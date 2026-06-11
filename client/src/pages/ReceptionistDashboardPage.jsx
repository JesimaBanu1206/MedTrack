/**
 * ReceptionistDashboardPage.jsx
 * Full-featured receptionist portal:
 *  - Today's queue & appointment management
 *  - OP timing editor (changes reflect in appointment page)
 *  - Walk-in patient check-in
 *  - Patient search
 */

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const API_BASE = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;

function apiFetch(path, options = {}) {
    const token = localStorage.getItem('receptionistToken') || localStorage.getItem('hospitalAdminToken');
    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Request failed');
        return data;
    });
}

// ── Color helpers ─────────────────────────────────────────────────────────────
const statusColor = s => ({ WAITING: '#d97706', IN_CONSULTATION: '#2563eb', COMPLETED: '#16a34a', CANCELLED: '#9ca3af' }[s] || '#6b7280');
const statusBg    = s => ({ WAITING: '#fef3c7', IN_CONSULTATION: '#dbeafe', COMPLETED: '#dcfce7', CANCELLED: '#f3f4f6' }[s] || '#f3f4f6');
const triageColor = t => ({ CRITICAL: '#dc2626', URGENT: '#f97316', NORMAL: '#16a34a' }[t] || '#6b7280');
const triageBg    = t => ({ CRITICAL: '#fee2e2', URGENT: '#fef3c7', NORMAL: '#dcfce7' }[t] || '#f3f4f6');

const DEPARTMENTS = [
    'General Medicine', 'General Surgery', 'Cardiology', 'Orthopedics',
    'ENT', 'Gynecology', 'Pediatrics', 'Neurology', 'Dermatology',
    'Ophthalmology', 'Psychiatry', 'Oncology', 'Nephrology', 'Urology'
];

