/**
 * DistrictDashboardPage.jsx
 * District Health Officer portal — Madurai-style monitoring dashboard
 * Features: hospital overview, ambulance tracking, AI alerts, disease trends,
 *           bed availability, revenue, ward-wise breakdown
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE = API.replace(/\/+$/, '');
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

function apiFetch(path, options = {}) {
    const token = localStorage.getItem('districtToken');
    return fetch(`${API_ROOT}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message || 'Failed'); return d; });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeHospitalType = t => String(t || '').trim().toUpperCase();
const displayHospitalType = t => {
    const type = normalizeHospitalType(t);
    if (type === 'GOVERNMENT') return 'GH';
    if (type === 'PRIVATE') return 'Private';
    if (type === 'CLINIC') return 'Clinic';
    return type || 'Unknown';
};
const matchesTypeFilter = (hospitalType, filterType) => {
    if (filterType === 'all') return true;
    const type = normalizeHospitalType(hospitalType);
    if (filterType === 'GH') return type === 'GH' || type === 'GOVERNMENT';
    return type === filterType;
};
const severityColor = s => ({ CRITICAL: '#dc2626', WARNING: '#d97706', INFO: '#2563eb' }[s] || '#6b7280');
const severityBg    = s => ({ CRITICAL: '#fee2e2', WARNING: '#fef3c7', INFO: '#dbeafe' }[s] || '#f3f4f6');
const ambulanceColor = s => ({ AVAILABLE: '#16a34a', DISPATCHED: '#2563eb', MAINTENANCE: '#d97706', OFFLINE: '#9ca3af' }[s?.toUpperCase()] || '#6b7280');
const ambulanceBg   = s => ({ AVAILABLE: '#dcfce7', DISPATCHED: '#dbeafe', MAINTENANCE: '#fef3c7', OFFLINE: '#f3f4f6' }[s?.toUpperCase()] || '#f3f4f6');
const typeColor = t => ({ GH: '#2563eb', GOVERNMENT: '#2563eb', PHC: '#7c3aed', PRIVATE: '#d97706', CLINIC: '#0f766e' }[normalizeHospitalType(t)] || '#6b7280');
const typeBg    = t => ({ GH: '#dbeafe', GOVERNMENT: '#dbeafe', PHC: '#f5f3ff', PRIVATE: '#fef3c7', CLINIC: '#ccfbf1' }[normalizeHospitalType(t)] || '#f3f4f6');

const fmtCurrency = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const bedPct = (used, total) => total > 0 ? Math.round((used / total) * 100) : 0;

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const submit = async e => {
        e.preventDefault(); setLoading(true);
        try {
            const res = await fetch(`${API_ROOT}/district/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
            }).then(r => r.json());
            if (!res.success) throw new Error(res.message);
            localStorage.setItem('districtToken', res.data.accessToken);
            localStorage.setItem('districtUser', JSON.stringify(res.data.user));
            onLogin(res.data.user);
        } catch (err) { toast.error(err.message); }
        finally { setLoading(false); }
    };
    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e3a5f,#1a56db)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '52px 44px', width: 420, boxShadow: '0 30px 80px rgba(0,0,0,.25)' }}>
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{ fontSize: 60, marginBottom: 12 }}>🏛️</div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1e3a5f' }}>District Health Portal</h1>
                    <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>Tamil Nadu Health Department</p>
                </div>
                <form onSubmit={submit}>
                    {['email', 'password'].map(f => (
                        <div key={f} style={{ marginBottom: 18 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151', marginBottom: 6 }}>{f}</label>
                            <input type={f === 'password' ? 'password' : 'email'} required value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                                style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    ))}
                    <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, padding: 14, background: loading ? '#93c5fd' : '#1a56db', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                        {loading ? 'Authenticating...' : 'Sign In →'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = '#1a56db', bg = '#dbeafe', onClick }) {
    return (
        <div onClick={onClick} style={{ background: '#fff', borderRadius: 14, padding: '20px 18px', border: '1px solid #e5e7eb', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .2s', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'; }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                    {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{sub}</div>}
                </div>
                <div style={{ width: 48, height: 48, background: bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
            </div>
        </div>
    );
}

// ── Bed Progress Bar ──────────────────────────────────────────────────────────
function BedBar({ label, available, total, color = '#1a56db' }) {
    const occupied = total - available;
    const pct = bedPct(occupied, total);
    const barColor = pct > 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#16a34a';
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ color: '#6b7280' }}>{available} free / {total} total</span>
            </div>
            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: 11, color: barColor, marginTop: 2, fontWeight: 700 }}>{pct}% occupied</div>
        </div>
    );
}

// ── Hospital Row ──────────────────────────────────────────────────────────────
function HospitalRow({ hospital, onSelect }) {
    const bedOccupancy = bedPct((hospital.total_beds || 0) - (hospital.available_beds || 0), hospital.total_beds || 1);
    const isCritical   = bedOccupancy > 90;
    return (
        <div onClick={() => onSelect(hospital)} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: `1.5px solid ${isCritical ? '#fca5a5' : '#e5e7eb'}`, marginBottom: 10, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', transition: 'border-color .2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1a56db'}
            onMouseLeave={e => e.currentTarget.style.borderColor = isCritical ? '#fca5a5' : '#e5e7eb'}>
            <div style={{ width: 44, height: 44, background: '#eff6ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{hospital.hospital_name}</span>
                    <span style={{ background: typeBg(hospital.type), color: typeColor(hospital.type), fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{displayHospitalType(hospital.type)}</span>
                    {isCritical && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>🚨 CRITICAL</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{hospital.address || hospital.district}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,80px)', gap: 12, textAlign: 'center', flexShrink: 0 }}>
                {[
                    { label: 'OP Today', value: hospital.op_today || 0, color: '#1a56db' },
                    { label: 'IP Today', value: hospital.ip_today || 0, color: '#7c3aed' },
                    { label: 'Beds Free', value: hospital.available_beds || 0, color: bedOccupancy > 80 ? '#dc2626' : '#16a34a' },
                    { label: 'Revenue', value: `₹${((hospital.revenue_today || 0)/1000).toFixed(1)}k`, color: '#d97706' }
                ].map(s => (
                    <div key={s.label}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Hospital Detail Modal ─────────────────────────────────────────────────────
function HospitalDetailModal({ hospital, wards, onClose }) {
    if (!hospital) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '85vh', overflow: 'auto' }}>
                <div style={{ padding: '22px 26px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{hospital.hospital_name}</h3>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{hospital.address}</div>
                    </div>
                    <button onClick={onClose} style={{ width: 34, height: 34, background: '#f3f4f6', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
                </div>
                <div style={{ padding: '20px 26px' }}>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                        {[
                            { l: 'OP Today', v: hospital.op_today || 0, c: '#1a56db' },
                            { l: 'IP Today', v: hospital.ip_today || 0, c: '#7c3aed' },
                            { l: 'Total Beds', v: hospital.total_beds || 0, c: '#0891b2' },
                            { l: 'Available', v: hospital.available_beds || 0, c: '#16a34a' }
                        ].map(s => (
                            <div key={s.l} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>

                    {/* Ward bed breakdown */}
                    {wards && wards.length > 0 && (
                        <div>
                            <h4 style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 15 }}>🛏 Ward-wise Bed Availability</h4>
                            {wards.filter(w => w.hospital_id === hospital.id).map(ward => (
                                <BedBar key={ward.id} label={`${ward.ward_name} (${ward.ward_type})`}
                                    available={ward.available_beds || 0} total={ward.total_beds || 1} />
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Revenue Today</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>{fmtCurrency(hospital.revenue_today)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Mini Donut Chart (CSS-based) ──────────────────────────────────────────────
function DonutSegment({ pct, color, label, value, size = 80 }) {
    const dash = Math.round(2 * Math.PI * 30 * (pct / 100));
    const gap  = Math.round(2 * Math.PI * 30) - dash;
    return (
        <div style={{ textAlign: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size/2} cy={size/2} r={30} fill="none" stroke="#f3f4f6" strokeWidth={12} />
                <circle cx={size/2} cy={size/2} r={30} fill="none" stroke={color} strokeWidth={12}
                    strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
                    transform={`rotate(-90 ${size/2} ${size/2})`} />
                <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={color}>{pct}%</text>
            </svg>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{value}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function DistrictDashboardPage() {
    const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem('districtUser')); } catch { return null; } });
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('districtToken'));
    const [data, setData]       = useState(null);
    const [tab, setTab]         = useState('overview');
    const [loading, setLoading] = useState(false);
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [alertFilter, setAlertFilter] = useState('all');
    const [hospTypeFilter, setHospTypeFilter] = useState('all');
    const refreshRef = useRef(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [overview, ambRes] = await Promise.all([
                apiFetch('/district/overview'),
                apiFetch('/district/ambulances').catch(() => ({ data: [] }))
            ]);
            setData({ ...overview.data, ambulances: ambRes.data || overview.data?.ambulances || [] });
        } catch (err) { console.warn('District load:', err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        loadData();
        refreshRef.current = setInterval(loadData, 15000);
        return () => clearInterval(refreshRef.current);
    }, [isLoggedIn, loadData]);

    const handleLogin = u => { setUser(u); setIsLoggedIn(true); };
    const handleLogout = () => { localStorage.removeItem('districtToken'); localStorage.removeItem('districtUser'); setUser(null); setIsLoggedIn(false); };

    const acknowledgeAlert = async id => {
        try {
            await apiFetch(`/district/alerts/${id}/acknowledge`, { method: 'PATCH' });
            toast.success('Alert acknowledged');
            loadData();
        } catch (err) { toast.error(err.message); }
    };

    if (!isLoggedIn) return <><Toaster /><LoginView onLogin={handleLogin} /></>;

    const stats     = data?.stats || {};
    const hospitals = (data?.hospitals || []).filter(h => matchesTypeFilter(h.type, hospTypeFilter));
    const ambulances = data?.ambulances || [];
    const alerts    = (data?.alerts || []).filter(a => alertFilter === 'all' || a.severity === alertFilter);
    const wards     = data?.wards || [];

    const TABS = [['overview','📊 Overview'],['hospitals','🏥 Hospitals'],['ambulances','🚑 Ambulances'],['alerts','🚨 Health Alerts'],['beds','🛏 Beds'],];

    return (
        <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            <Toaster position="top-right" />
            {selectedHospital && <HospitalDetailModal hospital={selectedHospital} wards={wards} onClose={() => setSelectedHospital(null)} />}

            {/* Sidebar */}
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <aside style={{ width: 240, background: 'linear-gradient(180deg,#1e3a5f,#1a56db)', minHeight: '100vh', padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
                        <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏛️</div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>MedTrack</div>
                            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>District Portal</div>
                        </div>
                    </div>

                    <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Navigation</div>
                    {TABS.map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ width: '100%', padding: '10px 14px', background: tab === id ? 'rgba(255,255,255,.2)' : 'transparent', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: tab === id ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                            {label}
                        </button>
                    ))}

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, marginBottom: 3 }}>Logged in as</div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{user?.fullName || user?.full_name || 'Officer'}</div>
                            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{user?.district} District</div>
                            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 2 }}>{user?.designation || 'District Health Officer'}</div>
                        </div>
                        <button onClick={handleLogout} style={{ width: '100%', padding: '9px', background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Logout</button>
                    </div>
                </aside>

                {/* Main content */}
                <div style={{ marginLeft: 240, flex: 1 }}>
                    {/* Top bar */}
                    <div style={{ background: '#fff', padding: '14px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e3a5f' }}>{user?.district} District Health Monitoring</h2>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>Real-time monitoring of government hospitals and public health indicators</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {/* Active alerts badge */}
                            {stats.activeAlerts > 0 && (
                                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🚨 {stats.activeAlerts} Active Alert{stats.activeAlerts > 1 ? 's' : ''}
                                </div>
                            )}
                            <button onClick={loadData} style={{ padding: '8px 16px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                🔄 Refresh
                            </button>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date().toLocaleString('en-IN')}</div>
                        </div>
                    </div>

                    <div style={{ padding: '24px 28px' }}>
                        {loading && !data && (
                            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading district data...</div>
                        )}

                        {/* ── OVERVIEW TAB ── */}
                        {tab === 'overview' && data && (
                            <div>
                                {/* Active AI Alert Banner */}
                                {(data.alerts || []).filter(a => a.severity === 'CRITICAL' && a.is_active).map(alert => (
                                    <div key={alert.id} style={{ background: '#fff8f0', border: '2px solid #fed7aa', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                        <div style={{ fontSize: 28 }}>🤖</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, fontSize: 15, color: '#9a3412', marginBottom: 4 }}>
                                                AI Health Alert — {alert.disease_name} Outbreak
                                            </div>
                                            <div style={{ fontSize: 13, color: '#7c2d12' }}>{alert.message}</div>
                                        </div>
                                        <button onClick={() => acknowledgeAlert(alert.id)} style={{ padding: '7px 14px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                                            Acknowledge
                                        </button>
                                    </div>
                                ))}

                                {/* KPI Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                                    <StatCard icon="🏥" label="Total Hospitals" value={stats.hospitals?.total || 0}
                                        sub={`${stats.hospitals?.gh ?? stats.hospitals?.government ?? 0} GH · ${stats.hospitals?.phc || 0} PHC · ${stats.hospitals?.private || 0} Pvt`} color="#1a56db" bg="#dbeafe" onClick={() => setTab('hospitals')} />
                                    <StatCard icon="🛏" label="Available Beds" value={stats.beds?.available || 0}
                                        sub={`${stats.beds?.total || 0} total · ${stats.beds?.occupied || 0} occupied`}
                                        color={bedPct(stats.beds?.occupied, stats.beds?.total) > 80 ? '#dc2626' : '#16a34a'} bg="#dcfce7" onClick={() => setTab('beds')} />
                                    <StatCard icon="🚑" label="Ambulances" value={stats.ambulances?.available || 0}
                                        sub={`${stats.ambulances?.total || 0} total · ${stats.ambulances?.dispatched || 0} dispatched`} color="#0891b2" bg="#e0f2fe" onClick={() => setTab('ambulances')} />
                                    <StatCard icon="💰" label="District Revenue" value={fmtCurrency(stats.revenue)}
                                        sub="Today's total" color="#d97706" bg="#fef3c7" />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
                                    <StatCard icon="👥" label="OP Patients Today" value={(stats.patients?.op_today || 0).toLocaleString('en-IN')} color="#7c3aed" bg="#f5f3ff" />
                                    <StatCard icon="🛏" label="IP Patients" value={(stats.patients?.ip_today || 0).toLocaleString('en-IN')} color="#1a56db" bg="#dbeafe" />
                                    <StatCard icon="🚨" label="Active Alerts" value={stats.activeAlerts || 0} color={stats.activeAlerts > 0 ? '#dc2626' : '#16a34a'} bg={stats.activeAlerts > 0 ? '#fee2e2' : '#dcfce7'} onClick={() => setTab('alerts')} />
                                </div>

                                {/* Hospital list (top 5) + Ambulance summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
                                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Hospitals in {user?.district}</h3>
                                            <button onClick={() => setTab('hospitals')} style={{ fontSize: 13, color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View All →</button>
                                        </div>
                                        {(data.hospitals || []).slice(0, 4).map(h => (
                                            <HospitalRow key={h.id} hospital={h} onSelect={setSelectedHospital} />
                                        ))}
                                    </div>

                                    {/* Ambulance quick view */}
                                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>🚑 Ambulances</h3>
                                            <button onClick={() => setTab('ambulances')} style={{ fontSize: 13, color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>All →</button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                            {[
                                                { status: 'AVAILABLE', icon: '🟢', count: stats.ambulances?.available || 0 },
                                                { status: 'DISPATCHED', icon: '🔵', count: stats.ambulances?.dispatched || 0 },
                                                { status: 'MAINTENANCE', icon: '🟡', count: stats.ambulances?.maintenance || 0 },
                                                { status: 'OFFLINE', icon: '⚫', count: stats.ambulances?.offline || 0 }
                                            ].map(s => (
                                                <div key={s.status} style={{ background: ambulanceBg(s.status), borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20 }}>{s.icon}</div>
                                                    <div style={{ fontSize: 22, fontWeight: 800, color: ambulanceColor(s.status) }}>{s.count}</div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: ambulanceColor(s.status) }}>{s.status}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Recent 4 ambulances */}
                                        {ambulances.slice(0, 4).map(a => (
                                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                                <span style={{ fontSize: 18 }}>🚑</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.vehicle_number || a.unit_number || `UNIT-${String(a.id || '').slice(0, 6).toUpperCase()}`}</div>
                                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.hospital_name || 'District 108 Emergency'}</div>
                                                </div>
                                                <span style={{ background: ambulanceBg(a.status || a.duty_status), color: ambulanceColor(a.status || a.duty_status), fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                                                    {(a.status || a.duty_status || '').toUpperCase()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── HOSPITALS TAB ── */}
                        {tab === 'hospitals' && (
                            <div>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>All Hospitals in {user?.district}</h3>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                        {['all','GH','PHC','PRIVATE'].map(t => (
                                            <button key={t} onClick={() => setHospTypeFilter(t)}
                                                style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: hospTypeFilter === t ? '#1a56db' : '#e5e7eb', background: hospTypeFilter === t ? '#dbeafe' : '#fff', color: hospTypeFilter === t ? '#1a56db' : '#6b7280' }}>
                                                {t === 'all' ? 'All' : displayHospitalType(t)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {hospitals.map(h => <HospitalRow key={h.id} hospital={h} onSelect={setSelectedHospital} />)}
                                {hospitals.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No hospitals found</div>}
                            </div>
                        )}

                        {/* ── AMBULANCES TAB ── */}
                        {tab === 'ambulances' && (
                            <div>
                                <h3 style={{ margin: '0 0 18px', fontWeight: 800, fontSize: 18 }}>🚑 District Ambulances</h3>
                                {/* Summary donut-like */}
                                <div style={{ display: 'flex', gap: 24, background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e5e7eb', marginBottom: 20, justifyContent: 'center' }}>
                                    {[
                                        { status: 'AVAILABLE', count: stats.ambulances?.available || 0 },
                                        { status: 'DISPATCHED', count: stats.ambulances?.dispatched || 0 },
                                        { status: 'MAINTENANCE', count: stats.ambulances?.maintenance || 0 },
                                        { status: 'OFFLINE', count: stats.ambulances?.offline || 0 }
                                    ].map(s => (
                                        <DonutSegment key={s.status} pct={Math.round((s.count / (stats.ambulances?.total || 1)) * 100)} color={ambulanceColor(s.status)} label={s.status} value={`${s.count} units`} />
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
                                    {ambulances.map(a => (
                                        <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: `2px solid ${ambulanceBg(a.status || a.duty_status)}`, padding: '16px 18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: 24 }}>🚑</span>
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: 15 }}>{a.vehicle_number || a.unit_number || `UNIT-${String(a.id || '').slice(0, 6).toUpperCase()}`}</div>
                                                        <div style={{ fontSize: 12, color: '#6b7280' }}>{a.hospital_name || 'District 108 Emergency'}</div>
                                                    </div>
                                                </div>
                                                <span style={{ background: ambulanceBg(a.status || a.duty_status), color: ambulanceColor(a.status || a.duty_status), fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                                                    {(a.status || a.duty_status || '').toUpperCase()}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                👤 {a.driver_name || 'N/A'} &nbsp;|&nbsp; 📞 {a.driver_phone || a.phone || 'N/A'}
                                            </div>
                                        </div>
                                    ))}
                                    {ambulances.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', gridColumn: '1/-1' }}>No ambulance data</div>}
                                </div>
                            </div>
                        )}

                        {/* ── ALERTS TAB ── */}
                        {tab === 'alerts' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>🚨 Health Alerts — {user?.district}</h3>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {['all','CRITICAL','WARNING','INFO'].map(s => (
                                            <button key={s} onClick={() => setAlertFilter(s)}
                                                style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: alertFilter === s ? severityColor(s === 'all' ? 'INFO' : s) : '#e5e7eb', background: alertFilter === s ? severityBg(s === 'all' ? 'INFO' : s) : '#fff', color: alertFilter === s ? severityColor(s === 'all' ? 'INFO' : s) : '#6b7280' }}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {alerts.length === 0 ? (
                                        <div style={{ background: '#fff', borderRadius: 14, padding: '60px', textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                                            No active health alerts for this district 🎉
                                        </div>
                                    ) : alerts.map(a => (
                                        <div key={a.id} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: `2px solid ${severityBg(a.severity)}`, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                            <div style={{ width: 48, height: 48, background: severityBg(a.severity), borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                                {a.severity === 'CRITICAL' ? '🚨' : a.severity === 'WARNING' ? '⚠️' : 'ℹ️'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 800, fontSize: 16 }}>{a.disease_name}</span>
                                                    <span style={{ background: severityBg(a.severity), color: severityColor(a.severity), fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                                                        {a.severity}
                                                    </span>
                                                    {a.is_active && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>ACTIVE</span>}
                                                </div>
                                                <div style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>{a.message}</div>
                                                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                                    Cases: <strong>{a.case_count}</strong> &nbsp;|&nbsp; Reported: {new Date(a.created_at).toLocaleDateString('en-IN')}
                                                </div>
                                            </div>
                                            {a.is_active && (
                                                <button onClick={() => acknowledgeAlert(a.id)}
                                                    style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                    Acknowledge
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── BEDS TAB ── */}
                        {tab === 'beds' && (
                            <div>
                                <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: 18 }}>🛏 District Bed Availability</h3>
                                {/* Summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                                    {[
                                        { label: 'Total Beds', value: stats.beds?.total || 0, color: '#1a56db', icon: '🛏' },
                                        { label: 'Available', value: stats.beds?.available || 0, color: '#16a34a', icon: '✅' },
                                        { label: 'Occupied', value: stats.beds?.occupied || 0, color: '#dc2626', icon: '🔴' },
                                        { label: 'Occupancy Rate', value: `${bedPct(stats.beds?.occupied, stats.beds?.total)}%`, color: bedPct(stats.beds?.occupied, stats.beds?.total) > 80 ? '#dc2626' : '#d97706', icon: '📊' }
                                    ].map(s => (
                                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '18px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Per hospital + ward breakdown */}
                                {(data?.hospitals || []).map(h => {
                                    const hWards = wards.filter(w => w.hospital_id === h.id);
                                    if (hWards.length === 0) return null;
                                    return (
                                        <div key={h.id} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb', marginBottom: 14 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                                <div style={{ fontWeight: 800, fontSize: 15 }}>{h.hospital_name}</div>
                                                <span style={{ background: typeBg(h.type), color: typeColor(h.type), fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{displayHospitalType(h.type)}</span>
                                            </div>
                                            {hWards.map(w => (
                                                <BedBar key={w.id} label={`${w.ward_name} (${w.ward_type})`} available={w.available_beds || 0} total={w.total_beds || 1} />
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
