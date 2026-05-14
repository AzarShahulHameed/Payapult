// frontend/src/pages/Loans.jsx
import { useState, useEffect } from 'react';
import { loansAPI, employeesAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Badge, Modal, Input, Select, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id:'', amount:'', tenure_months:'', reason:'', currency:'AED' });
  const [saving, setSaving] = useState(false);

  const fetchLoans = async () => {
    setLoading(true);
    try { const r = await loansAPI.list(); setLoans(r.data.data); } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchLoans();
    employeesAPI.list({ limit: 100 }).then(r => setEmployees(r.data.data.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await loansAPI.create(form); toast.success('Loan created!'); setShowModal(false); fetchLoans(); }
    catch (_) {} finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try { await loansAPI.approve(id); toast.success('Loan approved & schedule generated!'); fetchLoans(); } catch (_) {}
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const fmt = n => parseFloat(n || 0).toLocaleString();

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle actions={<Btn onClick={() => setShowModal(true)}>+ New Loan</Btn>}>Loans</SectionTitle>
      {loans.map(l => (
        <Card key={l.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{l.emp_name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{l.loan_number}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {l.status === 'pending' && <Btn size="sm" variant="success" onClick={() => handleApprove(l.id)}>Approve</Btn>}
              <Badge status={l.status}/>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 12 }}>
            {[['Loan Amount', `${l.currency} ${fmt(l.amount)}`], ['Outstanding', `${l.currency} ${fmt(l.remaining)}`], ['Monthly EMI', `${l.currency} ${fmt(l.emi_amount)}`], ['Paid', `${l.paid_count}/${l.tenure_months} mo`], ['Reason', l.reason || '—']].map(([k, v]) => (
              <div key={k} style={{ background: C.offWhite, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
              <span>Repayment Progress</span><span>{Math.round((l.paid_count / l.tenure_months) * 100)}%</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${Math.round((l.paid_count / l.tenure_months) * 100)}%`, background: l.status === 'closed' ? C.success : C.sky, borderRadius: 3 }}/>
            </div>
          </div>
        </Card>
      ))}
      {!loans.length && <Card><div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>No loans found</div></Card>}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Loan">
        <Select label="Employee" value={form.employee_id} onChange={set('employee_id')} options={employees} required />
        <Input label="Loan Amount" type="number" value={form.amount} onChange={set('amount')} required />
        <Input label="Tenure (months)" type="number" value={form.tenure_months} onChange={set('tenure_months')} required />
        <Select label="Currency" value={form.currency} onChange={set('currency')} options={['AED','USD','GBP','EUR'].map(c => ({ value: c, label: c }))} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5 }}>Reason</label>
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Loan'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
