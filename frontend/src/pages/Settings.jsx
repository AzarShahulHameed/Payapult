// frontend/src/pages/Settings.jsx — Zoho-style complete settings
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { settingsAPI, authAPI, uploadAPI } from '../api/client';
import { C } from '../constants';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

const btn = (v='primary') => ({
  padding:'9px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
  fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s',
  background:v==='primary'?C.navy:v==='danger'?C.danger:v==='success'?C.success:C.offWhite,
  color:v==='secondary'?C.textPrimary:'#fff',
  border:v==='secondary'?`1px solid ${C.border}`:'none',
});
const lbl = { fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.4 };
const inp = { width:'100%',padding:'10px 13px',borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13.5,outline:'none',color:C.navy,background:C.white,boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif",transition:'border-color 0.15s' };

function F({ label, value, onChange, type='text', placeholder, required, disabled }) {
  return <div style={{marginBottom:16}}>
    {label&&<label style={lbl}>{label}{required?' *':''}</label>}
    <input type={type} value={value||''} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled}
      style={{...inp,background:disabled?C.offWhite:C.white}}
      onFocus={e=>{if(!disabled)e.target.style.borderColor=C.steel}} onBlur={e=>e.target.style.borderColor=C.border}/>
  </div>;
}

function S({ label, value, onChange, options, required }) {
  return <div style={{marginBottom:16}}>
    {label&&<label style={lbl}>{label}{required?' *':''}</label>}
    <select value={value||''} onChange={onChange} required={required}
      style={{...inp,cursor:'pointer'}}
      onFocus={e=>e.target.style.borderColor=C.steel} onBlur={e=>e.target.style.borderColor=C.border}>
      <option value="">— Select —</option>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>;
}

function TA({ label, value, onChange, rows=3, placeholder }) {
  return <div style={{marginBottom:16}}>
    {label&&<label style={lbl}>{label}</label>}
    <textarea value={value||''} onChange={onChange} rows={rows} placeholder={placeholder}
      style={{...inp,resize:'vertical'}}/>
  </div>;
}

function SaveBtn({ onClick, loading, label='Save Changes' }) {
  return <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
    <button onClick={onClick} disabled={loading} style={{...btn('primary'),opacity:loading?.7:1}}>
      {loading?'Saving…':label}
    </button>
  </div>;
}

function ImageUpload({ label, current, onUpload, shape='rect' }) {
  const ref = useRef();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(current);
  useEffect(()=>setPreview(current),[current]);
  const isCircle = shape==='circle';

  const handle = async e => {
    const file = e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try { const url = await onUpload(file); setPreview(`http://localhost:5000${url}`); toast.success('Uploaded!'); }
    catch(_) { setPreview(current); }
    finally { setLoading(false); }
  };

  return <div style={{marginBottom:20}}>
    {label&&<label style={lbl}>{label}</label>}
    <div style={{display:'flex',alignItems:'center',gap:20}}>
      <div style={{width:isCircle?80:130,height:80,borderRadius:isCircle?'50%':10,border:`2px dashed ${C.border}`,overflow:'hidden',background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {preview?<img src={preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={()=>setPreview(null)}/>
          :<span style={{fontSize:32,opacity:.3}}>{isCircle?'👤':'🖼'}</span>}
      </div>
      <div>
        <button onClick={()=>ref.current?.click()} disabled={loading} style={{...btn('secondary'),display:'block',marginBottom:6,padding:'8px 16px'}}>
          {loading?'Uploading…':'📎 Upload Image'}
        </button>
        <div style={{fontSize:11,color:C.textMuted}}>PNG, JPG, GIF, WebP · max 5MB</div>
        <input ref={ref} type="file" accept="image/*" style={{display:'none'}} onChange={handle}/>
      </div>
    </div>
  </div>;
}

function Modal({ open, onClose, title, children, width=500 }) {
  if(!open) return null;
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(11,37,69,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:14,width,maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
      <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:C.white,zIndex:1}}>
        <span style={{fontWeight:700,fontSize:16,color:C.navy}}>{title}</span>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.textMuted}}>×</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>;
}

