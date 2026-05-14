// frontend/src/pages/Leave.jsx
import { useState, useEffect } from 'react';
import { leaveAPI, settingsAPI, employeesAPI } from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Badge, Table, Td, Modal, Input, Select, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

export default function Leave() {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id: '', policy_id: '', from_date: '', to_date: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([leaveAPI.list(), leaveAPI.balances()]);
      setRequests(r.data.data); setBalances(b.data.data);
    } catch (_) {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    Promise.all([settingsAPI.getLeavePolicies(), employeesAPI.list({ limit: 100 })]).then(([p, e]) => {
      setPolicies(p.data.data.map(x => ({ value: x.id, label: x.name })));
      setEmployees(e.data.data.map(x => ({ value: x.id, label: `${x.first_name} ${x.last_name}` })));
    });
  }, []);

  const handleApprove = async (id, action) => {
    try {
      if (action === 'approve') await leaveAPI.approve(id);
      else await leaveAPI.reject(id);
      toast.success(`Leave ${action}d`); fetchData();
    } catch (_) {}
  };

  const handleCreate = async () => {
    setSaving(true);
    try { await leaveAPI.create(form); toast.success('Leave request created'); setShowModal(false); fetchData(); }
    catch (_) {} finally { setSaving(false); }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <SectionTitle actions={<Btn onClick={() => setShowModal(true)}>+ Request Leave</Btn>}>Leave & Salary</SectionTitle>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 14, fontSize: 14 }}>Leave Balances</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {balances.slice(0, 8).map(b => (
            <div key={b.id} style={{ background: C.offWhite, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{b.emp_name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{b.policy_name}</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 3 }}>
                  <span>Balance</span><span style={{ fontWeight: 700, color: C.navy }}>{b.entitled_days - b.used_days - b.pending_days}d</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.min(((b.used_days + b.pending_days) / b.entitled_days) * 100, 100)}%`, background: C.sky, borderRadius: 2 }}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table loading={loading} headers={['Employee', 'Type', 'From', 'To', 'Days', 'Status', 'Actions']} rows={requests}
          renderRow={r => (<>
            <Td style={{ fontWeight: 600 }}>{r.emp_name}</Td>
            <Td>{r.leave_type}</Td>
            <Td>{r.from_date?.split('T')[0]}</Td>
            <Td>{r.to_date?.split('T')[0]}</Td>
            <Td style={{ fontWeight: 600 }}>{r.days}</Td>
            <Td><Badge status={r.status}/></Td>
            <Td>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="success" onClick={() => handleApprove(r.id, 'approve')}>Approve</Btn>
                  <Btn size="sm" variant="danger" onClick={() => handleApprove(r.id, 'reject')}>Reject</Btn>
                </div>
              )}
            </Td>
          </>)}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Leave">
        <Select label="Employee" value={form.employee_id} onChange={set('employee_id')} options={employees} required />
        <Select label="Leave Policy" value={form.policy_id} onChange={set('policy_id')} options={policies} required />
        <Input label="From Date" type="date" value={form.from_date} onChange={set('from_date')} required />
        <Input label="To Date" type="date" value={form.to_date} onChange={set('to_date')} required />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5 }}>Reason</label>
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Submit Request'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
