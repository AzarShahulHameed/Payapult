// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0B2545 0%,#1B3A6B 50%,#2E6DA4 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 44px', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#5BA4D4"/><stop offset="1" stopColor="#0B2545"/></linearGradient></defs>
            <ellipse cx={20} cy={20} rx={19} ry={19} fill="url(#lg)"/>
            <path d="M8 28 Q20 6 32 28" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <circle cx={20} cy={22} r={3.5} fill="white"/>
            <path d="M14 28 L20 22 L26 28" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 26, color: '#0B2545', letterSpacing: -0.5 }}>Payapult</span>
        </div>

        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: '#0B2545', marginBottom: 6 }}>Sign in to your workspace</h1>
        <p style={{ color: '#5A7A99', fontSize: 14, marginBottom: 28 }}>Payroll made simple, for every timezone.</p>

        <form onSubmit={handleSubmit}>
          {[{ label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'you@company.com' },
            { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••' }
          ].map(({ label, value, set, type, placeholder }) => (
            <div key={label} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0B2545', marginBottom: 6 }}>{label}</label>
              <input
                type={type} value={value} placeholder={placeholder}
                onChange={e => set(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #D9E4EF', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0B2545' }}
                onFocus={e => e.target.style.borderColor = '#2E6DA4'}
                onBlur={e => e.target.style.borderColor = '#D9E4EF'}
              />
            </div>
          ))}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#0B2545,#2E6DA4)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.8 : 1, marginTop: 8, letterSpacing: 0.3,
            transition: 'opacity 0.2s',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 12, color: '#5A7A99', textAlign: 'center' }}>
          Demo: admin@payapult.com / Admin@123
        </p>
      </div>
    </div>
  );
}
