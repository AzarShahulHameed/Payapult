// frontend/src/pages/Payslips.jsx — Full payslip view with company branding
import { useState, useEffect } from 'react';
import { employeesAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Table, Td, Spinner } from '../components/UI';
import useStore from '../store/useStore';

function PayslipPrint({ slip, onClose }) {
  const fmt = n => parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const components = Array.isArray(slip.components) ? slip.components : (typeof slip.components === 'string' ? JSON.parse(slip.components || '[]') : []);
  const earnings = components.filter(c => c.type === 'earning' || c.type === 'benefit');
  const deductions = components.filter(c => c.type === 'deduction');

  const print = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
      body{padding:30px;color:#111}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0B2545}
      .company{display:flex;align-items:center;gap:14px}
      .company img{height:52px;width:auto;object-fit:contain}
      .company-name{font-size:20px;font-weight:700;color:#0B2545}
      .company-detail{font-size:11px;color:#666;margin-top:3px}
      .slip-title{text-align:right}
      .slip-title h1{font-size:22px;font-weight:700;color:#0B2545}
      .slip-title p{font-size:12px;color:#666;margin-top:2px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#F4F7FB;padding:16px;border-radius:8px;margin-bottom:20px}
      .meta-item label{font-size:10px;color:#666;font-weight:600;text-transform:uppercase;display:block;margin-bottom:2px}
      .meta-item span{font-size:13px;font-weight:600;color:#0B2545}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#0B2545;color:white;padding:8px 12px;text-align:left;font-size:12px}
      td{padding:7px 12px;font-size:12px;border-bottom:1px solid #eee}
      .total-row td{font-weight:700;background:#f9fafb;border-top:2px solid #0B2545}
      .net-box{background:#0B2545;color:white;padding:14px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:4px}
      .net-box .label{font-size:13px}
      .net-box .amount{font-size:22px;font-weight:700}
      .footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center}
      .earned{color:#1EA97C;font-weight:600} .deduct{color:#E63946;font-weight:600}
      @media print{body{padding:20px}}
    </style></head><body>
      <div class="header">
        <div class="company">
          ${slip.logo_url ? `<img src="${slip.logo_url}" alt="Logo" />` : ''}
          <div>
            <div class="company-name">${slip.org_name || ''}</div>
            <div class="company-detail">${slip.legal_name ? `Legal: ${slip.legal_name}` : ''}${slip.trade_license ? ` · TL: ${slip.trade_license}` : ''}</div>
            <div class="company-detail">${slip.org_phone || ''} ${slip.org_email ? '· ' + slip.org_email : ''}</div>
          </div>
        </div>
        <div class="slip-title">
          <h1>Payslip</h1>
          <p>Period: ${slip.period_start?.split('T')[0]} – ${slip.period_end?.split('T')[0]}</p>
          <p>Pay Date: ${slip.pay_date?.split('T')[0]}</p>
        </div>
      </div>
      <div class="meta">
        <div class="meta-item"><label>Employee</label><span>${slip.first_name} ${slip.last_name}</span></div>
        <div class="meta-item"><label>Employee Code</label><span>${slip.employee_code}</span></div>
        <div class="meta-item"><label>Department</label><span>${slip.dept_name || '—'}</span></div>
        <div class="meta-item"><label>Designation</label><span>${slip.designation_name || '—'}</span></div>
        ${slip.bank_name ? `<div class="meta-item"><label>Bank</label><span>${slip.bank_name}</span></div>` : ''}
        ${slip.bank_account_no ? `<div class="meta-item"><label>Account</label><span>${slip.bank_account_no}</span></div>` : ''}
      </div>
      ${earnings.length > 0 ? `<table>
        <tr><th>Earnings</th><th style="text-align:right">Amount (${slip.currency || 'AED'})</th></tr>
        ${earnings.map(c => `<tr><td>${c.name}</td><td style="text-align:right" class="earned">${fmt(c.amount)}</td></tr>`).join('')}
        <tr class="total-row"><td>Total Earnings</td><td style="text-align:right">${fmt(slip.total_earnings)}</td></tr>
      </table>` : `<table><tr><th>Gross Salary</th><th style="text-align:right">Amount (${slip.currency || 'AED'})</th></tr>
        <tr><td>Base Salary</td><td style="text-align:right" class="earned">${fmt(slip.gross_salary)}</td></tr></table>`}
      ${(deductions.length > 0 || parseFloat(slip.loan_deduction || 0) > 0 || parseFloat(slip.advance_deduction || 0) > 0) ? `<table>
        <tr><th>Deductions</th><th style="text-align:right">Amount (${slip.currency || 'AED'})</th></tr>
        ${deductions.map(c => `<tr><td>${c.name}</td><td style="text-align:right" class="deduct">- ${fmt(c.amount)}</td></tr>`).join('')}
        ${parseFloat(slip.loan_deduction || 0) > 0 ? `<tr><td>Loan Repayment</td><td style="text-align:right" class="deduct">- ${fmt(slip.loan_deduction)}</td></tr>` : ''}
        ${parseFloat(slip.advance_deduction || 0) > 0 ? `<tr><td>Advance Recovery</td><td style="text-align:right" class="deduct">- ${fmt(slip.advance_deduction)}</td></tr>` : ''}
        <tr class="total-row"><td>Total Deductions</td><td style="text-align:right">- ${fmt(slip.total_deductions)}</td></tr>
      </table>` : ''}
      <div class="net-box">
        <span class="label">Net Salary</span>
        <span class="amount">${slip.currency || 'AED'} ${fmt(slip.net_salary)}</span>
      </div>
      ${slip.payslip_footer ? `<div class="footer">${slip.payslip_footer}</div>` : ''}
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {slip.logo_url && <img src={slip.logo_url} alt="" style={{ height: 36, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{slip.org_name}</div>
              {slip.trade_license && <div style={{ fontSize: 11, color: C.textMuted }}>TL: {slip.trade_license}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn onClick={print}>🖨 Print / PDF</Btn>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted }}>×</button>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          {/* Employee info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              ['Employee', `${slip.first_name} ${slip.last_name}`],
              ['Code', slip.employee_code],
              ['Department', slip.dept_name || '—'],
              ['Designation', slip.designation_name || '—'],
              ['Period', `${slip.period_start?.split('T')[0]} → ${slip.period_end?.split('T')[0]}`],
              ['Pay Date', slip.pay_date?.split('T')[0]],
            ].map(([k,v]) => (
              <div key={k} style={{ background: C.offWhite, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 1 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Earnings */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 8 }}>Earnings</div>
            {earnings.length > 0 ? earnings.map((c,i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span>{c.name}</span><span style={{ fontWeight: 600, color: C.success }}>{slip.currency} {parseFloat(c.amount || 0).toLocaleString()}</span>
              </div>
            )) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span>Base Salary</span><span style={{ fontWeight: 600, color: C.success }}>{slip.currency} {parseFloat(slip.gross_salary || 0).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Deductions */}
          {(parseFloat(slip.total_deductions || 0) > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 8 }}>Deductions</div>
              {deductions.map((c,i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <span>{c.name}</span><span style={{ fontWeight: 600, color: C.danger }}>- {slip.currency} {parseFloat(c.amount || 0).toLocaleString()}</span>
                </div>
              ))}
              {parseFloat(slip.loan_deduction || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <span>Loan Repayment</span><span style={{ fontWeight: 600, color: C.danger }}>- {slip.currency} {parseFloat(slip.loan_deduction).toLocaleString()}</span>
                </div>
              )}
              {parseFloat(slip.advance_deduction || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <span>Advance Recovery</span><span style={{ fontWeight: 600, color: C.danger }}>- {slip.currency} {parseFloat(slip.advance_deduction).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Net */}
          <div style={{ background: C.navy, borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ color: C.sky, fontWeight: 600, fontSize: 14 }}>Net Salary</span>
            <span style={{ color: C.white, fontWeight: 800, fontSize: 22 }}>{slip.currency || 'AED'} {parseFloat(slip.net_salary || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
          </div>

          {slip.payslip_footer && (
            <div style={{ marginTop: 16, fontSize: 11, color: C.textMuted, textAlign: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>{slip.payslip_footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Payslips() {
  const { user } = useStore();
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    employeesAPI.list({ limit: 200 }).then(r => setEmployees(r.data.data || []));
  }, []);

  const loadPayslips = async (empId) => {
    setSelectedEmp(empId);
    if (!empId) { setPayslips([]); return; }
    setLoading(true);
    try {
      const r = await employeesAPI.payslips(empId);
      setPayslips(r.data.data || []);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <SectionTitle>Payslips</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5 }}>Select Employee</label>
            <select value={selectedEmp} onChange={e => loadPayslips(e.target.value)}
              style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', minWidth: 260 }}>
              <option value="">— Choose employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
            </select>
          </div>
        </div>
      </Card>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading payslips…</div> : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Period', 'Pay Date', 'Gross', 'Deductions', 'Net', 'Currency', 'Action']}
            rows={payslips}
            emptyMsg={selectedEmp ? 'No payslips found' : 'Select an employee above'}
            renderRow={slip => (<>
              <Td style={{ fontWeight: 600 }}>{slip.period_start?.split('T')[0]} – {slip.period_end?.split('T')[0]}</Td>
              <Td>{slip.pay_date?.split('T')[0]}</Td>
              <Td>{parseFloat(slip.gross_salary || 0).toLocaleString()}</Td>
              <Td style={{ color: C.danger }}>- {parseFloat(slip.total_deductions || 0).toLocaleString()}</Td>
              <Td style={{ fontWeight: 700, color: C.success }}>{parseFloat(slip.net_salary || 0).toLocaleString()}</Td>
              <Td>{slip.currency || 'AED'}</Td>
              <Td>
                <Btn size="sm" onClick={() => setViewing(slip)}>View / Print</Btn>
              </Td>
            </>)}
          />
        </Card>
      )}

      {viewing && <PayslipPrint slip={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
