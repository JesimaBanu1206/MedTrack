/**
 * HospitalAdminPage.jsx  —  MedTrack Pro · Hospital Admin Panel
 * Design: MedTrack Pro (Document 2 HTML)
 * ─────────────────────────────────────────────────────────────────────────────
 * • Login screen (two-panel design)
 * • Full sidebar: Dashboard, Analytics, Staff, Schedule, Ambulance, Finance, Settings
 * • KPI cards with live data
 * • Patient Flow chart (line) + Revenue donut
 * • Staff management with full Add Staff modal (doctor-specific fields)
 * • Schedule management
 * • Emergency & Ambulance console
 * • Finance & Billing
 * • Settings
 * ─────────────────────────────────────────────────────────────────────────────
 */

import OPTimingsSection from './OPTimingsSection';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';
import useAuthStore from '../store/authStore';
import {
    Line, Doughnut
} from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    ArcElement, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    ArcElement, Tooltip, Legend, Filler
);

/* ══════════════════════════════════════════════════════════
   ROLE CONFIG
══════════════════════════════════════════════════════════ */
const ROLES = ['DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF'];

const ROLE_PERMS = {
    DOCTOR:         ['View Patients','Edit Prescriptions','View Lab Reports','View Appointments','Upload Documents'],
    NURSE:          ['View Patients','Update Vitals','View Prescriptions','View Appointments'],
    PHARMACIST:     ['View Prescriptions','Dispense Medicine','View Patients'],
    LAB_TECHNICIAN: ['Upload Lab Reports','View Patients','View Appointments'],
    RECEPTIONIST:   ['Manage Appointments','Register Patients','View Patients'],
    OTHER_STAFF:    ['View Appointments'],
};

const DEPARTMENTS = [
    'General Medicine','Cardiology','Orthopedics','Pediatrics',
    'Neurology','Gynecology','Dermatology','ENT','Ophthalmology',
    'Psychiatry','Radiology','Pharmacy','Laboratory','Administration','Emergency',
];

/* ══════════════════════════════════════════════════════════
   ROLE BADGE
══════════════════════════════════════════════════════════ */
const RoleBadge = ({ role }) => {
    const cfg = {
        DOCTOR:         { cls: 'bg-teal-500/8 text-teal-400 border-teal-500/12',     icon: 'fa-stethoscope' },
        NURSE:          { cls: 'bg-blue-500/8 text-blue-400 border-blue-500/12',     icon: 'fa-user-nurse' },
        PHARMACIST:     { cls: 'bg-purple-500/8 text-purple-400 border-purple-500/12', icon: 'fa-pills' },
        LAB_TECHNICIAN: { cls: 'bg-orange-500/8 text-orange-400 border-orange-500/12', icon: 'fa-flask' },
        RECEPTIONIST:   { cls: 'bg-slate-500/10 text-slate-400 border-slate-500/10',  icon: 'fa-headset' },
        OTHER_STAFF:    { cls: 'bg-gray-500/8 text-gray-400 border-gray-500/12',      icon: 'fa-user' },
    }[role] || { cls: 'bg-gray-500/8 text-gray-400 border-gray-500/12', icon: 'fa-user' };

    return (
        <span className={`staff-role-badge border ${cfg.cls}`} style={{
            padding:'4px 10px', borderRadius:999, fontSize:11,
            fontWeight:700, textTransform:'uppercase', display:'inline-flex',
            alignItems:'center', gap:5
        }}>
            <i className={`fa-solid ${cfg.icon}`} style={{fontSize:9}} />
            {role?.replace(/_/g,' ')}
        </span>
    );
};

