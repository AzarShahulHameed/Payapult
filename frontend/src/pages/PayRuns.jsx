// frontend/src/pages/PayRuns.jsx
import { useState, useEffect } from 'react';
import { payRunsAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Badge, Table, Td, Modal, Input, Select, Stat, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

export default function PayRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ period_start: '', period_end: '', pay_date: '', currency: 'AED' });

  const fetchRuns = async () => {
    setLoading(true);
    try { const r = await payRunsAPI.list(); setRuns(r.data.data); } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await payRunsAPI.create(form);
      toast.success('Pay run created and calculated!');
      setShowModal(false);
      fetchRuns();
    } catch (_) {} finally { setSaving(false); }
  };

  const handleAction = async (run, action) => {
    try {
      if (action === 'approve') await payRunsAPI.approve(run.id);
      else if (action === 'paid') await payRunsAPI.markPaid(run.id);
      else if (action === 'cancel') await payRunsAPI.cancel(run.id);
      else if (action === 'recalculate') { await payRunsAPI.recalculate(run.id); toast.success('Pay run recalculated with latest data!'); }
      toast.success(`Pay run ${action === 'paid' ? 'marked as paid' : action + 'd'}!`);
      fetchRuns();
      setSel(null);
    } catch (_) {}
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const fmt = n => parseFloat(n || 0).toLocaleString();

  if (sel) return (
    <div>
      <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.steel, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>← Back to Pay Runs</button>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: C.navy }}>{sel.id?.slice(0, 8).toUpperCase()}</div>
            <div style={{ color: C.textMuted, fontSize: 13 }}>{sel.period_start?.split('T')[0]} → {sel.period_end?.split('T')[0]}</div>
          </div>
          <Badge status={sel.status}/>
        </div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 1, background: C.offWhite, borderRadius: 10, padding: '12px 16px' }}><div style={{ fontSize: 11, color: C.textMuted }}>Gross</div><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{sel.currency} {fmt(sel.total_gross)}</div></div>
          <div style={{ flex: 1, background: C.offWhite, borderRadius: 10, padding: '12px 16px' }}><div style={{ fontSize: 11, color: C.textMuted }}>Net</div><div style={{ fontSize: 20, fontWeight: 700, color: C.success }}>{sel.currency} {fmt(sel.total_net)}</div></div>
          <div style={{ flex: 1, background: C.offWhite, borderRadius: 10, padding: '12px 16px' }}><div style={{ fontSize: 11, color: C.textMuted }}>Deductions</div><div style={{ fontSize: 20, fontWeight: 700, color: C.danger }}>{sel.currency} {fmt(sel.total_deductions)}</div></div>
          <div style={{ flex: 1, background: C.offWhite, borderRadius: 10, padding: '12px 16px' }}><div style={{ fontSize: 11, color: C.textMuted }}>Employees</div><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{sel.employee_count}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {sel.status === 'draft' && <Btn variant="success" onClick={() => handleAction(sel, 'approve')}>Approve</Btn>}
          {['draft','approved'].includes(sel.status) && <Btn onClick={() => handleAction(sel, 'paid')}>Mark as Paid</Btn>}
          {['draft','approved'].includes(sel.status) && <Btn variant="secondary" onClick={() => handleAction(sel, 'recalculate')}>🔄 Recalculate</Btn>}
          {sel.status !== 'paid' && <Btn variant="danger" onClick={() => handleAction(sel, 'cancel')}>Cancel Run</Btn>}
        </div>
      </Card>
      {sel.items?.length > 0 && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', fontWeight: 700, color: C.navy, fontSize: 14 }}>Employee Breakdown</div>
          <Table
            headers={['Employee', 'Dept', 'Gross', 'Deductions', 'Loan', 'Advance', 'Net']}
            rows={sel.items}
            renderRow={r => (<>
              <Td style={{ fontWeight: 600 }}>{r.emp_name}</Td>
              <Td style={{ color: C.textMuted }}>{r.dept_name}</Td>
              <Td>{r.currency} {fmt(r.gross_salary)}</Td>
              <Td style={{ color: C.danger }}>-{fmt(r.total_deductions)}</Td>
              <Td style={{ color: C.warning }}>-{fmt(r.loan_deduction)}</Td>
              <Td style={{ color: C.warning }}>-{fmt(r.advance_deduction)}</Td>
              <Td style={{ fontWeight: 700, color: C.success }}>{r.currency} {fmt(r.net_salary)}</Td>
            </>)}
          />
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <SectionTitle actions={<Btn onClick={() => setShowModal(true)}>+ New Pay Run</Btn>}>Pay Runs</SectionTitle>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Period', 'Pay Date', 'Employees', 'Gross', 'Net', 'Status', 'Action']}
          rows={runs} loading={loading}
          renderRow={r => (<>
            <Td style={{ fontWeight: 600 }}>{r.period_start?.split('T')[0]} – {r.period_end?.split('T')[0]}</Td>
            <Td>{r.pay_date?.split('T')[0]}</Td>
            <Td>{r.employee_count}</Td>
            <Td>{r.currency} {fmt(r.total_gross)}</Td>
            <Td style={{ fontWeight: 700, color: C.success }}>{r.currency} {fmt(r.total_net)}</Td>
            <Td><Badge status={r.status}/></Td>
            <Td><Btn size="sm" onClick={async () => { const res = await payRunsAPI.get(r.id); setSel(res.data.data); }}>View</Btn></Td>
          </>)}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Pay Run">
        <Input label="Period Start" type="date" value={form.period_start} onChange={set('period_start')} required />
        <Input label="Period End" type="date" value={form.period_end} onChange={set('period_end')} required />
        <Input label="Pay Date" type="date" value={form.pay_date} onChange={set('pay_date')} required />
        <Select label="Currency" value={form.currency} onChange={set('currency')} options={['AED','USD','GBP','EUR'].map(c => ({ value: c, label: c }))} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={saving}>{saving ? 'Generating…' : 'Generate Pay Run'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
