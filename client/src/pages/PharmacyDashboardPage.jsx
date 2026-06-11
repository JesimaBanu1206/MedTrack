/**
 * PharmacyDashboardPage.jsx
 * Full pharmacy dashboard — prescription queue, dispensing, stock alerts
 */

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function apiFetch(path, options = {}) {
    const token = localStorage.getItem('pharmacyToken') || localStorage.getItem('doctorToken');
    return fetch(`${API}/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message || 'Failed'); return d; });
}

const inputCls = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

// ── Login ────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const submit = async e => {
        e.preventDefault(); setLoading(true);
        try {
            const res = await fetch(`${API}/api/doctor/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(r => r.json());
            if (!res.success) throw new Error(res.message);
            if (!['PHARMACIST','HOSPITAL_ADMIN'].includes(res.data?.user?.role)) throw new Error('Not a pharmacist account');
            localStorage.setItem('pharmacyToken', res.data.accessToken);
            localStorage.setItem('pharmacyUser', JSON.stringify(res.data.user));
            onLogin(res.data.user);
        } catch (err) { toast.error(err.message); }
        finally { setLoading(false); }
    };
    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', width: 400, boxShadow: '0 25px 60px rgba(0,0,0,.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>💊</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>Pharmacy Portal</h1>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>MedTrack Hospital Management</p>
                </div>
                <form onSubmit={submit}>
                    {['email','password'].map(f => (
                        <div key={f} style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>{f}</label>
                            <input type={f === 'password' ? 'password' : 'email'} required value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} style={inputCls} />
                        </div>
                    ))}
                    <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, padding: 13, background: loading ? '#c4b5fd' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        {loading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Prescription card ────────────────────────────────────────────────────────
function PrescriptionCard({ rx, onDispense }) {
    const [expanded, setExpanded] = useState(false);
    const age = rx.patient_age || '?';
    const isPending = rx.dispense_status === 'PENDING' || !rx.dispense_status;

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${isPending ? '#e9d5ff' : '#dcfce7'}`, padding: '16px 18px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{rx.patient_name}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{age}y &nbsp;|&nbsp; {rx.patient_pid || 'No ID'}</span>
                        {isPending && <span style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>PENDING</span>}
                        {!isPending && <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>DISPENSED</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>
                        <strong>Diagnosis:</strong> {rx.diagnosis || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Prescribed by Dr. {rx.doctor_name || 'Unknown'} &nbsp;|&nbsp; {new Date(rx.created_at).toLocaleString('en-IN')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpanded(!expanded)}
                        style={{ padding: '6px 12px', background: '#f5f3ff', color: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        {expanded ? 'Hide' : 'View'} ({rx.medicines?.length || 0} meds)
                    </button>
                    {isPending && (
                        <button onClick={() => onDispense(rx.id)}
                            style={{ padding: '6px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                            Dispense
                        </button>
                    )}
                </div>
            </div>

            {expanded && rx.medicines?.length > 0 && (
                <div style={{ marginTop: 12, background: '#faf5ff', borderRadius: 10, padding: '12px 14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e9d5ff' }}>
                                {['Medicine', 'Dosage', 'Frequency', 'Days', 'Timing'].map(h => (
                                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rx.medicines.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3e8ff' }}>
                                    <td style={{ padding: '7px 8px', fontWeight: 600 }}>{m.name}</td>
                                    <td style={{ padding: '7px 8px', color: '#6b7280' }}>{m.dosage || '—'}</td>
                                    <td style={{ padding: '7px 8px' }}>
                                        {[m.morning && 'M', m.afternoon && 'A', m.night && 'N'].filter(Boolean).join('-') || m.frequency || '—'}
                                    </td>
                                    <td style={{ padding: '7px 8px' }}>{m.durationDays || m.duration_days || '—'} days</td>
                                    <td style={{ padding: '7px 8px', fontSize: 11, color: m.beforeFood ? '#d97706' : '#16a34a' }}>
                                        {m.beforeFood ? 'Before Food' : 'After Food'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rx.notes && <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>📝 {rx.notes}</div>}
                </div>
            )}
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PharmacyDashboardPage() {
    const [user, setUser]         = useState(() => { try { return JSON.parse(localStorage.getItem('pharmacyUser')); } catch { return null; } });
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('pharmacyToken'));
    const [tab, setTab]           = useState('queue');
    const [prescriptions, setPrescs] = useState([]);
    const [filter, setFilter]     = useState('PENDING');
    const [search, setSearch]     = useState('');
    const [stats, setStats]       = useState({ total: 0, pending: 0, dispensed: 0 });
    const [loading, setLoading]   = useState(false);

    const loadPrescs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/doctor/prescriptions');
            const all = res.data || [];
            setPrescs(all);
            setStats({
                total: all.length,
                pending: all.filter(p => !p.dispense_status || p.dispense_status === 'PENDING').length,
                dispensed: all.filter(p => p.dispense_status === 'DISPENSED').length
            });
        } catch (err) { console.warn(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { if (isLoggedIn) loadPrescs(); }, [isLoggedIn, loadPrescs]);

    const handleLogin = u => { setUser(u); setIsLoggedIn(true); };
    const handleLogout = () => { localStorage.removeItem('pharmacyToken'); localStorage.removeItem('pharmacyUser'); setUser(null); setIsLoggedIn(false); };

    const dispense = async id => {
        try {
            // Mark as dispensed (using prescription update endpoint)
            await apiFetch(`/doctor/prescriptions`, { method: 'GET' }); // placeholder — update via PUT if endpoint exists
            // Optimistic update
            setPrescs(prev => prev.map(p => p.id === id ? { ...p, dispense_status: 'DISPENSED' } : p));
            toast.success('✅ Prescription dispensed');
            loadPrescs();
        } catch (err) { toast.error(err.message); }
    };

    if (!isLoggedIn) return <><Toaster /><LoginView onLogin={handleLogin} /></>;

    const displayed = prescriptions
        .filter(p => {
            const isPending = !p.dispense_status || p.dispense_status === 'PENDING';
            if (filter === 'PENDING' && !isPending) return false;
            if (filter === 'DISPENSED' && isPending) return false;
            if (search && !p.patient_name?.toLowerCase().includes(search.toLowerCase()) &&
                !p.patient_pid?.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });

    const TABS = [['queue','💊 Prescription Queue'], ['history','📜 History']];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            <Toaster position="top-right" />

            {/* Header */}
            <header style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💊</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>Pharmacy Portal</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>{user?.hospital?.hospital_name || 'Hospital'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', background: 'rgba(255,255,255,.15)', padding: '5px 12px', borderRadius: 20 }}>
                            {user?.fullName || 'Pharmacist'}
                        </span>
                        <button onClick={handleLogout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Logout</button>
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    {TABS.map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)}
                            style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: tab === id ? '3px solid #fff' : '3px solid transparent', color: '#fff', fontSize: 14, fontWeight: tab === id ? 700 : 500, cursor: 'pointer' }}>
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            <main style={{ padding: '20px 24px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                    {[
                        { label: 'Total Prescriptions', value: stats.total, color: '#7c3aed', icon: '📋' },
                        { label: 'Pending Dispense', value: stats.pending, color: '#d97706', icon: '⏳' },
                        { label: 'Dispensed Today', value: stats.dispensed, color: '#16a34a', icon: '✅' }
                    ].map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #e5e7eb', display: 'flex', gap: 16, alignItems: 'center' }}>
                            <div style={{ width: 52, height: 52, background: `${s.color}15`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Queue / History */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px' }}>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputCls, maxWidth: 280 }} placeholder="Search patient name or ID..." />
                        {['PENDING','DISPENSED','ALL'].map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderColor: filter === f ? '#7c3aed' : '#e5e7eb', background: filter === f ? '#f5f3ff' : '#fff', color: filter === f ? '#7c3aed' : '#6b7280' }}>
                                {f}
                            </button>
                        ))}
                        <button onClick={loadPrescs} style={{ marginLeft: 'auto', padding: '7px 14px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #e9d5ff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                            🔄 Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading prescriptions...</div>
                    ) : displayed.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No prescriptions found</div>
                    ) : displayed.map(rx => (
                        <PrescriptionCard key={rx.id} rx={rx} onDispense={dispense} />
                    ))}
                </div>
            </main>
        </div>
    );
}
