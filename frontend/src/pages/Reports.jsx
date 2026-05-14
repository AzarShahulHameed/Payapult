// frontend/src/pages/Reports.jsx
import { useState, useEffect, useRef } from 'react';
import { analyticsAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

const YEARS = [2026, 2025, 2024, 2023].map(y => ({ value: String(y), label: String(y) }));
const MONTHS = [
  { value: '', label: 'All months' },
  ...['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => ({ value: String(i + 1), label: m })),
];

const REPORT_TYPES = [
  { id: 'payroll-detail', label: 'Payroll Detail',  icon: '💳', desc: 'Full payroll breakdown per employee' },
  { id: 'leave-summary',  label: 'Leave Summary',   icon: '🗓', desc: 'Leave entitlements & balances' },
  { id: 'loan-status',    label: 'Loan Status',     icon: '🏦', desc: 'Outstanding loans & repayments' },
  { id: 'headcount-tree', label: 'Org Chart Tree',  icon: '🌳', desc: 'Decomposition tree by dept/role' },
];

const fmt = n => parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 });

// ─── Decomposition Tree ──────────────────────────────────────
function buildTree(employees, groupBy) {
  if (!employees?.length) return null;
  const groups = {};
  employees.forEach(e => {
    const key = (groupBy === 'dept' ? e.department : e.designation) || '(Unassigned)';
    if (!groups[key]) groups[key] = { name: key, children: [], totalSalary: 0 };
    groups[key].children.push(e);
    groups[key].totalSalary += parseFloat(e.base_salary || 0);
  });
  return {
    name: 'Organization',
    totalSalary: employees.reduce((a, e) => a + parseFloat(e.base_salary || 0), 0),
    children: Object.values(groups).sort((a, b) => b.children.length - a.children.length),
  };
}