function DT({ headers, rows, renderRow, loading, empty='No records' }) {
  return <div style={{overflowX:'auto'}}>
    {loading?<div style={{textAlign:'center',padding:48,color:C.textMuted}}>Loading…</div>:
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
      <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
        {headers.map(h=><th key={h} style={{textAlign:'left',padding:'10px 14px',color:C.textMuted,fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}
      </tr></thead>
      <tbody>
        {!rows?.length?<tr><td colSpan={headers.length} style={{textAlign:'center',padding:48,color:C.textMuted}}>{empty}</td></tr>
          :rows.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.offWhite}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.offWhite}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            {renderRow(r)}
          </tr>)}
      </tbody>
    </table>}
  </div>;
}
const Td = ({children,style={}})=><td style={{padding:'12px 14px',color:C.textPrimary,verticalAlign:'middle',...style}}>{children}</td>;

function AB({ onEdit, onDelete }) {
  return <Td><div style={{display:'flex',gap:6}}>
    <button onClick={onEdit} style={{...btn('secondary'),padding:'5px 12px',fontSize:12}}>Edit</button>
    <button onClick={onDelete} style={{...btn('danger'),padding:'5px 12px',fontSize:12}}>Delete</button>
  </div></Td>;
}

function SH({ title, sub, action }) {
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
    <div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.navy,margin:0}}>{title}</h2>
      {sub&&<p style={{color:C.textMuted,fontSize:13,margin:'4px 0 0'}}>{sub}</p>}
    </div>
    {action}
  </div>;
}

const CARD = { background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'24px 28px',marginBottom:20 };
const TZ = ['Asia/Dubai','Asia/Riyadh','Asia/Kuwait','Asia/Kolkata','Asia/Karachi','Asia/Dhaka','Europe/London','Europe/Paris','Europe/Berlin','America/New_York','America/Chicago','America/Los_Angeles','America/Toronto','Asia/Singapore','Asia/Tokyo','Australia/Sydney','UTC'];
const CUR = ['AED','USD','GBP','EUR','INR','SAR','QAR','KWD','PKR','EGP','NGN','CNY','KRW','BDT','MYR','PHP','THB'];
const ROLES=[{value:'super_admin',label:'Super Admin'},{value:'admin',label:'Admin'},{value:'hr_manager',label:'HR Manager'},{value:'accountant',label:'Accountant'},{value:'employee',label:'Employee'}];
const LT=['annual','sick','maternity','paternity','unpaid','emergency','study'];
const CT=[{value:'earning',label:'Earning'},{value:'deduction',label:'Deduction'},{value:'benefit',label:'Benefit'}];

// ── SECTIONS ──────────────────────────────────────────────────────────────────
function OrgProfile() {
  const [org,setOrg]=useState(null); const [saving,setSaving]=useState(false);
  const set=k=>e=>setOrg(o=>({...o,[k]:e.target.value}));
  useEffect(()=>{settingsAPI.getOrg().then(r=>setOrg(r.data.data));},[]);
  if(!org) return <div style={{padding:40,textAlign:'center',color:C.textMuted}}>Loading…</div>;
  const save=async()=>{setSaving(true);try{const r=await settingsAPI.updateOrg(org);setOrg(r.data.data);toast.success('Saved!');}finally{setSaving(false);}};
  return <>
    <SH title="Organization Profile" sub="Basic company information"/>
    <div style={CARD}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
        <F label="Company Name" value={org.name} onChange={set('name')} required/>
        <F label="Legal Name" value={org.legal_name} onChange={set('legal_name')}/>
        <F label="Trade License No." value={org.trade_license} onChange={set('trade_license')}/>
        <F label="Registration No." value={org.registration_no} onChange={set('registration_no')}/>
        <F label="Email" type="email" value={org.email} onChange={set('email')}/>
        <F label="Phone" value={org.phone} onChange={set('phone')}/>
        <F label="Industry" value={org.industry} onChange={set('industry')}/>
        <F label="Website" value={org.website} onChange={set('website')} placeholder="https://"/>
        <F label="Country Code" value={org.country_code} onChange={set('country_code')} placeholder="AE"/>
        <S label="Timezone" value={org.timezone} onChange={set('timezone')} options={TZ.map(t=>({value:t,label:t}))}/>
      </div>
      <SaveBtn onClick={save} loading={saving}/>
    </div>
  </>;
}

