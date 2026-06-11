/**
 * GHPHCPage.jsx  —  Super Admin → GH & PHC Centres
 * Based on uploaded design: TN Health Admin (admin h.html)
 * ─────────────────────────────────────────────────────────────────────────────
 * Features:
 * • Stats cards: Total Facilities, Active Admins, Action Required
 * • Table: Hospital Code, Facility Name, District, Plan Type, Last Audit, Status, Renewal Date, Action
 * • Create Hospital modal with New/Existing toggle
 *   - New: full form with subscription + admin credentials + permissions
 *   - Existing: search hospital → load admin → edit admin
 * • Edit hospital (all fields except hospital_code — immutable)
 * • Toggle active/inactive + Soft delete
 * • Export CSV
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TN_DISTRICTS = [
    'Chennai','Coimbatore','Madurai','Salem','Tirunelveli','Tiruchirappalli',
    'Vellore','Erode','Tiruppur','Thoothukudi','Dindigul','Thanjavur',
    'Ranipet','Kancheepuram','Chengalpattu','Villupuram','Cuddalore',
    'Nagapattinam','Tiruvarur','Ariyalur','Perambalur','Kallakurichi',
    'Krishnagiri','Dharmapuri','Tirupattur','Namakkal','Karur','Pudukkottai',
    'Sivaganga','Ramanathapuram','Virudhunagar','Tenkasi','Kanniyakumari',
    'Nilgiris','Mayiladuthurai',
];

const PLAN_PRICES = { MONTHLY: '5,000', YEARLY: '50,000', PPP: '10/Patient' };

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function genCode() {
    return 'TN-' + Math.random().toString(36).substring(2,6).toUpperCase();
}
function genPassword() {
    return Math.random().toString(36).slice(-8) + '#1';
}
function genUsername(name) {
    const n = (name || '').replace(/[^a-zA-Z]/g,'').toLowerCase().substring(0,5);
    return n.length > 2 ? `admin_${n}_${Math.floor(Math.random()*100)}` : `tn_admin_${Math.floor(Math.random()*10000)}`;
}
function calcRenewal(startDate, plan) {
    if (!startDate) return '';
    const d = new Date(startDate);
    if (plan === 'MONTHLY' || plan === 'PPP') d.setMonth(d.getMonth()+1);
    else d.setFullYear(d.getFullYear()+1);
    return d.toISOString().split('T')[0];
}
function fmtDate(iso) {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

/* ─── Input / Select atoms ──────────────────────────────────────────────── */
const Label = ({ children }) => (
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#94a3b8',
        marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{children}</label>
);

const Inp = ({ style={}, ...p }) => (
    <input style={{
        width:'100%', background:'#0b1121', border:'1px solid #232d3f',
        borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:14,
        outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
        ...style
    }} onFocus={e=>e.target.style.borderColor='#3b82f6'}
       onBlur={e=>e.target.style.borderColor='#232d3f'} {...p} />
);

const Slct = ({ children, style={}, ...p }) => (
    <select style={{
        width:'100%', background:'#0b1121', border:'1px solid #232d3f',
        borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:14,
        outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
        ...style
    }} onFocus={e=>e.target.style.borderColor='#3b82f6'}
       onBlur={e=>e.target.style.borderColor='#232d3f'} {...p}>
        {children}
    </select>
);

/* ─── Plan Badge ─────────────────────────────────────────────────────────── */
const PlanBadge = ({ plan }) => {
    const cfg = plan === 'YEARLY'
        ? { color:'#a78bfa', bg:'rgba(139,92,246,0.15)', border:'rgba(139,92,246,0.2)' }
        : plan === 'PPP'
        ? { color:'#fdba74', bg:'rgba(249,115,22,0.15)', border:'rgba(249,115,22,0.2)' }
        : { color:'#60a5fa', bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.2)' };
    return (
        <span style={{
            background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
            padding:'3px 10px', borderRadius:4, fontSize:10, fontWeight:700, textTransform:'uppercase'
        }}>{plan || 'MONTHLY'}</span>
    );
};

/* ─── SUCCESS POPUP ──────────────────────────────────────────────────────── */
const SuccessPopup = ({ hospName, username, onClose }) => (
    <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', backdropFilter:'blur(16px)',
        zIndex:70, display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
        <div style={{
            background:'#151b2b', border:'1px solid rgba(16,185,129,0.2)',
            borderRadius:20, maxWidth:420, width:'100%', padding:32, textAlign:'center'
        }}>
            <div style={{
                width:64, height:64, background:'rgba(16,185,129,0.1)',
                borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                margin:'0 auto 20px'
            }}>
                <i className="fa-solid fa-check" style={{ fontSize:28, color:'#10b981' }} />
            </div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'#fff', marginBottom:8 }}>Registration Successful!</h2>
            <p style={{ fontSize:14, color:'#94a3b8', marginBottom:20 }}>Credentials sent via email to admin.</p>
            <div style={{
                background:'#0b1121', borderRadius:12, padding:16, border:'1px solid rgba(255,255,255,0.05)',
                textAlign:'left', marginBottom:20
            }}>
                <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Hospital Name</p>
                <p style={{ color:'#fff', fontWeight:600, marginBottom:12 }}>{hospName}</p>
                <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Admin Username</p>
                <p style={{ color:'#60a5fa', fontFamily:'monospace', fontWeight:700 }}>{username}</p>
            </div>
            <button onClick={onClose} style={{
                width:'100%', background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                color:'#fff', fontWeight:600, padding:'12px 0', borderRadius:12, cursor:'pointer', fontSize:14
            }}>Close</button>
        </div>
    </div>
);