function TreeNode({ node, depth = 0, expanded, onToggle, nodeId }) {
  const isRoot = depth === 0;
  const isGroup = depth === 1;
  const isExpanded = expanded.has(nodeId);
  const hasChildren = node.children?.length > 0;

  const getBg = () => {
    if (isRoot) return C.navy;
    if (isGroup) return C.steel;
    return C.white;
  };
  const getColor = () => (isRoot || isGroup) ? '#fff' : C.navy;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Node box */}
        <div
          onClick={() => hasChildren && onToggle(nodeId)}
          style={{
            background: getBg(),
            color: getColor(),
            border: `2px solid ${isRoot || isGroup ? 'transparent' : C.border}`,
            borderRadius: 12,
            padding: isRoot ? '14px 24px' : isGroup ? '10px 18px' : '8px 14px',
            minWidth: isRoot ? 220 : isGroup ? 180 : 160,
            maxWidth: isRoot ? 300 : 220,
            textAlign: 'center',
            cursor: hasChildren ? 'pointer' : 'default',
            boxShadow: isRoot ? '0 4px 20px rgba(11,37,69,0.25)' : isGroup ? '0 2px 10px rgba(46,109,164,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            userSelect: 'none',
          }}
        >
          {isRoot && <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>ORGANIZATION</div>}
          {isGroup && <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {node.children?.length} employees
          </div>}
          <div style={{ fontWeight: 700, fontSize: isRoot ? 16 : isGroup ? 14 : 13 }}>{node.name}</div>
          {(isRoot || isGroup) && (
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>
              AED {(node.totalSalary / 1000).toFixed(0)}K/mo
            </div>
          )}
          {!isRoot && !isGroup && (
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{node.designation || node.department || ''}</div>
          )}
          {hasChildren && (
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{isExpanded ? '▲ collapse' : '▼ expand'}</div>
          )}
        </div>

        {/* Connector line down */}
        {hasChildren && isExpanded && (
          <div style={{ width: 2, height: 24, background: C.border }} />
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {/* horizontal connector line */}
          {node.children.length > 1 && (
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: C.border,
            }}/>
          )}
          {node.children.map((child, i) => {
            const childId = `${nodeId}-${i}`;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* vertical connector */}
                <div style={{ width: 2, height: 20, background: C.border }}/>
                <TreeNode
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  nodeId={childId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecompositionTree({ employees, groupBy }) {
  const tree = buildTree(employees, groupBy);
  const [expanded, setExpanded] = useState(new Set(['root']));

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!tree) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>No employee data</div>;

  return (
    <div style={{ overflowX: 'auto', padding: '20px 10px' }}>
      <div style={{ minWidth: 600, display: 'flex', justifyContent: 'center' }}>
        <TreeNode node={tree} depth={0} expanded={expanded} onToggle={toggle} nodeId="root" />
      </div>
    </div>
  );
}

// ─── Main Reports Component ──────────────────────────────────
export default function Reports() {
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('');
  const [treeGroupBy, setTreeGroupBy] = useState('dept');

  const runReport = async () => {
    if (!selected) return;
    setLoading(true);
    setData([]);
    try {
      const params = { year };
      if (month && selected === 'payroll-detail') params.month = month;
      const r = await analyticsAPI.report(selected, params);
      setData(r.data.data || []);
      if ((r.data.data || []).length === 0) toast('No data for selected filters', { icon: 'ℹ️' });
    } catch (_) {}
    finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${selected}-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const isTree = selected === 'headcount-tree';

  return (
    <div>
      <SectionTitle>Reports</SectionTitle>

      {/* ── Report type selector + Filters on top ── */}
      <Card style={{ marginBottom: 20 }}>
        {/* Report types row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: selected ? 20 : 0 }}>
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => { setSelected(r.id); setData([]); }} style={{
              padding: '10px 18px', borderRadius: 10,
              border: `2px solid ${selected === r.id ? C.navy : C.border}`,
              background: selected === r.id ? C.navy : C.white,
              color: selected === r.id ? C.white : C.textPrimary,
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div>{r.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{r.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Filters row */}
        {selected && !isTree && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div>
              <label style={lbl}>Year</label>
              <select value={year} onChange={e => setYear(e.target.value)} style={selStyle}>
                {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            {selected === 'payroll-detail' && (
              <div>
                <label style={lbl}>Month</label>
                <select value={month} onChange={e => setMonth(e.target.value)} style={selStyle}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}
            <Btn onClick={runReport} disabled={loading}>
              {loading ? 'Running…' : '▶ Run Report'}
            </Btn>
            {data.length > 0 && (
              <Btn variant="ghost" onClick={exportCSV}>⬇ Export CSV</Btn>
            )}
            {data.length > 0 && (
              <span style={{ fontSize: 12, color: C.textMuted, alignSelf: 'center' }}>{data.length} records</span>
            )}
          </div>
        )}

        {/* Tree filters */}
        {isTree && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div>
              <label style={lbl}>Group By</label>
              <select value={treeGroupBy} onChange={e => setTreeGroupBy(e.target.value)} style={selStyle}>
                <option value="dept">Department</option>
                <option value="designation">Designation</option>
              </select>
            </div>
            <Btn onClick={runReport} disabled={loading}>
              {loading ? 'Loading…' : '▶ Load Tree'}
            </Btn>
          </div>
        )}
      </Card>

      {loading && <Spinner />}

      {/* Decomposition Tree */}
      {!loading && isTree && data.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 16, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🌳 Org Chart — Decomposition Tree</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>Group by:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['dept', 'designation'].map(g => (
                  <button key={g} onClick={() => setTreeGroupBy(g)} style={{
                    padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${treeGroupBy === g ? C.navy : C.border}`,
                    background: treeGroupBy === g ? C.navy : C.white, color: treeGroupBy === g ? C.white : C.textPrimary,
                    fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                    textTransform: 'capitalize',
                  }}>{g === 'dept' ? 'Department' : 'Designation'}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Employees', value: data.length },
              { label: 'Total Monthly Payroll', value: `AED ${(data.reduce((a, e) => a + parseFloat(e.base_salary || 0), 0) / 1000).toFixed(0)}K` },
              { label: 'Departments', value: [...new Set(data.map(e => e.department).filter(Boolean))].length },
              { label: 'Active', value: data.filter(e => e.status === 'active').length },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 130, background: C.offWhite, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 16 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <DecompositionTree employees={data} groupBy={treeGroupBy} />
        </Card>
      )}

      {/* Tabular results */}
      {!loading && !isTree && data.length > 0 && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
              <thead>
                <tr style={{ background: C.offWhite }}>
                  {getHeaders(selected).map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.offWhite}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {renderRow(row, selected)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!selected && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 6 }}>Select a report type above</div>
            <div style={{ fontSize: 13 }}>Choose payroll, leave, loan reports or the org chart decomposition tree</div>
          </div>
        </Card>
      )}
    </div>
  );
}

function getHeaders(type) {
  if (type === 'payroll-detail') return ['Employee', 'Dept', 'Designation', 'Gross', 'Deductions', 'Loan Ded.', 'Adv. Ded.', 'Net', 'CCY', 'Period'];
  if (type === 'leave-summary')  return ['Employee', 'Dept', 'Leave Type', 'Entitled', 'Used', 'Pending', 'Balance'];
  if (type === 'loan-status')    return ['Loan #', 'Employee', 'Code', 'Total', 'EMI', 'Tenure', 'Paid', 'Outstanding', 'Status'];
  return [];
}

function renderRow(row, type) {
  const td = (content, style = {}) => (
    <td style={{ padding: '11px 14px', ...style }}>{content}</td>
  );
  if (type === 'payroll-detail') return <>
    {td(row.emp_name, { fontWeight: 600 })}
    {td(row.department, { color: C.textMuted })}
    {td(row.designation, { color: C.textMuted })}
    {td(fmt(row.gross_salary))}
    {td(`-${fmt(row.total_deductions)}`, { color: C.danger })}
    {td(`-${fmt(row.loan_deduction)}`, { color: C.warning })}
    {td(`-${fmt(row.advance_deduction)}`, { color: C.warning })}
    {td(fmt(row.net_salary), { fontWeight: 700, color: C.success })}
    {td(row.currency)}
    {td(row.period_start?.split('T')[0], { color: C.textMuted, fontSize: 11 })}
  </>;
  if (type === 'leave-summary') return <>
    {td(row.emp_name, { fontWeight: 600 })}
    {td(row.department, { color: C.textMuted })}
    {td(row.leave_type, { textTransform: 'capitalize' })}
    {td(`${row.entitled_days}d`)}
    {td(`${row.used_days}d`, { color: C.danger })}
    {td(`${row.pending_days}d`, { color: C.warning })}
    {td(`${row.balance}d`, { fontWeight: 700, color: row.balance > 0 ? C.success : C.danger })}
  </>;
  if (type === 'loan-status') return <>
    {td(row.loan_number, { fontFamily: 'monospace', fontSize: 11 })}
    {td(row.emp_name, { fontWeight: 600 })}
    {td(row.employee_code, { color: C.textMuted })}
    {td(fmt(row.amount))}
    {td(fmt(row.emi_amount))}
    {td(`${row.tenure_months}mo`)}
    {td(fmt(row.paid), { color: C.success })}
    {td(fmt(row.outstanding), { fontWeight: 700, color: C.danger })}
    {td(row.status, { textTransform: 'capitalize' })}
  </>;
  return null;
}

const lbl = { fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5, fontFamily: "'Inter', sans-serif" };
const selStyle = { padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.textPrimary, background: 'white', fontFamily: "'Inter', sans-serif" };