function OrgBranding() {
  const [org,setOrg]=useState(null); const [saving,setSaving]=useState(false);
  useEffect(()=>{settingsAPI.getOrg().then(r=>setOrg(r.data.data));},[]);
  if(!org) return null;
  const handleLogo=async file=>{const r=await uploadAPI.logo(file);setOrg(o=>({...o,logo_url:r.data.url}));return r.data.url;};
  const save=async()=>{setSaving(true);try{await settingsAPI.updateOrg({payslip_footer:org.payslip_footer});toast.success('Saved!');}finally{setSaving(false);}};
  return <>
    <SH title="Branding & Logo" sub="Your company logo and payslip customization"/>
    <div style={CARD}>
      <ImageUpload label="Company Logo" current={org.logo_url?`http://localhost:5000${org.logo_url}`:null} onUpload={handleLogo}/>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20,marginTop:8}}>
        <TA label="Payslip Footer Text" value={org.payslip_footer} onChange={e=>setOrg(o=>({...o,payslip_footer:e.target.value}))} rows={3} placeholder="e.g. This is a computer generated payslip. No signature required."/>
      </div>
      <SaveBtn onClick={save} loading={saving}/>
    </div>
  </>;
}

function PayrollCfg() {
  const [org,setOrg]=useState(null); const [saving,setSaving]=useState(false);
  const set=k=>e=>setOrg(o=>({...o,[k]:e.target.value}));
  useEffect(()=>{settingsAPI.getOrg().then(r=>setOrg(r.data.data));},[]);
  if(!org) return null;
  const save=async()=>{setSaving(true);try{const r=await settingsAPI.updateOrg(org);setOrg(r.data.data);toast.success('Saved!');}finally{setSaving(false);}};
  return <>
    <SH title="Payroll Configuration" sub="Pay cycle, currency and fiscal settings"/>
    <div style={CARD}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 24px'}}>
        <S label="Base Currency" value={org.base_currency} onChange={set('base_currency')} options={CUR.map(c=>({value:c,label:c}))}/>
        <S label="Pay Frequency" value={org.pay_frequency} onChange={set('pay_frequency')} options={[{value:'monthly',label:'Monthly'},{value:'biweekly',label:'Bi-Weekly'},{value:'weekly',label:'Weekly'},{value:'semi_monthly',label:'Semi-Monthly'}]}/>
        <F label="Pay Day (1–31)" type="number" value={org.pay_day} onChange={set('pay_day')}/>
      </div>
      <SaveBtn onClick={save} loading={saving}/>
    </div>
  </>;
}

function useCRUD(fetchFn, createFn, updateFn, deleteFn, emptyForm) {
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null); const [form,setForm]=useState(emptyForm); const [saving,setSaving]=useState(false);
  const load=useCallback(()=>{setLoading(true);fetchFn().then(r=>{setItems(r.data.data||[]);setLoading(false);});},[]);
  useEffect(()=>{load();},[load]);
  const openAdd=()=>{setForm({...emptyForm});setModal({mode:'add'});};
  const openEdit=item=>{setForm({...emptyForm,...item});setModal({mode:'edit',id:item.id});};
  const save=async()=>{setSaving(true);try{if(modal.mode==='add') await createFn(form);else await updateFn(modal.id,form);toast.success(modal.mode==='add'?'Created!':'Updated!');setModal(null);load();}catch(_){}finally{setSaving(false);}};
  const del=async id=>{if(!confirm('Delete this record?'))return;try{await deleteFn(id);toast.success('Deleted');load();}catch(_){}};
  return {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del,load};
}

