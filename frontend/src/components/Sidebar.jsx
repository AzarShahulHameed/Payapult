// frontend/src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV, C } from '../constants';
import useStore from '../store/useStore';

export default function Sidebar() {
  const { user, logout } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [hov, setHov] = useState(null);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` : 'U';

  return (
    <aside style={{ width: 220, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: '16px 10px', overflowY: 'auto' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px', borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
        <svg width={32} height={32} viewBox="0 0 40 40" fill="none">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#5BA4D4"/><stop offset="1" stopColor="#0B2545"/></linearGradient></defs>
          <ellipse cx="20" cy="20" rx="19" ry="19" fill="url(#lg)"/>
          <path d="M8 28 Q20 6 32 28" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <circle cx="20" cy="22" r="3.5" fill="white"/>
          <path d="M14 28 L20 22 L26 28" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: C.navy, letterSpacing: -0.5 }}>Payapult</span>
      </div>

      {/* Nav */}
      {NAV.map(item => {
        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        const isHov = hov === item.id;
        return (
          <button key={item.id} onClick={() => navigate(item.path)}
            onMouseEnter={() => setHov(item.id)} onMouseLeave={() => setHov(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 2,
              background: active ? C.navy : isHov ? C.iceLight : 'transparent',
              color: active ? C.white : C.textPrimary,
              fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: active ? 600 : 400,
              transform: isHov && !active ? 'translateX(3px)' : 'none',
              transition: 'all 0.15s ease',
              boxShadow: active ? '0 4px 14px rgba(11,37,69,0.2)' : 'none',
            }}>
            <span style={{ fontSize: 16, transition: 'transform 0.2s', transform: isHov ? 'scale(1.2)' : 'none', display: 'inline-block' }}>{item.icon}</span>
            <span>{item.label}</span>
            {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: C.sky }} />}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* User footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: C.offWhite }}>
          {/* Avatar with photo support */}
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.navyMid},${C.sky})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.first_name} {user?.last_name}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'capitalize' }}>{user?.role?.replace(/_/g,' ')}</div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, padding: 2, flexShrink: 0 }}>↪</button>
        </div>
      </div>
    </aside>
  );
}
