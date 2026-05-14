// frontend/src/components/UI.jsx
import { C } from '../constants';

export const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
    padding: '20px 22px', boxShadow: '0 1px 4px rgba(11,37,69,0.04)',
    cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.2s', ...style,
  }}>{children}</div>
);

export const Stat = ({ label, value, sub, color }) => (
  <Card style={{ flex: 1, minWidth: 140 }}>
    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, fontWeight: 500 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: color || C.navy, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
  </Card>
);

export const Badge = ({ status }) => {
  const map = {
    active: { bg: '#E6F9F3', color: C.success },
    paid: { bg: '#E6F9F3', color: C.success },
    approved: { bg: '#E6F9F3', color: C.success },
    on_leave: { bg: '#FFF3E0', color: C.warning },
    draft: { bg: '#EFF6FF', color: C.steel },
    pending: { bg: '#FFF3E0', color: C.warning },
    processing: { bg: '#EFF6FF', color: C.steel },
    rejected: { bg: '#FFF0F0', color: C.danger },
    cancelled: { bg: '#F3F4F6', color: C.textMuted },
    closed: { bg: '#F3F4F6', color: C.textMuted },
    terminated: { bg: '#FFF0F0', color: C.danger },
    probation: { bg: '#FFF3E0', color: C.warning },
    defaulted: { bg: '#FFF0F0', color: C.danger },
    recovered: { bg: '#E6F9F3', color: C.success },
  };
  const key = (status || '').toLowerCase().replace(/ /g, '_');
  const s = map[key] || { bg: '#F3F4F6', color: C.textMuted };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
};

export const SectionTitle = ({ children, actions }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
    <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>{children}</h2>
    {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
  </div>
);

export const Btn = ({ children, onClick, variant = 'primary', disabled, size = 'md', type = 'button' }) => {
  const sizes = { sm: '6px 12px', md: '9px 18px', lg: '11px 24px' };
  const variants = {
    primary: { background: C.navy, color: '#fff', border: 'none' },
    secondary: { background: C.offWhite, color: C.textPrimary, border: `1px solid ${C.border}` },
    success: { background: C.success, color: '#fff', border: 'none' },
    danger: { background: C.danger, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: C.steel, border: `1px solid ${C.steel}` },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...v, padding: sizes[size], borderRadius: 8, fontSize: size === 'sm' ? 12 : 13,
      fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      fontFamily: "'Inter', -apple-system, sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
};

export const Input = ({ label, type = 'text', value, onChange, placeholder, required, style = {} }) => (
  <div style={{ marginBottom: 14, ...style }}>
    {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>{label}{required && ' *'}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.textPrimary, boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = C.steel}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

export const Select = ({ label, value, onChange, options = [], required, style = {} }) => (
  <div style={{ marginBottom: 14, ...style }}>
    {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>{label}{required && ' *'}</label>}
    <select value={value} onChange={onChange} required={required}
      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.textPrimary, background: C.white, boxSizing: 'border-box' }}>
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const Table = ({ headers, rows, renderRow, loading, emptyMsg = 'No records found' }) => (
  <div style={{ overflowX: 'auto' }}>
    {loading && <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading…</div>}
    {!loading && (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: C.textMuted, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.length === 0 && (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>{emptyMsg}</td></tr>
          )}
          {rows?.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.offWhite}`, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = C.offWhite}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {renderRow(r)}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export const Td = ({ children, style = {} }) => (
  <td style={{ padding: '11px 12px', color: C.textPrimary, ...style }}>{children}</td>
);

export const Modal = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, width, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

export const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
    <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.steel, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 4, background: '#F0F4F8', padding: 4, borderRadius: 10, width: 'fit-content', marginBottom: 20 }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        background: active === t.id ? C.white : 'transparent',
        color: active === t.id ? C.navy : C.textMuted,
        boxShadow: active === t.id ? '0 1px 4px rgba(11,37,69,0.1)' : 'none',
        transition: 'all 0.2s', fontFamily: "'Inter', -apple-system, sans-serif",
      }}>{t.label}</button>
    ))}
  </div>
);