function Departments() {
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getDepartments,settingsAPI.createDept,settingsAPI.updateDept,settingsAPI.deleteDept,{name:'',code:'',description:''});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  return <>
    <SH title="Departments" sub="Organize your company structure" action={<button onClick={openAdd} style={btn('primary')}>+ Add Department</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['Name','Code','Employees','Description','']} rows={items} empty="No departments yet"
        renderRow={r=><><Td style={{fontWeight:600}}>{r.name}</Td><Td style={{fontFamily:'monospace',color:C.textMuted}}>{r.code||'—'}</Td><Td style={{fontWeight:700}}>{r.emp_count||0}</Td><Td style={{color:C.textMuted}}>{r.description||'—'}</Td><AB onEdit={()=>openEdit(r)} onDelete={()=>del(r.id)}/></>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={`${modal?.mode==='add'?'Add':'Edit'} Department`}>
      <F label="Department Name" value={form.name} onChange={set('name')} required/>
      <F label="Short Code" value={form.code} onChange={set('code')} placeholder="e.g. ENG"/>
      <TA label="Description" value={form.description} onChange={set('description')} rows={2}/>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function Designations() {
  const [depts,setDepts]=useState([]);
  useEffect(()=>{settingsAPI.getDepartments().then(r=>setDepts((r.data.data||[]).map(d=>({value:d.id,label:d.name}))));},[]);
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getDesignations,settingsAPI.createDesig,settingsAPI.updateDesig,settingsAPI.deleteDesig,{name:'',department_id:'',level:1});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  return <>
    <SH title="Designations" sub="Job titles in your organization" action={<button onClick={openAdd} style={btn('primary')}>+ Add Designation</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['Title','Level','']} rows={items} empty="No designations yet"
        renderRow={r=><><Td style={{fontWeight:600}}>{r.name}</Td><Td>{r.level}</Td><AB onEdit={()=>openEdit(r)} onDelete={()=>del(r.id)}/></>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={`${modal?.mode==='add'?'Add':'Edit'} Designation`}>
      <F label="Job Title" value={form.name} onChange={set('name')} required/>
      <S label="Department" value={form.department_id} onChange={set('department_id')} options={depts}/>
      <F label="Level" type="number" value={form.level} onChange={set('level')} placeholder="1=Junior, 5=Senior"/>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function WorkLocations() {
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getWorkLocations,settingsAPI.createWL,settingsAPI.updateWL,settingsAPI.deleteWL,{name:'',country_code:'AE',timezone:'Asia/Dubai',currency:'AED',is_primary:false});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  return <>
    <SH title="Work Locations" sub="Office and remote locations" action={<button onClick={openAdd} style={btn('primary')}>+ Add Location</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['Name','Country','Timezone','Currency','Primary','']} rows={items} empty="No locations yet"
        renderRow={r=><><Td style={{fontWeight:600}}>{r.name}</Td><Td>{r.country_code}</Td><Td style={{color:C.textMuted}}>{r.timezone}</Td><Td>{r.currency}</Td><Td>{r.is_primary?'✅':'—'}</Td><AB onEdit={()=>openEdit(r)} onDelete={()=>del(r.id)}/></>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={`${modal?.mode==='add'?'Add':'Edit'} Work Location`}>
      <F label="Location Name" value={form.name} onChange={set('name')} required placeholder="e.g. Dubai HQ"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
        <F label="Country Code" value={form.country_code} onChange={set('country_code')} placeholder="AE"/>
        <S label="Currency" value={form.currency} onChange={set('currency')} options={CUR.map(c=>({value:c,label:c}))}/>
      </div>
      <S label="Timezone" value={form.timezone} onChange={set('timezone')} options={TZ.map(t=>({value:t,label:t}))}/>
      <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13.5,cursor:'pointer',marginTop:4}}>
        <input type="checkbox" checked={form.is_primary||false} onChange={e=>setForm(f=>({...f,is_primary:e.target.checked}))}/> Primary location
      </label>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function SalaryComponents() {
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getSalaryComponents,settingsAPI.createComp,settingsAPI.updateComp,settingsAPI.deleteComp,{name:'',code:'',type:'earning',calculation:'fixed',default_value:0,percentage:0,is_taxable:false});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const typeColor={earning:C.success,deduction:C.danger,benefit:C.steel};
  return <>
    <SH title="Salary Components" sub="Earnings, deductions and benefits" action={<button onClick={openAdd} style={btn('primary')}>+ Add Component</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['Name','Code','Type','Calculation','Default','Taxable','']} rows={items} empty="No components yet"
        renderRow={r=><>
          <Td style={{fontWeight:600}}>{r.name}</Td>
          <Td style={{fontFamily:'monospace',color:C.textMuted}}>{r.code}</Td>
          <Td><span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${typeColor[r.type]}18`,color:typeColor[r.type],fontWeight:700,textTransform:'capitalize'}}>{r.type}</span></Td>
          <Td style={{color:C.textMuted}}>{r.calculation==='percentage_of_basic'?'% of Basic':'Fixed'}</Td>
          <Td style={{fontWeight:600}}>{r.calculation==='percentage_of_basic'?`${r.percentage}%`:parseFloat(r.default_value||0).toLocaleString()}</Td>
          <Td>{r.is_taxable?<span style={{color:C.success,fontWeight:700}}>Yes</span>:'No'}</Td>
          <AB onEdit={()=>openEdit(r)} onDelete={()=>del(r.id)}/>
        </>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={`${modal?.mode==='add'?'Add':'Edit'} Salary Component`}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
        <F label="Name" value={form.name} onChange={set('name')} required placeholder="e.g. Housing Allowance"/>
        <F label="Code" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} required placeholder="HRA"/>
      </div>
      <S label="Type" value={form.type} onChange={set('type')} options={CT} required/>
      <S label="Calculation" value={form.calculation} onChange={set('calculation')} options={[{value:'fixed',label:'Fixed Amount'},{value:'percentage_of_basic',label:'% of Basic Salary'}]}/>
      {form.calculation==='percentage_of_basic'
        ?<F label="Percentage (%)" type="number" value={form.percentage} onChange={set('percentage')}/>
        :<F label="Default Amount" type="number" value={form.default_value} onChange={set('default_value')}/>}
      <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13.5,cursor:'pointer'}}>
        <input type="checkbox" checked={form.is_taxable||false} onChange={e=>setForm(f=>({...f,is_taxable:e.target.checked}))}/> Taxable component
      </label>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function LeavePolicies() {
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getLeavePolicies,settingsAPI.createPolicy,settingsAPI.updatePolicy,settingsAPI.deletePolicy,{name:'',leave_type:'annual',days_allowed:30,is_paid:true,carry_forward:false,max_carry_days:0});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  return <>
    <SH title="Leave Policies" sub="Configure leave types and entitlements" action={<button onClick={openAdd} style={btn('primary')}>+ Add Policy</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['Policy Name','Type','Days','Paid','Carry Forward','']} rows={items} empty="No policies yet"
        renderRow={r=><>
          <Td style={{fontWeight:600}}>{r.name}</Td>
          <Td style={{textTransform:'capitalize'}}>{r.leave_type}</Td>
          <Td style={{fontWeight:700}}>{r.days_allowed}d</Td>
          <Td>{r.is_paid?<span style={{color:C.success,fontWeight:700}}>Paid</span>:<span style={{color:C.textMuted}}>Unpaid</span>}</Td>
          <Td>{r.carry_forward?`✅ max ${r.max_carry_days}d`:'—'}</Td>
          <AB onEdit={()=>openEdit(r)} onDelete={()=>del(r.id)}/>
        </>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={`${modal?.mode==='add'?'Add':'Edit'} Leave Policy`}>
      <F label="Policy Name" value={form.name} onChange={set('name')} required placeholder="e.g. Annual Leave"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
        <S label="Leave Type" value={form.leave_type} onChange={set('leave_type')} options={LT.map(t=>({value:t,label:t.charAt(0).toUpperCase()+t.slice(1)}))} required/>
        <F label="Days Allowed" type="number" value={form.days_allowed} onChange={set('days_allowed')} required/>
      </div>
      <div style={{display:'flex',gap:24,marginBottom:16}}>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5,cursor:'pointer'}}><input type="checkbox" checked={form.is_paid!==false} onChange={e=>setForm(f=>({...f,is_paid:e.target.checked}))}/> Paid Leave</label>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5,cursor:'pointer'}}><input type="checkbox" checked={form.carry_forward||false} onChange={e=>setForm(f=>({...f,carry_forward:e.target.checked}))}/> Allow Carry Forward</label>
      </div>
      {form.carry_forward&&<F label="Max Carry Forward Days" type="number" value={form.max_carry_days} onChange={set('max_carry_days')}/>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function Users() {
  const {items,loading,modal,setModal,form,setForm,saving,openAdd,openEdit,save,del}=useCRUD(settingsAPI.getUsers,settingsAPI.createUser,settingsAPI.updateUser,settingsAPI.deleteUser,{email:'',password:'',first_name:'',last_name:'',role:'employee',phone:''});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const RC={super_admin:'#6C3FC4',admin:C.navy,hr_manager:C.steel,accountant:C.success,employee:C.textMuted};
  return <>
    <SH title="Users" sub="Manage team access" action={<button onClick={openAdd} style={btn('primary')}>+ Add User</button>}/>
    <div style={{...CARD,padding:0,overflow:'hidden'}}>
      <DT loading={loading} headers={['User','Email','Role','Phone','Status','']} rows={items} empty="No users"
        renderRow={u=><>
          <Td>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {u.avatar_url?<img src={`http://localhost:5000${u.avatar_url}`} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>
                :<div style={{width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${C.navyMid},${C.sky})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12}}>{u.first_name?.[0]}{u.last_name?.[0]}</div>}
              <span style={{fontWeight:600}}>{u.first_name} {u.last_name}</span>
            </div>
          </Td>
          <Td style={{color:C.textMuted}}>{u.email}</Td>
          <Td><span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${RC[u.role]}18`,color:RC[u.role],fontWeight:700,textTransform:'capitalize',whiteSpace:'nowrap'}}>{u.role?.replace(/_/g,' ')}</span></Td>
          <Td>{u.phone||'—'}</Td>
          <Td><span style={{color:u.is_active?C.success:C.danger,fontWeight:700,fontSize:12}}>{u.is_active?'Active':'Inactive'}</span></Td>
          <AB onEdit={()=>openEdit(u)} onDelete={()=>del(u.id)}/>
        </>}/>
    </div>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.mode==='add'?'Add New User':'Edit User'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
        <F label="First Name" value={form.first_name} onChange={set('first_name')} required/>
        <F label="Last Name" value={form.last_name} onChange={set('last_name')} required/>
      </div>
      {modal?.mode==='add'&&<><F label="Email" type="email" value={form.email} onChange={set('email')} required/><F label="Password" type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 characters"/></>}
      <F label="Phone" value={form.phone} onChange={set('phone')}/>
      <S label="Role" value={form.role} onChange={set('role')} options={ROLES} required/>
      <div style={{background:'#FFF8E1',border:'1px solid #FFE082',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#795548',marginBottom:4}}>
        <b>Roles:</b> Super Admin = all access · Admin = manage org · HR Manager = employees & leave · Accountant = pay runs · Employee = self only
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button style={btn('secondary')} onClick={()=>setModal(null)}>Cancel</button>
        <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':modal?.mode==='add'?'Create User':'Update'}</button>
      </div>
    </Modal>
  </>;
}

function MyProfile() {
  const {user,setUser}=useStore();
  const [form,setForm]=useState({first_name:user?.first_name||'',last_name:user?.last_name||'',phone:user?.phone||''});
  const [pw,setPw]=useState({oldPassword:'',newPassword:'',confirm:''});
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const handleAvatar=async file=>{const r=await uploadAPI.avatar(file);setUser({...user,avatar_url:r.data.url});return r.data.url;};
  const saveProfile=async()=>{setSaving(true);try{const r=await authAPI.updateProfile(form);setUser(r.data.user);toast.success('Profile updated!');}finally{setSaving(false);}};
  const changePw=async()=>{
    if(pw.newPassword!==pw.confirm){toast.error('Passwords do not match');return;}
    if(pw.newPassword.length<8){toast.error('Min 8 characters');return;}
    try{await authAPI.changePassword({oldPassword:pw.oldPassword,newPassword:pw.newPassword});toast.success('Password changed!');setPw({oldPassword:'',newPassword:'',confirm:''});}catch(_){}
  };
  return <>
    <SH title="My Profile" sub="Your account and security settings"/>
    <div style={CARD}>
      <ImageUpload label="Profile Photo" current={user?.avatar_url?`http://localhost:5000${user.avatar_url}`:null} onUpload={handleAvatar} shape="circle"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
        <F label="First Name" value={form.first_name} onChange={set('first_name')} required/>
        <F label="Last Name" value={form.last_name} onChange={set('last_name')} required/>
        <F label="Phone" value={form.phone} onChange={set('phone')}/>
        <F label="Email" value={user?.email} disabled/>
      </div>
      <SaveBtn onClick={saveProfile} loading={saving} label="Update Profile"/>
    </div>
    <div style={CARD}>
      <div style={{fontWeight:700,fontSize:15,color:C.navy,marginBottom:20}}>Change Password</div>
      <F label="Current Password" type="password" value={pw.oldPassword} onChange={e=>setPw(p=>({...p,oldPassword:e.target.value}))}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
        <F label="New Password" type="password" value={pw.newPassword} onChange={e=>setPw(p=>({...p,newPassword:e.target.value}))}/>
        <F label="Confirm Password" type="password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))}/>
      </div>
      <SaveBtn onClick={changePw} label="Change Password"/>
    </div>
  </>;
}

