// frontend/src/pages/Employees.jsx — Full CRUD with edit/delete
import { useState, useEffect, useRef } from 'react';
import { employeesAPI, settingsAPI } from '../api/client';
import api from '../api/client';
import { C } from '../constants';
import { Card, SectionTitle, Btn, Badge, Table, Td, Modal, Input, Select, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

const CURRENCIES = ['AED','USD','GBP','EUR','INR','SAR','QAR','KWD','PKR','EGP'].map(c=>({value:c,label:c}));
const GENDERS    = [{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}];
const STATUSES   = [{value:'active',label:'Active'},{value:'probation',label:'Probation'},{value:'on_leave',label:'On Leave'},{value:'terminated',label:'Terminated'}];
const EMP_TYPES  = [{value:'full_time',label:'Full Time'},{value:'part_time',label:'Part Time'},{value:'contract',label:'Contract'},{value:'intern',label:'Intern'}];

const EMPTY = { first_name:'',last_name:'',email:'',phone:'',gender:'',date_of_birth:'',nationality:'',national_id:'',passport_no:'',join_date:'',employment_type:'full_time',base_salary:'',currency:'AED',department_id:'',designation_id:'',work_location_id:'',manager_id:'',bank_name:'',bank_account_no:'',bank_iban:'',tax_id:'',status:'active' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page:1, total:0, pages:1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);  // employee detail view
  const [modal, setModal] = useState(null); // {mode:'add'|'edit', data?}
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments]   = useState([]);
  const [designations, setDesignations] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef();
  const [delConfirm, setDelConfirm] = useState(null);

  const fetchEmployees = async (page = 1) => {
    setLoading(true);
    try {
      const r = await employeesAPI.list({ page, limit:20, search });
      setEmployees(r.data.data); setPagination(r.data.pagination);
    } catch(_) {} finally { setLoading(false); }
  };

  const fetchLookups = async () => {
    const [d, des, wl, m] = await Promise.all([
      settingsAPI.getDepartments(), settingsAPI.getDesignations(),
      settingsAPI.getWorkLocations(), employeesAPI.list({ limit:200 }),
    ]);
    setDepartments((d.data.data||[]).map(x=>({value:x.id,label:x.name})));
    setDesignations((des.data.data||[]).map(x=>({value:x.id,label:x.name})));
    setWorkLocations((wl.data.data||[]).map(x=>({value:x.id,label:x.name})));
    setManagers((m.data.data||[]).map(x=>({value:x.id,label:`${x.first_name} ${x.last_name}`})));
  };

  useEffect(() => { fetchEmployees(); }, [search]);
  useEffect(() => { fetchLookups(); }, []);

  const openAdd = () => { setForm(EMPTY); setModal({ mode:'add' }); };
  const openEdit = (emp) => {
    setForm({
      first_name: emp.first_name||'', last_name: emp.last_name||'', email: emp.email||'',
      phone: emp.phone||'', gender: emp.gender||'', date_of_birth: emp.date_of_birth?.split('T')[0]||'',
      nationality: emp.nationality||'', national_id: emp.national_id||'', passport_no: emp.passport_no||'',
      join_date: emp.join_date?.split('T')[0]||'', employment_type: emp.employment_type||'full_time',
      base_salary: emp.base_salary||'', currency: emp.currency||'AED',
      department_id: emp.department_id||'', designation_id: emp.designation_id||'',
      work_location_id: emp.work_location_id||'', manager_id: emp.manager_id||'',
      bank_name: emp.bank_name||'', bank_account_no: emp.bank_account_no||'',
      bank_iban: emp.bank_iban||'', tax_id: emp.tax_id||'', status: emp.status||'active',
    });
    setModal({ mode:'edit', id: emp.id });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await employeesAPI.create(form);
        toast.success('Employee created!');
      } else {
        await employeesAPI.update(modal.id, form);
        toast.success('Employee updated!');
        if (sel?.id === modal.id) {
          const r = await employeesAPI.get(modal.id);
          setSel(r.data.data);
        }
      }
      setModal(null); fetchEmployees();
    } catch(_) {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await employeesAPI.remove(id);
      toast.success('Employee deactivated');
      setDelConfirm(null); setSel(null); fetchEmployees();
    } catch(_) {}
  };

  const handlePhotoUpload = async (e, empId) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData(); fd.append('photo', file);
      const r = await api.post(`/settings/upload/employee-photo/${empId}`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success('Photo updated!');
      if (sel) setSel(s => ({ ...s, photo_url: r.data.url }));
      fetchEmployees();
    } catch(_) {} finally { setPhotoUploading(false); }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (sel) return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
        <button onClick={()=>setSel(null)} style={{ background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',color:C.textMuted,fontSize:13 }}>← Back</button>
        <div style={{ flex:1 }}/>
        <Btn variant="secondary" onClick={()=>openEdit(sel)}>✏️ Edit</Btn>
        <Btn variant="danger" onClick={()=>setDelConfirm(sel)}>🗑 Delete</Btn>
      </div>

      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:24, alignItems:'flex-start', marginBottom:24 }}>
          {/* Photo */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:88,height:88,borderRadius:'50%',overflow:'hidden',border:`3px solid ${C.border}`,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {sel.photo_url
                ? <img src={`http://localhost:5000${sel.photo_url}`} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                : <div style={{ width:'100%',height:'100%',background:`linear-gradient(135deg,${C.navyMid},${C.sky})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:28 }}>{sel.first_name?.[0]}{sel.last_name?.[0]}</div>}
            </div>
            <button onClick={()=>photoRef.current?.click()} title="Upload photo"
              style={{ position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:C.navy,border:'2px solid #fff',cursor:'pointer',color:'#fff',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {photoUploading?'…':'📷'}
            </button>
            <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handlePhotoUpload(e,sel.id)} />
          </div>

          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:C.navy }}>{sel.first_name} {sel.last_name}</div>
            <div style={{ color:C.textMuted,fontSize:14,marginBottom:6 }}>{sel.designation_name||'—'} {sel.dept_name?`· ${sel.dept_name}`:''}</div>
            <div style={{ display:'flex',gap:8 }}><Badge status={sel.status}/><span style={{ fontSize:12,color:C.textMuted }}>{sel.employee_code}</span></div>
          </div>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
          {[
            ['Email', sel.email], ['Phone', sel.phone||'—'], ['Gender', sel.gender||'—'],
            ['Date of Birth', sel.date_of_birth?.split('T')[0]||'—'], ['Nationality', sel.nationality||'—'],
            ['Join Date', sel.join_date?.split('T')[0]||'—'], ['Employment', sel.employment_type||'—'],
            ['Work Location', sel.work_location_name||'—'], ['Manager', sel.manager_name||'—'],
            ['Base Salary', `${sel.currency} ${parseFloat(sel.base_salary||0).toLocaleString()}`],
            ['Bank', sel.bank_name||'—'], ['IBAN', sel.bank_iban||'—'],
          ].map(([k,v])=>(
            <div key={k} style={{ background:C.offWhite,borderRadius:8,padding:'8px 12px' }}>
              <div style={{ fontSize:10,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13,fontWeight:600,color:C.navy }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Leave Balances */}
      {sel.leaveBalances?.length > 0 && (
        <Card>
          <div style={{ fontWeight:700,color:C.navy,fontSize:14,marginBottom:14 }}>Leave Balances {new Date().getFullYear()}</div>
          <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
            {sel.leaveBalances.map(lb=>{
              const bal = lb.entitled_days - lb.used_days - lb.pending_days;
              const pct = Math.min(((lb.used_days+lb.pending_days)/lb.entitled_days)*100,100);
              return (
                <div key={lb.id} style={{ flex:1,minWidth:140,background:C.offWhite,borderRadius:10,padding:'12px 14px' }}>
                  <div style={{ fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:4 }}>{lb.policy_name}</div>
                  <div style={{ fontSize:20,fontWeight:800,color:C.navy }}>{bal}d</div>
                  <div style={{ fontSize:11,color:C.textMuted,marginBottom:6 }}>of {lb.entitled_days} days</div>
                  <div style={{ height:4,background:C.border,borderRadius:2 }}>
                    <div style={{ height:'100%',width:`${pct}%`,background:pct>80?C.danger:C.sky,borderRadius:2,transition:'width .3s' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Confirm Deactivation">
        <p style={{ color:C.textPrimary,marginBottom:20 }}>Are you sure you want to deactivate <b>{delConfirm?.first_name} {delConfirm?.last_name}</b>? They will no longer appear in active payrolls.</p>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>setDelConfirm(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={()=>handleDelete(delConfirm.id)}>Deactivate Employee</Btn>
        </div>
      </Modal>
    </div>
  );

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionTitle actions={<Btn onClick={openAdd}>+ Add Employee</Btn>}>Employees</SectionTitle>

      <div style={{ marginBottom:16,display:'flex',gap:12 }}>
        <input placeholder="Search name, email, code…" value={search} onChange={e=>{setSearch(e.target.value);fetchEmployees(1);}}
          style={{ padding:'9px 14px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',width:300 }}/>
      </div>

      <Card style={{ padding:0,overflow:'hidden' }}>
        <Table loading={loading} headers={['Employee','Dept','Designation','Gross','Currency','Status','Actions']}
          rows={employees}
          renderRow={emp=>(<>
            <Td>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                {emp.photo_url
                  ? <img src={`http://localhost:5000${emp.photo_url}`} alt="" style={{ width:32,height:32,borderRadius:'50%',objectFit:'cover' }}/>
                  : <div style={{ width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${C.navyMid},${C.sky})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12 }}>{emp.first_name?.[0]}{emp.last_name?.[0]}</div>}
                <button onClick={async()=>{ const r=await employeesAPI.get(emp.id);setSel(r.data.data); }} style={{ background:'none',border:'none',cursor:'pointer',color:C.steel,fontWeight:600,fontSize:13,padding:0 }}>
                  {emp.first_name} {emp.last_name}
                </button>
              </div>
            </Td>
            <Td style={{ color:C.textMuted }}>{emp.dept_name||'—'}</Td>
            <Td style={{ color:C.textMuted }}>{emp.designation_name||'—'}</Td>
            <Td style={{ fontWeight:600 }}>{parseFloat(emp.base_salary||0).toLocaleString()}</Td>
            <Td>{emp.currency}</Td>
            <Td><Badge status={emp.status}/></Td>
            <Td>
              <div style={{ display:'flex',gap:6 }}>
                <Btn size="sm" variant="secondary" onClick={()=>openEdit(emp)}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={()=>setDelConfirm(emp)}>Delete</Btn>
              </div>
            </Td>
          </>)}
        />
        {pagination.pages > 1 && (
          <div style={{ padding:'12px 16px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13 }}>
            <span style={{ color:C.textMuted }}>{pagination.total} employees</span>
            <div style={{ display:'flex',gap:6 }}>
              {Array.from({length:pagination.pages},(_,i)=>(
                <button key={i} onClick={()=>fetchEmployees(i+1)}
                  style={{ width:30,height:30,borderRadius:6,border:`1px solid ${C.border}`,background:pagination.page===i+1?C.navy:C.white,color:pagination.page===i+1?'#fff':C.textPrimary,cursor:'pointer',fontWeight:600,fontSize:12 }}>
                  {i+1}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.mode==='add'?'Add Employee':'Edit Employee'} width={640}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px' }}>
          <Input label="First Name" value={form.first_name} onChange={set('first_name')} required />
          <Input label="Last Name" value={form.last_name} onChange={set('last_name')} required />
          <Input label="Work Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
          <Select label="Gender" value={form.gender} onChange={set('gender')} options={GENDERS} />
          <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
          <Input label="Nationality" value={form.nationality} onChange={set('nationality')} />
          <Input label="National ID" value={form.national_id} onChange={set('national_id')} />
          <Input label="Passport No." value={form.passport_no} onChange={set('passport_no')} />
          <Input label="Join Date" type="date" value={form.join_date} onChange={set('join_date')} />
          <Select label="Employment Type" value={form.employment_type} onChange={set('employment_type')} options={EMP_TYPES} />
          <Select label="Status" value={form.status} onChange={set('status')} options={STATUSES} />
          <Input label="Base Salary" type="number" value={form.base_salary} onChange={set('base_salary')} required />
          <Select label="Currency" value={form.currency} onChange={set('currency')} options={CURRENCIES} />
          <Select label="Department" value={form.department_id} onChange={set('department_id')} options={departments} />
          <Select label="Designation" value={form.designation_id} onChange={set('designation_id')} options={designations} />
          <Select label="Work Location" value={form.work_location_id} onChange={set('work_location_id')} options={workLocations} />
          <Select label="Manager" value={form.manager_id} onChange={set('manager_id')} options={managers} />
        </div>
        <div style={{ borderTop:`1px solid ${C.border}`,paddingTop:16,marginTop:4 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:.5 }}>Bank Details</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px' }}>
            <Input label="Bank Name" value={form.bank_name} onChange={set('bank_name')} />
            <Input label="Account No." value={form.bank_account_no} onChange={set('bank_account_no')} />
            <Input label="IBAN" value={form.bank_iban} onChange={set('bank_iban')} />
            <Input label="Tax ID" value={form.tax_id} onChange={set('tax_id')} />
          </div>
        </div>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:16 }}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create Employee':'Save Changes'}</Btn>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Confirm Deactivation">
        <p style={{ color:C.textPrimary,marginBottom:20 }}>Deactivate <b>{delConfirm?.first_name} {delConfirm?.last_name}</b>? This removes them from active payroll.</p>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>setDelConfirm(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={()=>handleDelete(delConfirm.id)}>Deactivate</Btn>
        </div>
      </Modal>
    </div>
  );
}