/* ══════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════ */
const Sidebar = ({ page, setPage, hospital, user, handleLogout }) => {
    const [profileOpen, setProfileOpen] = useState(false);

    const sections = [
        {
            label: 'Overview',
            items: [
                { id:'DASHBOARD', icon:'fa-layer-group',   label:'Dashboard' },
                { id:'ANALYTICS', icon:'fa-chart-pie',     label:'Analytics & Reports' },
            ]
        },
        {
            label: 'Clinical',
            items: [
                { id:'STAFF',       icon:'fa-user-doctor',         label:'Staff Directory', badge: true },
                { id:'SCHEDULE',    icon:'fa-calendar-days',       label:'Schedule' },
                { id:'WARDS',       icon:'fa-bed',                 label:'Wards & Beds' },
                { id:'WARD_ASSIGN', icon:'fa-stethoscope',         label:'Ward Assignments' },
                { id:'AMBULANCE',   icon:'fa-van-shuttle',         label:'Emergency & Location' },
                { id:'FINANCE',     icon:'fa-file-invoice-dollar', label:'Finance & Billing' },
            ]
        },
        {
            label: 'System',
            items: [
                { id:'SETTINGS',  icon:'fa-gear',           label:'Settings' },
            ]
        },
    ];

    const initials = (hospital?.hospital_name || 'HA').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    return (
        <aside style={{
            width:288, background:'#0b1220', borderRight:'1px solid rgba(255,255,255,0.05)',
            display:'flex', flexDirection:'column', zIndex:40, flexShrink:0
        }}>
            {/* Logo */}
            <div style={{ height:80, display:'flex', alignItems:'center', padding:'0 24px',
                borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(11,18,32,0.5)' }}>
                <div style={{
                    width:40, height:40, borderRadius:12,
                    background:'linear-gradient(135deg,#2dd4bf,#4f46e5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 4px 16px rgba(45,212,191,0.2)', marginRight:12, flexShrink:0
                }}>
                    <i className="fa-solid fa-heart-pulse" style={{color:'#fff',fontSize:16}} />
                </div>
                <div>
                    <h1 style={{
                        fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:18,
                        color:'#fff', letterSpacing:-0.5
                    }}>
                        MedTrack <span style={{color:'#2dd4bf',fontSize:11,background:'rgba(45,212,191,0.1)',
                            padding:'2px 6px', borderRadius:4, verticalAlign:'top'}}>PRO</span>
                    </h1>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex:1, overflowY:'auto', padding:'24px 16px', display:'flex', flexDirection:'column', gap:24 }}>
                {sections.map(section => (
                    <div key={section.label}>
                        <p style={{ fontSize:10, color:'#475569', textTransform:'uppercase',
                            letterSpacing:'0.1em', fontWeight:600, paddingLeft:16, marginBottom:8 }}>
                            {section.label}
                        </p>
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            {section.items.map(item => (
                                <button key={item.id} onClick={() => setPage(item.id)}
                                    style={{
                                        display:'flex', alignItems:'center', justifyContent:'space-between',
                                        padding:'12px 16px', borderRadius:12, border:'none', cursor:'pointer',
                                        background: page === item.id ? 'rgba(45,212,191,0.08)' : 'transparent',
                                        color: page === item.id ? '#2dd4bf' : '#94a3b8',
                                        fontSize:14, fontWeight: page === item.id ? 600 : 400,
                                        transition:'all 0.15s',
                                        textAlign:'left',
                                    }}
                                    onMouseEnter={e => { if (page !== item.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}}
                                    onMouseLeave={e => { if (page !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}}
                                >
                                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                        <i className={`fa-solid ${item.icon}`} style={{width:20, textAlign:'center'}} />
                                        <span>{item.label}</span>
                                    </div>
                                    {item.badge && page !== 'STAFF' && (
                                        <span style={{
                                            background:'#14b8a6', color:'#0b1220', fontSize:10,
                                            fontWeight:700, padding:'1px 7px', borderRadius:4
                                        }}>3</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Profile */}
            <div style={{ padding:16, borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.01)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px',
                    borderRadius:12, cursor:'pointer', transition:'background 0.15s' }}
                    onClick={() => setProfileOpen(!profileOpen)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{
                        width:40, height:40, borderRadius:'50%',
                        background:'linear-gradient(135deg,#14b8a6,#4f46e5)',
                        padding:2, flexShrink:0
                    }}>
                        <div style={{
                            width:'100%', height:'100%', borderRadius:'50%',
                            background:'#0b1220', display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff'
                        }}>{initials}</div>
                    </div>
                    <div style={{ flex:1, overflow:'hidden' }}>
                        <p style={{ fontSize:14, fontWeight:700, color:'#fff',
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {hospital?.hospital_name || 'Hospital'}
                        </p>
                        <p style={{ fontSize:10, color:'#64748b' }}>Hospital Admin</p>
                    </div>
                    <i className="fa-solid fa-chevron-down" style={{ color:'#64748b', fontSize:12 }} />
                </div>
                {profileOpen && (
                    <div style={{
                        marginTop:8, padding:8, borderRadius:8,
                        background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.04)'
                    }}>
                        <button onClick={() => setPage('SETTINGS')} style={{
                            display:'block', width:'100%', textAlign:'left', padding:'8px 12px',
                            borderRadius:6, border:'none', cursor:'pointer', background:'transparent',
                            color:'#cbd5e1', fontSize:14, transition:'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            Settings
                        </button>
                        <button onClick={handleLogout} style={{
                            display:'block', width:'100%', textAlign:'left', padding:'8px 12px',
                            borderRadius:6, border:'none', cursor:'pointer', background:'transparent',
                            color:'#cbd5e1', fontSize:14, transition:'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

/* ══════════════════════════════════════════════════════════
   PATIENT FLOW CHART
══════════════════════════════════════════════════════════ */
const PatientFlowChart = () => {
    const data = {
        labels: ['8AM','10AM','12PM','2PM','4PM','6PM','8PM'],
        datasets: [
            {
                label: 'OP',
                data: [12,45,60,55,40,35,20],
                borderColor: '#2dd4bf',
                backgroundColor: 'rgba(45,212,191,0.12)',
                fill: true, tension: 0.4, pointRadius: 3,
            },
            {
                label: 'IP',
                data: [5,10,14,12,18,20,22],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.12)',
                fill: true, tension: 0.4, pointRadius: 3,
            },
        ],
    };
    const opts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position:'top', labels:{ color:'#9CA3AF', boxWidth:12 } } },
        scales: {
            y: { grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#9CA3AF' } },
            x: { grid:{ display:false }, ticks:{ color:'#9CA3AF' } },
        },
    };
    return <Line data={data} options={opts} />;
};

/* ══════════════════════════════════════════════════════════
   REVENUE DONUT
══════════════════════════════════════════════════════════ */
const RevenueDonut = ({ total }) => {
    const data = {
        labels: ['Pharmacy','Lab Tests','Consult','Other'],
        datasets: [{
            data: [4500,3200,6800,1200],
            backgroundColor: ['#2dd4bf','#3b82f6','#a855f7','#64748b'],
            hoverOffset: 6,
        }],
    };
    const opts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position:'bottom', labels:{ color:'#9CA3AF', boxWidth:12 } } },
    };
    return <Doughnut data={data} options={opts} />;
};

/* ══════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════ */
const Dashboard = ({ dashData, setPage }) => {
    const { hospital, stats, recentActivity } = dashData || {};
    const revTotal = 15700;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>
                        Dashboard Overview
                    </h2>
                    <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>
                        {hospital?.district} · {hospital?.type} · Facility Admin Panel
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPage('STAFF')} style={{
                        background:'rgba(45,212,191,0.1)', color:'#2dd4bf',
                        border:'1px solid rgba(45,212,191,0.2)', padding:'8px 16px',
                        borderRadius:8, fontSize:14, display:'flex', alignItems:'center', gap:8, cursor:'pointer'
                    }}>
                        <i className="fa-solid fa-user-plus" /> Add Staff
                    </button>
                    <button style={{
                        background:'rgba(59,130,246,0.1)', color:'#3b82f6',
                        border:'1px solid rgba(59,130,246,0.2)', padding:'8px 16px',
                        borderRadius:8, fontSize:14, display:'flex', alignItems:'center', gap:8, cursor:'pointer'
                    }}>
                        <i className="fa-solid fa-file-invoice" /> Reports
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                    { label:'Out-Patients', val: stats?.totalStaff || 142, icon:'fa-user-injured', color:'#2dd4bf', sub:'+12.5%', subIcon:'fa-arrow-trend-up', subColor:'#2dd4bf' },
                    { label:'In-Patients',  val: stats?.totalDoctors || 45,  icon:'fa-procedures', color:'#3b82f6', sub:'85% Full', subIcon:'fa-bed', subColor:'#3b82f6' },
                    { label:'Staff Active', val: stats?.activeUsers || 0, icon:'fa-users', color:'#a855f7', sub:'Total staff', subIcon:'fa-user', subColor:'#a855f7' },
                    { label:'Emergency',    val: 2, icon:'fa-heart-pulse', color:'#ef4444', sub:'Active', subIcon:'fa-truck-medical', subColor:'#ef4444', pulse:true },
                ].map(({ label, val, icon, color, sub, subIcon, subColor, pulse }) => (
                    <div key={label} style={{
                        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20, position:'relative'
                    }}>
                        <p style={{ color:'#94a3b8', fontSize:12, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</p>
                        <h3 style={{ fontSize:30, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>{val}</h3>
                        <div style={{
                            marginTop:12, fontSize:12, color:subColor,
                            background:`${subColor}11`, display:'inline-flex', alignItems:'center',
                            gap:6, padding:'4px 10px', borderRadius:6
                        }} className={pulse ? 'animate-pulse' : ''}>
                            <i className={`fa-solid ${subIcon}`} /> {sub}
                        </div>
                        <div style={{
                            position:'absolute', right:20, top:20, width:40, height:40, borderRadius:8,
                            background:'rgba(17,24,39,1)', border:'1px solid rgba(255,255,255,0.05)',
                            display:'flex', alignItems:'center', justifyContent:'center', color
                        }}>
                            <i className={`fa-solid ${icon}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Patient Flow Chart */}
                    <div style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:24 }}>
                        <div className="flex justify-between items-center mb-5">
                            <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, display:'flex', alignItems:'center', gap:8 }}>
                                <i className="fa-solid fa-chart-area" style={{ color:'#2dd4bf' }} />
                                Patient Flow Analytics
                            </h4>
                            <div className="flex gap-2">
                                {['Day','Week'].map(t => (
                                    <button key={t} style={{
                                        fontSize:12, padding:'4px 12px', borderRadius:6,
                                        background: t==='Week' ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.05)',
                                        color: t==='Week' ? '#fff' : '#94a3b8', border:'none', cursor:'pointer'
                                    }}>{t}</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ height:256 }}>
                            <PatientFlowChart />
                        </div>
                    </div>

                    {/* Recent Admissions */}
                    <div style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, overflow:'hidden' }}>
                        <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                            display:'flex', justifyContent:'space-between', alignItems:'center',
                            background:'rgba(255,255,255,0.02)' }}>
                            <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>Recent Admissions</h4>
                            <button style={{ fontSize:12, color:'#2dd4bf', background:'none', border:'none', cursor:'pointer' }}>View All</button>
                        </div>
                        <table style={{ width:'100%', fontSize:12, color:'#94a3b8', borderCollapse:'collapse' }}>
                            <thead style={{ background:'#0b1220' }}>
                                <tr>
                                    {['Patient ID','Name','Ward','Time'].map(h => (
                                        <th key={h} style={{ padding:'12px 24px', textAlign:'left', fontSize:11,
                                            textTransform:'uppercase', color:'#64748b', fontWeight:600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { id:'#PID-9021', name:'Rajesh Kumar',  ward:'ICU-02',   time:'10:42 AM' },
                                    { id:'#PID-9022', name:'Anita Desai',   ward:'Gen-12',   time:'11:15 AM' },
                                    { id:'#PID-9023', name:'Mohan S.',      ward:'Ortho-05', time:'11:30 AM' },
                                ].map(row => (
                                    <tr key={row.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding:'12px 24px', color:'#2dd4bf', fontFamily:'monospace' }}>{row.id}</td>
                                        <td style={{ padding:'12px 24px', color:'#fff' }}>{row.name}</td>
                                        <td style={{ padding:'12px 24px' }}>{row.ward}</td>
                                        <td style={{ padding:'12px 24px' }}>{row.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Revenue Donut */}
                    <div style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:24 }}>
                        <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:16 }}>Revenue Split</h4>
                        <div style={{ height:192 }}>
                            <RevenueDonut />
                        </div>
                        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:6 }}>
                            {[
                                { label:'Pharmacy', val:4500, pct:'28.7%', color:'#2dd4bf' },
                                { label:'Lab Tests', val:3200, pct:'20.4%', color:'#3b82f6' },
                                { label:'Consult',  val:6800, pct:'43.3%', color:'#a855f7' },
                                { label:'Other',    val:1200, pct:'7.6%',  color:'#64748b' },
                            ].map(r => (
                                <div key={r.label} style={{ display:'flex', justifyContent:'space-between',
                                    alignItems:'center', padding:'6px 10px', borderRadius:8 }}>
                                    <div style={{ display:'flex', alignItems:'center', fontSize:14, color:'#cbd5e1' }}>
                                        <span style={{ width:10, height:10, borderRadius:'50%',
                                            background:r.color, display:'inline-block', marginRight:8 }} />
                                        {r.label}
                                    </div>
                                    <span style={{ fontWeight:700, color:'#e2e8f0', fontSize:14 }}>
                                        ₹{r.val.toLocaleString()} ({r.pct})
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ color:'#94a3b8', fontSize:12 }}>Today's Total</p>
                            <p style={{ color:'#fff', fontSize:22, fontWeight:800 }}>₹ {revTotal.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Live Activity */}
                    <div style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:24 }}>
                        <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:16 }}>Live Activity</h4>
                        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                            {(dashData?.recentActivity || []).slice(0, 5).map((log, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                                    <div style={{ width:8, height:8, borderRadius:'50%',
                                        background: log.action?.includes('LOGIN') ? '#2dd4bf' : '#3b82f6', flexShrink:0 }} />
                                    <div>
                                        <div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>
                                            {log.action?.replace(/_/g,' ')}
                                        </div>
                                        <div style={{ color:'#64748b', fontSize:11 }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!dashData?.recentActivity || dashData.recentActivity.length === 0) && (
                                <>
                                    {[{t:'System Online', s:'All systems go', c:'#2dd4bf'},{t:'Session Started', s:'Admin logged in', c:'#3b82f6'}].map((a,i) => (
                                        <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                                            <div style={{ width:8,height:8,borderRadius:'50%',background:a.c,flexShrink:0 }} />
                                            <div>
                                                <div style={{ color:'#fff',fontSize:13,fontWeight:600 }}>{a.t}</div>
                                                <div style={{ color:'#64748b',fontSize:11 }}>{a.s}</div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   ADD STAFF MODAL
══════════════════════════════════════════════════════════ */
const AddStaffModal = ({ onClose, onSuccess }) => {
    const [form, setForm] = useState({
        role:'Doctor', department:'General Medicine', fullName:'',
        phone:'', email:'', experience:'', specialization:'',
        dobDay:'', dobMonth:'', dobYear:'', gender:'', certFile: null
    });
    const [genId, setGenId] = useState('');
    const [genPass, setGenPass] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState(null);

    const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    const generateIdAndPass = () => {
        const prefix = form.role === 'Doctor' ? 'DOC' : form.role === 'Nurse' ? 'NUR' : 'STF';
        const yr = new Date().getFullYear().toString().slice(-2);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const id = `${prefix}-${yr}-${rand}`;
        const pass = Math.random().toString(36).slice(-8) + '!1A';
        setGenId(id); setGenPass(pass);
    };

    const handleFile = e => setForm(f => ({ ...f, certFile: e.target.files[0] }));

    const handleSubmit = async () => {
        if (!form.fullName || !form.email) {
            setStatusMsg({ type:'error', text:'Name & Email are required' }); return;
        }
        setSaving(true);
        setStatusMsg(null);
        const roleMap = {
            Doctor:'DOCTOR', Nurse:'NURSE', Receptionist:'RECEPTIONIST',
            Pharmacist:'PHARMACIST', Admin:'OTHER_STAFF', Other:'OTHER_STAFF'
        };
        try {
            await axiosInstance.post('/hospital-admin/staff', {
                fullName: form.fullName,
                email: form.email,
                phone: form.phone,
                staffRole: roleMap[form.role] || 'OTHER_STAFF',
                department: form.department,
            });
            toast.success('Staff member created! Login credentials sent via email.');
            onSuccess?.();
            onClose();
        } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to create staff';
            setStatusMsg({ type:'error', text: msg });
            toast.error(msg);
        } finally { setSaving(false); }
    };

    const backdropRef = useRef(null);
    const fieldStyle = {
        width:'100%', background:'#111827', border:'1px solid #374151',
        borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14,
        outline:'none', boxSizing:'border-box',
    };
    const labelStyle = {
        display:'block', fontSize:11, fontWeight:700, color:'#94a3b8',
        textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6
    };

    return (
        <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
            style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(0,0,0,0.8)',
                backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{
                background:'rgba(12,16,36,0.95)', backdropFilter:'blur(12px)',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:20,
                width:'100%', maxWidth:720, maxHeight:'90vh',
                display:'flex', flexDirection:'column', overflow:'hidden'
            }}>
                {/* Header */}
                <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    background:'rgba(255,255,255,0.02)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:36, height:36, borderRadius:8, background:'rgba(45,212,191,0.12)',
                            display:'flex', alignItems:'center', justifyContent:'center', color:'#2dd4bf' }}>
                            <i className="fa-solid fa-user-plus" />
                        </div>
                        <div>
                            <h3 style={{ color:'#fff', fontWeight:700, fontSize:18 }}>Add New Staff</h3>
                            <p style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                                ID: {genId || '—'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18 }}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
                    {/* Role & Dept */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                        <div>
                            <label style={labelStyle}>Role *</label>
                            <select value={form.role} onChange={setF('role')} style={fieldStyle}>
                                <option>Doctor</option><option>Nurse</option>
                                <option>Receptionist</option><option>Pharmacist</option>
                                <option>Admin</option><option>Other</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Department</label>
                            <select value={form.department} onChange={setF('department')} style={fieldStyle}>
                                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn:'1 / -1' }}>
                            <label style={labelStyle}>Full Name *</label>
                            <input value={form.fullName} onChange={setF('fullName')}
                                placeholder="e.g. Dr. Rajesh Kumar" style={fieldStyle}
                                onFocus={e => e.target.style.borderColor = '#2dd4bf'}
                                onBlur={e => e.target.style.borderColor = '#374151'} />
                        </div>
                    </div>

                    {/* Doctor fields */}
                    {form.role === 'Doctor' && (
                        <div style={{ padding:16, borderRadius:12, background:'rgba(17,24,39,0.5)',
                            border:'1px solid rgba(45,212,191,0.2)' }}>
                            <h4 style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase',
                                letterSpacing:'0.06em', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                                <i className="fa-solid fa-user-doctor" /> Doctor Specifics
                            </h4>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                                <div>
                                    <label style={labelStyle}>Experience (Years)</label>
                                    <input type="number" min={0} value={form.experience} onChange={setF('experience')} style={fieldStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Specialization</label>
                                    <input type="text" value={form.specialization} onChange={setF('specialization')} style={fieldStyle} />
                                </div>
                                <div style={{ gridColumn:'1 / -1' }}>
                                    <label style={labelStyle}>Medical Certificate (PDF/JPG) *</label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile}
                                        style={{ ...fieldStyle, cursor:'pointer', padding:'8px 12px' }} />
                                    <p style={{ fontSize:10, color:'#64748b', marginTop:4 }}>Required for verification purposes.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOB & Gender */}
                    <div style={{ padding:16, borderRadius:12, background:'rgba(17,24,39,0.3)',
                        border:'1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.06em', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                            <i className="fa-solid fa-calendar" /> Personal Details
                        </p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
                            <div>
                                <label style={labelStyle}>DOB - Day</label>
                                <input type="number" min={1} max={31} placeholder="DD" value={form.dobDay} onChange={setF('dobDay')} style={fieldStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Month</label>
                                <input type="number" min={1} max={12} placeholder="MM" value={form.dobMonth} onChange={setF('dobMonth')} style={fieldStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Year</label>
                                <input type="number" min={1900} max={2010} placeholder="YYYY" value={form.dobYear} onChange={setF('dobYear')} style={fieldStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Gender</label>
                                <select value={form.gender} onChange={setF('gender')} style={fieldStyle}>
                                    <option value="">Select</option>
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Phone & Email */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                        <div>
                            <label style={labelStyle}>Phone *</label>
                            <input value={form.phone} onChange={setF('phone')} placeholder="+91 00000 00000" style={fieldStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Email (Login ID) *</label>
                            <input type="email" value={form.email} onChange={setF('email')} style={fieldStyle} />
                        </div>
                    </div>

                    {/* ID & Password generate */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:12, alignItems:'end' }}>
                        <div>
                            <label style={labelStyle}>Generated Employee ID</label>
                            <input readOnly value={genId} style={{ ...fieldStyle, color:'#2dd4bf' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Temporary Password</label>
                            <input readOnly value={genPass} style={{ ...fieldStyle, color:'#a78bfa' }} />
                        </div>
                        <button onClick={generateIdAndPass} style={{
                            padding:'10px 16px', borderRadius:8, background:'#4f46e5',
                            color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                            transition:'background 0.15s', whiteSpace:'nowrap'
                        }}>
                            Generate
                        </button>
                    </div>

                    {/* Permissions preview */}
                    <div style={{ padding:14, borderRadius:10, background:'rgba(45,212,191,0.04)',
                        border:'1px solid rgba(45,212,191,0.1)' }}>
                        <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.06em', marginBottom:10 }}>
                            Permissions for {form.role.toUpperCase()}
                        </p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {(ROLE_PERMS[{Doctor:'DOCTOR',Nurse:'NURSE',Pharmacist:'PHARMACIST',
                                Receptionist:'RECEPTIONIST',Admin:'OTHER_STAFF',Other:'OTHER_STAFF'}[form.role]] || []).map(p => (
                                <span key={p} style={{
                                    fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
                                    background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.15)',
                                    color:'#2dd4bf', display:'flex', alignItems:'center', gap:5
                                }}>
                                    <i className="fa-solid fa-check" style={{fontSize:9}} /> {p}
                                </span>
                            ))}
                        </div>
                    </div>

                    {statusMsg && (
                        <div style={{
                            padding:12, borderRadius:8, fontSize:13,
                            background: statusMsg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(45,212,191,0.1)',
                            border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(45,212,191,0.2)'}`,
                            color: statusMsg.type === 'error' ? '#f87171' : '#2dd4bf'
                        }}>
                            {statusMsg.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.05)',
                    display:'flex', justifyContent:'flex-end', gap:12, background:'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} style={{
                        padding:'10px 20px', borderRadius:10, fontSize:14, fontWeight:500,
                        color:'#94a3b8', background:'none', border:'none', cursor:'pointer'
                    }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving} style={{
                        padding:'10px 24px', borderRadius:10, fontSize:14, fontWeight:700,
                        background:'#14b8a6', color:'#0b1220', border:'none', cursor:'pointer',
                        opacity: saving ? 0.7 : 1, display:'flex', alignItems:'center', gap:8
                    }}>
                        {saving && <i className="fa-solid fa-spinner fa-spin" />}
                        {saving ? 'Creating…' : 'Create Account'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   STAFF PAGE
══════════════════════════════════════════════════════════ */
const StaffPage = () => {
    const [staff,       setStaff]       = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [search,      setSearch]      = useState('');
    const [roleFilter,  setRoleFilter]  = useState('all');
    const [page,        setPage]        = useState(1);
    const [pagination,  setPagination]  = useState(null);
    const [editStaff,   setEditStaff]   = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [showAdd,     setShowAdd]     = useState(false);
    const [activeTab,   setActiveTab]   = useState('All Staff');
    const [summary,     setSummary]     = useState({ total:0, doctors:0, pending:0 });

    const fetchStaff = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams({ search, page, limit:15 });
            if (roleFilter !== 'all') p.set('role', roleFilter);
            const res = await axiosInstance.get(`/hospital-admin/staff?${p}`);
            if (res.data?.success) {
                const data = res.data.data || [];
                setStaff(data);
                setPagination(res.data.pagination);
                setSummary({
                    total: res.data.pagination?.total || data.length,
                    doctors: data.filter(s => s.staff_role === 'DOCTOR').length,
                    pending: 0
                });
            }
        } catch { toast.error('Failed to load staff'); }
        finally { setLoading(false); }
    }, [search, roleFilter, page]);

    useEffect(() => { fetchStaff(); }, [search, roleFilter, page]);

    const handleToggle = async (id, cur) => {
        try {
            await axiosInstance.put(`/hospital-admin/staff/${id}`, { isActive: !cur });
            toast.success(`Staff ${!cur ? 'activated' : 'deactivated'}`);
            fetchStaff();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    };

    const handleDelete = async id => {
        if (!window.confirm('Remove this staff member?')) return;
        try {
            await axiosInstance.delete(`/hospital-admin/staff/${id}`);
            toast.success('Staff removed');
            fetchStaff();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    };

    const handleUpdate = async e => {
        e.preventDefault(); setEditLoading(true);
        try {
            await axiosInstance.put(`/hospital-admin/staff/${editStaff.id}`, {
                fullName: editStaff.full_name, phone: editStaff.phone,
                department: editStaff.department, staffRole: editStaff.staff_role
            });
            toast.success('Staff updated'); setEditStaff(null); fetchStaff();
        } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
        finally { setEditLoading(false); }
    };

    const handleExport = async () => {
        try {
            const res = await axiosInstance.get('/hospital-admin/staff/export', { responseType:'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href=url; a.download='staff.csv'; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('Export failed'); }
    };

    const tabRoles = { 'All Staff': 'all', 'Doctors': 'DOCTOR', 'Nurses': 'NURSE', 'Admin': 'OTHER_STAFF' };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Staff Management</h2>
                    <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>
                        Manage user access, roles, verification, schedules and permissions.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAdd(true)} style={{
                        background:'#14b8a6', color:'#0b1220', padding:'8px 18px',
                        borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14
                    }}>Add Staff Member</button>
                    <button onClick={fetchStaff} style={{
                        background:'#0d9488', color:'#fff', padding:'8px 14px',
                        borderRadius:8, fontWeight:600, border:'none', cursor:'pointer', fontSize:14
                    }}>Refresh</button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                {[
                    { label:'Total Staff',          val:summary.total,   icon:'fa-users',       color:'#3b82f6', bg:'rgba(59,130,246,0.2)' },
                    { label:'Doctors On Duty',       val:summary.doctors, icon:'fa-user-doctor', color:'#2dd4bf', bg:'rgba(45,212,191,0.2)' },
                    { label:'Pending Verification',  val:summary.pending, icon:'fa-clock',       color:'#eab308', bg:'rgba(234,179,8,0.2)' },
                ].map(c => (
                    <div key={c.label} style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                        border:'1px solid rgba(255,255,255,0.04)', borderRadius:14, padding:16,
                        display:'flex', alignItems:'center', gap:16 }}>
                        <div style={{ width:40, height:40, borderRadius:'50%',
                            background:c.bg, color:c.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <i className={`fa-solid ${c.icon}`} />
                        </div>
                        <div>
                            <p style={{ fontSize:22, fontWeight:700, color:'#fff' }}>{c.val}</p>
                            <p style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.1)', gap:24 }}>
                {Object.keys(tabRoles).map(t => (
                    <button key={t} onClick={() => { setActiveTab(t); setRoleFilter(tabRoles[t]); setPage(1); }}
                        style={{
                            paddingBottom:12, borderBottom: activeTab===t ? '2px solid #14b8a6' : '2px solid transparent',
                            color: activeTab===t ? '#2dd4bf' : '#94a3b8', fontWeight: activeTab===t ? 600 : 400,
                            fontSize:14, background:'none', border:'none', cursor:'pointer', transition:'all 0.15s'
                        }}>{t}</button>
                ))}
            </div>

            {/* Search + export */}
            <div className="flex gap-3 flex-wrap">
                <div style={{ flex:1, minWidth:240, display:'flex', alignItems:'center', gap:10,
                    background:'rgba(12,16,36,0.7)', border:'1px solid rgba(255,255,255,0.05)',
                    borderRadius:10, padding:'10px 14px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ color:'#64748b', fontSize:13 }} />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search staff…" style={{
                            background:'none', border:'none', outline:'none', color:'#fff', fontSize:14, width:'100%'
                        }} />
                </div>
                <button onClick={handleExport} style={{
                    display:'flex', alignItems:'center', gap:8, background:'rgba(12,16,36,0.7)',
                    border:'1px solid rgba(255,255,255,0.05)', padding:'10px 16px', borderRadius:10,
                    fontSize:13, fontWeight:600, color:'#2dd4bf', cursor:'pointer'
                }}>
                    <i className="fa-solid fa-file-csv" /> Export CSV
                </button>
            </div>

            {/* Table */}
            <div style={{ background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                border:'1px solid rgba(255,255,255,0.05)', borderRadius:16, overflow:'hidden' }}>
                {loading ? (
                    <div style={{ padding:'64px 24px', textAlign:'center', color:'#64748b' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize:24, color:'#2dd4bf', marginBottom:12 }} />
                        <p style={{ fontSize:14 }}>Fetching staff records…</p>
                    </div>
                ) : staff.length === 0 ? (
                    <div style={{ padding:'64px 24px', textAlign:'center', color:'#64748b' }}>
                        <i className="fa-solid fa-users" style={{ fontSize:32, marginBottom:12 }} />
                        <p style={{ fontSize:14 }}>No staff members found</p>
                    </div>
                ) : (
                    <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                            <thead>
                                <tr style={{ background:'rgba(11,18,32,0.8)', fontSize:11,
                                    textTransform:'uppercase', color:'#64748b', fontWeight:600 }}>
                                    {['Employee','Role & ID','Department','Status','Schedule','Actions'].map(h => (
                                        <th key={h} style={{ padding:'16px 24px', textAlign:'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(s => (
                                    <tr key={s.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding:'16px 24px' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                                <div style={{
                                                    width:36, height:36, borderRadius:8, background:'#1e293b',
                                                    border:'1px solid rgba(255,255,255,0.05)', display:'flex',
                                                    alignItems:'center', justifyContent:'center',
                                                    color:'#94a3b8', fontSize:14, fontWeight:700, flexShrink:0
                                                }}>
                                                    {s.full_name?.[0]?.toUpperCase() || 'S'}
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight:700, color:'#fff', fontSize:14 }}>{s.full_name}</p>
                                                    <p style={{ fontSize:11, color:'#64748b' }}>{s.users?.email || '—'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding:'16px 24px' }}>
                                            <div>
                                                <RoleBadge role={s.staff_role} />
                                                <p style={{ fontSize:10, color:'#64748b', marginTop:4, fontFamily:'monospace' }}>
                                                    {s.id?.slice(0,8)?.toUpperCase()}
                                                </p>
                                            </div>
                                        </td>
                                        <td style={{ padding:'16px 24px', color:'#94a3b8', fontSize:13 }}>{s.department || '—'}</td>
                                        <td style={{ padding:'16px 24px' }}>
                                            <span style={{
                                                fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
                                                background: s.is_active ? 'rgba(45,212,191,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: s.is_active ? '#2dd4bf' : '#f87171',
                                                border: `1px solid ${s.is_active ? 'rgba(45,212,191,0.2)' : 'rgba(239,68,68,0.2)'}`
                                            }}>
                                                {s.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding:'16px 24px', color:'#64748b', fontSize:12 }}>
                                            {s.users?.last_sign_in_at
                                                ? new Date(s.users.last_sign_in_at).toLocaleDateString('en-IN')
                                                : 'Not logged in'}
                                        </td>
                                        <td style={{ padding:'16px 24px', textAlign:'right' }}>
                                            <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
                                                <button onClick={() => setEditStaff({ ...s })} title="Edit"
                                                    style={{ background:'none', border:'none', cursor:'pointer',
                                                        color:'#64748b', fontSize:15, transition:'color 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <i className="fa-solid fa-ellipsis" />
                                                </button>
                                                <button onClick={() => handleToggle(s.id, s.is_active)} title="Toggle"
                                                    style={{ background:'none', border:'none', cursor:'pointer',
                                                        color:'#64748b', fontSize:15, transition:'color 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#2dd4bf'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <i className="fa-solid fa-power-off" />
                                                </button>
                                                <button onClick={() => handleDelete(s.id)} title="Remove"
                                                    style={{ background:'none', border:'none', cursor:'pointer',
                                                        color:'#64748b', fontSize:15, transition:'color 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <i className="fa-solid fa-trash" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pagination && pagination.pages > 1 && (
                    <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.05)',
                        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <p style={{ fontSize:12, color:'#64748b' }}>Showing {staff.length} of {pagination.total}</p>
                        <div style={{ display:'flex', gap:8 }}>
                            <button disabled={page<=1} onClick={() => setPage(p=>p-1)} style={{
                                padding:'6px 16px', borderRadius:8, fontSize:13, fontWeight:600,
                                background:'rgba(17,24,39,0.8)', color:'#94a3b8', border:'none', cursor:'pointer',
                                opacity: page<=1 ? 0.4 : 1
                            }}>← Prev</button>
                            <span style={{ padding:'6px 12px', fontSize:13, color:'#94a3b8' }}>{page} / {pagination.pages}</span>
                            <button disabled={page>=pagination.pages} onClick={() => setPage(p=>p+1)} style={{
                                padding:'6px 16px', borderRadius:8, fontSize:13, fontWeight:600,
                                background:'rgba(17,24,39,0.8)', color:'#94a3b8', border:'none', cursor:'pointer',
                                opacity: page>=pagination.pages ? 0.4 : 1
                            }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editStaff && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
                    display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:16 }}>
                    <div style={{ background:'rgba(12,16,36,0.95)', border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:20, width:'100%', maxWidth:560, padding:28 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
                            <h3 style={{ color:'#fff', fontWeight:700, fontSize:18 }}>Edit Staff Member</h3>
                            <button onClick={() => setEditStaff(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18 }}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                                {[{l:'Full Name',k:'full_name'},{l:'Phone',k:'phone'},{l:'Department',k:'department'}].map(({l,k}) => (
                                    <div key={k}>
                                        <label style={{ fontSize:11, fontWeight:700, color:'#94a3b8',
                                            textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>{l}</label>
                                        <input value={editStaff[k] || ''} onChange={e => setEditStaff(p=>({...p,[k]:e.target.value}))}
                                            style={{ width:'100%', background:'#111827', border:'1px solid #374151',
                                                borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14,
                                                outline:'none', boxSizing:'border-box' }} />
                                    </div>
                                ))}
                                <div>
                                    <label style={{ fontSize:11, fontWeight:700, color:'#94a3b8',
                                        textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>Role</label>
                                    <select value={editStaff.staff_role} onChange={e => setEditStaff(p=>({...p,staff_role:e.target.value}))}
                                        style={{ width:'100%', background:'#111827', border:'1px solid #374151',
                                            borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }}>
                                        {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display:'flex', gap:12 }}>
                                <button type="submit" disabled={editLoading} style={{
                                    display:'flex', alignItems:'center', gap:8, background:'#14b8a6',
                                    color:'#0b1220', padding:'10px 24px', borderRadius:10,
                                    fontWeight:700, border:'none', cursor:'pointer', opacity: editLoading ? 0.7 : 1
                                }}>
                                    {editLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-floppy-disk" />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setEditStaff(null)} style={{
                                    padding:'10px 20px', borderRadius:10, fontWeight:600,
                                    background:'rgba(17,24,39,0.8)', color:'#94a3b8', border:'none', cursor:'pointer'
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAdd && (
                <AddStaffModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); fetchStaff(); }} />
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   SCHEDULE PAGE
══════════════════════════════════════════════════════════ */
const SchedulePage = () => {
    const [staff, setStaff] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        staffUserId: '', shiftDate: new Date().toISOString().split('T')[0], shiftType: 'GENERAL',
        shiftStart: '09:00', shiftEnd: '17:00', location: '', notes: ''
    });
    const [msgForm, setMsgForm] = useState({
        targetType: 'INDIVIDUAL', targetUserId: '', targetRole: 'DOCTOR', title: '', message: '', priority: 'NORMAL'
    });

    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [staffRes, schedRes, msgRes] = await Promise.all([
                axiosInstance.get('/hospital-admin/staff?limit=200'),
                axiosInstance.get(`/hospital-admin/staff-schedules?date=${form.shiftDate}`),
                axiosInstance.get('/hospital-admin/messages')
            ]);
            setStaff(staffRes.data?.data || []);
            setSchedules(schedRes.data?.data || []);
            setMessages(msgRes.data?.data || []);
        } catch {
            toast.error('Failed to load schedule data');
        } finally {
            setLoading(false);
        }
    }, [form.shiftDate]);

    useEffect(() => { load(); }, [load]);

    const createSchedule = async e => {
        e.preventDefault();
        try {
            await axiosInstance.post('/hospital-admin/staff-schedules', form);
            toast.success('Schedule assigned');
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to assign schedule');
        }
    };

    const removeSchedule = async id => {
        try {
            await axiosInstance.delete(`/hospital-admin/staff-schedules/${id}`);
            toast.success('Schedule removed');
            load();
        } catch {
            toast.error('Failed to remove schedule');
        }
    };

    const sendMessage = async e => {
        e.preventDefault();
        try {
            await axiosInstance.post('/hospital-admin/messages', msgForm);
            toast.success('Message sent');
            setMsgForm(p => ({ ...p, title: '', message: '' }));
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send message');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Staff Schedules & Messaging</h2>
                <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Assign shifts to particular staff and send messages to individual staff members.</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Assign Staff Schedule</h4>
                    <form onSubmit={createSchedule} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <select value={form.staffUserId} onChange={e => setForm(p => ({ ...p, staffUserId: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }}>
                            <option value="">Select Staff</option>
                            {staff.map(s => (
                                <option key={s.id} value={s.user_id}>{s.full_name} ({s.staff_role})</option>
                            ))}
                        </select>
                        <input type="date" value={form.shiftDate} onChange={e => setForm(p => ({ ...p, shiftDate: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <select value={form.shiftType} onChange={e => setForm(p => ({ ...p, shiftType: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }}>
                            {['GENERAL','OP','IP','EMERGENCY','ICU','OT','NIGHT'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input placeholder="Location / Room" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <input type="time" value={form.shiftStart} onChange={e => setForm(p => ({ ...p, shiftStart: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <input type="time" value={form.shiftEnd} onChange={e => setForm(p => ({ ...p, shiftEnd: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <input placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            style={{ gridColumn:'span 2', background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <div style={{ gridColumn:'span 2', textAlign:'right' }}>
                            <button type="submit" style={{ background:'#14b8a6', color:'#0b1220', padding:'8px 18px', borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14 }}>
                                Assign Schedule
                            </button>
                        </div>
                    </form>
                </div>

                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Send Staff Message</h4>
                    <form onSubmit={sendMessage} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <select value={msgForm.targetType} onChange={e => setMsgForm(p => ({ ...p, targetType: e.target.value }))}
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }}>
                            <option value="INDIVIDUAL">Individual Staff</option>
                            <option value="ROLE">By Role</option>
                            <option value="ALL">All Staff</option>
                        </select>
                        {msgForm.targetType === 'INDIVIDUAL' && (
                            <select value={msgForm.targetUserId} onChange={e => setMsgForm(p => ({ ...p, targetUserId: e.target.value }))}
                                style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }}>
                                <option value="">Select Staff</option>
                                {staff.map(s => <option key={s.id} value={s.user_id}>{s.full_name}</option>)}
                            </select>
                        )}
                        {msgForm.targetType === 'ROLE' && (
                            <select value={msgForm.targetRole} onChange={e => setMsgForm(p => ({ ...p, targetRole: e.target.value }))}
                                style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }}>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        )}
                        <input value={msgForm.title} onChange={e => setMsgForm(p => ({ ...p, title: e.target.value }))} placeholder="Message title"
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14 }} />
                        <textarea value={msgForm.message} onChange={e => setMsgForm(p => ({ ...p, message: e.target.value }))} placeholder="Message"
                            style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14, minHeight:72 }} />
                        <div style={{ display:'flex', justifyContent:'flex-end' }}>
                            <button type="submit" style={{ background:'#0ea5e9', color:'#fff', padding:'8px 18px', borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14 }}>
                                Send Message
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Schedules For {form.shiftDate}</h4>
                {loading ? (
                    <p style={{ color:'#64748b', fontSize:13 }}>Loading...</p>
                ) : schedules.length === 0 ? (
                    <p style={{ color:'#64748b', fontSize:13 }}>No schedules assigned</p>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {schedules.map(s => (
                            <div key={s.id} style={{ padding:'12px 16px', borderRadius:10, background:'rgba(17,24,39,0.5)', border:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div>
                                    <p style={{ color:'#fff', fontWeight:600, fontSize:14 }}>{s.staff?.full_name || 'Staff'} ({s.staff?.staff_role || 'STAFF'})</p>
                                    <p style={{ color:'#64748b', fontSize:12 }}>{s.shift_type} · {s.shift_start} - {s.shift_end} {s.location ? `· ${s.location}` : ''}</p>
                                </div>
                                <button onClick={() => removeSchedule(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:14 }}>
                                    <i className="fa-solid fa-trash" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Recent Sent Messages</h4>
                {messages.length === 0 ? (
                    <p style={{ color:'#64748b', fontSize:13 }}>No messages sent yet</p>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {messages.slice(0, 8).map(m => (
                            <div key={m.id} style={{ padding:'10px 12px', borderRadius:8, background:'rgba(17,24,39,0.5)', border:'1px solid rgba(255,255,255,0.05)' }}>
                                <p style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{m.title}</p>
                                <p style={{ color:'#94a3b8', fontSize:12 }}>{m.message}</p>
                                <p style={{ color:'#64748b', fontSize:11, marginTop:4 }}>{m.target_type} · {new Date(m.created_at).toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   WARDS PAGE
══════════════════════════════════════════════════════════ */
const WardsPage = () => {
    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20
    };
    const inputStyle = {
        background:'#111827', border:'1px solid #374151', borderRadius:8,
        padding:'10px 12px', color:'#fff', fontSize:14, width:'100%', boxSizing:'border-box'
    };
    const STATUS_COLORS = { AVAILABLE:'#22c55e', OCCUPIED:'#ef4444', MAINTENANCE:'#f59e0b', RESERVED:'#3b82f6' };

    const [wards, setWards]   = useState([]);
    const [form, setForm]     = useState({ wardName:'', wardType:'GENERAL', totalBeds:10, floorNumber:1, description:'' });
    const [loading, setLoading] = useState(false);
    const [selectedWard, setSelectedWard] = useState(null);
    const [beds, setBeds]     = useState([]);
    const [bedsLoading, setBedsLoading] = useState(false);

    const loadWards = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/hospital-admin/wards');
            setWards(res.data?.data || []);
        } catch { toast.error('Failed to load wards'); }
        finally { setLoading(false); }
    };

    const loadBeds = async (wardId) => {
        setBedsLoading(true);
        try {
            const res = await axiosInstance.get(`/hospital-admin/wards/${wardId}/beds`);
            setBeds(res.data?.data || []);
        } catch { toast.error('Failed to load beds'); }
        finally { setBedsLoading(false); }
    };

    useEffect(() => { loadWards(); }, []);

    const createWard = async e => {
        e.preventDefault();
        try {
            await axiosInstance.post('/hospital-admin/wards', form);
            toast.success('Ward created successfully');
            setForm({ wardName:'', wardType:'GENERAL', totalBeds:10, floorNumber:1, description:'' });
            loadWards();
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to create ward'); }
    };

    const deleteWard = async id => {
        if (!window.confirm('Delete this ward?')) return;
        try {
            await axiosInstance.delete(`/hospital-admin/wards/${id}`);
            toast.success('Ward deleted');
            if (selectedWard?.id === id) { setSelectedWard(null); setBeds([]); }
            loadWards();
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to delete ward'); }
    };

    const updateBedStatus = async (bedId, status) => {
        try {
            await axiosInstance.patch(`/hospital-admin/beds/${bedId}/status`, { status });
            toast.success('Bed status updated');
            loadBeds(selectedWard.id);
        } catch { toast.error('Failed to update bed status'); }
    };

    const selectWard = (ward) => {
        setSelectedWard(ward);
        loadBeds(ward.id);
    };

    // ── Summary stats derived from loaded wards
    const totalBeds    = wards.reduce((s, w) => s + (w.bedStats?.total    ?? w.total_beds    ?? 0), 0);
    const availBeds    = wards.reduce((s, w) => s + (w.bedStats?.available ?? w.available_beds ?? 0), 0);
    const occupiedBeds = wards.reduce((s, w) => s + (w.bedStats?.occupied  ?? w.occupied_beds  ?? 0), 0);
    const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Wards &amp; Bed Management</h2>
                <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Create wards, manage bed inventory, and update occupancy status.</p>
            </div>

            {/* Live bed summary bar */}
            {wards.length > 0 && (
                <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                        {[
                            { label:'Total Wards', val: wards.length,  icon:'fa-layer-group', color:'#818cf8' },
                            { label:'Total Beds',  val: totalBeds,      icon:'fa-bed',         color:'#94a3b8' },
                            { label:'Available',   val: availBeds,      icon:'fa-bed-pulse',   color:'#22c55e' },
                            { label:'Occupied',    val: occupiedBeds,   icon:'fa-person-bed',  color:'#ef4444' },
                        ].map(c => (
                            <div key={c.label} style={{ background:'rgba(12,16,36,0.7)', border:'1px solid rgba(255,255,255,0.04)',
                                borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                                <div style={{ width:40, height:40, borderRadius:10,
                                    background:`${c.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <i className={`fa-solid ${c.icon}`} style={{ color:c.color, fontSize:16 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.label}</div>
                                    <div style={{ fontSize:22, fontWeight:800, color:c.color, lineHeight:1.2 }}>{c.val}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ background:'rgba(12,16,36,0.7)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:12, padding:'12px 18px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>Overall Occupancy</span>
                            <span style={{ fontSize:12, fontWeight:800,
                                color: occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 70 ? '#f59e0b' : '#22c55e' }}>
                                {occupancyPct}%
                            </span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${occupancyPct}%`, borderRadius:4, transition:'width 0.5s',
                                background: occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 70 ? '#f59e0b' : '#22c55e' }} />
                        </div>
                    </div>
                </>
            )}

            {/* Create Ward Form */}
            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Create New Ward</h4>
                <form onSubmit={createWard} style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                    <input placeholder="Ward Name (e.g. ICU-A)" value={form.wardName}
                        onChange={e => setForm(p => ({ ...p, wardName: e.target.value }))} required style={inputStyle} />
                    <select value={form.wardType} onChange={e => setForm(p => ({ ...p, wardType: e.target.value }))} style={inputStyle}>
                        {['GENERAL','ICU','CCU','PEDIATRIC','MATERNITY','SURGICAL','ORTHOPEDIC','EMERGENCY','PRIVATE'].map(t =>
                            <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="number" placeholder="Total Beds" value={form.totalBeds} min={1} max={100}
                        onChange={e => setForm(p => ({ ...p, totalBeds: Number(e.target.value) }))} required style={inputStyle} />
                    <input type="number" placeholder="Floor Number" value={form.floorNumber} min={0}
                        onChange={e => setForm(p => ({ ...p, floorNumber: Number(e.target.value) }))} style={inputStyle} />
                    <input placeholder="Description (optional)" value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, gridColumn:'span 1' }} />
                    <div style={{ display:'flex', alignItems:'flex-end' }}>
                        <button type="submit" style={{ width:'100%', background:'#14b8a6', color:'#0b1220',
                            padding:'10px 18px', borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14 }}>
                            <i className="fa-solid fa-plus" style={{ marginRight:8 }} />Create Ward
                        </button>
                    </div>
                </form>
            </div>

            {/* Wards List */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>All Wards</h4>
                    {loading ? <p style={{ color:'#64748b', fontSize:13 }}>Loading...</p> :
                    wards.length === 0 ? <p style={{ color:'#64748b', fontSize:13 }}>No wards created yet</p> :
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:400, overflowY:'auto' }}>
                        {wards.map(w => (
                            <div key={w.id} onClick={() => selectWard(w)} style={{
                                padding:'12px 14px', borderRadius:10, cursor:'pointer',
                                background: selectedWard?.id === w.id ? 'rgba(45,212,191,0.1)' : 'rgba(17,24,39,0.5)',
                                border: selectedWard?.id === w.id ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                transition:'all 0.15s'
                            }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                                    <div>
                                        <p style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{w.ward_name}</p>
                                        <p style={{ color:'#64748b', fontSize:12 }}>{w.ward_type} · Floor {w.floor_number}</p>
                                        <p style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>
                                            <span style={{ color:'#22c55e' }}>{w.bedStats?.available ?? w.available_beds ?? 0}</span> avail /
                                            <span style={{ color:'#ef4444', marginLeft:4 }}>{w.bedStats?.occupied ?? w.occupied_beds ?? 0}</span> occ /
                                            <span style={{ marginLeft:4 }}>{w.bedStats?.total ?? w.total_beds ?? 0} total</span>
                                        </p>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); deleteWard(w.id); }}
                                        style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', fontSize:13, padding:4 }}>
                                        <i className="fa-solid fa-trash" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>}
                </div>

                {/* Bed Grid */}
                <div style={panelStyle}>
                    {!selectedWard ? (
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, flexDirection:'column', gap:12 }}>
                            <i className="fa-solid fa-bed" style={{ fontSize:32, color:'#374151' }} />
                            <p style={{ color:'#64748b', fontSize:14 }}>Select a ward to view beds</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                                <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>{selectedWard.ward_name} — Beds</h4>
                                <div style={{ display:'flex', gap:12, fontSize:11 }}>
                                    {Object.entries(STATUS_COLORS).map(([s,c]) => (
                                        <span key={s} style={{ color:c, display:'flex', alignItems:'center', gap:4 }}>
                                            <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {bedsLoading ? <p style={{ color:'#64748b', fontSize:13 }}>Loading beds...</p> :
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:8 }}>
                                {beds.map(bed => (
                                    <div key={bed.id} style={{
                                        padding:'10px 8px', borderRadius:10, textAlign:'center',
                                        background:'rgba(17,24,39,0.6)',
                                        border:`1px solid ${STATUS_COLORS[bed.status] || '#374151'}30`,
                                        boxShadow:`0 0 8px ${STATUS_COLORS[bed.status] || '#374151'}15`
                                    }}>
                                        <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:6 }}>{bed.bed_number}</div>
                                        <select value={bed.status}
                                            onChange={e => updateBedStatus(bed.id, e.target.value)}
                                            style={{ fontSize:10, background:'transparent', border:'none', color:STATUS_COLORS[bed.status] || '#94a3b8',
                                                cursor:'pointer', fontWeight:600, textAlign:'center', width:'100%', outline:'none' }}>
                                            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   WARD ASSIGNMENT PAGE
══════════════════════════════════════════════════════════ */
const WardAssignmentPage = () => {
    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20
    };
    const inputStyle = {
        background:'#111827', border:'1px solid #374151', borderRadius:8,
        padding:'10px 12px', color:'#fff', fontSize:14, width:'100%', boxSizing:'border-box'
    };

    const [wards, setWards]           = useState([]);
    const [doctors, setDoctors]       = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [form, setForm]             = useState({ wardId:'', doctorUserId:'', isPrimary: false });
    const [loading, setLoading]       = useState(false);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [wardRes, docRes, assignRes] = await Promise.all([
                axiosInstance.get('/hospital-admin/wards'),
                axiosInstance.get('/hospital-admin/doctors'),
                axiosInstance.get('/hospital-admin/ward-assignments'),
            ]);
            setWards(wardRes.data?.data || []);
            setDoctors(docRes.data?.data || []);
            setAssignments(assignRes.data?.data || []);
        } catch { toast.error('Failed to load data'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAll(); }, []);

    const assign = async e => {
        e.preventDefault();
        try {
            await axiosInstance.post('/hospital-admin/ward-assignments', form);
            toast.success('Doctor assigned to ward');
            setForm({ wardId:'', doctorUserId:'', isPrimary: false });
            loadAll();
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to assign'); }
    };

    const removeAssignment = async id => {
        try {
            await axiosInstance.delete(`/hospital-admin/ward-assignments/${id}`);
            toast.success('Assignment removed');
            loadAll();
        } catch { toast.error('Failed to remove assignment'); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Ward Doctor Assignments</h2>
                <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Assign doctors to wards so they can manage inpatient cases.</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.8fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Assign Doctor to Ward</h4>
                    <form onSubmit={assign} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        <select value={form.wardId} onChange={e => setForm(p => ({ ...p, wardId: e.target.value }))} required style={inputStyle}>
                            <option value="">Select Ward</option>
                            {wards.map(w => <option key={w.id} value={w.id}>{w.ward_name} ({w.ward_type})</option>)}
                        </select>
                        <select value={form.doctorUserId} onChange={e => setForm(p => ({ ...p, doctorUserId: e.target.value }))} required style={inputStyle}>
                            <option value="">Select Doctor</option>
                            {doctors.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name} — {d.specialization || 'General'}</option>)}
                        </select>
                        <label style={{ display:'flex', alignItems:'center', gap:8, color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
                            <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(p => ({ ...p, isPrimary: e.target.checked }))}
                                style={{ accentColor:'#14b8a6' }} />
                            Mark as Primary Doctor
                        </label>
                        <button type="submit" style={{ background:'#14b8a6', color:'#0b1220', padding:'10px 18px',
                            borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14 }}>
                            <i className="fa-solid fa-link" style={{ marginRight:8 }} />Assign
                        </button>
                    </form>
                </div>

                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>Current Assignments</h4>
                    {loading ? <p style={{ color:'#64748b', fontSize:13 }}>Loading...</p> :
                    assignments.length === 0 ? <p style={{ color:'#64748b', fontSize:13 }}>No assignments yet</p> :
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:400, overflowY:'auto' }}>
                        {assignments.map(a => (
                            <div key={a.id} style={{ padding:'12px 16px', borderRadius:10, background:'rgba(17,24,39,0.5)',
                                border:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div>
                                    <p style={{ color:'#fff', fontWeight:600, fontSize:14 }}>
                                        {a.doctor?.full_name || 'Doctor'}
                                        {a.is_primary && <span style={{ marginLeft:8, background:'rgba(45,212,191,0.15)',
                                            color:'#2dd4bf', fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:700 }}>PRIMARY</span>}
                                    </p>
                                    <p style={{ color:'#64748b', fontSize:12 }}>
                                        {a.doctor?.specialization || 'General'} → {a.ward?.ward_name || 'Ward'} ({a.ward?.ward_type})
                                    </p>
                                    <p style={{ color:'#475569', fontSize:11, marginTop:2 }}>
                                        Assigned {new Date(a.assigned_at || a.created_at).toLocaleDateString('en-IN')}
                                    </p>
                                </div>
                                <button onClick={() => removeAssignment(a.id)}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:14, padding:4 }}>
                                    <i className="fa-solid fa-unlink" />
                                </button>
                            </div>
                        ))}
                    </div>}
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   AMBULANCE PAGE
══════════════════════════════════════════════════════════ */
const AmbulancePage = () => {
    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20
    };
    const inputStyle = {
        background:'#111827', border:'1px solid #374151', borderRadius:8,
        padding:'10px 12px', color:'#fff', fontSize:14, width:'100%', boxSizing:'border-box'
    };

    const [location, setLocation] = useState({ latitude:'', longitude:'', address:'', phone:'' });
    const [locLoading, setLocLoading] = useState(false);
    const [bedStats, setBedStats]   = useState(null);
    const [detecting, setDetecting] = useState(false);

    useEffect(() => {
        // Load hospital location
        axiosInstance.get('/hospital-admin/location')
            .then(res => { if (res.data?.data) setLocation(res.data.data); })
            .catch(() => {});
        // Load bed stats
        axiosInstance.get('/hospital-admin/bed-stats')
            .then(res => { if (res.data?.data) setBedStats(res.data.data); })
            .catch(() => {});
    }, []);

    const saveLocation = async e => {
        e.preventDefault();
        setLocLoading(true);
        try {
            await axiosInstance.put('/hospital-admin/location', location);
            toast.success('Hospital location saved');
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to save location'); }
        finally { setLocLoading(false); }
    };

    const detectGPS = () => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setDetecting(true);
        navigator.geolocation.getCurrentPosition(
            pos => {
                setLocation(p => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
                toast.success('GPS coordinates detected');
                setDetecting(false);
            },
            () => { toast.error('Failed to detect location'); setDetecting(false); }
        );
    };

    const mapsUrl = location.latitude && location.longitude
        ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
        : null;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Emergency &amp; Hospital Location</h2>
                <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Set hospital GPS coordinates for ambulance navigation and manage emergency resources.</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16 }}>
                {/* Location Form */}
                <div style={panelStyle}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                        <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>
                            <i className="fa-solid fa-location-dot" style={{ marginRight:8, color:'#2dd4bf' }} />
                            Hospital Location
                        </h4>
                        {mapsUrl && (
                            <a href={mapsUrl} target="_blank" rel="noreferrer" style={{
                                fontSize:12, color:'#2dd4bf', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                                <i className="fa-solid fa-map" />View on Maps
                            </a>
                        )}
                    </div>
                    <form onSubmit={saveLocation} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                                <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>Latitude</label>
                                <input value={location.latitude} onChange={e => setLocation(p => ({ ...p, latitude: e.target.value }))}
                                    placeholder="e.g. 10.7869" style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>Longitude</label>
                                <input value={location.longitude} onChange={e => setLocation(p => ({ ...p, longitude: e.target.value }))}
                                    placeholder="e.g. 79.1378" style={inputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>Full Address</label>
                            <textarea value={location.address} onChange={e => setLocation(p => ({ ...p, address: e.target.value }))}
                                placeholder="Hospital full address..." rows={2}
                                style={{ ...inputStyle, resize:'vertical' }} />
                        </div>
                        <div>
                            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>Emergency Phone</label>
                            <input value={location.phone} onChange={e => setLocation(p => ({ ...p, phone: e.target.value }))}
                                placeholder="e.g. 0422-1234567" style={inputStyle} />
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <button type="button" onClick={detectGPS} disabled={detecting} style={{
                                flex:1, padding:'10px 16px', borderRadius:8,
                                background:'rgba(99,102,241,0.15)', color:'#818cf8',
                                border:'1px solid rgba(99,102,241,0.3)', cursor:'pointer', fontWeight:600, fontSize:13 }}>
                                {detecting
                                    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight:8 }} />Detecting...</>
                                    : <><i className="fa-solid fa-crosshairs" style={{ marginRight:8 }} />Auto-Detect GPS</>}
                            </button>
                            <button type="submit" disabled={locLoading} style={{
                                flex:1, background:'#14b8a6', color:'#0b1220',
                                padding:'10px 16px', borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:14 }}>
                                {locLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-floppy-disk" style={{ marginRight:8 }} />Save Location</>}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Bed Stats Widget */}
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:14 }}>
                        <i className="fa-solid fa-bed-pulse" style={{ marginRight:8, color:'#2dd4bf' }} />
                        Live Bed Status
                    </h4>
                    {!bedStats ? (
                        <p style={{ color:'#64748b', fontSize:13 }}>Loading bed stats...</p>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {[{ label:'Total Beds', value: bedStats.total, color:'#94a3b8' },
                              { label:'Available', value: bedStats.available, color:'#22c55e' },
                              { label:'Occupied', value: bedStats.occupied, color:'#ef4444' },
                              { label:'In Maintenance', value: bedStats.maintenance, color:'#f59e0b' },
                              { label:'Cleaning', value: bedStats.cleaning, color:'#3b82f6' },
                            ].map(s => (
                                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                    padding:'10px 14px', background:'rgba(17,24,39,0.5)', borderRadius:10,
                                    border:'1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ color:'#94a3b8', fontSize:13 }}>{s.label}</span>
                                    <span style={{ color: s.color, fontWeight:700, fontSize:18 }}>{s.value ?? '—'}</span>
                                </div>
                            ))}
                            {bedStats.byWard && bedStats.byWard.length > 0 && (
                                <div style={{ marginTop:8 }}>
                                    <p style={{ fontSize:11, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8 }}>By Ward</p>
                                    {bedStats.byWard.slice(0,5).map(w => (
                                        <div key={w.wardName} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0',
                                            borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13 }}>
                                            <span style={{ color: w.available <= 2 ? '#f87171' : '#94a3b8' }}>
                                                {w.wardName} {w.available <= 2 ? '⚠️' : ''}
                                            </span>
                                            <span style={{ color: w.available === 0 ? '#ef4444' : w.available <= 2 ? '#f59e0b' : '#22c55e', fontWeight:600 }}>
                                                {w.available}/{w.total} free
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Ambulance Pool + Emergency */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:12 }}>
                        <i className="fa-solid fa-truck-medical" style={{ marginRight:8, color:'#2dd4bf' }} />
                        Ambulance Pool
                    </h4>
                    {[{id:'AMB-01',status:'Available',color:'#22c55e'},{id:'AMB-02',status:'En Route',color:'#f59e0b'},{id:'AMB-03',status:'Standby',color:'#3b82f6'}].map(a => (
                        <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'10px 12px', background:'rgba(17,24,39,0.5)', borderRadius:8,
                            border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 }}>
                            <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{a.id}</span>
                            <span style={{ color: a.color, fontSize:12, fontWeight:700 }}>{a.status}</span>
                        </div>
                    ))}
                </div>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, marginBottom:12 }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight:8, color:'#ef4444' }} />
                        Emergency Actions
                    </h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <button onClick={() => toast.success('Ambulance dispatched!')} style={{
                            width:'100%', padding:'12px 16px', borderRadius:8, background:'rgba(239,68,68,0.1)',
                            color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', fontWeight:700, fontSize:14 }}>
                            <i className="fa-solid fa-paper-plane" style={{ marginRight:8 }} />Dispatch Ambulance
                        </button>
                        <button onClick={() => toast.success('Code Blue triggered!')} style={{
                            width:'100%', padding:'12px 16px', borderRadius:8, background:'rgba(59,130,246,0.1)',
                            color:'#3b82f6', border:'1px solid rgba(59,130,246,0.2)', cursor:'pointer', fontWeight:700, fontSize:14 }}>
                            <i className="fa-solid fa-bolt" style={{ marginRight:8 }} />Code Blue Alert
                        </button>
                        <button onClick={() => toast.success('Case resolved!')} style={{
                            width:'100%', padding:'12px 16px', borderRadius:8,
                            background:'rgba(34,197,94,0.1)', color:'#22c55e',
                            border:'1px solid rgba(34,197,94,0.2)', cursor:'pointer', fontWeight:700, fontSize:14 }}>
                            <i className="fa-solid fa-check" style={{ marginRight:8 }} />Mark Resolved
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   FINANCE PAGE
══════════════════════════════════════════════════════════ */
const FinancePage = () => {
    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:20
    };
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Finance &amp; Billing</h2>
            <p style={{ color:'#94a3b8', fontSize:14 }}>Daily reports, pending invoices and payment modes.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>Today's Revenue</h4>
                    <p style={{ fontSize:28, fontWeight:800, color:'#2dd4bf', marginTop:12 }}>₹ 15,700</p>
                    <p style={{ color:'#64748b', fontSize:12, marginTop:4 }}>+8.4% from yesterday</p>
                </div>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>Pending Bills</h4>
                    <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                        {[{id:'#PID-8201',amt:'₹ 2,450'},{id:'#PID-8199',amt:'₹ 1,200'},{id:'#PID-8195',amt:'₹ 5,800'}].map(b => (
                            <div key={b.id} style={{ display:'flex', justifyContent:'space-between',
                                padding:'8px 12px', background:'rgba(17,24,39,0.5)', borderRadius:8 }}>
                                <span style={{ color:'#94a3b8', fontSize:13 }}>{b.id}</span>
                                <span style={{ color:'#f59e0b', fontSize:13, fontWeight:600 }}>{b.amt}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:14 }}>Payment Modes</h4>
                    <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                        {[{mode:'Cash',pct:45,color:'#2dd4bf'},{mode:'Card/UPI',pct:47,color:'#3b82f6'},{mode:'Insurance',pct:8,color:'#a855f7'}].map(p => (
                            <div key={p.mode}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                    <span style={{ color:'#94a3b8', fontSize:13 }}>{p.mode}</span>
                                    <span style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{p.pct}%</span>
                                </div>
                                <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:9999 }}>
                                    <div style={{ width:`${p.pct}%`, height:'100%', background:p.color, borderRadius:9999 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   ANALYTICS PAGE
══════════════════════════════════════════════════════════ */
const AnalyticsPage = ({ dashData }) => {
    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:24
    };
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Analytics &amp; Reports</h2>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Patient Flow — Weekly</h4>
                    <div style={{ height:280 }}><PatientFlowChart /></div>
                </div>
                <div style={panelStyle}>
                    <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Staff by Role</h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {dashData?.stats?.byRole && Object.entries(dashData.stats.byRole).map(([role, count]) => (
                            <div key={role} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                padding:'10px 14px', background:'rgba(17,24,39,0.5)', borderRadius:10,
                                border:'1px solid rgba(255,255,255,0.05)' }}>
                                <RoleBadge role={role} />
                                <span style={{ color:'#fff', fontWeight:700 }}>{count}</span>
                            </div>
                        ))}
                        {(!dashData?.stats?.byRole || Object.keys(dashData.stats.byRole).length === 0) && (
                            <p style={{ color:'#64748b', fontSize:14 }}>No staff data available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   SETTINGS PAGE
══════════════════════════════════════════════════════════ */
const SettingsPage = ({ user, handleLogout }) => {
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePwdChange = async e => {
        e.preventDefault();
        if (!oldPass || !newPass) { toast.error('Both fields required'); return; }
        setLoading(true);
        try {
            await axiosInstance.post('/auth/change-password', { currentPassword: oldPass, newPassword: newPass });
            toast.success('Password changed successfully');
            setOldPass(''); setNewPass('');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to change password');
        } finally { setLoading(false); }
    };

    const panelStyle = {
        background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.04)', borderRadius:16, padding:24
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Outfit,sans-serif' }}>Settings</h2>

            {/* Profile info */}
            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Account Information</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {[
                        { label:'Email', value: user?.email },
                        { label:'Role', value:'HOSPITAL_ADMIN' },
                        { label:'Hospital', value: user?.hospital?.hospital_name },
                        { label:'Hospital Code', value: user?.hospital?.hospital_code },
                    ].map(row => (
                        <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color:'#64748b', fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>{row.label}</span>
                            <span style={{ color:'#fff', fontSize:14, fontFamily: row.label==='Hospital Code' ? 'monospace' : 'inherit' }}>
                                {row.value || '—'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Change password */}
            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Change Password</h4>
                <form onSubmit={handlePwdChange} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {[{l:'Current Password',v:oldPass,s:setOldPass},{l:'New Password',v:newPass,s:setNewPass}].map(({l,v,s}) => (
                        <div key={l}>
                            <label style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                                letterSpacing:'0.04em', display:'block', marginBottom:6 }}>{l}</label>
                            <input type="password" value={v} onChange={e => s(e.target.value)}
                                style={{ width:'100%', background:'#111827', border:'1px solid #374151',
                                    borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                        </div>
                    ))}
                    <button type="submit" disabled={loading} style={{
                        padding:'10px 24px', width:'fit-content', borderRadius:10, fontWeight:700, fontSize:14,
                        background:'#14b8a6', color:'#0b1220', border:'none', cursor:'pointer',
                        opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', gap:8
                    }}>
                        {loading && <i className="fa-solid fa-spinner fa-spin" />}
                        Update Password
                    </button>
                </form>
            </div>

            {/* Logout */}
            <div style={panelStyle}>
                <h4 style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:16 }}>Session</h4>
                <button onClick={handleLogout} style={{
                    padding:'10px 24px', borderRadius:10, fontWeight:700, fontSize:14,
                    background:'rgba(239,68,68,0.1)', color:'#f87171',
                    border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:8
                }}>
                    <i className="fa-solid fa-right-from-bracket" /> Logout
                </button>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════════════════════════ */
const LoginScreen = ({ onLogin, loading, error, onClearError }) => {
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [showPwd,  setShowPwd]  = useState(false);

    const handleSubmit = e => { e.preventDefault(); onLogin({ email, password }); };

    return (
        <div style={{
            position:'fixed', inset:0, zIndex:50, display:'flex',
            alignItems:'center', justifyContent:'center', padding:16,
            background:'radial-gradient(circle at 10% 10%, rgba(12,18,48,0.85) 0%, rgba(6,10,30,0.95) 35%, rgba(4,6,16,1) 100%)',
            backgroundColor:'#040617'
        }}>
            <div style={{
                width:'100%', maxWidth:900, height:620, borderRadius:28,
                overflow:'hidden', display:'flex', boxShadow:'0 32px 64px rgba(0,0,0,0.6)',
                background:'rgba(12,16,36,0.7)', backdropFilter:'blur(12px)',
                border:'1px solid rgba(255,255,255,0.04)'
            }}>
                {/* Left panel */}
                <div style={{ flex:1, padding:'48px 56px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                    <div style={{ marginBottom:36 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                            <div style={{
                                width:44, height:44, borderRadius:12,
                                background:'linear-gradient(135deg,#2dd4bf,#4f46e5)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                boxShadow:'0 4px 16px rgba(45,212,191,0.2)'
                            }}>
                                <i className="fa-solid fa-heart-pulse" style={{ color:'#fff', fontSize:18 }} />
                            </div>
                            <span style={{ fontSize:22, fontFamily:'Outfit,sans-serif', fontWeight:700, color:'#fff', letterSpacing:-0.5 }}>
                                Med<span style={{ color:'#2dd4bf' }}>Track</span> Pro
                            </span>
                        </div>
                        <h1 style={{ fontSize:30, fontWeight:700, color:'#fff', marginBottom:6 }}>Welcome Back</h1>
                        <p style={{ color:'#94a3b8', fontSize:14 }}>
                            Sign in to access your hospital admin portal.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
                        <div>
                            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#94a3b8',
                                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Admin ID / Email</label>
                            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                <i className="fa-solid fa-user-shield" style={{
                                    position:'absolute', left:16, color:'#64748b', fontSize:14, zIndex:1
                                }} />
                                <input type="email" placeholder="e.g. admin@hospital.gov.in"
                                    value={email} onChange={e => { setEmail(e.target.value); onClearError?.(); }}
                                    required autoFocus
                                    style={{
                                        width:'100%', background:'rgba(17,24,39,0.6)', border:'1px solid #374151',
                                        borderRadius:12, padding:'14px 16px 14px 44px', color:'#fff', fontSize:14,
                                        outline:'none', transition:'border-color 0.2s', boxSizing:'border-box'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#2dd4bf'}
                                    onBlur={e => e.target.style.borderColor = '#374151'} />
                            </div>
                        </div>
                        <div>
                            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#94a3b8',
                                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Secure Key</label>
                            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                <i className="fa-solid fa-key" style={{
                                    position:'absolute', left:16, color:'#64748b', fontSize:14, zIndex:1
                                }} />
                                <input type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                                    value={password} onChange={e => { setPassword(e.target.value); onClearError?.(); }}
                                    required
                                    style={{
                                        width:'100%', background:'rgba(17,24,39,0.6)', border:'1px solid #374151',
                                        borderRadius:12, padding:'14px 44px 14px 44px', color:'#fff', fontSize:14,
                                        outline:'none', transition:'border-color 0.2s', boxSizing:'border-box'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#2dd4bf'}
                                    onBlur={e => e.target.style.borderColor = '#374151'} />
                                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                                    position:'absolute', right:16, background:'none', border:'none',
                                    color:'#64748b', cursor:'pointer', fontSize:15, zIndex:1
                                }}>
                                    <i className={`fa-solid ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                            <label style={{ display:'flex', alignItems:'center', gap:8, color:'#94a3b8', cursor:'pointer' }}>
                                <input type="checkbox" style={{ accentColor:'#14b8a6' }} />
                                Remember workstation
                            </label>
                            <a href="#" style={{ color:'#2dd4bf', textDecoration:'none' }}>Forgot credentials?</a>
                        </div>

                        {error && (
                            <div style={{
                                display:'flex', alignItems:'center', gap:10, fontSize:13,
                                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                                color:'#f87171', padding:'10px 14px', borderRadius:10
                            }}>
                                <i className="fa-solid fa-circle-exclamation" />
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} style={{
                            width:'100%', background:'linear-gradient(135deg,#14b8a6,#4f46e5)',
                            color:'#fff', fontWeight:700, fontSize:15, padding:'15px 20px',
                            borderRadius:12, border:'none', cursor:'pointer', boxShadow:'0 4px 20px rgba(45,212,191,0.2)',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                            opacity: loading ? 0.8 : 1
                        }}>
                            {loading
                                ? <><i className="fa-solid fa-spinner fa-spin" /> Authenticating…</>
                                : 'Authenticate Access'
                            }
                        </button>
                    </form>

                    <div style={{ marginTop:36, paddingTop:24, borderTop:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                        <p style={{ fontSize:10, color:'#475569' }}>
                            Restricted System · Authorized Personnel Only · MedTrack v2.4.0
                        </p>
                    </div>
                </div>

                {/* Right panel */}
                <div style={{
                    width:380, background:'rgba(11,18,32,0.4)',
                    borderLeft:'1px solid rgba(255,255,255,0.05)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    padding:48, position:'relative'
                }}>
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(79,70,229,0.06),rgba(59,130,246,0.06))' }} />
                    <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
                        <div style={{
                            width:96, height:96, margin:'0 auto 24px',
                            background:'linear-gradient(135deg,#2dd4bf,#4f46e5)',
                            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                            boxShadow:'0 0 40px rgba(45,212,191,0.18)'
                        }}>
                            <i className="fa-solid fa-shield-halved" style={{ fontSize:40, color:'#fff' }} />
                        </div>
                        <h2 style={{ fontSize:22, fontWeight:700, color:'#fff', marginBottom:12 }}>Central Command</h2>
                        <p style={{ color:'#94a3b8', fontSize:14, lineHeight:1.7 }}>
                            Manage staff, monitor patient flow, and oversee facility resources in real-time.
                        </p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:32 }}>
                            {[{ label:'Uptime', value:'99.9%', color:'#2dd4bf' }, { label:'Encryption', value:'256-bit', color:'#818cf8' }].map(c => (
                                <div key={c.label} style={{
                                    background:'rgba(255,255,255,0.05)', padding:16, borderRadius:12
                                }}>
                                    <div style={{ fontSize:20, fontWeight:700, color:c.color }}>{c.value}</div>
                                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   MAIN PAGE (ENTRY POINT)
══════════════════════════════════════════════════════════ */
const HospitalAdminPage = () => {
    const { isAuthenticated, user, hospitalAdminLogin, logout, isLoading, error, setError } = useAuthStore();
    const [page,     setPage]     = useState('DASHBOARD');
    const [dashData, setDashData] = useState(null);
    const [bedAlerts, setBedAlerts] = useState([]);   // low bed wards
    const [showBedAlerts, setShowBedAlerts] = useState(false);

    const isHospitalAdmin = isAuthenticated && user?.role === 'HOSPITAL_ADMIN';

    const fetchDashboard = useCallback(async () => {
        if (!isHospitalAdmin) return;
        try {
            const res = await axiosInstance.get('/hospital-admin/dashboard');
            if (res.data?.success) setDashData(res.data.data);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                logout();
            }
        }
    }, [isHospitalAdmin, logout]);

    // Poll bed stats every 60s — generate low bed alerts
    const fetchBedAlerts = useCallback(async () => {
        if (!isHospitalAdmin) return;
        try {
            const res = await axiosInstance.get('/hospital-admin/bed-stats');
            const stats = res.data?.data;
            if (!stats) return;
            const LOW_THRESHOLD = 3; // flag if available <= 3
            const alerts = (stats.byWard || []).filter(w => w.total > 0 && w.available <= LOW_THRESHOLD);
            setBedAlerts(alerts);
        } catch { /* silent */ }
    }, [isHospitalAdmin]);

    useEffect(() => {
        if (isHospitalAdmin) { fetchDashboard(); fetchBedAlerts(); }
    }, [isHospitalAdmin]);

    useEffect(() => {
        if (!isHospitalAdmin) return;
        const interval = setInterval(fetchBedAlerts, 60000);
        return () => clearInterval(interval);
    }, [isHospitalAdmin, fetchBedAlerts]);

    const handleLogout = () => logout();

    /* ── not logged in ── */
    if (!isHospitalAdmin) {
        return (
            <LoginScreen
                loading={isLoading}
                error={error}
                onClearError={() => setError(null)}
                onLogin={async creds => { await hospitalAdminLogin(creds); }}
            />
        );
    }

    const hospital = user?.hospital || dashData?.hospital;

    /* ── logged in ── */
    return (
        <div style={{
            display:'flex', height:'100vh', overflow:'hidden',
            fontFamily:'"Plus Jakarta Sans",sans-serif',
            background:'radial-gradient(circle at 10% 10%, rgba(12,18,48,0.85) 0%, rgba(6,10,30,0.95) 35%, rgba(4,6,16,1) 100%)',
            backgroundColor:'#040617', color:'#cbd5e1'
        }}>
            <Sidebar
                page={page}
                setPage={setPage}
                hospital={hospital}
                user={user}
                handleLogout={handleLogout}
            />

            {/* Main */}
            <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {/* Header */}
                <header style={{
                    height:80, display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'0 32px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    background:'rgba(6,8,20,0.6)', backdropFilter:'blur(12px)', zIndex:30, flexShrink:0
                }}>
                    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        <div>
                            <div style={{ fontSize:18, fontFamily:'Outfit,sans-serif', fontWeight:700, color:'#fff' }}>
                                {({ DASHBOARD:'Dashboard Overview', ANALYTICS:'Analytics & Reports',
                                   STAFF:'Staff Management', SCHEDULE:'Staff Schedules',
                                   WARDS:'Wards & Bed Management', WARD_ASSIGN:'Ward Doctor Assignments',
                                   AMBULANCE:'Emergency & Hospital Location', FINANCE:'Finance & Billing',
                                   SETTINGS:'Settings' }[page])}
                            </div>
                            <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                                {hospital?.hospital_name} · Hospital Admin
                            </div>
                        </div>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                        {/* Live mini stats */}
                        <div style={{ display:'flex', alignItems:'center', gap:16, fontSize:13,
                            background:'rgba(11,18,32,0.5)', padding:'8px 16px', borderRadius:9999,
                            border:'1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color:'#94a3b8' }}>OP: <strong style={{ color:'#fff' }}>{dashData?.stats?.totalStaff || 142}</strong></span>
                            <span style={{ color:'#94a3b8' }}>IP: <strong style={{ color:'#fff' }}>{dashData?.stats?.totalDoctors || 45}</strong></span>
                        </div>

                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            {/* Low Bed Alert Bell */}
                            <div style={{ position:'relative' }}>
                                <button onClick={() => setShowBedAlerts(p => !p)} style={{
                                    width:36, height:36, borderRadius:'50%',
                                    background: bedAlerts.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                                    border: bedAlerts.length > 0 ? '1px solid rgba(239,68,68,0.3)' : 'none',
                                    cursor:'pointer',
                                    color: bedAlerts.length > 0 ? '#ef4444' : '#94a3b8',
                                    fontSize:15, display:'flex', alignItems:'center', justifyContent:'center',
                                    position:'relative'
                                }}>
                                    <i className="fa-regular fa-bell" />
                                    {bedAlerts.length > 0 && (
                                        <span style={{
                                            position:'absolute', top:-4, right:-4,
                                            width:16, height:16, borderRadius:'50%',
                                            background:'#ef4444', color:'#fff', fontSize:9,
                                            fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
                                            border:'2px solid #040617'
                                        }}>{bedAlerts.length > 9 ? '9+' : bedAlerts.length}</span>
                                    )}
                                </button>

                                {/* Dropdown */}
                                {showBedAlerts && (
                                    <div style={{
                                        position:'absolute', top:44, right:0, width:300, zIndex:9999,
                                        background:'#0d1227', border:'1px solid rgba(239,68,68,0.2)',
                                        borderRadius:12, boxShadow:'0 12px 40px rgba(0,0,0,0.5)',
                                        overflow:'hidden'
                                    }} onClick={e => e.stopPropagation()}>
                                        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                                            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                            <span style={{ fontWeight:700, color:'#ef4444', fontSize:13 }}>
                                                🛑 Low Bed Alerts ({bedAlerts.length})
                                            </span>
                                            <button onClick={() => setShowBedAlerts(false)}
                                                style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:16 }}>x</button>
                                        </div>
                                        <div style={{ maxHeight:280, overflowY:'auto' }}>
                                            {bedAlerts.length === 0 ? (
                                                <p style={{ padding:'20px 16px', color:'#64748b', fontSize:13, textAlign:'center' }}>
                                                    ✅ All wards have adequate beds
                                                </p>
                                            ) : bedAlerts.map((w, i) => (
                                                <div key={i} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)',
                                                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                    <div>
                                                        <div style={{ color:'#f1f5f9', fontWeight:600, fontSize:13 }}>{w.wardName}</div>
                                                        <div style={{ color:'#64748b', fontSize:11, marginTop:2 }}>{w.wardType}</div>
                                                    </div>
                                                    <span style={{
                                                        fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
                                                        background: w.available === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: w.available === 0 ? '#ef4444' : '#f59e0b',
                                                        border: `1px solid ${w.available === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
                                                    }}>
                                                        {w.available === 0 ? 'FULL' : `${w.available} left`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding:'10px 16px', background:'rgba(0,0,0,0.2)', textAlign:'center' }}>
                                            <button onClick={() => { setPage('WARDS'); setShowBedAlerts(false); }}
                                                style={{ color:'#2dd4bf', fontSize:12, fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>
                                                → Manage Wards & Beds
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleLogout} title="Logout" style={{
                                width:36, height:36, borderRadius:'50%', background:'rgba(239,68,68,0.1)',
                                border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', color:'#ef4444', fontSize:14,
                                display:'flex', alignItems:'center', justifyContent:'center'
                            }}>
                                <i className="fa-solid fa-right-from-bracket" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <div style={{ flex:1, overflowY:'auto', padding:'32px' }}>
                    {page === 'DASHBOARD'  && <Dashboard  dashData={dashData} setPage={setPage} />}
                    {page === 'ANALYTICS'  && <AnalyticsPage dashData={dashData} />}
                    {page === 'STAFF'      && <StaffPage />}
                    {page === 'SCHEDULE'   && <SchedulePage />}
                    {page === 'WARDS'      && <WardsPage />}
                    {page === 'WARD_ASSIGN' && <WardAssignmentPage />}
                    {page === 'AMBULANCE'  && <AmbulancePage />}
                    {page === 'FINANCE'    && <FinancePage />}
                    {page === 'SETTINGS'   && <SettingsPage user={user} handleLogout={handleLogout} />}
                </div>
            </main>
        </div>
    );
};

export default HospitalAdminPage;
