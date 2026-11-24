import {
  Boxes,
  Eye,
  EyeOff,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../store/AuthContext";

export function LoginPage() {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(isSupabaseConfigured ? "" : "admin@example.co.th");
  const [password, setPassword] = useState(isSupabaseConfigured ? "" : "demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !email.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      nav("/");
    } catch {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-header">
          <img className="login-logo" src="/cm_logo.png" alt="โลโก้เชียงใหม่โฟรเซ่นฟูดส์" />
          <div>
            <span className="login-company-tag">
              บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด (มหาชน) • CHIANGMAI FROZEN FOODS PCL.
            </span>
            <h1>ระบบจัดการสำนักงาน &amp; เอกสารองค์กร</h1>
            <p>จัดการวัสดุสำนักงาน คำขอเบิก และทะเบียนแรงงานต่างด้าวครบจบในระบบเดียว</p>
          </div>
        </div>

        <ul className="login-features-list">
          <li>
            <Boxes size={18} />
            <span>ระบบคลังพัสดุและเบิก-จ่ายอัจฉริยะ</span>
          </li>
          <li>
            <FileCheck2 size={18} />
            <span>ระบบติดตามต่อภาษีและเอกสารแรงงานต่างด้าว</span>
          </li>
          <li>
            <ShieldCheck size={18} />
            <span>แจ้งเตือนวันครบกำหนดและตรวจสอบย้อนหลังได้ 100%</span>
          </li>
        </ul>
      </div>

      <form className="login-card" onSubmit={login}>
        <h2>เข้าสู่ระบบ</h2>
        <p>ใช้บัญชีพนักงานของคุณเพื่อดำเนินการต่อ</p>

        <label>
          อีเมล
          <div className="input-icon">
            <Mail size={18} />
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@cmfrozen.com"
              autoFocus
            />
          </div>
        </label>

        <label>
          รหัสผ่าน
          <div className="input-icon">
            <LockKeyhole size={18} />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="ระบุรหัสผ่านของคุณ"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="btn primary"
          type="submit"
          disabled={submitting || !email.trim() || !password}
        >
          {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        {!isSupabaseConfigured && (
          <small className="demo-note">
            โหมดทดลอง: admin@example.co.th, staff@example.co.th หรือ issuer@example.co.th
          </small>
        )}
      </form>
    </div>
  );
}
