import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const roles = new Set(['admin', 'staff', 'viewer'])
const departments = new Set(['EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE'])
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!url || !anonKey || !serviceKey || !authorization) return json({ error: 'Unauthorized' }, 401)

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) return json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, 401)

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles').select('role,is_active').eq('id', callerData.user.id).single()
    if (profileError || callerProfile?.role !== 'admin' || !callerProfile?.is_active) {
      return json({ error: 'ไม่มีสิทธิ์จัดการผู้ใช้งาน' }, 403)
    }

    const body = await request.json()
    const action = String(body?.action ?? '')

    if (action === 'list') {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) throw authError
      const { data: profiles, error } = await admin
        .from('profiles').select('id,full_name,employee_code,department,role,is_active').order('full_name')
      if (error) throw error
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
      const users = authData.users.map((authUser) => {
        const profile = profileMap.get(authUser.id)
        return {
          id: authUser.id,
          email: authUser.email ?? '',
          name: profile?.full_name ?? authUser.user_metadata?.full_name ?? authUser.email ?? 'ผู้ใช้งาน',
          code: profile?.employee_code ?? '',
          department: profile?.department ?? '',
          role: profile?.role ?? 'viewer',
          active: profile?.is_active ?? true,
          lastSignInAt: authUser.last_sign_in_at ?? null,
        }
      })
      return json({ users })
    }

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const fullName = String(body.name ?? '').trim()
      const employeeCode = String(body.code ?? '').trim()
      const department = String(body.department ?? '')
      const role = String(body.role ?? '')
      if (!email || !email.includes('@') || password.length < 8 || !fullName || !employeeCode || !departments.has(department) || !roles.has(role)) {
        return json({ error: 'ข้อมูลผู้ใช้งานไม่ครบหรือไม่ถูกต้อง' }, 400)
      }
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, employee_code: employeeCode, department },
      })
      if (createError || !created.user) throw createError ?? new Error('สร้างบัญชีไม่สำเร็จ')
      const { error: saveError } = await admin.from('profiles').upsert({
        id: created.user.id,
        full_name: fullName,
        employee_code: employeeCode,
        department,
        role,
        is_active: true,
      })
      if (saveError) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw saveError
      }
      await admin.from('audit_logs').insert({
        table_name: 'profiles', record_id: created.user.id, action: 'INSERT', actor_id: callerData.user.id,
        new_data: { email, full_name: fullName, employee_code: employeeCode, department, role, is_active: true },
        event_type: 'USER_CREATE', title: fullName, detail: `สร้างผู้ใช้งาน ${employeeCode}`,
      })
      return json({ ok: true })
    }

    if (action === 'update') {
      const id = String(body.id ?? '')
      const fullName = String(body.name ?? '').trim()
      const employeeCode = String(body.code ?? '').trim()
      const department = String(body.department ?? '')
      const role = String(body.role ?? '')
      if (!id || !fullName || !employeeCode || !departments.has(department) || !roles.has(role)) {
        return json({ error: 'ข้อมูลผู้ใช้งานไม่ครบหรือไม่ถูกต้อง' }, 400)
      }
      if (id === callerData.user.id && role !== 'admin') return json({ error: 'ไม่สามารถลดสิทธิ์บัญชีของตนเองได้' }, 400)
      const { data: target, error: targetError } = await admin.from('profiles').select('role,is_active').eq('id', id).single()
      if (targetError) throw targetError
      if (target.role === 'admin' && role !== 'admin') {
        const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin').eq('is_active', true)
        if ((count ?? 0) <= 1) return json({ error: 'ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อย 1 คน' }, 400)
      }
      const { error } = await admin.from('profiles').update({
        full_name: fullName, employee_code: employeeCode, department, role,
      }).eq('id', id)
      if (error) throw error
      await admin.auth.admin.updateUserById(id, { user_metadata: { full_name: fullName, employee_code: employeeCode, department } })
      await admin.from('audit_logs').insert({
        table_name: 'profiles', record_id: id, action: 'UPDATE', actor_id: callerData.user.id,
        new_data: { full_name: fullName, employee_code: employeeCode, department, role },
        event_type: 'USER_UPDATE', title: fullName, detail: `แก้ไขผู้ใช้งาน ${employeeCode}`,
      })
      return json({ ok: true })
    }

    if (action === 'set-active') {
      const id = String(body.id ?? '')
      const active = Boolean(body.active)
      if (!id) return json({ error: 'ไม่พบผู้ใช้งาน' }, 400)
      if (id === callerData.user.id && !active) return json({ error: 'ไม่สามารถระงับบัญชีของตนเองได้' }, 400)
      const { data: target, error: targetError } = await admin.from('profiles').select('full_name,role,is_active').eq('id', id).single()
      if (targetError) throw targetError
      if (target.role === 'admin' && !active) {
        const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin').eq('is_active', true)
        if ((count ?? 0) <= 1) return json({ error: 'ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายได้' }, 400)
      }
      const { error: updateError } = await admin.from('profiles').update({ is_active: active }).eq('id', id)
      if (updateError) throw updateError
      const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
      if (authError) {
        await admin.from('profiles').update({ is_active: target.is_active }).eq('id', id)
        throw authError
      }
      await admin.from('audit_logs').insert({
        table_name: 'profiles', record_id: id, action: 'UPDATE', actor_id: callerData.user.id,
        new_data: { is_active: active }, event_type: active ? 'USER_ENABLE' : 'USER_DISABLE',
        title: target.full_name, detail: active ? 'เปิดใช้งานผู้ใช้' : 'ระงับผู้ใช้งาน',
      })
      return json({ ok: true })
    }

    return json({ error: 'ไม่รู้จักคำสั่งนี้' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการจัดการผู้ใช้งาน'
    return json({ error: message }, 400)
  }
})