/* ─── MAIN MODAL ─────────────────────────────────────────────────────────── */
const CreateModal = ({ onClose, onSuccess }) => {
    const [mode, setMode]         = useState('new'); // 'new' | 'existing'
    const [form, setForm]         = useState({
        hospitalName:'', type:'Government Hospital', district:'Chennai', city:'',
        hospitalCode: genCode(), address:'', contactEmail:'', contactPhone:'', licenseNo:'',
        wardCount: 0, totalBeds: 0, icuBeds: 0,
        planType:'MONTHLY', startDate: new Date().toISOString().split('T')[0], renewalDate:'', price:'5,000',
        adminName:'', adminEmail:'', adminPhone:'',
        username:'', password: genPassword(),
        permissions: { op:true, beds:true, amb:false, ehr:false },
        status:'ACTIVE',
    });
    const [existSearch, setExistSearch] = useState('');
    const [existResults, setExistResults] = useState([]);
    const [selectedHosp, setSelectedHosp] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors]  = useState({});
    const searchTimer = useRef(null);

    // Auto-calculate renewal
    useEffect(() => {
        if (form.startDate) {
            const renewal = calcRenewal(form.startDate, form.planType);
            const price   = PLAN_PRICES[form.planType] || '5,000';
            setForm(f => ({ ...f, renewalDate: renewal, price }));
        }
    }, [form.startDate, form.planType]);

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
    const setP = k => e => setForm(f => ({ ...f, permissions: { ...f.permissions, [k]: e.target.checked } }));

    // Auto-suggest username from hospital name
    const onHospNameChange = e => {
        const v = e.target.value;
        setForm(f => ({ ...f, hospitalName: v, username: genUsername(v) }));
    };

    // Search existing hospitals
    const searchExisting = useCallback(async (q) => {
        if (!q || q.length < 2) { setExistResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/hospitals', { params: { search: q, limit: 10 } });
            setExistResults(res.data.data || []);
        } catch { setExistResults([]); }
        setSearchLoading(false);
    }, []);

    const onSearchInput = e => {
        const v = e.target.value;
        setExistSearch(v);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => searchExisting(v), 400);
    };

    const selectHospital = async (h) => {
        setSelectedHosp(h);
        setExistResults([]);
        // Pre-fill facility fields from selected hospital
        setForm(f => ({
            ...f,
            hospitalName: h.hospital_name || '',
            type:         h.type === 'GH' ? 'Government Hospital' : h.type === 'PRIVATE' ? 'Private Hospital' : (h.type || 'Government Hospital'),
            district:     h.district || 'Chennai',
            city:         h.city || '',
            hospitalCode: h.hospital_code || f.hospitalCode,
            address:      h.address || '',
            contactEmail: h.contact_email || '',
            contactPhone: h.contact_phone || '',
            licenseNo:    h.license_no || '',
            wardCount:    h.ward_count || 0,
            totalBeds:    h.total_beds || 0,
            icuBeds:      h.icu_beds || 0,
            planType:     h.plan_type || 'MONTHLY',
            renewalDate:  h.renewal_date || '',
            price:        h.plan_price || PLAN_PRICES[h.plan_type || 'MONTHLY'],
        }));
        // load admin credentials
        try {
            const r = await axiosInstance.get(`/super-admin/hospitals/${h.hospital_code}/admin`);
            const a = r.data.data;
            if (a) {
                setForm(f => ({
                    ...f,
                    adminName:   a.name     || '',
                    adminEmail:  a.email    || '',
                    adminPhone:  a.phone    || '',
                    username:    a.username || '',
                    password:    '',
                    permissions: a.permissions || { op:true, beds:true, amb:false, ehr:false },
                }));
            }
        } catch { /* no admin yet */ }
    };

    const validate = () => {
        const e = {};
        if (mode === 'new') {
            if (!form.hospitalName.trim())  e.hospitalName  = 'Required';
            if (!form.hospitalCode.trim())  e.hospitalCode  = 'Required';
            if (!form.contactEmail.trim() || !/\S+@\S+\.\S+/.test(form.contactEmail)) e.contactEmail = 'Valid email required';
            if (!/^[0-9]{10}$/.test(form.contactPhone)) e.contactPhone = '10-digit number';
        } else {
            if (!selectedHosp) e.hospital = 'Please select a hospital';
            if (!form.adminName.trim()) e.adminName = 'Required';
        }
        return e;
    };

    const handleSubmit = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true);
        try {
            if (mode === 'existing') {
                await axiosInstance.put(`/super-admin/hospitals/${selectedHosp.hospital_code}/admin`, {
                    name:        form.adminName,
                    email:       form.adminEmail,
                    phone:       form.adminPhone,
                    username:    form.username,
                    password:    form.password || undefined,
                    permissions: form.permissions,
                });
                toast.success('Admin updated successfully!');
                onSuccess();
            } else {
                // Normalize type from display → enum
                const typeMap = {
                    'Government Hospital': 'GH',
                    'Private Hospital':    'PRIVATE',
                    'PHC':                 'PHC',
                    'CLINIC':              'CLINIC',
                };
                const payload = {
                    hospitalName:  form.hospitalName,
                    hospitalCode:  form.hospitalCode,
                    type:          typeMap[form.type] || form.type,
                    address:       form.address,
                    district:      form.district,
                    city:          form.city,
                    contactEmail:  form.contactEmail,
                    contactPhone:  form.contactPhone,
                    licenseNo:     form.licenseNo,
                    planType:      form.planType,
                    startDate:     form.startDate,
                    renewalDate:   form.renewalDate,
                    price:         form.price,
                    adminName:     form.adminName,
                    adminPhone:    form.adminPhone,
                    username:      form.username,
                    password:      form.password,
                    permissions:   form.permissions,
                    status:        form.status,
                };
                const r = await axiosInstance.post('/super-admin/hospitals', payload);
                toast.success('Hospital registered! Credentials sent via email.');
                onSuccess(r.data.data);
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const backdropRef = useRef(null);
    const onBd = e => { if (e.target === backdropRef.current) onClose(); };

    // pill style for mode toggle
    const pillActive   = { background:'#3b82f6', color:'#fff', fontWeight:700 };
    const pillInactive = { background:'transparent', color:'#cbd5e1', fontWeight:500 };

    return (
        <div ref={backdropRef} onClick={onBd} style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(12px)',
            zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16
        }}>
            <div style={{
                background:'#151b2b', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:20, width:'100%', maxWidth:900, maxHeight:'95vh',
                display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.6)'
            }}>
                {/* Header */}
                <div style={{
                    padding:'20px 28px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    background:'#0b1121', borderRadius:'20px 20px 0 0',
                    display:'flex', alignItems:'center', justifyContent:'space-between'
                }}>
                    <div>
                        <h3 style={{ fontSize:20, fontWeight:700, color:'#fff', margin:0 }}>
                            {mode === 'new' ? 'Create New Hospital' : 'Edit Hospital Admin'}
                        </h3>
                        <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                            {mode === 'new'
                                ? 'Enter details to register.'
                                : 'Search and select hospital to load admin credentials.'}
                        </p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        {/* Mode toggle */}
                        <div style={{
                            display:'flex', background:'#0b1121', borderRadius:8, padding:4,
                            border:'1px solid #232d3f', gap:2
                        }}>
                            <button onClick={() => setMode('new')} style={{
                                padding:'7px 16px', borderRadius:6, border:'none', cursor:'pointer',
                                fontSize:12, transition:'all 0.2s',
                                ...(mode === 'new' ? pillActive : pillInactive)
                            }}>New</button>
                            <button onClick={() => setMode('existing')} style={{
                                padding:'7px 16px', borderRadius:6, border:'none', cursor:'pointer',
                                fontSize:12, transition:'all 0.2s',
                                ...(mode === 'existing' ? pillActive : pillInactive)
                            }}>Existing</button>
                        </div>
                        <button onClick={onClose} style={{
                            background:'transparent', border:'none', cursor:'pointer',
                            color:'#94a3b8', fontSize:20, padding:4
                        }}>
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ overflowY:'auto', padding:'28px', flex:1, display:'flex', flexDirection:'column', gap:28 }}>

                    {/* EXISTING HOSPITAL SEARCH */}
                    {mode === 'existing' && (
                        <div style={{
                            background:'rgba(11,18,32,0.4)', borderRadius:12,
                            padding:16, border:'1px solid rgba(255,255,255,0.04)'
                        }}>
                            <Label>Search Hospitals by Code, Name or District</Label>
                            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                                <Inp
                                    value={existSearch}
                                    onChange={onSearchInput}
                                    placeholder="e.g. TN-AB12 or Government Hospital Chennai or Chennai"
                                    style={{ flex:1 }}
                                />
                                <button onClick={() => searchExisting(existSearch)} style={{
                                    padding:'8px 16px', background:'#232d3f', border:'1px solid #374151',
                                    borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, whiteSpace:'nowrap'
                                }}>Search</button>
                            </div>
                            {errors.hospital && <p style={{ color:'#f87171', fontSize:11, marginBottom:8 }}>{errors.hospital}</p>}

                            {searchLoading && (
                                <div style={{ padding:'8px 0', color:'#94a3b8', fontSize:13 }}>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight:6 }} />Searching...
                                </div>
                            )}

                            {/* Results */}
                            {existResults.length > 0 && (
                                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:160, overflowY:'auto' }}>
                                    {existResults.map(h => (
                                        <div key={h.id} onClick={() => selectHospital(h)} style={{
                                            padding:'10px 14px', borderRadius:8,
                                            background:'rgba(11,18,32,0.4)', border:'1px solid #232d3f',
                                            cursor:'pointer', transition:'background 0.15s'
                                        }}
                                        onMouseEnter={e=>e.currentTarget.style.background='rgba(59,130,246,0.08)'}
                                        onMouseLeave={e=>e.currentTarget.style.background='rgba(11,18,32,0.4)'}>
                                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                                                <div>
                                                    <p style={{ color:'#fff', fontWeight:600, fontSize:14, margin:0 }}>{h.hospital_name}</p>
                                                    <p style={{ color:'#64748b', fontSize:12, marginTop:2 }}>
                                                        {h.hospital_code} · {h.district || 'N/A'}
                                                    </p>
                                                </div>
                                                <span style={{ color:'#60a5fa', fontSize:12 }}>Select →</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selected */}
                            {selectedHosp && (
                                <div style={{
                                    padding:'10px 14px', borderRadius:8,
                                    background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)',
                                    display:'flex', alignItems:'center', justifyContent:'space-between'
                                }}>
                                    <div>
                                        <p style={{ color:'#fff', fontWeight:700, fontSize:14, margin:0 }}>
                                            {selectedHosp.hospital_name}
                                            <span style={{ color:'#64748b', fontWeight:400, fontSize:12, marginLeft:8 }}>
                                                ({selectedHosp.hospital_code})
                                            </span>
                                        </p>
                                        <p style={{ color:'#94a3b8', fontSize:12, marginTop:2 }}>{selectedHosp.district}</p>
                                    </div>
                                    <button onClick={() => { setSelectedHosp(null); setExistSearch(''); }} style={{
                                        padding:'4px 10px', background:'#1e293b', border:'1px solid #374151',
                                        borderRadius:6, color:'#94a3b8', cursor:'pointer', fontSize:12
                                    }}>Deselect</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FACILITY INFO — shown in both modes */}
                        <div>
                            <h4 style={{ fontSize:10, fontWeight:700, color:'#3b82f6', textTransform:'uppercase',
                                letterSpacing:'0.1em', marginBottom:16 }}>
                                1. Facility Information
                            </h4>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                                {/* Hospital Name (2 cols) */}
                                <div style={{ gridColumn:'span 2' }}>
                                    <Label>Hospital Name *</Label>
                                    <Inp value={form.hospitalName} onChange={onHospNameChange} placeholder="e.g. Govt. Hospital Madurai" />
                                    {errors.hospitalName && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{errors.hospitalName}</p>}
                                </div>

                                {/* Type */}
                                <div>
                                    <Label>Type</Label>
                                    <Slct value={form.type} onChange={set('type')}>
                                        <option>Government Hospital</option>
                                        <option>Private Hospital</option>
                                        <option>PHC</option>
                                        <option>CLINIC</option>
                                    </Slct>
                                </div>

                                {/* District */}
                                <div>
                                    <Label>District</Label>
                                    <Slct value={form.district} onChange={set('district')}>
                                        {TN_DISTRICTS.map(d => <option key={d}>{d}</option>)}
                                    </Slct>
                                </div>

                                {/* City */}
                                <div>
                                    <Label>City</Label>
                                    <Inp value={form.city} onChange={set('city')} placeholder="e.g. Madurai South" />
                                </div>

                                {/* Code */}
                                <div>
                                    <Label>Hospital Code *</Label>
                                    <div style={{ display:'flex', gap:6 }}>
                                        <Inp value={form.hospitalCode} onChange={set('hospitalCode')}
                                            style={{ fontFamily:'monospace', color:'#60a5fa', flex:1 }} readOnly />
                                        <button onClick={() => setForm(f=>({...f, hospitalCode:genCode()}))} style={{
                                            padding:'8px 12px', background:'#232d3f', border:'1px solid #374151',
                                            borderRadius:8, color:'#fff', cursor:'pointer', fontSize:12
                                        }}>Gen</button>
                                    </div>
                                    {errors.hospitalCode && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{errors.hospitalCode}</p>}
                                </div>

                                {/* Address (2 cols) */}
                                <div style={{ gridColumn:'span 2' }}>
                                    <Label>Address</Label>
                                    <Inp value={form.address} onChange={set('address')} placeholder="Street, Area" />
                                </div>

                                {/* Email */}
                                <div>
                                    <Label>Official Email *</Label>
                                    <Inp type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="admin@hospital.gov.in" />
                                    {errors.contactEmail && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{errors.contactEmail}</p>}
                                </div>

                                {/* Phone */}
                                <div>
                                    <Label>Contact Phone *</Label>
                                    <Inp value={form.contactPhone} onChange={set('contactPhone')} placeholder="10-digit number" maxLength={10} />
                                    {errors.contactPhone && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{errors.contactPhone}</p>}
                                </div>

                                {/* License No */}
                                <div>
                                    <Label>License No (Optional)</Label>
                                    <Inp value={form.licenseNo} onChange={set('licenseNo')} placeholder="MCI-XXXX" />
                                </div>

                                {/* Ward Count */}
                                <div>
                                    <Label>Ward Count</Label>
                                    <Inp type="number" min="0" value={form.wardCount}
                                        onChange={set('wardCount')} placeholder="0" />
                                </div>

                                {/* Total Beds */}
                                <div>
                                    <Label>Total Beds</Label>
                                    <Inp type="number" min="0" value={form.totalBeds}
                                        onChange={set('totalBeds')} placeholder="0" />
                                </div>

                                {/* ICU Beds */}
                                <div>
                                    <Label>ICU Beds</Label>
                                    <Inp type="number" min="0" value={form.icuBeds}
                                        onChange={set('icuBeds')} placeholder="0" />
                                </div>
                            </div>
                        </div>

                    {/* ADMIN CREDENTIALS + SUBSCRIPTION side by side */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

                        {/* Admin Credentials */}
                        <div>
                            <h4 style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', textTransform:'uppercase',
                                letterSpacing:'0.1em', marginBottom:12 }}>
                                {mode === 'new' ? '2.' : ''} Admin Credentials &amp; Permissions
                            </h4>
                            <div style={{
                                background:'rgba(11,18,32,0.5)', borderRadius:12, padding:16,
                                border:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:12
                            }}>
                                <div>
                                    <Label>Full Name</Label>
                                    <Inp value={form.adminName} onChange={set('adminName')} placeholder="Admin full name" />
                                    {errors.adminName && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{errors.adminName}</p>}
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                    <div>
                                        <Label>Email</Label>
                                        <Inp type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@hosp.in" />
                                    </div>
                                    <div>
                                        <Label>Phone</Label>
                                        <Inp value={form.adminPhone} onChange={set('adminPhone')} placeholder="10 digits" />
                                    </div>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                    <div>
                                        <Label>Username</Label>
                                        <div style={{ display:'flex', gap:6 }}>
                                            <Inp value={form.username} onChange={set('username')} style={{ flex:1 }} />
                                            <button onClick={() => setForm(f=>({...f, username:genUsername(f.hospitalName)}))} style={{
                                                background:'transparent', border:'none', cursor:'pointer',
                                                color:'#94a3b8', fontSize:16, padding:'0 6px'
                                            }}>↺</button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Password</Label>
                                        <div style={{ display:'flex', gap:6 }}>
                                            <Inp value={form.password} onChange={set('password')} style={{ flex:1 }} />
                                            <button onClick={() => setForm(f=>({...f, password:genPassword()}))} style={{
                                                padding:'8px 10px', background:'#232d3f', border:'1px solid #374151',
                                                borderRadius:8, color:'#fff', cursor:'pointer', fontSize:11
                                            }}>Gen</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions */}
                                <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:12 }}>
                                    <Label><span style={{ color:'#2dd4bf' }}>Access Permissions</span></Label>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                                        {[
                                            ['op',   'OP Management'],
                                            ['beds', 'Bed Management'],
                                            ['amb',  'Ambulance'],
                                            ['ehr',  'Health Records'],
                                        ].map(([k, label]) => (
                                            <label key={k} style={{
                                                display:'flex', alignItems:'center', gap:8,
                                                fontSize:12, color:'#94a3b8', cursor:'pointer'
                                            }}>
                                                <input type="checkbox" checked={form.permissions[k]}
                                                    onChange={setP(k)}
                                                    style={{ accentColor:'#3b82f6', width:14, height:14 }} />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subscription — shown in both modes */}
                        <div>
                            <h4 style={{ fontSize:10, fontWeight:700, color:'#eab308', textTransform:'uppercase',
                                letterSpacing:'0.1em', marginBottom:12 }}>
                                {mode === 'new' ? '3.' : ''} Subscription
                            </h4>
                                <div style={{
                                    background:'linear-gradient(135deg,rgba(234,179,8,0.05),transparent)',
                                    borderRadius:12, padding:16, border:'1px solid rgba(234,179,8,0.1)',
                                    display:'flex', flexDirection:'column', gap:14
                                }}>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                        <div>
                                            <Label>Plan</Label>
                                            <Slct value={form.planType} onChange={set('planType')}>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="YEARLY">Yearly</option>
                                                <option value="PPP">PPP (Per Patient)</option>
                                            </Slct>
                                        </div>
                                        <div>
                                            <Label>Start Date</Label>
                                            <Inp type="date" value={form.startDate} onChange={set('startDate')} />
                                        </div>
                                    </div>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                        <div>
                                            <Label>Renewal</Label>
                                            <Inp value={fmtDate(form.renewalDate)} readOnly
                                                style={{ color:'#94a3b8', cursor:'not-allowed', background:'#0a0e18' }} />
                                        </div>
                                        <div>
                                            <Label>Price (₹)</Label>
                                            <Inp value={form.price} readOnly
                                                style={{ color:'#eab308', fontWeight:700, background:'#0a0e18', cursor:'not-allowed' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Status</Label>
                                        <Slct value={form.status} onChange={set('status')}>
                                            <option value="ACTIVE">Active</option>
                                            <option value="INACTIVE">Inactive</option>
                                        </Slct>
                                    </div>
                                </div>
                            </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding:'16px 28px', borderTop:'1px solid rgba(255,255,255,0.05)',
                    background:'#0b1121', borderRadius:'0 0 20px 20px',
                    display:'flex', alignItems:'center', justifyContent:'space-between'
                }}>
                    <p style={{ fontSize:12, color:'#64748b' }}>
                        Mode: {mode === 'new' ? 'Creating new hospital' : 'Editing hospital admin'}
                    </p>
                    <div style={{ display:'flex', gap:12 }}>
                        <button onClick={onClose} style={{
                            padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer',
                            background:'transparent', color:'#94a3b8', fontSize:14
                        }}>Cancel</button>
                        <button onClick={handleSubmit} disabled={saving} style={{
                            padding:'10px 28px', borderRadius:12, border:'none', cursor:'pointer',
                            background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', color:'#fff',
                            fontSize:14, fontWeight:700, boxShadow:'0 4px 16px rgba(59,130,246,0.3)',
                            opacity: saving ? 0.7 : 1
                        }}>
                            {saving
                                ? <><i className="fa-solid fa-spinner fa-spin" style={{marginRight:8}}/>Saving...</>
                                : mode === 'new' ? 'Create Hospital' : 'Update Admin'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── EDIT HOSPITAL MODAL ────────────────────────────────────────────────── */
const EditHospitalModal = ({ hospital, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        hospitalName: hospital.hospital_name || '',
        type: hospital.type || 'GH',
        address: hospital.address || '',
        district: hospital.district || '',
        city: hospital.city || '',
        contactEmail: hospital.contact_email || '',
        contactPhone: hospital.contact_phone || '',
        licenseNo: hospital.license_no || '',
        planType: hospital.plan_type || 'MONTHLY',
        renewalDate: hospital.renewal_date || '',
        price: hospital.plan_price || '',
        isActive: hospital.is_active !== false,
    });
    const [saving, setSaving] = useState(false);
    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await axiosInstance.put(`/super-admin/hospitals/${hospital.id}`, {
                ...form, isActive: form.isActive
            });
            toast.success('Hospital updated');
            onSuccess();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Update failed');
        } finally { setSaving(false); }
    };

    const backdropRef = useRef(null);
    const typeDisplay = { GH:'Government Hospital', PHC:'PHC', PRIVATE:'Private Hospital', CLINIC:'CLINIC' };

    return (
        <div ref={backdropRef} onClick={e=>{ if(e.target===backdropRef.current) onClose(); }}
            style={{
                position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)',
                zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16
            }}>
            <div style={{
                background:'#151b2b', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:20, width:'100%', maxWidth:700, maxHeight:'90vh',
                display:'flex', flexDirection:'column'
            }}>
                <div style={{
                    padding:'20px 28px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    background:'#0b1121', borderRadius:'20px 20px 0 0',
                    display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                    <div>
                        <h3 style={{ color:'#fff', fontWeight:700, fontSize:18, margin:0 }}>Edit Hospital</h3>
                        <p style={{ color:'#64748b', fontSize:12, marginTop:4 }}>
                            Code <span style={{ color:'#60a5fa', fontFamily:'monospace' }}>{hospital.hospital_code}</span> is immutable.
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:20 }}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
                <div style={{ overflowY:'auto', padding:28, display:'flex', flexDirection:'column', gap:16 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                        <div style={{ gridColumn:'span 2' }}>
                            <Label>Hospital Name</Label>
                            <Inp value={form.hospitalName} onChange={set('hospitalName')} />
                        </div>
                        <div>
                            <Label>Type</Label>
                            <Slct value={form.type} onChange={set('type')}>
                                <option value="GH">Government Hospital</option>
                                <option value="PHC">PHC</option>
                                <option value="PRIVATE">Private Hospital</option>
                                <option value="CLINIC">Clinic</option>
                            </Slct>
                        </div>
                        <div>
                            <Label>District</Label>
                            <Slct value={form.district} onChange={set('district')}>
                                <option value="">Select District</option>
                                {TN_DISTRICTS.map(d => <option key={d}>{d}</option>)}
                            </Slct>
                        </div>
                        <div>
                            <Label>City</Label>
                            <Inp value={form.city} onChange={set('city')} />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Inp type="email" value={form.contactEmail} onChange={set('contactEmail')} />
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Inp value={form.contactPhone} onChange={set('contactPhone')} maxLength={10} />
                        </div>
                        <div>
                            <Label>License No</Label>
                            <Inp value={form.licenseNo} onChange={set('licenseNo')} />
                        </div>
                        <div style={{ gridColumn:'span 2' }}>
                            <Label>Address</Label>
                            <Inp value={form.address} onChange={set('address')} />
                        </div>
                        <div>
                            <Label>Plan Type</Label>
                            <Slct value={form.planType} onChange={set('planType')}>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                                <option value="PPP">PPP</option>
                            </Slct>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Slct value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                                onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'ACTIVE' }))}>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </Slct>
                        </div>
                    </div>
                </div>
                <div style={{
                    padding:'16px 28px', borderTop:'1px solid rgba(255,255,255,0.05)',
                    background:'#0b1121', borderRadius:'0 0 20px 20px',
                    display:'flex', justifyContent:'flex-end', gap:12
                }}>
                    <button onClick={onClose} style={{
                        padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer',
                        background:'transparent', color:'#94a3b8', fontSize:14
                    }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving} style={{
                        padding:'10px 28px', borderRadius:10, border:'none', cursor:'pointer',
                        background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', color:'#fff',
                        fontSize:14, fontWeight:700, opacity: saving ? 0.7 : 1
                    }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── DELETE CONFIRM ─────────────────────────────────────────────────────── */
const DeleteModal = ({ hospital, onClose, onConfirm, loading }) => (
    <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)',
        zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
        <div style={{
            background:'#151b2b', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:20, width:'100%', maxWidth:420, padding:32, textAlign:'center'
        }}>
            <div style={{
                width:56, height:56, background:'rgba(239,68,68,0.1)',
                borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'
            }}>
                <i className="fa-solid fa-trash" style={{ fontSize:22, color:'#ef4444' }} />
            </div>
            <h3 style={{ color:'#fff', fontWeight:700, fontSize:18, marginBottom:8 }}>Remove Hospital?</h3>
            <p style={{ color:'#94a3b8', fontSize:14, marginBottom:8 }}>
                <strong style={{ color:'#fff' }}>{hospital.hospital_name}</strong>
            </p>
            <p style={{ color:'#64748b', fontSize:13, marginBottom:24 }}>
                All staff will be deactivated. This action is reversible by contacting support.
            </p>
            <div style={{ display:'flex', gap:12 }}>
                <button onClick={onClose} style={{
                    flex:1, padding:'11px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)',
                    background:'transparent', color:'#94a3b8', cursor:'pointer', fontSize:14
                }}>Cancel</button>
                <button onClick={onConfirm} disabled={loading} style={{
                    flex:1, padding:'11px 0', borderRadius:12, border:'none',
                    background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:700,
                    opacity: loading ? 0.7 : 1
                }}>
                    {loading ? 'Removing...' : 'Yes, Remove'}
                </button>
            </div>
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function GHPHCPage() {
    const [hospitals, setHospitals]       = useState([]);
    const [analytics, setAnalytics]       = useState(null);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [pagination, setPagination]     = useState({ page:1, pages:1, total:0, limit:20 });
    const [modal, setModal]               = useState(null); // null | 'create' | 'edit' | 'delete'
    const [editHospital, setEditHospital] = useState(null);
    const [deleteHospital, setDeleteHospital] = useState(null);
    const [deleting, setDeleting]         = useState(false);
    const [toggling, setToggling]         = useState(null);
    const [successData, setSuccessData]   = useState(null);
    const searchTimer = useRef(null);

    const fetchHospitals = useCallback(async (page = 1, q = search) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/hospitals', { params: { search: q, page, limit:20 } });
            setHospitals(res.data.data || []);
            setPagination(res.data.pagination || { page:1, pages:1, total:0 });
        } catch {
            toast.error('Failed to load hospitals');
        } finally { setLoading(false); }
    }, [search]);

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/super-admin/hospitals/analytics');
            setAnalytics(res.data.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchHospitals();
        fetchAnalytics();
    }, []);

    const onSearchChange = e => {
        const v = e.target.value;
        setSearch(v);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchHospitals(1, v), 400);
    };

    const onCreateSuccess = (data) => {
        setModal(null);
        if (data?.hospital) {
            setSuccessData({
                hospName: data.hospital.hospital_name,
                username: data.adminUser?.username || data.adminUser?.email
            });
        }
        fetchHospitals();
        fetchAnalytics();
    };

    const onEditSuccess = () => {
        setModal(null); setEditHospital(null);
        fetchHospitals(); fetchAnalytics();
    };

    const handleToggle = async (h) => {
        setToggling(h.id);
        try {
            await axiosInstance.patch(`/super-admin/hospitals/${h.id}/toggle-status`);
            toast.success(`Hospital ${h.is_active ? 'deactivated' : 'activated'}`);
            fetchHospitals();
        } catch {
            toast.error('Failed to toggle status');
        } finally { setToggling(null); }
    };

    const handleDelete = async () => {
        if (!deleteHospital) return;
        setDeleting(true);
        try {
            await axiosInstance.delete(`/super-admin/hospitals/${deleteHospital.id}`);
            toast.success('Hospital removed');
            setModal(null); setDeleteHospital(null);
            fetchHospitals(); fetchAnalytics();
        } catch {
            toast.error('Failed to remove hospital');
        } finally { setDeleting(false); }
    };

    const handleExport = async () => {
        try {
            const res = await axiosInstance.get('/super-admin/hospitals/export/csv', { responseType:'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a   = document.createElement('a');
            a.href = url; a.download = 'hospitals.csv'; a.click();
            toast.success('CSV downloaded');
        } catch { toast.error('Export failed'); }
    };

    /* ─── Styles ─────────────────────────────────────────────────────────── */
    const s = {
        page:   { minHeight:'100vh', background:'#0b1121', color:'#e2e8f0', fontFamily:'Outfit,sans-serif', padding:0 },
        header: { padding:'28px 32px 0', marginBottom:28 },
        grid3:  { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, padding:'0 32px', marginBottom:28 },
        statCard: { background:'#151b2b', border:'1px solid rgba(255,255,255,0.05)', borderRadius:20, padding:24,
            display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 6px rgba(0,0,0,0.1)' },
        actionBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', marginBottom:20, gap:16 },
        table: { background:'#151b2b', border:'1px solid rgba(255,255,255,0.05)', borderRadius:20, overflow:'hidden', margin:'0 32px' },
        th:    { padding:'14px 20px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' },
        td:    { padding:'16px 20px', fontSize:14, borderBottom:'1px solid rgba(55,65,81,0.4)', whiteSpace:'nowrap' },
    };

    return (
        <div style={s.page}>
            {/* Header */}
            <div style={s.header}>
                <h2 style={{ fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Hospital &amp; Admin Management</h2>
                <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Subscription management, credentials, and access control.</p>
            </div>

            {/* Stats */}
            <div style={s.grid3}>
                <div style={s.statCard}>
                    <div>
                        <p style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>TOTAL FACILITIES</p>
                        <h3 style={{ fontSize:32, fontWeight:800, color:'#fff', margin:0 }}>{analytics?.totalHospitals ?? '—'}</h3>
                    </div>
                    <div style={{ width:56, height:56, borderRadius:16, background:'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="fa-solid fa-hospital" style={{ fontSize:24, color:'#3b82f6' }} />
                    </div>
                </div>
                <div style={s.statCard}>
                    <div>
                        <p style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>ACTIVE ADMINS</p>
                        <h3 style={{ fontSize:32, fontWeight:800, color:'#fff', margin:0 }}>{analytics?.activeAdmins ?? '—'}</h3>
                    </div>
                    <div style={{ width:56, height:56, borderRadius:16, background:'rgba(139,92,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="fa-solid fa-users" style={{ fontSize:24, color:'#8b5cf6' }} />
                    </div>
                </div>
                <div style={{ ...s.statCard, border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div>
                        <p style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>INACTIVE HOSPITALS</p>
                        <h3 style={{ fontSize:32, fontWeight:800, color:'#fff', margin:0 }}>{analytics?.inactiveHospitals ?? '—'}</h3>
                    </div>
                    <div style={{ width:56, height:56, borderRadius:16, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="fa-solid fa-clipboard-check" style={{ fontSize:24, color:'#ef4444' }} />
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div style={s.actionBar}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                    <div style={{ position:'relative', maxWidth:420, flex:1 }}>
                        <i className="fa-solid fa-magnifying-glass" style={{
                            position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                            color:'#64748b', fontSize:14
                        }} />
                        <input value={search} onChange={onSearchChange}
                            placeholder="Search Hospital Name, Code or District..."
                            style={{
                                width:'100%', background:'#151b2b', border:'1px solid #232d3f',
                                borderRadius:12, padding:'12px 16px 12px 42px', color:'#fff',
                                fontSize:14, outline:'none', boxSizing:'border-box'
                            }}
                            onFocus={e=>e.target.style.borderColor='#3b82f6'}
                            onBlur={e=>e.target.style.borderColor='#232d3f'}
                        />
                    </div>
                    <button onClick={handleExport} style={{
                        padding:'12px 20px', background:'#1e293b', border:'1px solid rgba(255,255,255,0.08)',
                        borderRadius:12, color:'#94a3b8', cursor:'pointer', fontSize:13,
                        display:'flex', alignItems:'center', gap:8
                    }}>
                        <i className="fa-solid fa-download" />Export CSV
                    </button>
                </div>
                <button onClick={() => setModal('create')} style={{
                    padding:'12px 24px',
                    background:'linear-gradient(90deg,#3b82f6,#8b5cf6)',
                    border:'none', borderRadius:12, color:'#fff', fontWeight:700,
                    fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:8,
                    boxShadow:'0 4px 16px rgba(59,130,246,0.3)'
                }}>
                    <i className="fa-solid fa-plus-circle" />Create New Hospital
                </button>
            </div>

            {/* Table */}
            <div style={s.table}>
                <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14, color:'#94a3b8' }}>
                        <thead style={{ background:'rgba(11,18,32,0.5)', borderBottom:'1px solid rgba(55,65,81,0.5)' }}>
                            <tr>
                                {['Hospital Code','Facility Name','District','Plan Type','Last Audit','Status','Renewal Date','Actions'].map(h => (
                                    <th key={h} style={s.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', padding:'48px 0', color:'#64748b' }}>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight:8 }} />Syncing with database...
                                </td></tr>
                            ) : hospitals.length === 0 ? (
                                <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', padding:'48px 0', color:'#64748b' }}>
                                    No hospitals found.
                                </td></tr>
                            ) : hospitals.map(h => (
                                <tr key={h.id} style={{ transition:'background 0.15s' }}
                                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.01)'}
                                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <td style={s.td}>
                                        <span style={{ fontFamily:'monospace', color:'#60a5fa', fontWeight:700, fontSize:12 }}>
                                            {h.hospital_code}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, color:'#fff', fontWeight:600 }}>{h.hospital_name}</td>
                                    <td style={s.td}>{h.district || 'N/A'}</td>
                                    <td style={s.td}><PlanBadge plan={h.plan_type} /></td>
                                    <td style={s.td}>{fmtDate(h.last_audit) !== 'N/A' ? fmtDate(h.last_audit) : <span style={{ color:'#475569' }}>Pending</span>}</td>
                                    <td style={s.td}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8,
                                            color: h.is_active ? '#10b981' : '#ef4444',
                                            fontSize:12, fontWeight:700, textTransform:'uppercase'
                                        }}>
                                            <div style={{
                                                width:6, height:6, borderRadius:'50%',
                                                background: h.is_active ? '#10b981' : '#ef4444',
                                                ...(h.is_active ? { animation:'pulse 2s infinite' } : {})
                                            }} />
                                            {h.is_active ? 'Active' : 'Inactive'}
                                        </div>
                                    </td>
                                    <td style={s.td}>{fmtDate(h.renewal_date)}</td>
                                    <td style={{ ...s.td, textAlign:'right' }}>
                                        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, opacity:0.6 }}
                                            onMouseEnter={e=>e.currentTarget.style.opacity=1}
                                            onMouseLeave={e=>e.currentTarget.style.opacity=0.6}>
                                            {/* Edit */}
                                            <button title="Edit" onClick={() => { setEditHospital(h); setModal('edit'); }} style={{
                                                background:'transparent', border:'none', cursor:'pointer',
                                                color:'#94a3b8', fontSize:15
                                            }}>
                                                <i className="fa-solid fa-pen" />
                                            </button>
                                            {/* Toggle */}
                                            <button title={h.is_active ? 'Deactivate' : 'Activate'}
                                                onClick={() => handleToggle(h)}
                                                disabled={toggling === h.id}
                                                style={{
                                                    background:'transparent', border:'none', cursor:'pointer',
                                                    color: h.is_active ? '#10b981' : '#64748b', fontSize:15
                                                }}>
                                                <i className={`fa-solid fa-toggle-${h.is_active ? 'on' : 'off'}`} />
                                            </button>
                                            {/* Delete */}
                                            <button title="Remove" onClick={() => { setDeleteHospital(h); setModal('delete'); }} style={{
                                                background:'transparent', border:'none', cursor:'pointer',
                                                color:'#94a3b8', fontSize:15
                                            }}>
                                                <i className="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && pagination.pages > 1 && (
                    <div style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'14px 20px', borderTop:'1px solid rgba(55,65,81,0.4)'
                    }}>
                        <p style={{ color:'#64748b', fontSize:12 }}>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</p>
                        <div style={{ display:'flex', gap:8 }}>
                            <button disabled={pagination.page <= 1}
                                onClick={() => fetchHospitals(pagination.page - 1)}
                                style={{
                                    padding:'6px 16px', borderRadius:8, border:'1px solid #232d3f',
                                    background:'#0b1121', color:'#e2e8f0', fontSize:12, cursor:'pointer',
                                    opacity: pagination.page <= 1 ? 0.3 : 1
                                }}>← Prev</button>
                            <button disabled={pagination.page >= pagination.pages}
                                onClick={() => fetchHospitals(pagination.page + 1)}
                                style={{
                                    padding:'6px 16px', borderRadius:8, border:'1px solid #232d3f',
                                    background:'#0b1121', color:'#e2e8f0', fontSize:12, cursor:'pointer',
                                    opacity: pagination.page >= pagination.pages ? 0.3 : 1
                                }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {modal === 'create' && (
                <CreateModal onClose={() => setModal(null)} onSuccess={onCreateSuccess} />
            )}
            {modal === 'edit' && editHospital && (
                <EditHospitalModal hospital={editHospital} onClose={() => { setModal(null); setEditHospital(null); }} onSuccess={onEditSuccess} />
            )}
            {modal === 'delete' && deleteHospital && (
                <DeleteModal hospital={deleteHospital} onClose={() => { setModal(null); setDeleteHospital(null); }}
                    onConfirm={handleDelete} loading={deleting} />
            )}
            {successData && (
                <SuccessPopup hospName={successData.hospName} username={successData.username}
                    onClose={() => { setSuccessData(null); }} />
            )}
        </div>
    );
}
