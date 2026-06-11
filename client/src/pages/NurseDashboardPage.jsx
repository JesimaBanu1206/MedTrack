/**
 * NurseDashboardPage.jsx
 * Full Nurse Dashboard — vitals recording, queue management, patient care
 */

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function api(path, options = {}) {
    const token = localStorage.getItem('nurseToken') || localStorage.getItem('doctorToken');
    return fetch(`${API}/api${path}`, {
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

const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827'
};

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await fetch(`${API}/api/doctor/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            }).then(r => r.json());
            if (!data.success) throw new Error(data.message);
            localStorage.setItem('nurseToken', data.data.accessToken);
            onLogin(data.data.user);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🩺</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1e40af' }}>Nurse Portal</h1>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>MedTrack Staff Access</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
                        <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
                        <input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={inputStyle} />
                    </div>
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = '#2563eb' }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px', border: `2px solid ${color}20`, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
        </div>
    );
}

// ── Record Vitals Modal ────────────────────────────────────────────────────────
function RecordVitalsModal({ patient, onClose, onSaved }) {
    const [form, setForm] = useState({
        patientPid: patient?.patient_pid || '',
        patientName: patient?.patient_name || '',
        queueEntryId: patient?.id || null,
        bp: patient?.bp || '',
        temperature: patient?.temperature || '',
        heartRate: patient?.heart_rate || '',
        sugar: patient?.sugar || '',
        weight: patient?.weight || '',
        spo2: '',
        respiration: '',
        painScale: '',
        notes: ''
    });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!form.patientPid && !form.patientName) {
            toast.error('Enter Patient ID or Patient Name');
            return;
        }
        setSaving(true);
        try {
            await api('/nurse/vitals', { method: 'POST', body: JSON.stringify(form) });
            toast.success('✅ Vitals recorded');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const fields = [
        ['BP (e.g. 120/80)', 'bp', 'text'],
        ['Temperature (°F)', 'temperature', 'text'],
        ['Heart Rate (bpm)', 'heartRate', 'number'],
        ['Blood Sugar (mg/dL)', 'sugar', 'text'],
        ['Weight (kg)', 'weight', 'number'],
        ['SpO2 (%)', 'spo2', 'number'],
        ['Respiration Rate', 'respiration', 'number'],
        ['Pain Scale (0-10)', 'painScale', 'number'],
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Record Vitals — {form.patientName}</h3>
                    <button onClick={onClose} style={{ width: 30, height: 30, border: 'none', background: '#f3f4f6', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Patient ID</label>
                            <input type="text" value={form.patientPid || ''} onChange={e => setForm(p => ({ ...p, patientPid: e.target.value }))} style={inputStyle} placeholder="e.g. MT-0001" />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Patient Name</label>
                            <input type="text" value={form.patientName || ''} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} style={inputStyle} placeholder="Patient full name" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        {fields.map(([label, field, type]) => (
                            <div key={field}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
                                <input type={type} value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes</label>
                        <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, height: 60, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                        <button onClick={onClose} style={{ padding: '9px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                            {saving ? 'Saving...' : '✓ Save Vitals'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Nurse Dashboard ───────────────────────────────────────────────────────
export default function NurseDashboardPage() {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nurseUser')); } catch { return null; }
    });
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('nurseToken'));
    const [dashData, setDashData] = useState(null);
    const [activeTab, setActiveTab] = useState('queue');
    const [vitalsModal, setVitalsModal] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const load = useCallback(async () => {
        try {
            const data = await api('/nurse/dashboard');
            setDashData(data.data);
        } catch (err) {
            console.warn('Load failed:', err.message);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) load();
    }, [isLoggedIn, load]);

    const handleLogin = (u) => {
        setUser(u);
        setIsLoggedIn(true);
        localStorage.setItem('nurseUser', JSON.stringify(u));
    };

    const handleLogout = () => {
        localStorage.removeItem('nurseToken');
        localStorage.removeItem('nurseUser');
        setUser(null);
        setIsLoggedIn(false);
    };

    const updateStatus = async (queueId, status, triageStatus) => {
        try {
            await api(`/nurse/queue/${queueId}/status`, { method: 'PATCH', body: JSON.stringify({ status, triageStatus }) });
            toast.success('Status updated');
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const completeLabRequest = async (id) => {
        const resultNotes = prompt('Enter result notes:');
        if (resultNotes === null) return;
        try {
            await api(`/nurse/lab-requests/${id}/complete`, { method: 'PATCH', body: JSON.stringify({ resultNotes }) });
            toast.success('Lab request completed');
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (!isLoggedIn) return (
        <>
            <Toaster position="top-right" />
            <LoginView onLogin={handleLogin} />
        </>
    );

    const stats = dashData?.stats || {};
    const queue = dashData?.queue || [];
    const notices = dashData?.notices || [];
    const pendingLabs = dashData?.pendingLabs || [];

    const filteredQueue = statusFilter === 'all' ? queue : queue.filter(q => q.status === statusFilter);
    const triageColor = t => ({ CRITICAL: '#ef4444', URGENT: '#f97316', NORMAL: '#6b7280' }[t] || '#6b7280');
    const statusBg = s => ({ WAITING: '#fef3c7', IN_CONSULTATION: '#dbeafe', COMPLETED: '#dcfce7', CANCELLED: '#f3f4f6' }[s] || '#f3f4f6');
    const statusColor = s => ({ WAITING: '#d97706', IN_CONSULTATION: '#1d4ed8', COMPLETED: '#16a34a', CANCELLED: '#6b7280' }[s] || '#6b7280');

    return (
        <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <Toaster position="top-right" />

            {/* Header */}
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #2563eb, #1e40af)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                            {(user?.fullName || 'N')[0]}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{user?.fullName || 'Nurse'}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>Nurse • {user?.hospital?.hospital_name || 'Hospital'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        <button onClick={handleLogout} style={{ padding: '7px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Logout</button>
                    </div>
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid #f3f4f6' }}>
                    {[['queue', '👥 Patient Queue'], ['vitals', '🩺 Vitals Today'], ['wards', '🏥 Ward Patients'], ['admission', '🛏 Admission'], ['labs', '🔬 Lab Requests'], ['notices', '📣 Notices']].map(([id, label]) => (
                        <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: activeTab === id ? '2px solid #2563eb' : '2px solid transparent', fontSize: 13, fontWeight: activeTab === id ? 600 : 500, color: activeTab === id ? '#2563eb' : '#6b7280', cursor: 'pointer' }}>
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            <main style={{ padding: '20px 24px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
                    <StatCard icon="👥" label="Total Queue" value={stats.totalQueue || 0} color="#2563eb" />
                    <StatCard icon="⏳" label="Waiting" value={stats.waiting || 0} color="#d97706" />
                    <StatCard icon="🩺" label="In Consultation" value={stats.inConsultation || 0} color="#7c3aed" />
                    <StatCard icon="✅" label="Completed" value={stats.completed || 0} color="#16a34a" />
                    <StatCard icon="🚨" label="Critical" value={stats.critical || 0} color="#ef4444" />
                    <StatCard icon="📊" label="Vitals Today" value={stats.vitalsRecordedToday || 0} color="#0d9488" />
                </div>

                {/* Patient Queue Tab */}
                {activeTab === 'queue' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Today's Patient Queue</h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['all', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'].map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: statusFilter === s ? '#2563eb' : '#e5e7eb', background: statusFilter === s ? '#dbeafe' : '#fff', color: statusFilter === s ? '#1d4ed8' : '#6b7280' }}>
                                        {s === 'all' ? 'All' : s.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {['Token', 'Patient', 'Age/Gender', 'Reason', 'Vitals', 'Triage', 'Status', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQueue.length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No patients</td></tr>
                                    ) : filteredQueue.map((p, i) => (
                                        <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '14px', fontWeight: 700, color: '#2563eb' }}>#{String(p.token_number).padStart(2, '0')}</td>
                                            <td style={{ padding: '14px' }}>
                                                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.patient_name}</div>
                                                {p.patient_pid && <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.patient_pid}</div>}
                                            </td>
                                            <td style={{ padding: '14px', fontSize: 13 }}>{p.age || '--'} / {p.gender?.charAt(0) || '?'}</td>
                                            <td style={{ padding: '14px', fontSize: 13, color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason || '--'}</td>
                                            <td style={{ padding: '14px', fontSize: 12, color: '#6b7280' }}>
                                                {p.bp && <div>BP: {p.bp}</div>}
                                                {p.temperature && <div>T: {p.temperature}</div>}
                                                {p.heart_rate && <div>HR: {p.heart_rate}</div>}
                                                {!p.bp && !p.temperature && !p.heart_rate && '—'}
                                            </td>
                                            <td style={{ padding: '14px' }}>
                                                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.triage_status === 'CRITICAL' ? '#fee2e2' : p.triage_status === 'URGENT' ? '#fef3c7' : '#f3f4f6', color: triageColor(p.triage_status) }}>
                                                    {p.triage_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: statusBg(p.status), color: statusColor(p.status) }}>
                                                    {p.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px' }}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button onClick={() => setVitalsModal(p)} style={{ padding: '5px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>📊 Vitals</button>
                                                    {p.status === 'WAITING' && (
                                                        <button onClick={() => updateStatus(p.id, 'CANCELLED')} style={{ padding: '5px 10px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
                                                    )}
                                                    {p.triage_status !== 'CRITICAL' && (
                                                        <button onClick={() => updateStatus(p.id, p.status, 'CRITICAL')} style={{ padding: '5px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>🚨 Critical</button>
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

                {/* Vitals Tab */}
                {activeTab === 'vitals' && (
                    <div>
                        <div style={{ margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Vitals Recorded Today</h2>
                            <button onClick={() => setVitalsModal({})} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                + Record by Patient ID
                            </button>
                        </div>
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {['Time', 'Patient', 'BP', 'Temperature', 'HR', 'Sugar', 'Weight', 'SpO2'].map(h => (
                                            <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(dashData?.todayVitals || []).length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No vitals recorded today</td></tr>
                                    ) : (dashData?.todayVitals || []).map((v, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{new Date(v.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600 }}>{v.patient_name}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.bp || '—'}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.temperature || '—'}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.heart_rate || '—'}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.sugar || '—'}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.weight ? `${v.weight} kg` : '—'}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.spo2 ? `${v.spo2}%` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Lab Requests Tab */}
                {activeTab === 'labs' && (
                    <div>
                        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Pending Lab Requests</h2>
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {['Requested', 'Patient', 'Test Type', 'Urgency', 'Status', 'Action'].map(h => (
                                            <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingLabs.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No pending lab requests</td></tr>
                                    ) : pendingLabs.map((lr, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{new Date(lr.created_at).toLocaleString('en-IN')}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600 }}>{lr.patient_name}</td>
                                            <td style={{ padding: '12px 14px', fontSize: 13 }}>{lr.test_type}</td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: lr.urgency === 'STAT' ? '#fee2e2' : lr.urgency === 'URGENT' ? '#fef3c7' : '#f3f4f6', color: lr.urgency === 'STAT' ? '#dc2626' : lr.urgency === 'URGENT' ? '#d97706' : '#6b7280' }}>
                                                    {lr.urgency}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>{lr.status}</span>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <button onClick={() => completeLabRequest(lr.id)} style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                                                    ✓ Complete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Notices Tab */}
                {activeTab === 'notices' && (
                    <div>
                        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Admin Notices</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {notices.length === 0 ? (
                                <div style={{ background: '#fff', borderRadius: 12, padding: '40px', textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb' }}>No active notices</div>
                            ) : notices.map((n, i) => (
                                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: `1.5px solid ${n.priority === 'URGENT' ? '#ef4444' : n.priority === 'HIGH' ? '#f97316' : '#e5e7eb'}`, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: 20 }}>{n.priority === 'URGENT' ? '🚨' : n.priority === 'HIGH' ? '⚠️' : '📢'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{n.title}</div>
                                        <div style={{ fontSize: 13, color: '#374151' }}>{n.message}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{new Date(n.created_at).toLocaleString('en-IN')}</div>
                                    </div>
                                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: n.priority === 'URGENT' ? '#fee2e2' : n.priority === 'HIGH' ? '#fef3c7' : '#f3f4f6', color: n.priority === 'URGENT' ? '#dc2626' : n.priority === 'HIGH' ? '#d97706' : '#6b7280' }}>
                                        {n.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

                {/* Ward Patients Tab */}
                {activeTab === 'wards' && <WardPatientsTab />}

                {/* Admission Tab */}
                {activeTab === 'admission' && <AdmissionTab />}

            {vitalsModal && (
                <RecordVitalsModal
                    patient={vitalsModal}
                    onClose={() => setVitalsModal(null)}
                    onSaved={load}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARD PATIENTS TAB (Nurse)
// ─────────────────────────────────────────────────────────────────────────────
function WardPatientsTab() {
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [wardFilter, setWardFilter] = useState('all');
    const [updateModal, setUpdateModal] = useState(null);

    const load = () => {
        api('/nurse/admissions').then(d => setAdmissions(d.data || [])).catch(console.warn).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const discharge = async (admissionId) => {
        if (!window.confirm('Confirm discharge this patient?')) return;
        try { await api(`/nurse/admissions/${admissionId}/discharge`, { method: 'PATCH' }); toast.success('Patient discharged'); load(); }
        catch (err) { toast.error(err.message); }
    };

    const uniqueWards = [...new Set(admissions.map(a => a.wards?.ward_name).filter(Boolean))];
    const filtered = wardFilter === 'all' ? admissions : admissions.filter(a => a.wards?.ward_name === wardFilter);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Ward Patients</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} style={inputStyle}>
                        <option value="all">All Wards</option>
                        {uniqueWards.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#f9fafb' }}>
                        {['Bed','Ward','Patient','Age/Gender','Admission Reason','Diagnosis','Admitted','Actions'].map(h => (
                            <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No admitted patients</td></tr>
                        ) : filtered.map(adm => (
                            <tr key={adm.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#2563eb', fontSize: 13 }}>{adm.beds?.bed_code || '--'}</td>
                                <td style={{ padding: '12px 14px', fontSize: 13 }}>
                                    <div style={{ fontWeight: 600 }}>{adm.wards?.ward_name || '--'}</div>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{adm.wards?.ward_type}</div>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                    <div style={{ fontWeight: 700 }}>{adm.patient_name}</div>
                                    {adm.patient_pid && <div style={{ fontSize: 11, color: '#9ca3af' }}>{adm.patient_pid}</div>}
                                </td>
                                <td style={{ padding: '12px 14px', fontSize: 13 }}>{adm.age || '--'} / {adm.gender?.charAt(0) || '?'}</td>
                                <td style={{ padding: '12px 14px', fontSize: 13, maxWidth: 140 }}>{adm.admission_reason || '--'}</td>
                                <td style={{ padding: '12px 14px', fontSize: 13 }}>{adm.diagnosis || '--'}</td>
                                <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{new Date(adm.admission_date).toLocaleDateString('en-IN')}</td>
                                <td style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => setUpdateModal(adm)}
                                            style={{ padding: '5px 10px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Update</button>
                                        <button onClick={() => discharge(adm.id)}
                                            style={{ padding: '5px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Discharge</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {updateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px' }}>Update Patient: {updateModal.patient_name}</h3>
                        <UpdateConditionForm admission={updateModal} onClose={() => setUpdateModal(null)} onSaved={() => { setUpdateModal(null); load(); }} />
                    </div>
                </div>
            )}
        </div>
    );
}

function UpdateConditionForm({ admission, onClose, onSaved }) {
    const [notes, setNotes] = useState(admission.treatment_notes || '');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try { await api(`/nurse/queue/${admission.id}/status`, { method: 'PATCH', body: JSON.stringify({ notes }) }); toast.success('Updated'); onSaved(); }
        catch (err) { toast.error(err.message); } finally { setSaving(false); }
    };
    return (
        <div>
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Condition Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 100, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={onClose} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMISSION TAB (Nurse / Receptionist)
// ─────────────────────────────────────────────────────────────────────────────
function AdmissionTab() {
    const [wards, setWards] = useState([]);
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [form, setForm] = useState({ patientName: '', patientPid: '', age: '', gender: '', admissionReason: '', diagnosis: '' });
    const [saving, setSaving] = useState(false);
    const [loadingWards, setLoadingWards] = useState(true);

    useEffect(() => {
        api('/nurse/wards').then(d => setWards(d.data || [])).catch(console.warn).finally(() => setLoadingWards(false));
    }, []);

    const currentWard = wards.find(w => w.id === selectedWard);
    const availableBeds = (currentWard?.beds || []).filter(b => b.status === 'AVAILABLE');

    const admit = async () => {
        if (!selectedWard || !selectedBed || !form.patientName) {
            toast.error('Select ward, bed and enter patient name'); return;
        }
        setSaving(true);
        try {
            await api('/nurse/admissions', { method: 'POST', body: JSON.stringify({ wardId: selectedWard, bedId: selectedBed, ...form }) });
            toast.success('✅ Patient admitted successfully');
            setForm({ patientName: '', patientPid: '', age: '', gender: '', admissionReason: '', diagnosis: '' });
            setSelectedBed('');
            // Refresh ward list
            api('/nurse/wards').then(d => setWards(d.data || []));
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    if (loadingWards) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading wards...</div>;

    const bedStatusColor = s => ({ AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', CLEANING: '#d97706', MAINTENANCE: '#6b7280' }[s] || '#6b7280');
    const bedStatusBg   = s => ({ AVAILABLE: '#dcfce7', OCCUPIED: '#fee2e2', CLEANING: '#fef3c7', MAINTENANCE: '#f3f4f6' }[s] || '#f3f4f6');

    return (
        <div>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Patient Admission</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Step 1: Ward Selection + Bed Status */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#374151' }}>① Select Ward & Bed</h3>

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Ward</label>
                        <select value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedBed(''); }} style={inputStyle}>
                            <option value="">-- Select Ward --</option>
                            {wards.map(w => (
                                <option key={w.id} value={w.id}>{w.ward_name} ({w.ward_type}) — {w.availableBeds} beds free</option>
                            ))}
                        </select>
                    </div>

                    {currentWard && (
                        <>
                            {/* Bed availability overview */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                                {['AVAILABLE','OCCUPIED','CLEANING','MAINTENANCE'].map(s => {
                                    const count = currentWard.beds.filter(b => b.status === s).length;
                                    return (
                                        <span key={s} style={{ padding: '4px 10px', background: bedStatusBg(s), color: bedStatusColor(s), borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                            {s}: {count}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Visual bed grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginBottom: 14 }}>
                                {currentWard.beds.map(bed => (
                                    <div key={bed.id}
                                        onClick={() => bed.status === 'AVAILABLE' && setSelectedBed(bed.id)}
                                        style={{ border: `2px solid ${selectedBed === bed.id ? '#2563eb' : bedStatusColor(bed.status)}`,
                                            background: selectedBed === bed.id ? '#dbeafe' : bedStatusBg(bed.status),
                                            borderRadius: 8, padding: '8px 4px', textAlign: 'center',
                                            cursor: bed.status === 'AVAILABLE' ? 'pointer' : 'default', transition: 'all .15s' }}>
                                        <div style={{ fontSize: 16 }}>🛏</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: selectedBed === bed.id ? '#1d4ed8' : bedStatusColor(bed.status), marginTop: 2 }}>{bed.bed_code}</div>
                                        <div style={{ fontSize: 9, color: bedStatusColor(bed.status), fontWeight: 600 }}>{bed.status}</div>
                                    </div>
                                ))}
                            </div>

                            {selectedBed && (
                                <div style={{ padding: '8px 12px', background: '#dbeafe', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
                                    ✓ Bed selected: {currentWard.beds.find(b => b.id === selectedBed)?.bed_code}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Step 2: Patient Details */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#374151' }}>② Patient Details</h3>
                    {[['Patient Name *','patientName','text'],['Patient ID (optional)','patientPid','text'],
                        ['Age','age','number'],['Admission Reason','admissionReason','text'],['Diagnosis','diagnosis','text']].map(([lbl,field,type]) => (
                        <div key={field} style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{lbl}</label>
                            <input type={type} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                        </div>
                    ))}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Gender</label>
                        <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={inputStyle}>
                            <option value="">-- Select --</option>
                            {['MALE','FEMALE','OTHER'].map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <button onClick={admit} disabled={saving}
                        style={{ width: '100%', padding: '12px', background: saving ? '#9ca3af' : '#2563eb', color: '#fff',
                            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? 'Admitting...' : '🛏 Admit Patient'}
                    </button>
                </div>
            </div>
        </div>
    );
}
