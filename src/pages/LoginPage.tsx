import { LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

export function LoginPage(){
 const nav=useNavigate();const {signIn}=useAuth()
 const [email,setEmail]=useState(isSupabaseConfigured?'':'admin@example.co.th')
 const [password,setPassword]=useState(isSupabaseConfigured?'':'demo1234')
 const [error,setError]=useState('');const [submitting,setSubmitting]=useState(false)
 const login=async(event:FormEvent)=>{event.preventDefault();if(submitting||!email.trim()||!password)return;setSubmitting(true);setError('');try{await signIn(email,password);nav('/')}catch{setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ')}finally{setSubmitting(false)}}
 return <div className="login-page"><div className="login-brand"><img className="login-logo" src="/cm_logo.png" alt="โลโก้เชียงใหม่โฟรเซ่นฟูดส์"/><div><h1>ระบบจัดการสำนักงาน<br/>เชียงใหม่โฟรเซ่นฟูดส์</h1><p>จัดการวัสดุสำนักงานได้ง่าย ครบ และตรวจสอบได้</p></div></div><form className="login-card" onSubmit={login}><h2>เข้าสู่ระบบ</h2><p>ใช้บัญชีพนักงานของคุณเพื่อดำเนินการต่อ</p><label>อีเมล<div className="input-icon"><Mail size={18}/><input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} autoFocus/></div></label><label>รหัสผ่าน<div className="input-icon"><LockKeyhole size={18}/><input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></div></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary" type="submit" disabled={submitting||!email.trim()||!password}>{submitting?'กำลังเข้าสู่ระบบ...':'เข้าสู่ระบบ'}</button>{!isSupabaseConfigured&&<small className="demo-note">โหมดทดลอง: admin@example.co.th, staff@example.co.th หรือ viewer@example.co.th</small>}</form></div>
}
