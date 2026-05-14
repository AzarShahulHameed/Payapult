// frontend/src/pages/Documents.jsx
// Three tabs: Documents (by employee), Certificates (per employee), Templates (import)
import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { employeesAPI } from '../api/client';
import { C } from '../constants';
import { SectionTitle, Btn, Modal, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

const BASE = 'http://localhost:5000';
const CAT_ICONS  = { contract:'📄', payslip:'💳', tax:'🧾', identity:'🪪', other:'📎' };
const CAT_COLORS = { contract:C.steel, payslip:C.success, tax:C.warning, identity:C.purple, other:C.textMuted };
const CERT_TYPES = ['Passport','Emirates ID','Labour Card','Visa','Trade License','Insurance Card','Driving License','Medical Certificate','Education Certificate','Other'];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function FileIcon({ mime, name }) {
  const ext = (name||'').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <>🖼</>;
  if (ext === 'pdf') return <>📄</>;
  if (['xlsx','xls','csv'].includes(ext)) return <>📊</>;
  if (['doc','docx'].includes(ext)) return <>📝</>;
  return <>📎</>;
}

function UploadBtn({ label = 'Upload File', onChange, accept, loading }) {
  const ref = useRef();
  return <>
    <button onClick={()=>ref.current?.click()} disabled={loading}
      style={{ padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:13,fontWeight:600,color:C.navy,display:'flex',alignItems:'center',gap:6 }}>
      {loading ? '⏳ Uploading…' : `📎 ${label}`}
    </button>
    <input ref={ref} type="file" accept={accept||'*'} style={{ display:'none' }} onChange={onChange} />
  </>;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: DOCUMENTS — grouped by employee
// ══════════════════════════════════════════════════════════════════════════════
function DocumentsTab() {
  const [grouped, setGrouped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState(null); // employee object
  const [catFilter, setCatFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ employee_id:'', category:'other', name:'', description:'', expiry_date:'' });
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const loadGrouped = async () => {
    setLoading(true);
    try { const r = await api.get('/documents/by-employee'); setGrouped(r.data.data||[]); }
    catch(_) {} finally { setLoading(false); }
  };

  useEffect(() => {
    loadGrouped();
    employeesAPI.list({ limit:200 }).then(r => setEmployees(r.data.data||[]));
  }, []);

  const handleUpload = async () => {
    if (!form.name) { toast.error('Document name required'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => { if(v) fd.append(k,v); });
      if (file) fd.append('file', file);
      await api.post('/documents', fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success('Document uploaded!');
      setShowUpload(false); setFile(null);
      setForm({ employee_id:'', category:'other', name:'', description:'', expiry_date:'' });
      loadGrouped();
    } catch(_) {} finally { setUploading(false); }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${docId}`); toast.success('Deleted'); loadGrouped(); }
    catch(_) {}
  };

  const CATEGORIES = ['all','contract','payslip','tax','identity','other'];

  // ── Employee detail view ────────────────────────────────────────────────────
  if (selectedEmp) {
    const docs = selectedEmp.documents.filter(d => catFilter === 'all' || d.category === catFilter);
    return (
      <div>
        <div style={{ display:'flex',gap:12,alignItems:'center',marginBottom:20 }}>
          <button onClick={()=>{setSelectedEmp(null);setCatFilter('all');}} style={{ background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',color:C.textMuted,fontSize:13 }}>← All Employees</button>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:C.navy }}>{selectedEmp.first_name} {selectedEmp.last_name}</div>
            <div style={{ fontSize:12,color:C.textMuted }}>{selectedEmp.employee_code} {selectedEmp.dept_name?`· ${selectedEmp.dept_name}`:''}</div>
          </div>
          <Btn onClick={()=>{ setForm(f=>({...f,employee_id:selectedEmp.id})); setShowUpload(true); }}>+ Upload Document</Btn>
        </div>

        {/* Category filter */}
        <div style={{ display:'flex',gap:8,marginBottom:18,flexWrap:'wrap' }}>
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setCatFilter(cat)}
              style={{ padding:'6px 16px',borderRadius:20,border:`1.5px solid ${catFilter===cat?C.navy:C.border}`,background:catFilter===cat?C.navy:'white',color:catFilter===cat?'#fff':C.textMuted,fontWeight:600,fontSize:12,cursor:'pointer',textTransform:'capitalize' }}>
              {cat==='all'?'📂 All':`${CAT_ICONS[cat]||'📎'} ${cat}`}
            </button>
          ))}
        </div>

        {docs.length === 0
          ? <div style={{ textAlign:'center',padding:'60px 20px',color:C.textMuted,background:C.white,borderRadius:12,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:40,marginBottom:12 }}>📂</div>
              <div style={{ fontWeight:700,color:C.navy,marginBottom:8 }}>No documents in this category</div>
              <Btn onClick={()=>{ setForm(f=>({...f,employee_id:selectedEmp.id})); setShowUpload(true); }}>Upload First Document</Btn>
            </div>
          : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14 }}>
              {docs.map(doc=>(
                <div key={doc.id} style={{ background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:16,position:'relative' }}>
                  <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                    <div style={{ width:44,height:44,borderRadius:10,background:`${CAT_COLORS[doc.category]||C.textMuted}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0 }}>
                      {CAT_ICONS[doc.category]||'📎'}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,color:C.navy,fontSize:13,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{doc.name}</div>
                      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginTop:4 }}>
                        <span style={{ fontSize:10,padding:'2px 8px',borderRadius:12,background:`${CAT_COLORS[doc.category]||C.textMuted}20`,color:CAT_COLORS[doc.category]||C.textMuted,fontWeight:700,textTransform:'capitalize' }}>{doc.category}</span>
                        {doc.expiry_date && <span style={{ fontSize:10,color:C.textMuted }}>Exp: {doc.expiry_date.split('T')[0]}</span>}
                      </div>
                      {doc.description && <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>{doc.description}</div>}
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:8,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}` }}>
                    {doc.file_url && <a href={`${BASE}${doc.file_url}`} target="_blank" rel="noreferrer"
                        style={{ flex:1,textAlign:'center',padding:'6px',borderRadius:7,background:C.offWhite,color:C.navy,fontSize:12,fontWeight:600,textDecoration:'none' }}>⬇ Download</a>}
                    <button onClick={()=>handleDelete(doc.id)}
                      style={{ padding:'6px 12px',borderRadius:7,background:'#FFF0F0',border:'none',color:C.danger,fontSize:12,fontWeight:600,cursor:'pointer' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    );
  }

  // ── Employee list view ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.navy }}>Documents</div>
          <div style={{ fontSize:13,color:C.textMuted }}>Grouped by employee — click to view & manage</div>
        </div>
        <Btn onClick={()=>setShowUpload(true)}>+ Upload Document</Btn>
      </div>

      {loading ? <Spinner /> :
        grouped.length === 0
          ? <div style={{ textAlign:'center',padding:'80px 20px',background:C.white,borderRadius:12,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:56,marginBottom:16 }}>📁</div>
              <div style={{ fontWeight:700,fontSize:16,color:C.navy,marginBottom:8 }}>No documents yet</div>
              <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>Upload contracts, payslips, tax documents and more</div>
              <Btn onClick={()=>setShowUpload(true)}>Upload First Document</Btn>
            </div>
          : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14 }}>
              {grouped.map(emp=>(
                <div key={emp.id} onClick={()=>setSelectedEmp(emp)}
                  style={{ background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:16,cursor:'pointer',transition:'all .15s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.steel; e.currentTarget.style.boxShadow=`0 4px 16px rgba(46,109,164,.12)`; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.boxShadow='none'; }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:12 }}>
                    {emp.photo_url
                      ? <img src={`${BASE}${emp.photo_url}`} alt="" style={{ width:44,height:44,borderRadius:'50%',objectFit:'cover' }}/>
                      : <div style={{ width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${C.navyMid},${C.sky})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16 }}>{emp.first_name?.[0]}{emp.last_name?.[0]}</div>}
                    <div>
                      <div style={{ fontWeight:700,color:C.navy,fontSize:14 }}>{emp.first_name} {emp.last_name}</div>
                      <div style={{ fontSize:11,color:C.textMuted }}>{emp.employee_code} {emp.dept_name?`· ${emp.dept_name}`:''}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                    {['contract','payslip','tax','identity','other'].map(cat=>{
                      const cnt = emp.documents.filter(d=>d.category===cat).length;
                      if(!cnt) return null;
                      return <span key={cat} style={{ fontSize:11,padding:'3px 8px',borderRadius:20,background:`${CAT_COLORS[cat]}15`,color:CAT_COLORS[cat],fontWeight:700 }}>{CAT_ICONS[cat]} {cnt}</span>;
                    })}
                    <span style={{ fontSize:11,color:C.textMuted,marginLeft:'auto' }}>{emp.documents.length} file{emp.documents.length!==1?'s':''}</span>
                  </div>
                </div>
              ))}
            </div>
      }

      {/* Upload modal */}
      <Modal open={showUpload} onClose={()=>{setShowUpload(false);setFile(null);}} title="Upload Document" width={500}>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Employee</label>
          <select value={form.employee_id} onChange={e=>setForm(f=>({...f,employee_id:e.target.value}))}
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none' }}>
            <option value="">— Organization-wide —</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Category</label>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none' }}>
            {['contract','payslip','tax','identity','other'].map(c=><option key={c} value={c} style={{ textTransform:'capitalize' }}>{CAT_ICONS[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Document Name *</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Employment Contract 2025"
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Expiry Date (optional)</label>
          <input type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))}
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>File *</label>
          <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:'20px',textAlign:'center',cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.steel} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{ fontSize:24,marginBottom:4 }}>📎</div>
            <div style={{ fontSize:13,color:C.textMuted }}>{file?file.name:'Click to select a file (PDF, DOC, XLS, JPG…)'}</div>
            <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e=>setFile(e.target.files?.[0])}/>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>{setShowUpload(false);setFile(null);}}>Cancel</Btn>
          <Btn onClick={handleUpload} disabled={uploading||!form.name}>{uploading?'Uploading…':'Upload Document'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: CERTIFICATES — per employee (Passport, Emirates ID, etc.)
// ══════════════════════════════════════════════════════════════════════════════
function CertificatesTab() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editCert, setEditCert] = useState(null);
  const [form, setForm] = useState({ cert_type:'Passport', cert_number:'', issued_by:'', issue_date:'', expiry_date:'', notes:'' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => { employeesAPI.list({limit:200}).then(r=>setEmployees(r.data.data||[])); }, []);

  const loadCerts = async (empId) => {
    setSelectedEmp(empId); if (!empId) { setCerts([]); return; }
    setLoading(true);
    try { const r = await api.get(`/documents/certificates/${empId}`); setCerts(r.data.data||[]); }
    catch(_) {} finally { setLoading(false); }
  };

  const openAdd = () => { setForm({ cert_type:'Passport', cert_number:'', issued_by:'', issue_date:'', expiry_date:'', notes:'' }); setEditCert(null); setFile(null); setShowModal(true); };
  const openEdit = c => { setForm({ cert_type:c.cert_type, cert_number:c.cert_number||'', issued_by:c.issued_by||'', issue_date:c.issue_date?.split('T')[0]||'', expiry_date:c.expiry_date?.split('T')[0]||'', notes:c.notes||'' }); setEditCert(c); setFile(null); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>{ if(v) fd.append(k,v); });
      if (file) fd.append('file', file);
      if (editCert) await api.put(`/documents/certificates/${editCert.id}`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      else await api.post(`/documents/certificates/${selectedEmp}`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success(editCert?'Updated!':'Certificate added!');
      setShowModal(false); loadCerts(selectedEmp);
    } catch(_) {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this certificate?')) return;
    try { await api.delete(`/documents/certificates/${id}`); toast.success('Deleted'); loadCerts(selectedEmp); }
    catch(_) {}
  };

  const isExpiringSoon = (d) => { if (!d) return false; const diff = (new Date(d)-new Date())/(1000*60*60*24); return diff < 90 && diff > 0; };
  const isExpired = (d) => d && new Date(d) < new Date();

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.navy }}>Employee Certificates</div>
          <div style={{ fontSize:13,color:C.textMuted }}>Passport, Emirates ID, Labour Card & more</div>
        </div>
      </div>

      <div style={{ background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20 }}>
        <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:6 }}>Select Employee</label>
        <select value={selectedEmp} onChange={e=>loadCerts(e.target.value)}
          style={{ padding:'10px 14px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',minWidth:300 }}>
          <option value="">— Choose employee —</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
        </select>
      </div>

      {selectedEmp && (
        <>
          <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:14 }}>
            <Btn onClick={openAdd}>+ Add Certificate</Btn>
          </div>

          {loading ? <Spinner /> :
            certs.length === 0
              ? <div style={{ textAlign:'center',padding:'60px 20px',background:C.white,borderRadius:12,border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:40,marginBottom:12 }}>🪪</div>
                  <div style={{ fontWeight:700,color:C.navy,marginBottom:8 }}>No certificates yet</div>
                  <Btn onClick={openAdd}>Add First Certificate</Btn>
                </div>
              : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14 }}>
                  {certs.map(cert=>{
                    const expired = isExpired(cert.expiry_date);
                    const expiring = isExpiringSoon(cert.expiry_date);
                    return (
                      <div key={cert.id} style={{ background:C.white,borderRadius:12,border:`2px solid ${expired?C.danger:expiring?C.warning:C.border}`,padding:16 }}>
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12 }}>
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase',letterSpacing:.5,marginBottom:4 }}>Certificate Type</div>
                            <div style={{ fontWeight:700,color:C.navy,fontSize:15 }}>{cert.cert_type}</div>
                          </div>
                          {expired && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#FFF0F0',color:C.danger,fontWeight:700 }}>Expired</span>}
                          {expiring && !expired && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#FFF8E1',color:C.warning,fontWeight:700 }}>Expiring Soon</span>}
                        </div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12 }}>
                          {[['Number', cert.cert_number], ['Issued By', cert.issued_by], ['Issue Date', cert.issue_date?.split('T')[0]], ['Expiry Date', cert.expiry_date?.split('T')[0]]].map(([k,v])=>v?(
                            <div key={k} style={{ background:C.offWhite,borderRadius:7,padding:'7px 10px' }}>
                              <div style={{ fontSize:10,color:C.textMuted,fontWeight:600 }}>{k}</div>
                              <div style={{ fontSize:12,fontWeight:600,color:C.navy }}>{v}</div>
                            </div>
                          ):null)}
                        </div>
                        {cert.notes && <div style={{ fontSize:12,color:C.textMuted,marginBottom:10,fontStyle:'italic' }}>{cert.notes}</div>}
                        <div style={{ display:'flex',gap:8 }}>
                          {cert.file_url && <a href={`${BASE}${cert.file_url}`} target="_blank" rel="noreferrer" style={{ flex:1,textAlign:'center',padding:'6px',borderRadius:7,background:C.offWhite,color:C.navy,fontSize:12,fontWeight:600,textDecoration:'none' }}>⬇ View File</a>}
                          <button onClick={()=>openEdit(cert)} style={{ padding:'6px 12px',borderRadius:7,background:C.offWhite,border:'none',color:C.navy,fontSize:12,fontWeight:600,cursor:'pointer' }}>✏️</button>
                          <button onClick={()=>handleDelete(cert.id)} style={{ padding:'6px 12px',borderRadius:7,background:'#FFF0F0',border:'none',color:C.danger,fontSize:12,fontWeight:600,cursor:'pointer' }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
          }
        </>
      )}

      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editCert?'Edit Certificate':'Add Certificate'} width={500}>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Certificate Type *</label>
          <select value={form.cert_type} onChange={e=>setForm(f=>({...f,cert_type:e.target.value}))}
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none' }}>
            {CERT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px' }}>
          {[['cert_number','Certificate Number'],['issued_by','Issued By']].map(([k,l])=>(
            <div key={k} style={{ marginBottom:13 }}>
              <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>{l}</label>
              <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
            </div>
          ))}
          <div style={{ marginBottom:13 }}>
            <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Issue Date</label>
            <input type="date" value={form.issue_date} onChange={e=>setForm(f=>({...f,issue_date:e.target.value}))} style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
          </div>
          <div style={{ marginBottom:13 }}>
            <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Expiry Date</label>
            <input type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
          </div>
        </div>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Notes</label>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',resize:'vertical',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Attach File (optional)</label>
          <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:'16px',textAlign:'center',cursor:'pointer' }}>
            <div style={{ fontSize:13,color:C.textMuted }}>{file?`📎 ${file.name}`:'Click to attach PDF, image, or document'}</div>
            <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e=>setFile(e.target.files?.[0])}/>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'Saving…':editCert?'Update':'Add Certificate'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: TEMPLATES — upload Excel/CSV template → import employees
// ══════════════════════════════════════════════════════════════════════════════
function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', category:'other' });
  const [file, setFile] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();
  const importRef = useRef();

  const load = async () => { setLoading(true); try { const r = await api.get('/documents/templates'); setTemplates(r.data.data||[]); } catch(_) {} finally { setLoading(false); }};
  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!form.name) { toast.error('Template name required'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>{ if(v) fd.append(k,v); });
      if (file) fd.append('file', file);
      await api.post('/documents/templates', fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success('Template saved!'); setShowUpload(false); setFile(null); setForm({name:'',description:'',category:'other'}); load();
    } catch(_) {} finally { setUploading(false); }
  };

  const handleImport = async () => {
    if (!importFile) { toast.error('Please select a file'); return; }
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', importFile);
      const r = await api.post('/documents/templates/import', fd, { headers:{'Content-Type':'multipart/form-data'} });
      setImportResult(r.data);
      toast.success(r.data.message);
    } catch(err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const handleDeleteTmpl = async (id) => {
    if (!confirm('Delete this template?')) return;
    try { await api.delete(`/documents/templates/${id}`); toast.success('Deleted'); load(); } catch(_) {}
  };

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.navy }}>Import Templates</div>
          <div style={{ fontSize:13,color:C.textMuted }}>Upload Excel/CSV templates to bulk import employee data</div>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <Btn variant="secondary" onClick={()=>setShowImport(true)}>📥 Import Data</Btn>
          <Btn onClick={()=>setShowUpload(true)}>+ Save Template</Btn>
        </div>
      </div>

      {/* How-to guide */}
      <div style={{ background:'#EFF6FF',borderRadius:12,border:`1px solid ${C.sky}40`,padding:20,marginBottom:20 }}>
        <div style={{ fontWeight:700,color:C.navy,marginBottom:10,fontSize:14 }}>📊 How to Import Employees from Excel/CSV</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
          {[
            ['1️⃣ Prepare your file','Create a CSV or Excel file with columns: first_name, last_name, email, salary, department, designation, join_date'],
            ['2️⃣ Click Import Data','Click the "Import Data" button and upload your CSV or XLSX file'],
            ['3️⃣ Review results','The system auto-creates departments, designations and employee codes — duplicates are updated'],
          ].map(([t,d])=>(
            <div key={t} style={{ background:C.white,borderRadius:8,padding:'12px 14px' }}>
              <div style={{ fontWeight:700,color:C.navy,fontSize:13,marginBottom:4 }}>{t}</div>
              <div style={{ fontSize:12,color:C.textMuted,lineHeight:1.5 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:14,padding:'10px 14px',background:C.white,borderRadius:8,fontSize:12,color:C.textMuted }}>
          <b>Required columns:</b> first_name, email &nbsp;|&nbsp; <b>Optional:</b> last_name, salary, department, designation, join_date &nbsp;|&nbsp; <b>Formats:</b> .csv, .xlsx, .xls
        </div>
      </div>

      {loading ? <Spinner /> :
        templates.length === 0
          ? <div style={{ textAlign:'center',padding:'60px 20px',background:C.white,borderRadius:12,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:40,marginBottom:12 }}>📋</div>
              <div style={{ fontWeight:700,color:C.navy,marginBottom:8 }}>No saved templates</div>
              <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>Save your import templates here for future use</div>
              <Btn onClick={()=>setShowUpload(true)}>Save First Template</Btn>
            </div>
          : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14 }}>
              {templates.map(t=>(
                <div key={t.id} style={{ background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:16 }}>
                  <div style={{ display:'flex',gap:12,alignItems:'flex-start',marginBottom:12 }}>
                    <div style={{ width:40,height:40,borderRadius:8,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>📋</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,color:C.navy,marginBottom:2 }}>{t.name}</div>
                      {t.description && <div style={{ fontSize:12,color:C.textMuted }}>{t.description}</div>}
                      <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>{new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    {t.file_url && <a href={`${BASE}${t.file_url}`} download style={{ flex:1,textAlign:'center',padding:'7px',borderRadius:7,background:C.offWhite,color:C.navy,fontSize:12,fontWeight:600,textDecoration:'none' }}>⬇ Download</a>}
                    <button onClick={()=>handleDeleteTmpl(t.id)} style={{ padding:'7px 12px',borderRadius:7,background:'#FFF0F0',border:'none',color:C.danger,fontSize:12,fontWeight:600,cursor:'pointer' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
      }

      {/* Save template modal */}
      <Modal open={showUpload} onClose={()=>setShowUpload(false)} title="Save Template" width={480}>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Template Name *</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Employee Import Template"
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:13 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Description</label>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2}
            style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,outline:'none',resize:'vertical',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Template File (optional)</label>
          <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:'20px',textAlign:'center',cursor:'pointer' }}>
            <div style={{ fontSize:13,color:C.textMuted }}>{file?`📎 ${file.name}`:'Click to attach your template file'}</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>setFile(e.target.files?.[0])}/>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>setShowUpload(false)}>Cancel</Btn>
          <Btn onClick={handleUpload} disabled={uploading||!form.name}>{uploading?'Saving…':'Save Template'}</Btn>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={showImport} onClose={()=>{setShowImport(false);setImportResult(null);setImportFile(null);}} title="Import Employees from File" width={520}>
        <div style={{ background:'#EFF6FF',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:C.navy }}>
          <b>Supported columns:</b> first_name, last_name, email, salary (or base_salary), department, designation, join_date
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12,fontWeight:600,color:C.textMuted,display:'block',marginBottom:5 }}>Select CSV or Excel File *</label>
          <div onClick={()=>importRef.current?.click()} style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:'24px',textAlign:'center',cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.steel} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{ fontSize:32,marginBottom:8 }}>📊</div>
            <div style={{ fontSize:13,color:C.textMuted }}>{importFile?<b style={{ color:C.navy }}>📎 {importFile.name}</b>:'Click to select .csv or .xlsx file'}</div>
            <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }} onChange={e=>setImportFile(e.target.files?.[0])}/>
          </div>
        </div>

        {importResult && (
          <div style={{ background:importResult.results?.errors?.length?'#FFF8E1':'#E6F9F3',borderRadius:8,padding:'12px 14px',marginBottom:16 }}>
            <div style={{ fontWeight:700,color:C.navy,marginBottom:6 }}>Import Results</div>
            <div style={{ fontSize:13 }}>
              <span style={{ color:C.success,fontWeight:700 }}>✅ {importResult.results?.created} created</span>
              {' · '}
              <span style={{ color:C.steel,fontWeight:700 }}>🔄 {importResult.results?.updated} updated</span>
              {importResult.results?.errors?.length>0 && <><br/><span style={{ color:C.danger,fontWeight:700,fontSize:12 }}>⚠ {importResult.results?.errors?.length} errors</span></>}
            </div>
            {importResult.results?.errors?.length>0 && (
              <div style={{ marginTop:8,fontSize:11,color:C.danger,maxHeight:80,overflowY:'auto' }}>
                {importResult.results.errors.map((e,i)=><div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={()=>{setShowImport(false);setImportResult(null);setImportFile(null);}}>Close</Btn>
          <Btn onClick={handleImport} disabled={importing||!importFile}>{importing?'Importing…':'Import Now'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Documents() {
  const [tab, setTab] = useState('docs');
  const TABS = [
    { id:'docs',   label:'📁 Documents' },
    { id:'certs',  label:'🪪 Certificates' },
    { id:'tmpl',   label:'📋 Import Templates' },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:6,background:'#F0F4F8',padding:4,borderRadius:12,width:'fit-content',marginBottom:24 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'8px 20px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",
              background:tab===t.id?C.white:'transparent',color:tab===t.id?C.navy:C.textMuted,
              boxShadow:tab===t.id?'0 1px 4px rgba(11,37,69,.1)':'none',transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'docs'  && <DocumentsTab />}
      {tab === 'certs' && <CertificatesTab />}
      {tab === 'tmpl'  && <TemplatesTab />}
    </div>
  );
}
