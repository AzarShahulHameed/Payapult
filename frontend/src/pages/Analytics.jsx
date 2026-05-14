// frontend/src/pages/Analytics.jsx
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { analyticsAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Spinner } from '../components/UI';

const PIE_COLORS = [C.sky, C.purple, C.success, C.warning, C.danger, '#FF6B6B', '#4ECDC4'];

const TABS = [
  { id: 'payroll',   label: 'Payroll Trend',  icon: '📈' },
  { id: 'dept',      label: 'Dept. Spend',    icon: '🏢' },
  { id: 'gender',    label: 'Gender Split',   icon: '👥' },
  { id: 'headcount', label: 'Headcount',      icon: '📊' },
];

const YEARS = [2026, 2025, 2024, 2023].map(y => String(y));

const fmt = v => `AED ${parseFloat(v || 0).toLocaleString()}`;
const fmtK = v => `${(v / 1000).toFixed(0)}K`;

export default function Analytics() {
  const [dash, setDash] = useState(null);
  const [headcount, setHeadcount] = useState(null);
  const [payrollDetail, setPayrollDetail] = useState(null);
  const [chart, setChart] = useState('payroll');
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [deptFilter, setDeptFilter] = useState('');

  useEffect(() => {
    Promise.all([
      analyticsAPI.dashboard(),
      analyticsAPI.headcount(),
    ]).then(([d, h]) => {
      setDash(d.data.data);
      setHeadcount(h.data.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (chart === 'payroll') {
      analyticsAPI.payroll({ year })
        .then(r => setPayrollDetail(r.data.data))
        .catch(() => {});
    }
  }, [chart, year]);

  const allDepts = [...new Set((dash?.deptSpend || []).map(d => d.dept).filter(Boolean))];
  const filteredDeptSpend = deptFilter
    ? (dash?.deptSpend || []).filter(d => d.dept === deptFilter)
    : (dash?.deptSpend || []);

  const trendData = (payrollDetail && payrollDetail.length > 0)
    ? payrollDetail.map(r => ({ ...r, month: r.mo || r.month }))
    : (dash?.monthlyTrend || []).map(r => ({ ...r, month: r.mo || r.month }));

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>Analytics</SectionTitle>

      {/* ── Tab filters on top ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setChart(t.id)} style={{
            padding: '8px 18px', borderRadius: 20,
            border: `1.5px solid ${chart === t.id ? C.navy : C.border}`,
            background: chart === t.id ? C.navy : C.white,
            color: chart === t.id ? C.white : C.textPrimary,
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}

        {/* Contextual filters */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {chart === 'payroll' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Year:</label>
              <select value={year} onChange={e => setYear(e.target.value)} style={selStyle}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {chart === 'dept' && allDepts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Department:</label>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={selStyle}>
                <option value="">All Departments</option>
                {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart panel ── */}
      <Card>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 20, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          {TABS.find(t => t.id === chart)?.icon} {TABS.find(t => t.id === chart)?.label}
        </div>

        {/* Payroll Trend */}
        {chart === 'payroll' && (
          trendData.length > 0 ? (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Gross (YTD)', value: fmt(trendData.reduce((a, r) => a + parseFloat(r.total_gross || 0), 0)) },
                  { label: 'Total Net (YTD)', value: fmt(trendData.reduce((a, r) => a + parseFloat(r.total_net || 0), 0)) },
                  { label: 'Avg Headcount', value: Math.round(trendData.reduce((a, r) => a + parseFloat(r.employee_count || r.headcount || 0), 0) / trendData.length) },
                  { label: 'Pay Runs', value: trendData.length },
                ].map(k => (
                  <div key={k.label} style={{ flex: 1, minWidth: 140, background: C.offWhite, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{k.label}</div>
                    <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.sky} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.success} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.success} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <Tooltip formatter={v => [fmt(v)]} contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: 'Inter', border: `1px solid ${C.border}` }}/>
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter' }}/>
                  <Area type="monotone" dataKey="total_gross" name="Gross" stroke={C.steel} strokeWidth={2.5} fill="url(#gradGross)"/>
                  <Area type="monotone" dataKey="total_net" name="Net" stroke={C.success} strokeWidth={2} fill="url(#gradNet)"/>
                </AreaChart>
              </ResponsiveContainer>
            </>
          ) : <EmptyState text="No payroll data for this year — run your first payroll!" />
        )}

        {/* Dept Spend */}
        {chart === 'dept' && (
          filteredDeptSpend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={filteredDeptSpend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <XAxis dataKey="dept" tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <Tooltip
                    formatter={(v, name) => [fmt(v), name === 'total_spend' ? 'Monthly Spend' : name]}
                    contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: 'Inter', border: `1px solid ${C.border}` }}
                  />
                  <Bar dataKey="total_spend" name="Monthly Spend" fill={C.sky} radius={[8, 8, 0, 0]}>
                    {filteredDeptSpend.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Dept table */}
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {['Department', 'Headcount', 'Monthly Spend', 'Avg per Head'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeptSpend.map((d, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.dept || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{d.headcount}</td>
                        <td style={{ padding: '10px 14px', color: C.navy, fontWeight: 700 }}>{fmt(d.total_spend)}</td>
                        <td style={{ padding: '10px 14px', color: C.textMuted }}>{fmt(d.headcount > 0 ? d.total_spend / d.headcount : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <EmptyState text="No department spend data yet" />
        )}

        {/* Gender Split */}
        {chart === 'gender' && (
          headcount?.byGender?.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={280} height={280}>
                <PieChart>
                  <Pie data={headcount.byGender} dataKey="count" nameKey="gender" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4}>
                    {headcount.byGender.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: 'Inter' }}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 200 }}>
                {headcount.byGender.map((d, i) => {
                  const total = headcount.byGender.reduce((a, x) => a + parseInt(x.count), 0);
                  const pct = total > 0 ? Math.round(parseInt(d.count) / total * 100) : 0;
                  return (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                          <span style={{ textTransform: 'capitalize', fontSize: 14, fontWeight: 600, color: C.navy }}>{d.gender?.replace(/_/g, ' ')}</span>
                        </div>
                        <div style={{ fontWeight: 700, color: C.navy }}>{d.count} <span style={{ color: C.textMuted, fontWeight: 400, fontSize: 12 }}>({pct}%)</span></div>
                      </div>
                      <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 3, transition: 'width 0.6s' }}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 20, padding: '12px 16px', background: C.offWhite, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Total Employees</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>
                    {headcount.byGender.reduce((a, d) => a + parseInt(d.count), 0)}
                  </div>
                </div>
              </div>
            </div>
          ) : <EmptyState text="No employee data yet" />
        )}

        {/* Headcount by dept */}
        {chart === 'headcount' && (
          headcount?.byDept?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={headcount.byDept} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <XAxis dataKey="dept" tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted, fontFamily: 'Inter' }} axisLine={false} tickLine={false}/>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: 'Inter', border: `1px solid ${C.border}` }}/>
                  <Bar dataKey="count" name="Headcount" radius={[8, 8, 0, 0]}>
                    {headcount.byDept.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {headcount.byStatus?.map((s, i) => (
                  <div key={i} style={{ padding: '8px 14px', borderRadius: 20, background: C.offWhite, fontSize: 13 }}>
                    <span style={{ textTransform: 'capitalize', color: C.textMuted }}>{s.status}: </span>
                    <span style={{ fontWeight: 700, color: C.navy }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState text="No employee data yet" />
        )}
      </Card>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{text}</div>
    </div>
  );
}

const selStyle = {
  padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: 13, outline: 'none', color: C.textPrimary, background: C.white,
  fontFamily: "'Inter', sans-serif", cursor: 'pointer',
};