// ── NAV TREE ──────────────────────────────────────────────────────────────────
const NAV=[
  {group:'Organization',items:[
    {id:'org-profile',    label:'Profile & Details',     icon:'🏢',comp:OrgProfile},
    {id:'branding',       label:'Branding & Logo',       icon:'🎨',comp:OrgBranding},
    {id:'payroll-config', label:'Payroll Configuration', icon:'⚙️',comp:PayrollCfg},
    {id:'departments',    label:'Departments',           icon:'🗂',comp:Departments},
    {id:'designations',   label:'Designations',          icon:'🏷',comp:Designations},
    {id:'work-locations', label:'Work Locations',        icon:'📍',comp:WorkLocations},
  ]},
  {group:'Users & Roles',items:[
    {id:'users',label:'Users',icon:'👥',comp:Users},
  ]},
  {group:'Payroll Setup',items:[
    {id:'salary-components',label:'Salary Components',icon:'💰',comp:SalaryComponents},
    {id:'leave-policies',   label:'Leave Policies',   icon:'🗓',comp:LeavePolicies},
  ]},
  {group:'Account',items:[
    {id:'my-profile',label:'My Profile',icon:'👤',comp:MyProfile},
  ]},
];

export default function Settings() {
  const [params,setParams]=useSearchParams();
  const activeId=params.get('section')||'org-profile';
  const setActive=id=>setParams({section:id});
  const all=NAV.flatMap(g=>g.items);
  const Comp=all.find(i=>i.id===activeId)?.comp||OrgProfile;

  return (
    <div style={{display:'flex',gap:0,margin:'-28px -32px',minHeight:'calc(100vh - 56px)'}}>
      {/* Sidebar */}
      <div style={{width:220,flexShrink:0,background:C.white,borderRight:`1px solid ${C.border}`,position:'sticky',top:0,height:'calc(100vh - 56px)',overflowY:'auto'}}>
        <div style={{padding:'18px 16px 14px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:C.navy}}>⚙️ Settings</div>
        </div>
        {NAV.map(g=>(
          <div key={g.group} style={{marginBottom:4}}>
            <div style={{padding:'12px 16px 4px',fontSize:10,fontWeight:700,color:C.textMuted,textTransform:'uppercase',letterSpacing:1}}>{g.group}</div>
            {g.items.map(item=>(
              <button key={item.id} onClick={()=>setActive(item.id)}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 16px',border:'none',cursor:'pointer',textAlign:'left',
                  background:activeId===item.id?`${C.navy}10`:'transparent',
                  color:activeId===item.id?C.navy:C.textPrimary,
                  fontFamily:"'DM Sans',sans-serif",fontSize:13.5,fontWeight:activeId===item.id?700:400,
                  borderLeft:activeId===item.id?`3px solid ${C.navy}`:'3px solid transparent',
                  transition:'all 0.12s'}}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto',maxWidth:920}}>
        <Comp key={activeId}/>
      </div>
    </div>
  );
}
