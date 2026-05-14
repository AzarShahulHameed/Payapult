// frontend/src/pages/Advances.jsx
import { useState, useEffect } from 'react'
import { advancesAPI, employeesAPI } from '../api/client'
import { C } from '../constants'
import { Card, SectionTitle, Btn, Badge, Table, Td, Modal, Input, Select, Spinner } from '../components/UI'
import toast from 'react-hot-toast'

export default function Advances() {
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({ employee_id: '', amount: '', recovery_months: '1', reason: '', currency: 'AED' })
  const [saving, setSaving] = useState(false)

  const fetchAdvances = async () => {
    setLoading(true)
    try {
      const r = await advancesAPI.list()
      setAdvances(r.data.data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchAdvances()
    employeesAPI.list({ limit: 100 }).then(r =>
      setEmployees(r.data.data.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name} (${e.employee_code})` })))
    )
  }, [])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await advancesAPI.create(form)
      toast.success('Advance request submitted!')
      setShowModal(false)
      setForm({ employee_id: '', amount: '', recovery_months: '1', reason: '', currency: 'AED' })
      fetchAdvances()
    } catch (_) {}
    finally { setSaving(false) }
  }

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') await advancesAPI.approve(id)
      else await advancesAPI.reject(id)
      toast.success(`Advance ${action}d!`)
      fetchAdvances()
    } catch (_) {}
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const fmt = n => parseFloat(n || 0).toLocaleString()

  return (
    <div>
      <SectionTitle actions={<Btn onClick={() => setShowModal(true)}>+ Request Advance</Btn>}>
        Salary Advances
      </SectionTitle>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Advances', value: advances.length, color: C.navy },
          { label: 'Pending Approval', value: advances.filter(a => a.status === 'pending').length, color: C.warning },
          { label: 'Approved', value: advances.filter(a => a.status === 'approved').length, color: C.success },
          { label: 'Total Amount', value: `AED ${fmt(advances.filter(a => a.status === 'approved').reduce((s, a) => s + parseFloat(a.amount || 0), 0))}`, color: C.steel },
        ].map(s => (
          <Card key={s.label} style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <Spinner /> : (
          <Table
            headers={['Advance #', 'Employee', 'Amount', 'Recovery', 'Reason', 'Request Date', 'Status', 'Actions']}
            rows={advances}
            emptyMsg="No advance requests yet"
            renderRow={a => (<>
              <Td style={{ fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>{a.advance_number}</Td>
              <Td style={{ fontWeight: 600 }}>{a.emp_name}</Td>
              <Td style={{ fontWeight: 700 }}>{a.currency} {fmt(a.amount)}</Td>
              <Td style={{ color: C.textMuted }}>{a.recovery_months} month{a.recovery_months > 1 ? 's' : ''}</Td>
              <Td style={{ color: C.textMuted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason || '—'}</Td>
              <Td style={{ color: C.textMuted }}>{a.request_date?.split('T')[0]}</Td>
              <Td><Badge status={a.status} /></Td>
              <Td>
                {a.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="success" onClick={() => handleAction(a.id, 'approve')}>Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleAction(a.id, 'reject')}>Reject</Btn>
                  </div>
                )}
              </Td>
            </>)}
          />
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Salary Advance">
        <Select label="Employee" value={form.employee_id} onChange={set('employee_id')} options={employees} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Amount" type="number" value={form.amount} onChange={set('amount')} placeholder="e.g. 5000" required />
          <Select label="Currency" value={form.currency} onChange={set('currency')}
            options={['AED','USD','GBP','EUR','INR','SAR'].map(c => ({ value: c, label: c }))} />
        </div>
        <Input label="Recovery Period (months)" type="number" value={form.recovery_months} onChange={set('recovery_months')} placeholder="1" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5 }}>Reason</label>
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3}
            placeholder="Reason for advance request…"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }} />
        </div>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#795548' }}>
          ℹ️ The advance amount will be automatically deducted from the employee's salary over the specified recovery period.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={saving || !form.employee_id || !form.amount}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