const inputCls = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
    const [form, setForm]     = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const submit = async e => {
        e.preventDefault(); setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/receptionist/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
                credentials: 'include'
            }).then(r => r.json());
            if (!res.success) throw new Error(res.message);
            localStorage.setItem('receptionistToken', res.data.accessToken);
            localStorage.setItem('token', res.data.accessToken);
            localStorage.setItem('receptionistUser', JSON.stringify(res.data.user));
            onLogin(res.data.user);
        } catch (err) { toast.error(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0891b2,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', width: 400, boxShadow: '0 25px 60px rgba(0,0,0,.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>📋</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0e7490' }}>Receptionist Portal</h1>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>MedTrack Hospital Management</p>
                </div>
                <form onSubmit={submit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</label>
                        <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputCls} placeholder="receptionist@hospital.gov" />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Password</label>
                        <input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={inputCls} />
                    </div>
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#a5f3fc' : '#0891b2', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        {loading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WALK-IN MODAL
// ─────────────────────────────────────────────────────────────────────────────
function WalkInModal({ onClose, onSaved }) {
    const [form, setForm] = useState({ patientPid: '', patientName: '', age: '', gender: 'MALE', department: 'General Medicine', reason: '', triageStatus: 'NORMAL' });
    const [saving, setSaving] = useState(false);
    const [searched, setSearched] = useState(null);

    const searchPatient = async () => {
        if (!form.patientPid) return;
        try {
            const res = await apiFetch(`/receptionist/search-patient?q=${form.patientPid}`);
            if (res.data?.length > 0) {
                const p = res.data[0];
                setSearched(p);
                setForm(prev => ({ ...prev, patientName: p.full_name, age: p.age || '', gender: p.gender || 'MALE' }));
                toast.success(`Patient found: ${p.full_name}`);
            } else { toast.error('Patient ID not found'); }
        } catch (err) { toast.error(err.message); }
    };

    const submit = async () => {
        if (!form.patientName || !form.department) { toast.error('Name and department required'); return; }
        setSaving(true);
        try {
            await apiFetch('/receptionist/walk-in', { method: 'POST', body: JSON.stringify(form) });
            toast.success('✅ Patient added to queue');
            onSaved(); onClose();
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontWeight: 800 }}>🚶 Walk-In Check-In</h3>
                    <button onClick={onClose} style={{ width: 30, height: 30, border: 'none', background: '#f3f4f6', borderRadius: '50%', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
                {/* Search by PID */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input value={form.patientPid} onChange={e => setForm(p => ({ ...p, patientPid: e.target.value }))} style={{ ...inputCls, flex: 1 }} placeholder="Patient ID (optional)" />
                    <button onClick={searchPatient} style={{ padding: '9px 16px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Search</button>
                </div>
                {searched && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#065f46' }}>
                        ✅ {searched.full_name} | {searched.age}y | {searched.blood_group || 'Blood N/A'}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Patient Name *</label>
                        <input value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} style={inputCls} placeholder="Full name" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Age</label>
                        <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} style={inputCls} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Gender</label>
                        <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={inputCls}>
                            <option>MALE</option><option>FEMALE</option><option>OTHER</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Department *</label>
                        <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={inputCls}>
                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Triage</label>
                        <select value={form.triageStatus} onChange={e => setForm(p => ({ ...p, triageStatus: e.target.value }))} style={inputCls}>
                            <option>NORMAL</option><option>URGENT</option><option>CRITICAL</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Reason for Visit</label>
                        <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} style={inputCls} placeholder="Chief complaint" />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={submit} disabled={saving} style={{ padding: '9px 22px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? 'Saving...' : '✓ Add to Queue'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// OP TIMING EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function OpTimingEditor({ hospitalId }) {
    const [date, setDate]     = useState(new Date().toISOString().split('T')[0]);
    const [timings, setTimings] = useState([]);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving]  = useState(false);

    const emptyForm = { department: 'General Medicine', start_time: '08:00', end_time: '13:00', slot_duration_minutes: 15, max_patients: 60, doctor_name: '', notes: '' };
    const [form, setForm] = useState(emptyForm);

    const load = useCallback(async () => {
        try {
            const res = await apiFetch(`/receptionist/op-timings?date=${date}`);
            setTimings(res.data || []);
        } catch (err) { console.warn(err.message); }
    }, [date]);

    useEffect(() => { load(); }, [load]);

    const openEdit = t => {
        setEditing(t.id);
        setForm({ department: t.department, start_time: t.start_time, end_time: t.end_time, slot_duration_minutes: t.slot_duration_minutes, max_patients: t.max_patients, doctor_name: t.doctor_name || '', notes: t.notes || '' });
    };

    const openNew = () => {
        setEditing('new');
        setForm(emptyForm);
    };

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/receptionist/op-timings', { method: 'POST', body: JSON.stringify({ ...form, timing_date: date }) });
            toast.success('OP timing saved ✅');
            setEditing(null);
            load();
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🕐 OP Timings</h3>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        style={{ padding: '7px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
                </div>
                <button onClick={openNew} style={{ padding: '8px 16px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    + Add Timing
                </button>
            </div>

            {/* Edit / New form */}
            {editing && (
                <div style={{ background: '#f0f9ff', border: '2px solid #0891b2', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 14px', color: '#0e7490', fontWeight: 700 }}>
                        {editing === 'new' ? 'Add New OP Timing' : 'Edit OP Timing'} — {date}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Department</label>
                            <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={inputCls}>
                                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Start Time</label>
                            <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={inputCls} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>End Time</label>
                            <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={inputCls} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Slot Duration (min)</label>
                            <input type="number" value={form.slot_duration_minutes} onChange={e => setForm(p => ({ ...p, slot_duration_minutes: +e.target.value }))} style={inputCls} min={5} max={60} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Max Patients</label>
                            <input type="number" value={form.max_patients} onChange={e => setForm(p => ({ ...p, max_patients: +e.target.value }))} style={inputCls} min={1} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Doctor Name</label>
                            <input value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} style={inputCls} placeholder="Optional" />
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Notes</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputCls} placeholder="Optional notes" />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setEditing(null)} style={{ padding: '9px 18px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                            {saving ? 'Saving...' : '✓ Save Timing'}
                        </button>
                    </div>
                </div>
            )}

            {/* Timings list */}
            <div style={{ display: 'grid', gap: 10 }}>
                {timings.length === 0 ? (
                    <div style={{ background: '#fff', borderRadius: 12, padding: '30px', textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                        No OP timings set for {date}
                    </div>
                ) : timings.map(t => (
                    <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, background: '#e0f2fe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🩺</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{t.department}</div>
                            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                                {t.start_time} – {t.end_time} &nbsp;|&nbsp; {t.slot_duration_minutes} min slots &nbsp;|&nbsp; Max {t.max_patients} patients
                                {t.doctor_name && <> &nbsp;|&nbsp; Dr. {t.doctor_name}</>}
                            </div>
                        </div>
                        <button onClick={() => openEdit(t)} style={{ padding: '6px 14px', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                            Edit
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceptionistDashboardPage() {
    const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem('receptionistUser')); } catch { return null; } });
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('receptionistToken'));
    const [tab, setTab]         = useState('queue');
    const [dashData, setDashData] = useState(null);
    const [appointments, setAppts] = useState([]);
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const loadDash = useCallback(async () => {
        try { const res = await apiFetch('/receptionist/dashboard'); setDashData(res.data); }
        catch (err) { console.warn('Dash load:', err.message); }
    }, []);

    const loadAppts = useCallback(async () => {
        try {
            const params = new URLSearchParams({ date: dateFilter });
            if (deptFilter) params.set('department', deptFilter);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await apiFetch(`/receptionist/appointments?${params}`);
            setAppts(res.data || []);
        } catch (err) { console.warn(err.message); }
    }, [dateFilter, deptFilter, statusFilter]);

    useEffect(() => { if (isLoggedIn) { loadDash(); loadAppts(); } }, [isLoggedIn, loadDash, loadAppts]);
    useEffect(() => { if (!isLoggedIn || !autoRefresh) return; const t = setInterval(loadAppts, 30000); return () => clearInterval(t); }, [isLoggedIn, autoRefresh, loadAppts]);

    const handleLogin = u => { setUser(u); setIsLoggedIn(true); };
    const handleLogout = () => { localStorage.removeItem('receptionistToken'); localStorage.removeItem('receptionistUser'); setUser(null); setIsLoggedIn(false); };

    const updateStatus = async (id, status) => {
        try {
            await apiFetch(`/receptionist/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            toast.success(`Status → ${status}`);
            loadAppts();
        } catch (err) { toast.error(err.message); }
    };

    const doSearch = async () => {
        if (searchQ.length < 2) return;
        try {
            const res = await apiFetch(`/receptionist/search-patient?q=${encodeURIComponent(searchQ)}`);
            setSearchResults(res.data || []);
        } catch (err) { toast.error(err.message); }
    };

    if (!isLoggedIn) return <><Toaster position="top-right" /><LoginView onLogin={handleLogin} /></>;

    const stats = dashData?.stats || {};
    const TABS = [['queue','📋 Queue'], ['timings','🕐 OP Timings'], ['search','🔍 Patient Search']];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            <Toaster position="top-right" />
            {showWalkIn && <WalkInModal onClose={() => setShowWalkIn(false)} onSaved={() => { loadDash(); loadAppts(); }} />}

            {/* Header */}
            <header style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📋</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>Receptionist Portal</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>{user?.hospital?.hospital_name || 'Hospital'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', background: 'rgba(255,255,255,.15)', padding: '5px 12px', borderRadius: 20 }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <button onClick={() => setShowWalkIn(true)} style={{ padding: '8px 16px', background: '#fff', color: '#0891b2', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                            + Walk-in
                        </button>
                        <button onClick={handleLogout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Logout</button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 4, paddingBottom: 0 }}>
                    {TABS.map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)}
                            style={{ padding: '10px 20px', background: tab === id ? 'rgba(255,255,255,.2)' : 'transparent', border: 'none', borderBottom: tab === id ? '3px solid #fff' : '3px solid transparent', color: '#fff', fontSize: 14, fontWeight: tab === id ? 700 : 500, cursor: 'pointer', borderRadius: '8px 8px 0 0' }}>
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            <main style={{ padding: '20px 24px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                        { label: 'Total Today', value: stats.totalAppointments || 0, color: '#0891b2', icon: '📊' },
                        { label: 'Waiting', value: stats.waiting || 0, color: '#d97706', icon: '⏳' },
                        { label: 'In Progress', value: stats.inProgress || 0, color: '#7c3aed', icon: '🩺' },
                        { label: 'Completed', value: stats.completed || 0, color: '#16a34a', icon: '✅' },
                        { label: 'Cancelled', value: stats.cancelled || 0, color: '#6b7280', icon: '❌' },
                        { label: 'Avail Beds', value: stats.availableBeds || 0, color: '#0891b2', icon: '🛏' }
                    ].map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── QUEUE TAB ── */}
                {tab === 'queue' && (
                    <div>
                        {/* Filters */}
                        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e5e7eb', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                                style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
                            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                                <option value="">All Departments</option>
                                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            {['all','WAITING','IN_CONSULTATION','COMPLETED','CANCELLED'].map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: statusFilter === s ? '#0891b2' : '#e5e7eb', background: statusFilter === s ? '#e0f2fe' : '#fff', color: statusFilter === s ? '#0891b2' : '#6b7280' }}>
                                    {s === 'all' ? 'All' : s.replace('_', ' ')}
                                </button>
                            ))}
                            <button onClick={() => { loadDash(); loadAppts(); }} style={{ marginLeft: 'auto', padding: '7px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                                🔄 Refresh
                            </button>
                        </div>

                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f0f9ff' }}>
                                        {['Token','Patient','Dept','Reason','Triage','Status','Time','Actions'].map(h => (
                                            <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#0e7490', textAlign: 'left', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No appointments for selected filters</td></tr>
                                    ) : appointments.map(a => (
                                        <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '13px 14px', fontWeight: 800, color: '#0891b2', fontSize: 16 }}>#{String(a.token_number).padStart(2,'0')}</td>
                                            <td style={{ padding: '13px 14px' }}>
                                                <div style={{ fontWeight: 700 }}>{a.patient_name}</div>
                                                {a.patient_pid && <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.patient_pid}</div>}
                                                {a.age && <div style={{ fontSize: 11, color: '#6b7280' }}>{a.age}y / {a.gender?.charAt(0)}</div>}
                                            </td>
                                            <td style={{ padding: '13px 14px', fontSize: 13 }}>{a.department}</td>
                                            <td style={{ padding: '13px 14px', fontSize: 12, color: '#6b7280', maxWidth: 120 }}>{a.reason || '—'}</td>
                                            <td style={{ padding: '13px 14px' }}>
                                                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: triageBg(a.triage_status), color: triageColor(a.triage_status) }}>
                                                    {a.triage_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 14px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: statusBg(a.status), color: statusColor(a.status) }}>
                                                    {a.status?.replace('_',' ')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 14px', fontSize: 12, color: '#6b7280' }}>
                                                {a.preferred_time || a.visit_date}
                                            </td>
                                            <td style={{ padding: '13px 14px' }}>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                    {a.status === 'WAITING' && (
                                                        <button onClick={() => updateStatus(a.id,'IN_CONSULTATION')}
                                                            style={{ padding: '5px 9px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                                            In
                                                        </button>
                                                    )}
                                                    {(a.status === 'WAITING' || a.status === 'IN_CONSULTATION') && (
                                                        <button onClick={() => updateStatus(a.id,'COMPLETED')}
                                                            style={{ padding: '5px 9px', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                                            Done
                                                        </button>
                                                    )}
                                                    {a.status === 'WAITING' && (
                                                        <button onClick={() => updateStatus(a.id,'CANCELLED')}
                                                            style={{ padding: '5px 9px', background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── OP TIMINGS TAB ── */}
                {tab === 'timings' && (
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px' }}>
                        <OpTimingEditor hospitalId={user?.hospitalId} />
                    </div>
                )}

                {/* ── PATIENT SEARCH TAB ── */}
                {tab === 'search' && (
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 16 }}>🔍 Search Patient</h3>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && doSearch()}
                                style={{ ...inputCls, flex: 1 }} placeholder="Search by Patient ID, Name or Phone" />
                            <button onClick={doSearch} style={{ padding: '9px 22px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                                Search
                            </button>
                        </div>
                        {searchResults.length > 0 ? (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {searchResults.map(p => (
                                    <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                                        <div style={{ width: 44, height: 44, background: '#e0f2fe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0891b2', fontSize: 18 }}>
                                            {p.full_name?.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 15 }}>{p.full_name}</div>
                                            <div style={{ fontSize: 13, color: '#6b7280' }}>
                                                {p.patient_pid} &nbsp;|&nbsp; {p.age}y &nbsp;|&nbsp; {p.gender} &nbsp;|&nbsp; {p.blood_group || 'Blood N/A'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.phone}</div>
                                        </div>
                                        <button onClick={() => { setShowWalkIn(true); }} style={{ padding: '7px 14px', background: '#e0f2fe', color: '#0891b2', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                            + Queue
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : searchQ.length > 1 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No patients found</div>
                        ) : null}
                    </div>
                )}
            </main>
        </div>
    );
}
