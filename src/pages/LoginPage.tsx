import { LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

export function LoginPage(){const nav=useNavigate();const {signIn}=useAuth();const [email,setEmail]=useState('admin@example.co.th');const [password,setPassword]=useState('demo1234');const [error,setError]=useState('');const login=async()=>{try{await signIn(email,password);nav('/')}catch{setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')}}
 return <div className="login-page"><div className="login-brand"><img className="login-logo" src="/cm_logo.png" alt="โลโก้เชียงใหม่โฟรเซ่นฟูดส์"/><div><h1>ระบบจัดการสำนักงาน<br/>เชียงใหม่โฟรเซ่นฟูดส์</h1><p>จัดการวัสดุสำนักงานได้ง่าย ครบ และตรวจสอบได้</p></div></div><section className="login-card"><h2>เข้าสู่ระบบ</h2><p>ใช้บัญชีพนักงานของคุณเพื่อดำเนินการต่อ</p><label>อีเมล<div className="input-icon"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div></label><label>รหัสผ่าน<div className="input-icon"><LockKeyhole size={18}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div></label>{error&&<p className="form-error">{error}</p>}<button className="btn primary" onClick={login}>เข้าสู่ระบบ</button>{!isSupabaseConfigured&&<small className="demo-note">โหมดทดลอง: admin@example.co.th, staff@example.co.th หรือ viewer@example.co.th</small>}</section></div>}
