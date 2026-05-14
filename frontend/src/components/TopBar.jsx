// frontend/src/components/TopBar.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { C, NAV } from '../constants';
import useStore from '../store/useStore';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useStore();
  const current = NAV.find(n => location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path)));
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` : 'U';

  return (
    <div style={{ height: 56, borderBottom: `1px solid ${C.border}`, background: C.white, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0 }}>
      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>
        {current?.icon} {current?.label || 'Payapult'}
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {user?.org_name && <span style={{ fontSize: 12, color: C.textMuted }}>{user.org_name}</span>}
        <div style={{ height: 18, width: 1, background: C.border }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>{user?.timezone || 'Asia/Dubai'}</span>
        {/* Avatar */}
        <div onClick={() => navigate('/settings/profile')} style={{ cursor: 'pointer' }} title="My Profile">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.border}` }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${C.navyMid},${C.sky})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {initials}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
