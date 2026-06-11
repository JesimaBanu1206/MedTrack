/**
 * DoctorDashboardPage.jsx  — MedTrack Enhanced Doctor Portal
 * Features:
 *  • Live notice polling every 30s with unread badge
 *  • Messages inbox (admin → individual / role / all) with unread count
 *  • Enhanced Online Consult: per-day time slot management + bookings
 *  • Full attendance (check-in / break / resume / check-out)
 *  • OP Queue with patient auto-fill, prescription, lab, AI analysis
 *  • IP Ward Management with visual bed layout
 *  • AI Medical Analysis with risk scoring & disease prediction
 *  • Doctor Profile with change password
 *  • Attendance history tab
 *  • Code Blue alert
 *  • Lab Notifications tab — real-time polling for completed lab results
 *  • Lab Requests tracker with status + urgency filter
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import axiosInstance from '../api/axios';

// ─── API Helper — uses axiosInstance so token refresh works automatically ─────
async function api(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    let data;
    try { data = options.body ? JSON.parse(options.body) : undefined; } catch { data = options.body; }
    const response = await axiosInstance({
        url: path,
        method,
        data,
        headers: options.headers || {}
    });
    return response.data;
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
    background: '#fff', color: '#111827'
};
const btn = (bg, color = '#fff') => ({
    padding: '8px 18px', background: bg, color, border: 'none', borderRadius: 8,
    fontWeight: 600, fontSize: 13, cursor: 'pointer'
});

// ─── Priority colour ──────────────────────────────────────────────────────────
function priBg(p) {
    return { URGENT: '#fee2e2', HIGH: '#fef3c7', NORMAL: '#f0fdfa', LOW: '#f3f4f6' }[p] || '#f3f4f6';
}
function priColor(p) {
    return { URGENT: '#dc2626', HIGH: '#d97706', NORMAL: '#0d9488', LOW: '#6b7280' }[p] || '#6b7280';
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: width,
                maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
                    position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
                    <button onClick={onClose} style={{ width: 30, height: 30, border: 'none',
                        background: '#f3f4f6', borderRadius: '50%', cursor: 'pointer', fontSize: 15 }}>✕</button>
                </div>
                <div style={{ padding: '20px 24px' }}>{children}</div>
            </div>
        </div>
    );
}

function FormField({ label, children, span }) {
    return (
        <div style={{ gridColumn: span === 2 ? 'span 2' : undefined }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151',
                marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
            {children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VIEW
// ─────────────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault(); setLoading(true);
        try {
            const data = await api('/doctor/login', { method: 'POST', body: JSON.stringify(form) });
            // Store in doctor-specific key so other portals' tokens don't interfere
            localStorage.setItem('doctorToken', data.data.accessToken);
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('doctorUser', JSON.stringify(data.data.user));
            onLogin(data.data.user);
            toast.success('Welcome, ' + (data.data.user.fullName || 'Doctor'));
        } catch (err) { toast.error(err.message || err.response?.data?.message || 'Login failed'); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f766e,#134e4a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px',
                width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#0d9488,#0f766e)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: 28 }}>🏥</div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f766e' }}>MedTrack</h1>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>Doctor & Staff Portal</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</label>
                        <input type="email" required value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="doctor@hospital.com" style={{ ...inputStyle }}
                            onFocus={e => e.target.style.borderColor = '#0d9488'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
                        <input type="password" required value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            placeholder="••••••••" style={{ ...inputStyle }} />
                    </div>
                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '12px',
                        background: loading ? '#9ca3af' : 'linear-gradient(135deg,#0d9488,#0f766e)',
                        color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
function Header({ user, attendance, onCheckIn, onBreak, onBreakEnd, onCheckOut, onLogout, activeTab, setActiveTab, onCodeBlue, msgUnread }) {
    const isOnDuty   = attendance?.status === 'ON_DUTY';
    const isOnBreak  = attendance?.status === 'ON_BREAK';
    const isCheckedOut = attendance?.logout_time;

    const tabs = [
        { id: 'dashboard',     label: '🏠 Dashboard' },
        { id: 'queue',         label: '👥 OP Consult' },
        { id: 'ipwards',       label: '🏥 IP Wards' },
        { id: 'online',        label: '💻 Online Consult' },
        { id: 'appointments',  label: '📆 Appointments' },
        { id: 'prescriptions', label: '💊 Prescriptions' },
        { id: 'labnoti',       label: '🔬 Lab Results', badge: msgUnread?.labNew },
        { id: 'ai',            label: '🧠 AI Analysis' },
        { id: 'messages',      label: '✉ Messages', badge: msgUnread?.msgs },
        { id: 'history',       label: '📅 Attendance' },
        { id: 'leave',         label: '🛫 Leave' },
        { id: 'profile',       label: '👤 Profile' },
    ];

    return (
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px',
            position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                {/* Doctor info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#0d9488,#0f766e)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {(user?.fullName || 'D')[0]}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{user?.fullName || 'Doctor'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {user?.department || user?.doctorProfile?.specialization || 'General Medicine'} · {user?.hospital?.hospital_name || 'Hospital'}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={onCodeBlue} style={{ padding: '8px 14px', background: '#dc2626',
                        color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        ⚠ CODE BLUE
                    </button>

                    {/* Attendance quick actions */}
                    {!attendance?.login_time && (
                        <button onClick={onCheckIn} style={{ ...btn('#16a34a'), fontSize: 12 }}>✓ Check In</button>
                    )}
                    {attendance?.login_time && !isCheckedOut && isOnDuty && (
                        <button onClick={onBreak} style={{ ...btn('#f3f4f6', '#374151'), fontSize: 12 }}>☕ Break</button>
                    )}
                    {isOnBreak && (
                        <button onClick={onBreakEnd} style={{ ...btn('#0d9488'), fontSize: 12 }}>▶ Resume</button>
                    )}
                    {attendance?.login_time && !isCheckedOut && (
                        <button onClick={onCheckOut} style={{ ...btn('#f3f4f6', '#ef4444'), fontSize: 12 }}>↪ Check Out</button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        border: `1.5px solid ${isOnDuty ? '#16a34a' : isOnBreak ? '#d97706' : isCheckedOut ? '#9ca3af' : '#9ca3af'}`,
                        borderRadius: 8, fontSize: 12, fontWeight: 600,
                        color: isOnDuty ? '#16a34a' : isOnBreak ? '#d97706' : '#6b7280' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%',
                            background: isOnDuty ? '#16a34a' : isOnBreak ? '#d97706' : '#d1d5db' }} />
                        {isOnDuty ? 'ON DUTY' : isOnBreak ? 'ON BREAK' : isCheckedOut ? 'CHECKED OUT' : 'NOT CHECKED IN'}
                    </div>

                    <button onClick={onLogout} style={{ padding: '8px 10px', background: 'none',
                        border: '1.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>⏻</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #f3f4f6', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        style={{ position: 'relative', padding: '10px 14px', background: 'none', border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #0d9488' : '2px solid transparent',
                            fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 500,
                            color: activeTab === tab.id ? '#0d9488' : '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {tab.label}
                        {tab.badge > 0 && (
                            <span style={{ position: 'absolute', top: 6, right: 4, width: 16, height: 16,
                                background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: 9,
                                fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {tab.badge > 9 ? '9+' : tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </header>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE BAR
// ─────────────────────────────────────────────────────────────────────────────
function ResourceBar({ label, available, total, color, critical }) {
    const pct = total > 0 ? Math.min(100, (available / total) * 100) : 0;
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: critical ? '#ef4444' : color }}>
                    {critical ? `⚠ ${available} left` : `${available}/${total}`}
                </span>
            </div>
            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                <div style={{ height: 6, background: color, borderRadius: 3, width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD TAB
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({ dashData, attendance, notices }) {
    const schedules  = dashData?.schedules || { today: [], tomorrow: [] };
    const resources  = dashData?.resources;
    const queueStats = dashData?.queueStats || {};

    const loginTime = attendance?.login_time
        ? new Date(attendance.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '--:--';

    const totalMinutes = attendance?.login_time && !attendance?.logout_time
        ? Math.round((Date.now() - new Date(attendance.login_time)) / 60000)
        : (attendance?.total_minutes || 0);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return (
        <div style={{ padding: '20px 24px' }}>
            {/* 4-Card Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>

                {/* Attendance */}
                <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #0d9488', padding: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1,
                        textTransform: 'uppercase', marginBottom: 8 }}>MY ATTENDANCE</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: -1, marginBottom: 2 }}>{loginTime}</div>
                    {attendance?.login_time && (
                        <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
                            ✅ {attendance.status?.replace('_', ' ')}
                        </div>
                    )}
                    {attendance?.login_time && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            ⏱ {hrs}h {mins}m on duty
                        </div>
                    )}
                    {!attendance?.login_time && (
                        <div style={{ fontSize: 13, color: '#9ca3af' }}>Not checked in today</div>
                    )}
                </div>

                {/* Shift Roster */}
                <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #3b82f6', padding: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1,
                        textTransform: 'uppercase', marginBottom: 10 }}>SHIFT ROSTER</div>
                    {schedules.today.length > 0 ? schedules.today.slice(0, 2).map((s, i) => {
                        const isIP = ['INPATIENT','IP','IP_WARD'].includes((s.duty_type||'').toUpperCase()) ||
                                     ['INPATIENT','IP'].includes((s.appointment_type||'').toUpperCase());
                        return (
                        <div key={i} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8,
                            background: isIP ? '#f0fdfa' : '#f9fafb',
                            border: `1px solid ${isIP ? '#99f6e4' : '#e5e7eb'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px',
                                    background: isIP ? '#ccfbf1' : '#dbeafe',
                                    color: isIP ? '#0d9488' : '#1d4ed8', borderRadius: 4 }}>
                                    {isIP ? '🏥 IP' : 'TODAY'}
                                </span>
                                <span style={{ fontSize: 11, color: '#6b7280' }}>{s.shift_start?.slice(0,5)} – {s.shift_end?.slice(0,5)}</span>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.duty_type} · {s.department}</div>
                            {s.room_number && <div style={{ fontSize: 11, color: '#9ca3af' }}>Room {s.room_number}</div>}
                            {s.ward_name && <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>Ward: {s.ward_name}</div>}
                            {isIP && (
                                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#0d9488',
                                    background: '#ccfbf1', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
                                    🏥 IP duty — check the IP Wards tab
                                </div>
                            )}
                        </div>
                        );
                    }) : <div style={{ fontSize: 13, color: '#9ca3af' }}>No schedule today</div>}
                    {schedules.tomorrow.slice(0, 1).map((s, i) => (
                        <div key={i} style={{ paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 2 }}>TOMORROW</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{s.duty_type} · {s.department}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.shift_start?.slice(0,5)} – {s.shift_end?.slice(0,5)}</div>
                        </div>
                    ))}
                </div>

                {/* Hospital Resources */}
                <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #a855f7', padding: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1,
                        textTransform: 'uppercase', marginBottom: 10 }}>HOSPITAL RESOURCES</div>
                    {resources ? (
                        <>
                            <ResourceBar label="General Beds" available={resources.general_beds_available}
                                total={resources.general_beds_total} color="#8b5cf6" />
                            <ResourceBar label="ICU Beds" available={resources.icu_beds_available}
                                total={resources.icu_beds_total} color="#8b5cf6"
                                critical={resources.icu_beds_available <= 2} />
                            {resources.ventilators_total > 0 && (
                                <ResourceBar label="Ventilators" available={resources.ventilators_available}
                                    total={resources.ventilators_total} color="#8b5cf6"
                                    critical={resources.ventilators_available <= 1} />
                            )}
                        </>
                    ) : <div style={{ fontSize: 13, color: '#9ca3af' }}>No resource data</div>}
                </div>

                {/* Admin Notices */}
                <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #f97316', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1,
                            textTransform: 'uppercase' }}>ADMIN NOTICES</div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                            boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} title="Live" />
                    </div>
                    <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                        {notices.length > 0 ? notices.map((n, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: priBg(n.priority),
                                borderRadius: 8, marginBottom: 6, fontSize: 12, borderLeft: `3px solid ${priColor(n.priority)}` }}>
                                <div style={{ fontWeight: 700, color: priColor(n.priority), marginBottom: 2 }}>
                                    {n.priority === 'URGENT' ? '🚨' : n.priority === 'HIGH' ? '⚠' : '📢'} {n.title}
                                </div>
                                <div style={{ color: '#374151' }}>{n.message}</div>
                            </div>
                        )) : <div style={{ fontSize: 13, color: '#9ca3af' }}>No notices</div>}
                    </div>
                </div>
            </div>

            {/* Queue Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                    { label: 'Total Queue', value: queueStats.total || 0, color: '#0d9488' },
                    { label: 'Waiting', value: queueStats.waiting || 0, color: '#d97706' },
                    { label: 'In Consultation', value: queueStats.inConsultation || 0, color: '#3b82f6' },
                    { label: 'Completed Today', value: queueStats.completed || 0, color: '#16a34a' },
                ].map((stat, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px',
                        border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// OP QUEUE TAB
// ─────────────────────────────────────────────────────────────────────────────
function QueueTab() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchPid, setSearchPid] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [consultModal, setConsultModal] = useState(null);
    const [patientData, setPatientData] = useState(null);

    const loadQueue = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api('/doctor/queue');
            setQueue(data.data || []);
        } catch { toast.error('Failed to load queue'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    const handleConsult = async entry => {
        setConsultModal(entry); setPatientData(null);
        if (entry.patient_pid) {
            try {
                const d = await api(`/doctor/patient/${entry.patient_pid}`);
                setPatientData(d.data);
            } catch {
                setPatientData({ patient: { full_name: entry.patient_name, age: entry.age, gender: entry.gender }, prescriptions: [], labReports: [] });
            }
        } else {
            setPatientData({ patient: { full_name: entry.patient_name, age: entry.age, gender: entry.gender }, prescriptions: [], labReports: [] });
        }
        try {
            await api(`/doctor/queue/${entry.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_CONSULTATION' }) });
            loadQueue();
        } catch (_) {}
    };

    const triageColor = t => ({ CRITICAL: '#ef4444', URGENT: '#f97316', NORMAL: '#6b7280' }[t] || '#6b7280');
    const statusStyle = s => ({
        WAITING: { bg: '#fef3c7', color: '#d97706' },
        IN_CONSULTATION: { bg: '#dbeafe', color: '#1d4ed8' },
        COMPLETED: { bg: '#dcfce7', color: '#16a34a' },
        CANCELLED: { bg: '#f3f4f6', color: '#6b7280' },
        REFERRED: { bg: '#fdf4ff', color: '#9333ea' }
    }[s] || { bg: '#f3f4f6', color: '#6b7280' });

    const filtered = queue.filter(p =>
        !searchPid ||
        p.patient_pid?.toLowerCase().includes(searchPid.toLowerCase()) ||
        p.patient_name?.toLowerCase().includes(searchPid.toLowerCase())
    );

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fff', borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '10px 14px' }}>
                    <span style={{ fontSize: 16, color: '#9ca3af' }}>🔍</span>
                    <input value={searchPid} onChange={e => setSearchPid(e.target.value)}
                        placeholder="Search patient name or ID..."
                        style={{ border: 'none', outline: 'none', fontSize: 14, flex: 1 }} />
                </div>
                <button onClick={loadQueue} style={{ ...btn('#f3f4f6', '#374151') }}>↻ Refresh</button>
                <button onClick={() => setShowAdd(true)} style={{ ...btn('#0d9488') }}>+ Add Patient</button>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['TOKEN', 'PATIENT', 'AGE/SEX', 'REASON', 'VITALS', 'STATUS', 'ACTION'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700,
                                    color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No patients in queue</td></tr>
                        ) : filtered.map(p => {
                            const ss = statusStyle(p.status);
                            return (
                                <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 16, color: '#0d9488' }}>
                                        #{String(p.token_number).padStart(2, '0')}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.patient_name}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>PID: {p.patient_pid || 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{p.age || '--'}/{p.gender?.charAt(0) || '?'}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{p.reason || '--'}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                        {p.bp && (
                                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                background: p.triage_status === 'CRITICAL' ? '#fee2e2' : '#f3f4f6',
                                                color: triageColor(p.triage_status) }}>
                                                BP: {p.bp}
                                            </span>
                                        )}
                                        {p.temperature && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>T: {p.temperature}</div>}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                            background: ss.bg, color: ss.color }}>
                                            {p.status === 'IN_CONSULTATION' ? 'In Queue' : p.status?.charAt(0) + p.status?.slice(1).toLowerCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        {p.status === 'COMPLETED' ? (
                                            <button style={{ ...btn('#f3f4f6', '#374151'), fontSize: 12 }}>View</button>
                                        ) : (
                                            <button onClick={() => handleConsult(p)}
                                                style={{ ...btn('linear-gradient(135deg,#0d9488,#0f766e)'), fontSize: 12 }}>
                                                Consult
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} onAdded={loadQueue} />}
            {consultModal && (
                <ConsultModal entry={consultModal} patientData={patientData}
                    onClose={() => { setConsultModal(null); setPatientData(null); loadQueue(); }} />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PATIENT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onAdded }) {
    const [form, setForm] = useState({
        patientName: '', patientPid: '', age: '', gender: 'M',
        reason: '', bp: '', temperature: '', heartRate: '', triageStatus: 'NORMAL'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault(); setLoading(true);
        try {
            await api('/doctor/queue', { method: 'POST', body: JSON.stringify(form) });
            toast.success('Patient added to queue');
            onAdded(); onClose();
        } catch (err) { toast.error(err.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal title="Add Patient to Queue" onClose={onClose} width={480}>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Patient Name *" span={2}>
                        <input required value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} style={inputStyle} />
                    </FormField>
                    <FormField label="Patient ID (PID)">
                        <input value={form.patientPid} onChange={e => setForm(p => ({ ...p, patientPid: e.target.value }))} style={inputStyle} placeholder="TN-XXXX" />
                    </FormField>
                    <FormField label="Age">
                        <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} style={inputStyle} />
                    </FormField>
                    <FormField label="Gender">
                        <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={inputStyle}>
                            <option value="M">Male</option><option value="F">Female</option><option value="Other">Other</option>
                        </select>
                    </FormField>
                    <FormField label="Triage">
                        <select value={form.triageStatus} onChange={e => setForm(p => ({ ...p, triageStatus: e.target.value }))} style={inputStyle}>
                            <option value="NORMAL">Normal</option><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option>
                        </select>
                    </FormField>
                    <FormField label="Reason / Complaint" span={2}>
                        <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} style={inputStyle} />
                    </FormField>
                    <FormField label="BP (e.g. 120/80)">
                        <input value={form.bp} onChange={e => setForm(p => ({ ...p, bp: e.target.value }))} style={inputStyle} />
                    </FormField>
                    <FormField label="Temperature">
                        <input value={form.temperature} onChange={e => setForm(p => ({ ...p, temperature: e.target.value }))} style={inputStyle} placeholder="98.6°F" />
                    </FormField>
                    <FormField label="Heart Rate (bpm)">
                        <input type="number" value={form.heartRate} onChange={e => setForm(p => ({ ...p, heartRate: e.target.value }))} style={inputStyle} />
                    </FormField>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button type="button" onClick={onClose} style={{ ...btn('#f3f4f6', '#374151') }}>Cancel</button>
                    <button type="submit" disabled={loading} style={{ ...btn('#0d9488') }}>
                        {loading ? 'Adding...' : 'Add to Queue'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ConsultModal({ entry, patientData, onClose }) {
    const [tab, setTab] = useState('vitals');
    const [rxForm, setRxForm] = useState({
        diagnosis: '', chiefComplaint: entry?.reason || '', notes: '', followUpDate: '',
        isLabRequired: false,
        medicines: [{ name: '', dosage: '', morning: false, afternoon: false, night: false, beforeFood: false, durationDays: 3 }]
    });
    const [labForm, setLabForm] = useState({ testType: '', urgency: 'ROUTINE', notes: '' });
    const [saving, setSaving] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const patient = patientData?.patient || {};
    const prevRx  = patientData?.prescriptions || [];
    const labReps = patientData?.labReports || [];

    const savePrescription = async () => {
        if (!rxForm.diagnosis) return toast.error('Diagnosis is required');
        setSaving(true);
        try {
            await api('/doctor/prescription', {
                method: 'POST',
                body: JSON.stringify({
                    queueEntryId: entry.id, patientId: patient.id || null,
                    patientName: patient.full_name || entry.patient_name,
                    ...rxForm, medicines: rxForm.medicines.filter(m => m.name)
                })
            });
            toast.success('Prescription saved!'); onClose();
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const sendToLab = async () => {
        if (!labForm.testType) return toast.error('Test type required');
        setSaving(true);
        try {
            await api('/doctor/lab-request', {
                method: 'POST',
                body: JSON.stringify({ patientId: patient.id || null, patientName: patient.full_name || entry.patient_name, ...labForm })
            });
            toast.success('Lab request sent!'); setLabForm({ testType: '', urgency: 'ROUTINE', notes: '' });
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const runAI = () => {
        setAnalyzing(true);
        setTimeout(() => {
            setAiAnalysis(generateLocalAIAnalysis({ patient, vitals: entry, chiefComplaint: entry.reason }));
            setAnalyzing(false);
        }, 1200);
    };

    const addMed = () => setRxForm(p => ({
        ...p, medicines: [...p.medicines, { name: '', dosage: '', morning: false, afternoon: false, night: false, beforeFood: false, durationDays: 3 }]
    }));
    const remMed = i => setRxForm(p => ({ ...p, medicines: p.medicines.filter((_, idx) => idx !== i) }));
    const updMed = (i, field, value) => setRxForm(p => ({
        ...p, medicines: p.medicines.map((m, idx) => idx === i ? { ...m, [field]: value } : m)
    }));

    return (
        <Modal title={`Consultation — ${patient.full_name || entry.patient_name}`} onClose={onClose} width={780}>
            {/* Patient header strip */}
            <div style={{ display: 'flex', gap: 16, padding: '12px 16px', background: '#f0fdfa', borderRadius: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{patient.full_name || entry.patient_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Age: {patient.age || entry.age} · Gender: {patient.gender || entry.gender} · PID: {entry.patient_pid || 'N/A'}
                    </div>
                    {patient.allergies && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>⚠ Allergies: {patient.allergies}</div>}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, alignItems: 'center' }}>
                    {entry.bp && <span><b>BP:</b> {entry.bp}</span>}
                    {entry.heart_rate && <span><b>HR:</b> {entry.heart_rate}</span>}
                    {entry.temperature && <span><b>T:</b> {entry.temperature}</span>}
                </div>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
                {[['vitals','📊 Vitals & History'],['prescription','💊 Prescription'],['lab','🔬 Lab Tests'],['ai','🤖 AI Analysis']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 14px', background: 'none', border: 'none',
                        borderBottom: tab === id ? '2px solid #0d9488' : '2px solid transparent',
                        fontSize: 13, fontWeight: tab === id ? 600 : 400, color: tab === id ? '#0d9488' : '#6b7280', cursor: 'pointer' }}>
                        {lbl}
                    </button>
                ))}
            </div>

            {/* Vitals */}
            {tab === 'vitals' && (
                <div>
                    {patient.medical_history && (
                        <div style={{ padding: 10, background: '#fef3c7', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                            <b>Medical History:</b> {patient.medical_history}
                        </div>
                    )}
                    <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Previous Prescriptions</h4>
                    {prevRx.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>None</p>
                        : prevRx.slice(0, 3).map((rx, i) => (
                            <div key={i} style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: '#0d9488' }}>{rx.diagnosis}</span>
                                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(rx.created_at).toLocaleDateString()}</span>
                                </div>
                                {rx.prescription_items?.map((m, j) => (
                                    <div key={j} style={{ color: '#374151', marginLeft: 8 }}>
                                        · {m.medicine_name} {m.dosage} ({[m.morning&&'M',m.afternoon&&'A',m.night&&'N'].filter(Boolean).join('-')})
                                    </div>
                                ))}
                            </div>
                        ))
                    }
                    <h4 style={{ margin: '12px 0 8px', fontSize: 13, fontWeight: 700 }}>Lab Reports</h4>
                    {labReps.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>None</p>
                        : labReps.slice(0, 5).map((lr, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                                border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                                <span>{lr.test_type}</span>
                                <span style={{ color: lr.status === 'COMPLETED' ? '#16a34a' : '#d97706', fontWeight: 600 }}>{lr.status}</span>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Prescription */}
            {tab === 'prescription' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <FormField label="Diagnosis *" span={2}>
                            <input value={rxForm.diagnosis} onChange={e => setRxForm(p => ({ ...p, diagnosis: e.target.value }))}
                                style={inputStyle} placeholder="Primary diagnosis" />
                        </FormField>
                        <FormField label="Chief Complaint">
                            <input value={rxForm.chiefComplaint} onChange={e => setRxForm(p => ({ ...p, chiefComplaint: e.target.value }))} style={inputStyle} />
                        </FormField>
                        <FormField label="Follow-up Date">
                            <input type="date" value={rxForm.followUpDate} onChange={e => setRxForm(p => ({ ...p, followUpDate: e.target.value }))} style={inputStyle} />
                        </FormField>
                        <FormField label="Notes" span={2}>
                            <textarea value={rxForm.notes} onChange={e => setRxForm(p => ({ ...p, notes: e.target.value }))}
                                style={{ ...inputStyle, height: 56, resize: 'vertical' }} />
                        </FormField>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Medicines</span>
                        <button onClick={addMed} style={{ ...btn('#0d9488'), fontSize: 12, padding: '5px 12px' }}>+ Add</button>
                    </div>

                    {rxForm.medicines.map((med, i) => (
                        <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <input value={med.name} onChange={e => updMed(i,'name',e.target.value)} placeholder="Medicine name" style={{ ...inputStyle, fontSize: 13 }} />
                                <input value={med.dosage} onChange={e => updMed(i,'dosage',e.target.value)} placeholder="Dosage" style={{ ...inputStyle, fontSize: 13 }} />
                                <input type="number" value={med.durationDays} onChange={e => updMed(i,'durationDays',e.target.value)}
                                    placeholder="Days" style={{ ...inputStyle, fontSize: 13 }} min={1} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                {[['morning','Morning'],['afternoon','Afternoon'],['night','Night'],['beforeFood','Before Food']].map(([f,l]) => (
                                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={med[f]} onChange={e => updMed(i,f,e.target.checked)} />
                                        {l}
                                    </label>
                                ))}
                                {rxForm.medicines.length > 1 && (
                                    <button onClick={() => remMed(i)} style={{ marginLeft: 'auto', padding: '2px 8px',
                                        background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={rxForm.isLabRequired} onChange={e => setRxForm(p => ({ ...p, isLabRequired: e.target.checked }))} />
                            Requires Lab Test
                        </label>
                        <button onClick={savePrescription} disabled={saving} style={{ ...btn('#0d9488'), padding: '10px 24px' }}>
                            {saving ? 'Saving...' : '✓ Save Prescription'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lab */}
            {tab === 'lab' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FormField label="Test Type *" span={2}>
                            <input value={labForm.testType} onChange={e => setLabForm(p => ({ ...p, testType: e.target.value }))}
                                style={inputStyle} placeholder="CBC, Blood Sugar, ECG, X-Ray..." />
                        </FormField>
                        <FormField label="Urgency">
                            <select value={labForm.urgency} onChange={e => setLabForm(p => ({ ...p, urgency: e.target.value }))} style={inputStyle}>
                                <option value="ROUTINE">Routine</option>
                                <option value="URGENT">Urgent</option>
                                <option value="STAT">STAT (Immediately)</option>
                            </select>
                        </FormField>
                        <FormField label="Notes" span={2}>
                            <textarea value={labForm.notes} onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))}
                                style={{ ...inputStyle, height: 56, resize: 'vertical' }} />
                        </FormField>
                    </div>
                    <button onClick={sendToLab} disabled={saving} style={{ marginTop: 16, ...btn('#0d9488'), padding: '10px 24px' }}>
                        {saving ? 'Sending...' : '🔬 Send to Lab'}
                    </button>
                </div>
            )}

            {/* AI */}
            {tab === 'ai' && (
                <div>
                    <button onClick={runAI} disabled={analyzing}
                        style={{ ...btn('linear-gradient(135deg,#7c3aed,#6d28d9)'), padding: '10px 24px', marginBottom: 16 }}>
                        {analyzing ? '🤖 Analyzing...' : '🤖 Run AI Analysis'}
                    </button>
                    {aiAnalysis && (
                        <div>
                            {aiAnalysis.alerts?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: 13 }}>⚠ Alerts</h4>
                                    {aiAnalysis.alerts.map((a, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>{a}</div>
                                    ))}
                                </div>
                            )}
                            {aiAnalysis.risks?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ margin: '0 0 8px', color: '#d97706', fontSize: 13 }}>🔍 Risk Factors</h4>
                                    {aiAnalysis.risks.map((r, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>{r}</div>
                                    ))}
                                </div>
                            )}
                            {aiAnalysis.recommendations?.length > 0 && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px', color: '#0d9488', fontSize: 13 }}>💡 Recommendations</h4>
                                    {aiAnalysis.recommendations.map((r, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#f0fdfa', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>{r}</div>
                                    ))}
                                </div>
                            )}
                            {aiAnalysis.summary && (
                                <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                                    <b>Summary:</b> {aiAnalysis.summary}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESCRIPTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PrescriptionsTab() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        api('/doctor/prescriptions').then(d => setPrescriptions(d.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const filtered = prescriptions.filter(p =>
        !search || p.patient_name?.toLowerCase().includes(search.toLowerCase()) || p.diagnosis?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>My Prescriptions</h2>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search patient or diagnosis..." style={{ ...inputStyle, width: 280 }} />
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div> : (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Date','Patient','Diagnosis','Medicines','Follow-up','Action'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((rx, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{new Date(rx.created_at).toLocaleDateString('en-IN')}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{rx.patient_name}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{rx.diagnosis}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{rx.prescription_items?.length || 0} med(s)</td>
                                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{rx.follow_up_date ? new Date(rx.follow_up_date).toLocaleDateString('en-IN') : '—'}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <button onClick={() => setSelected(rx)} style={{ ...btn('#f0fdfa', '#0d9488'), border: '1px solid #0d9488', fontSize: 12 }}>View</button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No prescriptions found</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
            {selected && (
                <Modal title={`Prescription — ${selected.patient_name}`} onClose={() => setSelected(null)} width={520}>
                    <div style={{ fontSize: 13 }}>
                        <div style={{ marginBottom: 6 }}><b>Date:</b> {new Date(selected.created_at).toLocaleString('en-IN')}</div>
                        <div style={{ marginBottom: 6 }}><b>Diagnosis:</b> {selected.diagnosis}</div>
                        {selected.notes && <div style={{ marginBottom: 6 }}><b>Notes:</b> {selected.notes}</div>}
                        <h4 style={{ margin: '12px 0 8px', color: '#0d9488' }}>Medicines</h4>
                        {selected.prescription_items?.map((m, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
                                <b>{m.medicine_name}</b> — {m.dosage}
                                <span style={{ marginLeft: 8, color: '#6b7280' }}>
                                    [{[m.morning&&'M',m.afternoon&&'A',m.night&&'N'].filter(Boolean).join('-')}] {m.duration_days}d
                                </span>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT RECORDS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PatientRecordsTab() {
    const [searchPid, setSearchPid] = useState('');
    const [patientData, setPatientData] = useState(null);
    const [searching, setSearching] = useState(false);

    const searchPatient = async () => {
        if (!searchPid.trim()) return;
        setSearching(true);
        try {
            const data = await api(`/doctor/patient/${searchPid.trim()}`);
            setPatientData(data.data);
        } catch (err) { toast.error(err.message || 'Patient not found'); setPatientData(null); }
        finally { setSearching(false); }
    };

    const p = patientData?.patient;

    return (
        <div style={{ padding: '20px 24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Patient Records</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input value={searchPid} onChange={e => setSearchPid(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPatient()}
                    placeholder="Enter Patient ID (e.g. TN-8892)"
                    style={{ ...inputStyle, flex: 1, maxWidth: 360 }} />
                <button onClick={searchPatient} disabled={searching} style={{ ...btn('#0d9488'), padding: '10px 20px' }}>
                    {searching ? 'Searching...' : '🔍 Search'}
                </button>
            </div>

            {p && (
                <div>
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{p.full_name}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, fontSize: 13 }}>
                            <div><b>Patient ID:</b> {p.patient_id}</div>
                            <div><b>Age:</b> {p.age} yrs</div>
                            <div><b>Gender:</b> {p.gender}</div>
                            <div><b>Blood Group:</b> {p.blood_group || 'N/A'}</div>
                        </div>
                        {p.medical_history && <div style={{ marginTop: 10, fontSize: 13 }}><b>Medical History:</b> {p.medical_history}</div>}
                        {p.allergies && <div style={{ marginTop: 6, fontSize: 13, color: '#ef4444' }}><b>⚠ Allergies:</b> {p.allergies}</div>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Prescriptions ({patientData.prescriptions?.length || 0})</h4>
                            {(patientData.prescriptions || []).map((rx, i) => (
                                <div key={i} style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600 }}>{rx.diagnosis}</span>
                                        <span style={{ color: '#9ca3af' }}>{new Date(rx.created_at).toLocaleDateString('en-IN')}</span>
                                    </div>
                                </div>
                            ))}
                            {(!patientData.prescriptions?.length) && <p style={{ color: '#9ca3af', fontSize: 13 }}>No records</p>}
                        </div>
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Lab Reports ({patientData.labReports?.length || 0})</h4>
                            {(patientData.labReports || []).map((lr, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                                    border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{lr.test_type}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(lr.created_at).toLocaleDateString('en-IN')}</div>
                                    </div>
                                    <span style={{ color: lr.status === 'COMPLETED' ? '#16a34a' : '#d97706', fontWeight: 600, fontSize: 12 }}>{lr.status}</span>
                                </div>
                            ))}
                            {(!patientData.labReports?.length) && <p style={{ color: '#9ca3af', fontSize: 13 }}>No lab reports</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE CONSULT TAB — with per-day time slot management
// ─────────────────────────────────────────────────────────────────────────────
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

function OnlineConsultTab({ user }) {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({
        isPublished: false, bio: '', consultationFee: '', slotDurationMin: 15,
        availableDays: ['MON','TUE','WED','THU','FRI'],
        timeSlots: {}
    });
    const [saving, setSaving] = useState(false);
    const [activeDay, setActiveDay] = useState('MON');
    const [newSlot, setNewSlot] = useState('09:00');

    useEffect(() => {
        api('/doctor/online-consult/profile').then(d => {
            if (d.data) {
                setProfile(d.data);
                setForm({
                    isPublished: d.data.is_published || false,
                    bio: d.data.bio || '',
                    consultationFee: d.data.consultation_fee || '',
                    slotDurationMin: d.data.slot_duration_min || 15,
                    availableDays: d.data.available_days || ['MON','TUE','WED','THU','FRI'],
                    timeSlots: d.data.time_slots || {}
                });
            }
        }).catch(() => {});
    }, []);

    const toggleDay = d => setForm(p => ({
        ...p,
        availableDays: p.availableDays.includes(d) ? p.availableDays.filter(x => x !== d) : [...p.availableDays, d]
    }));

    const addSlot = () => {
        if (!newSlot) return;
        setForm(p => {
            const existing = p.timeSlots[activeDay] || [];
            if (existing.includes(newSlot)) return p;
            const updated = [...existing, newSlot].sort();
            return { ...p, timeSlots: { ...p.timeSlots, [activeDay]: updated } };
        });
    };

    const removeSlot = (day, slot) => setForm(p => ({
        ...p, timeSlots: { ...p.timeSlots, [day]: (p.timeSlots[day] || []).filter(s => s !== slot) }
    }));

    const copyToAll = () => {
        const slotsForDay = form.timeSlots[activeDay] || [];
        const newSlots = {};
        form.availableDays.forEach(d => { newSlots[d] = [...slotsForDay]; });
        setForm(p => ({ ...p, timeSlots: { ...p.timeSlots, ...newSlots } }));
        toast.success(`Slots copied to all available days`);
    };

    const save = async () => {
        setSaving(true);
        try {
            await api('/doctor/online-consult/profile', { method: 'PUT', body: JSON.stringify(form) });
            toast.success('Online consult profile updated');
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const slotsForActive = form.timeSlots[activeDay] || [];

    return (
        <div style={{ padding: '20px 24px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Online Consultation Setup</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                {/* Left settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Publish toggle */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                            <div onClick={() => setForm(p => ({ ...p, isPublished: !p.isPublished }))}
                                style={{ width: 48, height: 26, background: form.isPublished ? '#0d9488' : '#d1d5db',
                                    borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                                <div style={{ position: 'absolute', top: 3, left: form.isPublished ? 24 : 3,
                                    width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: form.isPublished ? '#0d9488' : '#6b7280' }}>
                                    {form.isPublished ? '🟢 Published — Patients can book' : '⚫ Not Published'}
                                </div>
                                <div style={{ fontSize: 12, color: '#9ca3af' }}>Toggle to make your profile visible to patients</div>
                            </div>
                        </label>
                    </div>

                    {/* Bio & Fee */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Profile Details</h3>
                        <FormField label="Bio / About">
                            <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                                style={{ ...inputStyle, height: 72, resize: 'vertical' }}
                                placeholder="Tell patients about your expertise..." />
                        </FormField>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                            <FormField label="Consultation Fee (₹)">
                                <input type="number" value={form.consultationFee}
                                    onChange={e => setForm(p => ({ ...p, consultationFee: e.target.value }))} style={inputStyle} />
                            </FormField>
                            <FormField label="Slot Duration (min)">
                                <select value={form.slotDurationMin}
                                    onChange={e => setForm(p => ({ ...p, slotDurationMin: parseInt(e.target.value) }))} style={inputStyle}>
                                    {[10,15,20,30,45,60].map(d => <option key={d} value={d}>{d} min</option>)}
                                </select>
                            </FormField>
                        </div>
                    </div>

                    {/* Available Days */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Available Days</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {DAYS.map(d => (
                                <button key={d} type="button" onClick={() => toggleDay(d)} style={{
                                    padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    borderColor: form.availableDays.includes(d) ? '#0d9488' : '#e5e7eb',
                                    background: form.availableDays.includes(d) ? '#f0fdfa' : '#fff',
                                    color: form.availableDays.includes(d) ? '#0d9488' : '#6b7280'
                                }}>{d}</button>
                            ))}
                        </div>
                    </div>

                    {/* Time Slot Manager */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Time Slots per Day</h3>
                            <button onClick={copyToAll} style={{ ...btn('#f0fdfa', '#0d9488'), border: '1px solid #0d9488', fontSize: 12 }}>
                                Copy {activeDay} → All
                            </button>
                        </div>

                        {/* Day selector */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                            {form.availableDays.map(d => (
                                <button key={d} onClick={() => setActiveDay(d)} style={{
                                    padding: '5px 12px', borderRadius: 8, border: '1.5px solid',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer', position: 'relative',
                                    borderColor: activeDay === d ? '#0d9488' : '#e5e7eb',
                                    background: activeDay === d ? '#0d9488' : '#fff',
                                    color: activeDay === d ? '#fff' : '#6b7280'
                                }}>
                                    {d}
                                    {(form.timeSlots[d] || []).length > 0 && (
                                        <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                                            background: '#16a34a', color: '#fff', borderRadius: '50%', fontSize: 8,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                            {(form.timeSlots[d] || []).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Slots for active day */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                {activeDay} — {slotsForActive.length} slot(s)
                            </div>
                            {slotsForActive.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {slotsForActive.map(slot => (
                                        <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '5px 10px', background: '#f0fdfa', border: '1px solid #0d9488',
                                            borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#0d9488' }}>
                                            🕐 {slot}
                                            <button onClick={() => removeSlot(activeDay, slot)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#9ca3af', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No slots added for {activeDay}</div>
                            )}
                        </div>

                        {/* Add slot */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="time" value={newSlot} onChange={e => setNewSlot(e.target.value)}
                                style={{ ...inputStyle, flex: 1, maxWidth: 140 }} />
                            <button onClick={addSlot} style={{ ...btn('#0d9488'), padding: '8px 20px' }}>+ Add Slot</button>
                        </div>

                        {/* Quick add common slots */}
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Quick add:</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'].map(t => (
                                    <button key={t} onClick={() => {
                                        setForm(p => {
                                            const ex = p.timeSlots[activeDay] || [];
                                            if (ex.includes(t)) return p;
                                            return { ...p, timeSlots: { ...p.timeSlots, [activeDay]: [...ex, t].sort() } };
                                        });
                                    }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb',
                                        fontSize: 11, cursor: 'pointer', background: (form.timeSlots[activeDay]||[]).includes(t) ? '#f0fdfa' : '#fff',
                                        color: (form.timeSlots[activeDay]||[]).includes(t) ? '#0d9488' : '#6b7280' }}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={save} disabled={saving}
                        style={{ ...btn('#0d9488'), padding: '12px 24px', alignSelf: 'flex-start', fontSize: 14 }}>
                        {saving ? 'Saving...' : '💾 Save All Settings'}
                    </button>
                </div>

                {/* Right — preview card + revenue + feedback */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Profile card */}
                    <div style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', borderRadius: 12,
                        padding: 24, color: '#fff', textAlign: 'center' }}>
                        <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 12px' }}>
                            {(user?.fullName || 'D')[0]}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.fullName}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{user?.doctorProfile?.specialization || 'General Medicine'}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 4px' }}>₹{form.consultationFee || '—'}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{form.slotDurationMin} min · {form.availableDays.join(', ')}</div>
                        <div style={{ marginTop: 10, padding: '4px 12px', background: form.isPublished ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                            borderRadius: 20, display: 'inline-block', fontSize: 11, fontWeight: 700 }}>
                            {form.isPublished ? '🟢 LIVE' : '⚫ OFFLINE'}
                        </div>
                    </div>

                    {/* Revenue widget */}
                    <OnlineConsultRevenueWidget />

                    {/* Feedback widget */}
                    <OnlineConsultFeedbackWidget />

                    {/* Slot summary */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Slot Summary</h4>
                        {DAYS.map(d => {
                            const slots = form.timeSlots[d] || [];
                            const isAvail = form.availableDays.includes(d);
                            return (
                                <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                                    <span style={{ fontWeight: 600, color: isAvail ? '#374151' : '#9ca3af' }}>{d}</span>
                                    {isAvail ? (
                                        <span style={{ color: slots.length > 0 ? '#0d9488' : '#9ca3af', fontSize: 12 }}>
                                            {slots.length > 0 ? `${slots.length} slots (${slots[0]}–${slots[slots.length-1]})` : 'No slots'}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontSize: 12 }}>Not available</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE CONSULT — REVENUE WIDGET
// ─────────────────────────────────────────────────────────────────────────────
function OnlineConsultRevenueWidget() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/doctor/online-consult/bookings').then(d => setBookings(d.data || [])).catch(() => setBookings([])).finally(() => setLoading(false));
    }, []);

    const completed = bookings.filter(b => b.status === 'COMPLETED');
    const thisMonth = completed.filter(b => {
        const d = new Date(b.booked_at || b.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalRevenue = completed.reduce((s, b) => s + parseFloat(b.fee || b.consultation_fee || 0), 0);
    const monthRevenue = thisMonth.reduce((s, b) => s + parseFloat(b.fee || b.consultation_fee || 0), 0);

    const pending = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING').length;

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💰</span> Revenue Generated
            </h4>
            {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</div> : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {[
                            { label: 'This Month', value: `₹${monthRevenue.toLocaleString('en-IN')}`, color: '#0d9488', bg: '#f0fdfa' },
                            { label: 'All Time', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: '#8b5cf6', bg: '#f5f3ff' },
                        ].map(s => (
                            <div key={s.label} style={{ padding: '12px 14px', background: s.bg, borderRadius: 10, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                            { label: 'Total Bookings', value: bookings.length, icon: '📅' },
                            { label: 'Completed', value: completed.length, icon: '✅' },
                            { label: 'Pending / Upcoming', value: pending, icon: '⏳' },
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                                padding: '7px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                                <span style={{ color: '#6b7280' }}>{row.icon} {row.label}</span>
                                <span style={{ fontWeight: 700, color: '#374151' }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE CONSULT — FEEDBACK WIDGET
// ─────────────────────────────────────────────────────────────────────────────
function OnlineConsultFeedbackWidget() {
    const [bookings, setBookings] = useState([]);

    useEffect(() => {
        api('/doctor/online-consult/bookings').then(d => setBookings(d.data || [])).catch(() => {});
    }, []);

    const rated = bookings.filter(b => b.rating != null && b.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length) : null;
    const dist = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: rated.filter(b => Math.round(b.rating) === star).length,
        pct: rated.length > 0 ? Math.round((rated.filter(b => Math.round(b.rating) === star).length / rated.length) * 100) : 0
    }));
    const starColor = r => r >= 4 ? '#16a34a' : r >= 3 ? '#d97706' : '#ef4444';

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⭐</span> Patient Feedback Score
            </h4>
            {rated.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px 0', color: '#9ca3af', fontSize: 13 }}>No ratings yet</div>
            ) : (
                <>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: 36, fontWeight: 800, color: starColor(avgRating) }}>{avgRating.toFixed(1)}</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                            {'⭐'.repeat(Math.round(avgRating))} out of 5 · {rated.length} review{rated.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {dist.map(d => (
                            <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <span style={{ width: 20, textAlign: 'right', color: '#374151', fontWeight: 600 }}>{d.star}★</span>
                                <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: `${d.pct}%`, height: '100%', background: starColor(d.star), borderRadius: 4, transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ width: 28, color: '#9ca3af' }}>{d.count}</span>
                            </div>
                        ))}
                    </div>
                    {/* Recent feedback */}
                    {rated.slice(0, 3).some(b => b.review || b.feedback) && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
                                letterSpacing: 0.5, marginBottom: 8 }}>Recent Reviews</div>
                            {rated.slice(0, 3).filter(b => b.review || b.feedback).map((b, i) => (
                                <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{'⭐'.repeat(Math.round(b.rating))}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>&ldquo;{b.review || b.feedback}&rdquo;</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MessagesTab({ onUnreadChange }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const loadMessages = useCallback(async () => {
        try {
            const d = await api('/doctor/messages');
            setMessages(d.data || []);
            onUnreadChange?.(d.unreadCount || 0);
        } catch { toast.error('Failed to load messages'); }
        finally { setLoading(false); }
    }, [onUnreadChange]);

    useEffect(() => { loadMessages(); }, [loadMessages]);

    const openMsg = async msg => {
        setSelected(msg);
        if (!msg.isRead) {
            try {
                await api(`/doctor/messages/${msg.id}/read`, { method: 'PATCH' });
                setMessages(m => m.map(x => x.id === msg.id ? { ...x, isRead: true } : x));
                const unread = messages.filter(m => !m.isRead && m.id !== msg.id).length;
                onUnreadChange?.(unread);
            } catch (_) {}
        }
    };

    const targetIcon = t => ({ ALL: '📢', ROLE: '👥', INDIVIDUAL: '✉' }[t] || '✉');
    const priorityIcon = p => ({ URGENT: '🚨', HIGH: '⚠', NORMAL: '📋', LOW: 'ℹ' }[p] || '📋');

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    Messages from Admin
                    {messages.filter(m => !m.isRead).length > 0 && (
                        <span style={{ marginLeft: 10, padding: '2px 10px', background: '#ef4444', color: '#fff',
                            borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            {messages.filter(m => !m.isRead).length} new
                        </span>
                    )}
                </h2>
                <button onClick={loadMessages} style={{ ...btn('#f3f4f6', '#374151') }}>↻ Refresh</button>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
                    {/* Message list */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                                No messages yet
                            </div>
                        ) : messages.map(msg => (
                            <div key={msg.id} onClick={() => openMsg(msg)}
                                style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                                    background: selected?.id === msg.id ? '#f0fdfa' : !msg.isRead ? '#fffbeb' : '#fff',
                                    transition: 'background 0.15s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>{targetIcon(msg.target_type)}</span>
                                        <span style={{ fontWeight: !msg.isRead ? 700 : 600, fontSize: 14, color: '#111827' }}>{msg.title}</span>
                                        {!msg.isRead && (
                                            <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%', flexShrink: 0 }} />
                                        )}
                                    </div>
                                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                                        {new Date(msg.created_at).toLocaleDateString('en-IN')}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {priorityIcon(msg.priority)} {msg.message}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                        background: priBg(msg.priority), color: priColor(msg.priority), fontWeight: 700 }}>
                                        {msg.priority}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>From: {msg.sender_name}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Message detail */}
                    {selected && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selected.title}</h3>
                                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                    background: priBg(selected.priority), color: priColor(selected.priority) }}>
                                    {selected.priority}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, background: '#f3f4f6', color: '#374151' }}>
                                    {targetIcon(selected.target_type)} {selected.target_type}
                                    {selected.target_role && ` · ${selected.target_role}`}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, background: '#f3f4f6', color: '#374151' }}>
                                    From: {selected.sender_name}
                                </span>
                            </div>
                            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 10, fontSize: 14,
                                lineHeight: 1.7, color: '#374151', minHeight: 100 }}>
                                {selected.message}
                            </div>
                            <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
                                {new Date(selected.created_at).toLocaleString('en-IN')}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────
function AttendanceHistoryTab() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

    const load = async () => {
        setLoading(true);
        try {
            const d = await api(`/doctor/attendance/history?from=${from}&to=${to}&limit=60`);
            setHistory(d.data || []);
        } catch { toast.error('Failed to load history'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const statusColor = s => ({ ON_DUTY: '#16a34a', ON_BREAK: '#d97706', OFF_DUTY: '#6b7280', ABSENT: '#ef4444' }[s] || '#6b7280');
    const statusBg = s => ({ ON_DUTY: '#dcfce7', ON_BREAK: '#fef3c7', OFF_DUTY: '#f3f4f6', ABSENT: '#fee2e2' }[s] || '#f3f4f6');

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Attendance History</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        style={{ ...inputStyle, width: 150 }} />
                    <span style={{ color: '#6b7280', fontSize: 13 }}>to</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        style={{ ...inputStyle, width: 150 }} />
                    <button onClick={load} style={{ ...btn('#0d9488') }}>Filter</button>
                </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div> : (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Date','Check In','Break Start','Break End','Check Out','Total Hours','Status'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280',
                                        textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No records found</td></tr>
                            ) : history.map((rec, i) => {
                                const fmt = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
                                const hrs = rec.total_minutes ? `${Math.floor(rec.total_minutes / 60)}h ${rec.total_minutes % 60}m` : '—';
                                return (
                                    <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>
                                            {new Date(rec.attendance_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#16a34a' }}>{fmt(rec.login_time)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#d97706' }}>{fmt(rec.break_start)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#0d9488' }}>{fmt(rec.break_end)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#ef4444' }}>{fmt(rec.logout_time)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{hrs}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                background: statusBg(rec.status), color: statusColor(rec.status) }}>
                                                {rec.status?.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function LeaveRequestsTab() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ leaveDate: '', leaveType: 'CASUAL', reason: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await api('/doctor/leave-requests');
            setItems(d.data || []);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const submit = async e => {
        e.preventDefault();
        if (!form.leaveDate) return toast.error('Leave date is required');
        setSubmitting(true);
        try {
            await api('/doctor/leave-requests', { method: 'POST', body: JSON.stringify(form) });
            toast.success('Leave request submitted');
            setForm({ leaveDate: '', leaveType: 'CASUAL', reason: '' });
            load();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const chipStyle = status => ({
        PENDING: { bg: '#fef3c7', color: '#d97706' },
        APPROVED: { bg: '#dcfce7', color: '#16a34a' },
        REJECTED: { bg: '#fee2e2', color: '#dc2626' }
    }[status] || { bg: '#f3f4f6', color: '#6b7280' });

    return (
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Apply Leave</h3>
                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Leave Date">
                        <input type="date" value={form.leaveDate} onChange={e => setForm(p => ({ ...p, leaveDate: e.target.value }))} style={inputStyle} />
                    </FormField>
                    <FormField label="Leave Type">
                        <select value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))} style={inputStyle}>
                            <option value="CASUAL">Casual</option>
                            <option value="SICK">Sick</option>
                            <option value="EMERGENCY">Emergency</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </FormField>
                    <FormField label="Reason" span={2}>
                        <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} style={{ ...inputStyle, height: 80, resize: 'vertical' }} />
                    </FormField>
                    <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                        <button type="submit" disabled={submitting} style={{ ...btn('#0d9488'), padding: '10px 22px' }}>
                            {submitting ? 'Submitting...' : 'Submit Leave'}
                        </button>
                    </div>
                </form>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Recent Leave Requests</h3>
                {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <p style={{ color: '#9ca3af', fontSize: 13 }}>No leave requests found</p>
                        ) : items.map(row => {
                            const s = chipStyle(row.status);
                            return (
                                <div key={row.id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{row.leave_date}</div>
                                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
                                            {row.status}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#374151' }}>{row.leave_type}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{row.reason || 'No reason provided'}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT CALENDAR TAB
// ─────────────────────────────────────────────────────────────────────────────
function AppointmentCalendarTab() {
    const today = new Date();
    const [viewDate, setViewDate] = useState(today);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const [historyPid, setHistoryPid] = useState('');
    const [historyData, setHistoryData] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api('/doctor/schedule/today');
            // API returns { today: [...], tomorrow: [...] } — flatten into single array
            const data = res.data;
            const flat = Array.isArray(data)
                ? data
                : [...(data?.today || []), ...(data?.tomorrow || [])];
            setAppointments(flat);
        } catch { setAppointments([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAppointments(); }, [loadAppointments]);

    const apptsByDay = {};
    appointments.forEach(a => {
        const d = new Date(a.appointment_date || a.scheduled_at || a.date);
        if (!isNaN(d)) {
            const key = d.getDate();
            if (!apptsByDay[key]) apptsByDay[key] = [];
            apptsByDay[key].push(a);
        }
    });

    const dayAppts = apptsByDay[selectedDay] || [];

    const loadHistory = async () => {
        if (!historyPid.trim()) return toast.error('Enter a Patient ID');
        setHistoryLoading(true); setHistoryData(null);
        try {
            const d = await api(`/doctor/patient/${historyPid.trim()}`);
            setHistoryData(d.data);
        } catch (err) { toast.error(err.message || 'Patient not found'); }
        finally { setHistoryLoading(false); }
    };

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const statusDot = s => ({ SCHEDULED: '#3b82f6', COMPLETED: '#16a34a', CANCELLED: '#ef4444', NO_SHOW: '#9ca3af' }[s] || '#9ca3af');

    return (
        <div style={{ padding: '20px 24px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>📆 Appointments & Patient History</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
                {/* Calendar */}
                <div>
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {/* Month header */}
                        <div style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', padding: '16px 20px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.2)', border: 'none',
                                color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>‹</button>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{monthName}</span>
                            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.2)', border: 'none',
                                color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>›</button>
                        </div>
                        {/* Day-of-week headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#f9fafb' }}>
                            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{d}</div>
                            ))}
                        </div>
                        {/* Date grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: 8, gap: 2 }}>
                            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                            {Array(daysInMonth).fill(null).map((_, i) => {
                                const d = i + 1;
                                const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
                                const isSelected = selectedDay === d;
                                const hasAppt = !!apptsByDay[d];
                                return (
                                    <button key={d} onClick={() => setSelectedDay(d)} style={{
                                        position: 'relative', aspectRatio: '1', borderRadius: 8, border: 'none',
                                        cursor: 'pointer', fontSize: 13, fontWeight: isToday ? 700 : 500,
                                        background: isSelected ? '#0d9488' : isToday ? '#f0fdfa' : '#fff',
                                        color: isSelected ? '#fff' : isToday ? '#0d9488' : '#374151',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {d}
                                        {hasAppt && (
                                            <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                                                width: 4, height: 4, borderRadius: '50%',
                                                background: isSelected ? 'rgba(255,255,255,0.8)' : '#0d9488' }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected day appointments */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, marginTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>
                            {month + 1}/{selectedDay}/{year} — {dayAppts.length} appointment(s)
                        </div>
                        {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</div> :
                        dayAppts.length === 0 ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No appointments on this day</div> :
                        dayAppts.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%',
                                    background: statusDot(a.status), flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.patient_name || a.full_name || 'Patient'}</div>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.appointment_time || a.time_slot || '—'} · {a.reason || a.appointment_type || 'Consultation'}</div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                    background: a.status === 'COMPLETED' ? '#dcfce7' : a.status === 'CANCELLED' ? '#fee2e2' : '#dbeafe',
                                    color: statusDot(a.status) }}>{a.status || 'SCHEDULED'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Patient Medical History Timeline */}
                <div>
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>🔍 Patient Medical History Timeline</h3>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input value={historyPid} onChange={e => setHistoryPid(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && loadHistory()}
                                placeholder="Enter Patient ID (PID)..."
                                style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={loadHistory} disabled={historyLoading}
                                style={{ ...btn('#0d9488'), padding: '8px 20px', whiteSpace: 'nowrap' }}>
                                {historyLoading ? '...' : '🔍 Load'}
                            </button>
                        </div>
                    </div>

                    {historyData && <PatientHistoryTimeline data={historyData} />}

                    {!historyData && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb',
                            padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>🏥</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Enter a Patient ID to view their medical history timeline</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>Includes visit records, prescriptions, lab results and more</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT HISTORY TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function PatientHistoryTimeline({ data }) {
    const patient = data?.patient || {};
    const records = data?.medicalRecords || data?.records || [];
    const prescriptions = data?.prescriptions || [];
    const labReports = data?.labReports || data?.labRequests || [];
    const vitals = data?.vitals || [];

    // Merge timeline events
    const events = [
        ...records.map(r => ({ type: 'record', date: r.created_at, label: r.diagnosis || r.chief_complaint || 'Medical Record', sub: r.notes, color: '#3b82f6', icon: '📋' })),
        ...prescriptions.map(p => ({ type: 'rx', date: p.created_at, label: `Prescription: ${(p.items||[]).map(i=>i.medicine_name||i.drug_name).slice(0,2).join(', ') || 'Medicines'}`, sub: p.notes, color: '#8b5cf6', icon: '💊' })),
        ...labReports.map(l => ({ type: 'lab', date: l.created_at, label: `Lab: ${l.test_name || l.test_type || 'Test'}`, sub: l.result_notes || l.status, color: '#f59e0b', icon: '🔬' })),
        ...vitals.map(v => ({ type: 'vitals', date: v.recorded_at || v.created_at, label: `Vitals: BP ${v.bp || '—'} · HR ${v.heart_rate || '—'}`, sub: `Temp: ${v.temperature || '—'} · SpO2: ${v.spo2 || '—'}`, color: '#10b981', icon: '❤️' })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, maxHeight: 600, overflowY: 'auto' }}>
            {/* Patient Header */}
            <div style={{ display: 'flex', gap: 16, padding: '14px 16px', background: '#f0fdfa',
                borderRadius: 10, border: '1px solid #99f6e4', marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#0d9488,#0f766e)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                    {(patient.full_name || 'P')[0]}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{patient.full_name || 'Unknown Patient'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                        PID: <strong style={{ color: '#0d9488' }}>{patient.patient_pid || patient.pid || '—'}</strong>
                        {patient.age && ` · Age: ${patient.age}`}
                        {patient.gender && ` · ${patient.gender}`}
                        {patient.blood_group && ` · ${patient.blood_group}`}
                    </div>
                    {patient.allergies && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>⚠ Allergies: {patient.allergies}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                    <div style={{ fontWeight: 600, color: '#374151' }}>{records.length} visits</div>
                    <div>{prescriptions.length} prescriptions</div>
                    <div>{labReports.length} lab tests</div>
                </div>
            </div>

            {/* Timeline */}
            {events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 14 }}>No history records found for this patient</div>
            ) : (
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                    <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
                    {events.map((ev, i) => (
                        <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
                            <div style={{ position: 'absolute', left: -20, top: 3, width: 20, height: 20,
                                borderRadius: '50%', background: ev.color, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 10, border: '2px solid #fff',
                                boxShadow: '0 0 0 2px ' + ev.color + '33' }}>
                                <span style={{ fontSize: 9 }}>{ev.icon}</span>
                            </div>
                            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
                                border: '1px solid #e5e7eb', borderLeft: `3px solid ${ev.color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.label}</div>
                                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                        {ev.date ? new Date(ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </span>
                                </div>
                                {ev.sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{ev.sub}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE BLUE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CodeBlueModal({ onClose }) {
    return (
        <Modal title="🚨 CODE BLUE ALERT" onClose={onClose} width={400}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🚨</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>EMERGENCY CODE BLUE</div>
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>Alert dispatched to all available staff & emergency team</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[['📞 Emergency', '102', '#fee2e2', '#dc2626'], ['🚑 Ambulance', '108', '#fef3c7', '#d97706']].map(([l, v, bg, c]) => (
                        <div key={l} style={{ padding: 14, background: bg, borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{l}</div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} style={{ padding: '10px 24px', background: '#dc2626', color: '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    Dismiss Alert
                </button>
            </div>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL AI ANALYSIS HELPER
// ─────────────────────────────────────────────────────────────────────────────
function generateLocalAIAnalysis({ patient, vitals, chiefComplaint }) {
    const alerts = [], risks = [], recommendations = [];
    if (vitals?.bp) {
        const [sys] = vitals.bp.split('/').map(Number);
        if (sys >= 160) alerts.push('Severely elevated BP — immediate management required');
        else if (sys >= 140) risks.push('Stage 2 hypertension — requires treatment');
    }
    if (vitals?.heart_rate) {
        const hr = parseInt(vitals.heart_rate);
        if (hr > 100) alerts.push('Tachycardia — heart rate above normal');
        if (hr < 60) alerts.push('Bradycardia — abnormally low heart rate');
    }
    if (vitals?.temperature) {
        const t = parseFloat(vitals.temperature);
        if (t >= 103) alerts.push('High fever — investigate infectious cause');
        else if (t >= 100.4) risks.push('Fever present — monitor for infection');
    }
    if (vitals?.sugar) {
        const s = parseFloat(vitals.sugar);
        if (s > 200) alerts.push('High blood glucose — possible uncontrolled diabetes');
        if (s < 70) alerts.push('Hypoglycemia — immediate glucose administration');
    }
    if (patient?.age > 60) risks.push('Age > 60 — increased cardiovascular risk');
    if (chiefComplaint?.toLowerCase().includes('chest')) {
        alerts.push('Chest pain — rule out ACS; ECG and troponin recommended');
        recommendations.push('ECG, Troponin I, Chest X-Ray recommended');
    }
    recommendations.push('Ensure adequate hydration and rest');
    if (risks.length > 0) recommendations.push('Follow-up in 1–2 weeks');
    return {
        alerts, risks, recommendations,
        summary: `AI analysis complete. ${alerts.length > 0 ? 'Critical findings — immediate attention required.' : 'No critical immediate concerns.'}`
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorDashboardPage() {
    const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('doctorUser')); } catch { return null; } });
    // Only treat as logged in when doctor-specific token is present (prevents other portals' tokens causing 403 polls)
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('doctorToken'));
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dashData, setDashData] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [notices, setNotices] = useState([]);
    const [msgUnread, setMsgUnread] = useState(0);
    const [showCodeBlue, setShowCodeBlue] = useState(false);
    const noticeIntervalRef = useRef(null);

    // Load dashboard + attendance
    const loadDashboard = useCallback(async () => {
        try {
            const [dash, att] = await Promise.all([
                api('/doctor/dashboard'),
                api('/doctor/attendance/today')
            ]);
            setDashData(dash.data);
            setAttendance(att.data);
            setNotices(dash.data?.notices || []);
        } catch (err) { console.warn('Dashboard load failed:', err.message); }
    }, []);

    // Poll notices every 30s — only runs when doctorToken is present
    const pollNotices = useCallback(async () => {
        if (!localStorage.getItem('doctorToken')) return;
        try {
            const d = await api('/doctor/notices');
            setNotices(d.data || []);
        } catch (err) {
            // On 403/401 stop the polling interval — the axios interceptor will handle reload
            const status = err?.response?.status;
            if ((status === 403 || status === 401) && noticeIntervalRef.current) {
                clearInterval(noticeIntervalRef.current);
                noticeIntervalRef.current = null;
            }
        }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        loadDashboard();
        noticeIntervalRef.current = setInterval(pollNotices, 30000);
        return () => clearInterval(noticeIntervalRef.current);
    }, [isLoggedIn, loadDashboard, pollNotices]);

    const handleLogin = userData => { setUser(userData); setIsLoggedIn(true); };
    const handleLogout = () => {
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('doctorUser');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null); setIsLoggedIn(false); setDashData(null); setAttendance(null);
        clearInterval(noticeIntervalRef.current);
    };

    const handleCheckIn = async () => {
        try { const d = await api('/doctor/attendance/check-in', { method: 'POST' }); setAttendance(d.data); toast.success('✅ Checked in'); loadDashboard(); }
        catch (err) { toast.error(err.message); }
    };
    const handleBreak = async () => {
        try { const d = await api('/doctor/attendance/break-start', { method: 'POST' }); setAttendance(d.data); toast.success('☕ Break started'); }
        catch (err) { toast.error(err.message); }
    };
    const handleBreakEnd = async () => {
        try { const d = await api('/doctor/attendance/break-end', { method: 'POST' }); setAttendance(d.data); toast.success('▶ Resumed'); }
        catch (err) { toast.error(err.message); }
    };
    const handleCheckOut = async () => {
        if (!window.confirm('Confirm check out?')) return;
        try { const d = await api('/doctor/attendance/check-out', { method: 'POST' }); setAttendance(d.data); toast.success('✓ Checked out'); }
        catch (err) { toast.error(err.message); }
    };

    if (!isLoggedIn) return (
        <>
            <Toaster position="top-right" />
            <LoginView onLogin={handleLogin} />
        </>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <Toaster position="top-right" />
            <Header user={user} attendance={attendance}
                onCheckIn={handleCheckIn} onBreak={handleBreak} onBreakEnd={handleBreakEnd}
                onCheckOut={handleCheckOut} onLogout={handleLogout}
                activeTab={activeTab} setActiveTab={setActiveTab}
                onCodeBlue={() => setShowCodeBlue(true)} msgUnread={msgUnread} />

            {activeTab === 'dashboard'     && <DashboardTab dashData={dashData} attendance={attendance} notices={notices} />}
            {activeTab === 'queue'         && <QueueTab />}
            {activeTab === 'ipwards'       && <IPWardTab />}
            {activeTab === 'online'        && <OnlineConsultTab user={user} />}
            {activeTab === 'appointments'   && <AppointmentCalendarTab />}
            {activeTab === 'prescriptions' && <PrescriptionsTab />}
            {activeTab === 'ai'            && <AIAnalysisTab />}
            {activeTab === 'messages'      && <MessagesTab onUnreadChange={setMsgUnread} />}
            {activeTab === 'history'       && <AttendanceHistoryTab />}
            {activeTab === 'leave'         && <LeaveRequestsTab />}
            {activeTab === 'profile'       && <ProfileTab user={user} onUserUpdate={u => { localStorage.setItem('doctorUser', JSON.stringify(u)); setUser(u); }} />}

            {showCodeBlue && <CodeBlueModal onClose={() => setShowCodeBlue(false)} />}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB — Doctor info + Change Password
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({ user, onUserUpdate }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const [saving, setSaving] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);

    useEffect(() => {
        api('/doctor/profile').then(d => {
            setProfile(d.data);
            setEditForm({ specialization: d.data.specialization || '', phone: d.data.phone || '',
                qualification: d.data.qualification || '', experienceYears: d.data.experienceYears || '',
                consultationFee: d.data.consultationFee || '', profileBio: d.data.profileBio || '' });
        }).catch(console.warn).finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        setSaving(true);
        try { await api('/doctor/profile', { method: 'PUT', body: JSON.stringify(editForm) }); toast.success('Profile updated'); setEditing(false); }
        catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const changePassword = async () => {
        if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
        if (pwForm.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
        setPwSaving(true);
        try {
            await api('/doctor/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }) });
            toast.success('✅ Password changed successfully');
            setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
            setShowPwModal(false);
        } catch (err) { toast.error(err.message); }
        finally { setPwSaving(false); }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading profile...</div>;

    const infoItems = [
        { label: 'Doctor ID', value: profile?.doctorUniqueId, icon: '🪪' },
        { label: 'Full Name', value: profile?.fullName, icon: '👤' },
        { label: 'Specialization', value: profile?.specialization, icon: '🩺' },
        { label: 'Qualification', value: profile?.qualification, icon: '🎓' },
        { label: 'Experience', value: profile?.experienceYears ? `${profile.experienceYears} years` : null, icon: '📅' },
        { label: 'Hospital', value: profile?.hospital?.hospital_name, icon: '🏥' },
        { label: 'Department', value: profile?.department, icon: '🏢' },
        { label: 'Phone', value: profile?.phone, icon: '📱' },
        { label: 'Email', value: profile?.email, icon: '✉' },
        { label: 'Consultation Fee', value: profile?.consultationFee ? `₹${profile.consultationFee}` : null, icon: '💰' },
    ];

    return (
        <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                {/* Avatar row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg,#0d9488,#0f766e)', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                        {(profile?.fullName || 'D')[0]}
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>{profile?.fullName}</h2>
                        <p style={{ margin: '4px 0 0', color: '#0d9488', fontWeight: 600 }}>{profile?.specialization || 'General Medicine'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#9ca3af' }}>{profile?.doctorUniqueId} · {profile?.hospital?.hospital_name}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                        <button onClick={() => setEditing(!editing)} style={{ ...btn('#0d9488'), fontSize: 13 }}>
                            {editing ? 'Cancel Edit' : '✏ Edit Profile'}
                        </button>
                        <button onClick={() => setShowPwModal(true)} style={{ ...btn('#f3f4f6', '#374151'), fontSize: 13 }}>🔒 Change Password</button>
                    </div>
                </div>

                {!editing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {infoItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 18, marginTop: 2 }}>{item.icon}</span>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: item.value ? '#111827' : '#d1d5db' }}>{item.value || '—'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[['Specialization','specialization','text'],['Phone','phone','tel'],['Qualification','qualification','text'],
                            ['Experience (years)','experienceYears','number'],['Consultation Fee (₹)','consultationFee','number']].map(([lbl,field,type]) => (
                            <div key={field}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>{lbl}</label>
                                <input type={type} value={editForm[field] || ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                            </div>
                        ))}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Bio</label>
                            <textarea value={editForm.profileBio || ''} onChange={e => setEditForm(p => ({ ...p, profileBio: e.target.value }))} style={{ ...inputStyle, height: 80, resize: 'vertical' }} />
                        </div>
                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={saveProfile} disabled={saving} style={{ ...btn('#0d9488') }}>{saving ? 'Saving...' : '✓ Save Changes'}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Change Password Modal */}
            {showPwModal && (
                <Modal title="Change Password" onClose={() => setShowPwModal(false)} width={440}>
                    {[['Current Password','currentPassword'],['New Password','newPassword'],['Confirm New Password','confirm']].map(([lbl,field]) => (
                        <div key={field} style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>{lbl}</label>
                            <input type="password" value={pwForm[field]} onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <button onClick={() => setShowPwModal(false)} style={{ ...btn('#f3f4f6', '#374151') }}>Cancel</button>
                        <button onClick={changePassword} disabled={pwSaving} style={{ ...btn('#0d9488') }}>{pwSaving ? 'Changing...' : '🔒 Change Password'}</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// IP WARD TAB — Doctor's assigned ward patients (IP duty)
// ─────────────────────────────────────────────────────────────────────────────
function IPWardTab() {
    const [wards, setWards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWard, setSelectedWard] = useState(null);
    const [admissionModal, setAdmissionModal] = useState(null);
    const [notesModal, setNotesModal] = useState(null);
    const [labModal, setLabModal] = useState(null);

    useEffect(() => {
        api('/doctor/ip-wards').then(d => {
            setWards(d.data || []);
            if (d.data?.length) setSelectedWard(d.data[0].id);
        }).catch(console.warn).finally(() => setLoading(false));
    }, []);

    const activeWard = wards.find(w => w.id === selectedWard);

    const bedStatusColor = s => ({ AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', CLEANING: '#d97706', MAINTENANCE: '#6b7280' }[s] || '#6b7280');
    const bedStatusBg   = s => ({ AVAILABLE: '#dcfce7', OCCUPIED: '#fee2e2', CLEANING: '#fef3c7', MAINTENANCE: '#f3f4f6' }[s] || '#f3f4f6');

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading wards...</div>;
    if (wards.length === 0) return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏥</div>
            <h3 style={{ color: '#374151' }}>No Wards Assigned</h3>
            <p style={{ color: '#9ca3af' }}>Contact your Hospital Admin to assign IP wards to you.</p>
        </div>
    );

    const occupiedBeds = (activeWard?.beds || []).filter(b => b.status === 'OCCUPIED' && b.admission);

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: 16 }}>
                {/* Ward selector */}
                <div style={{ width: 200, flexShrink: 0 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>MY WARDS</h3>
                    {wards.map(w => (
                        <button key={w.id} onClick={() => setSelectedWard(w.id)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
                                background: selectedWard === w.id ? '#0d9488' : '#fff',
                                color: selectedWard === w.id ? '#fff' : '#374151',
                                border: '1.5px solid', borderColor: selectedWard === w.id ? '#0d9488' : '#e5e7eb',
                                borderRadius: 10, marginBottom: 8, cursor: 'pointer', transition: 'all .2s' }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{w.ward_name}</div>
                            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{w.ward_type} · Floor {w.floor_number || 'G'}</div>
                            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                                {w.beds?.filter(b => b.status === 'OCCUPIED').length || 0}/{w.total_beds} occupied
                            </div>
                        </button>
                    ))}
                </div>

                {/* Ward content */}
                {activeWard && (
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>{activeWard.ward_name}</h2>
                                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{activeWard.ward_type} · {activeWard.total_beds} beds total</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['AVAILABLE','OCCUPIED','CLEANING','MAINTENANCE'].map(s => (
                                    <span key={s} style={{ padding: '4px 10px', background: bedStatusBg(s), color: bedStatusColor(s),
                                        borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                        ● {s}: {activeWard.beds?.filter(b => b.status === s).length || 0}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Visual Bed Grid */}
                        <div style={{ background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 20, border: '1px solid #e5e7eb' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Ward Layout</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                                {(activeWard.beds || []).map(bed => (
                                    <div key={bed.id} onClick={() => bed.admission && setAdmissionModal(bed.admission)}
                                        style={{ background: bedStatusBg(bed.status), border: `2px solid ${bedStatusColor(bed.status)}`,
                                            borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                                            cursor: bed.admission ? 'pointer' : 'default', transition: 'transform .15s',
                                            ':hover': { transform: 'scale(1.03)' } }}>
                                        <div style={{ fontSize: 18 }}>{bed.status === 'OCCUPIED' ? '🛏' : bed.status === 'CLEANING' ? '🧹' : bed.status === 'MAINTENANCE' ? '🔧' : '🛏'}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: bedStatusColor(bed.status), marginTop: 4 }}>{bed.bed_code}</div>
                                        {bed.admission && (
                                            <div style={{ fontSize: 10, color: '#374151', marginTop: 2, fontWeight: 600,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {bed.admission.patient_name}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 10, color: bedStatusColor(bed.status), marginTop: 2, fontWeight: 600 }}>{bed.status}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Patient List */}
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Admitted Patients ({occupiedBeds.length})</h4>
                            </div>
                            {occupiedBeds.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No admitted patients in this ward</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ background: '#f9fafb' }}>
                                        {['Bed','Patient','Age/Gender','Reason','Diagnosis','Admitted','Actions'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {occupiedBeds.map(bed => {
                                            const adm = bed.admission;
                                            return (
                                                <tr key={bed.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0d9488', fontSize: 13 }}>{bed.bed_code}</td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{adm.patient_name}</div>
                                                        {adm.patient_pid && <div style={{ fontSize: 11, color: '#9ca3af' }}>{adm.patient_pid}</div>}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{adm.age || '--'} / {adm.gender?.charAt(0) || '?'}</td>
                                                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151', maxWidth: 140 }}>{adm.admission_reason || '--'}</td>
                                                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{adm.diagnosis || '--'}</td>
                                                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{new Date(adm.admission_date).toLocaleDateString('en-IN')}</td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button onClick={() => setAdmissionModal(adm)} style={{ padding: '5px 10px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>📋 Records</button>
                                                            <button onClick={() => setNotesModal(adm)} style={{ padding: '5px 10px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>📝 Notes</button>
                                                            <button onClick={() => setLabModal({ patientName: adm.patient_name, patientId: adm.patient_id })} style={{ padding: '5px 10px', background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>🔬 Lab</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Admission detail modal */}
            {admissionModal && (
                <Modal title={`Patient: ${admissionModal.patient_name}`} onClose={() => setAdmissionModal(null)} width={560}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[['Patient ID', admissionModal.patient_pid],['Age/Gender', `${admissionModal.age || '--'} / ${admissionModal.gender || '--'}`],
                            ['Admission Reason', admissionModal.admission_reason],['Diagnosis', admissionModal.diagnosis],
                            ['Admitted On', new Date(admissionModal.admission_date).toLocaleString('en-IN')],['Status', admissionModal.status]]
                            .map(([lbl,val]) => (
                            <div key={lbl}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                                <div style={{ fontSize: 14, color: '#111827' }}>{val || '—'}</div>
                            </div>
                        ))}
                        {admissionModal.treatment_notes && (
                            <div style={{ gridColumn: 'span 2', marginTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Treatment Notes</div>
                                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, fontSize: 14, color: '#374151' }}>{admissionModal.treatment_notes}</div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Notes modal */}
            {notesModal && (
                <IPNotesModal admission={notesModal} onClose={() => setNotesModal(null)}
                    onSaved={() => { setNotesModal(null); api('/doctor/ip-wards').then(d => setWards(d.data || [])).catch(console.warn); }} />
            )}

            {/* Lab request modal */}
            {labModal && (
                <LabRequestModal patientName={labModal.patientName} patientId={labModal.patientId}
                    onClose={() => setLabModal(null)} />
            )}
        </div>
    );
}

function IPNotesModal({ admission, onClose, onSaved }) {
    const [form, setForm] = useState({ treatmentNotes: admission.treatment_notes || '', diagnosis: admission.diagnosis || '', labRequested: admission.lab_requested || false });
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try { await api(`/doctor/admissions/${admission.id}/notes`, { method: 'PATCH', body: JSON.stringify(form) }); toast.success('Notes updated'); onSaved(); }
        catch (err) { toast.error(err.message); } finally { setSaving(false); }
    };
    return (
        <Modal title={`Update Notes — ${admission.patient_name}`} onClose={onClose} width={520}>
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Diagnosis</label>
                <input value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Treatment Notes</label>
                <textarea value={form.treatmentNotes} onChange={e => setForm(p => ({ ...p, treatmentNotes: e.target.value }))} style={{ ...inputStyle, height: 120, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="labReq" checked={form.labRequested} onChange={e => setForm(p => ({ ...p, labRequested: e.target.checked }))} />
                <label htmlFor="labReq" style={{ fontSize: 14, color: '#374151' }}>Mark Lab Test Required</label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={onClose} style={{ ...btn('#f3f4f6', '#374151') }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ ...btn('#0d9488') }}>{saving ? 'Saving...' : '✓ Update Notes'}</button>
            </div>
        </Modal>
    );
}

function LabRequestModal({ patientName, patientId, onClose }) {
    const [form, setForm] = useState({ testType: '', urgency: 'ROUTINE', notes: '' });
    const [saving, setSaving] = useState(false);
    const save = async () => {
        if (!form.testType) { toast.error('Enter test type'); return; }
        setSaving(true);
        try { await api('/doctor/lab-request', { method: 'POST', body: JSON.stringify({ patientId, patientName, ...form }) }); toast.success('Lab request sent'); onClose(); }
        catch (err) { toast.error(err.message); } finally { setSaving(false); }
    };
    return (
        <Modal title={`Lab Request — ${patientName}`} onClose={onClose} width={460}>
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>TEST TYPE *</label>
                <input value={form.testType} onChange={e => setForm(p => ({ ...p, testType: e.target.value }))} style={inputStyle} placeholder="e.g. CBC, Blood Culture, HbA1c" />
            </div>
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>URGENCY</label>
                <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))} style={inputStyle}>
                    {['ROUTINE','URGENT','STAT'].map(u => <option key={u}>{u}</option>)}
                </select>
            </div>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>NOTES</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, height: 70, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={onClose} style={{ ...btn('#f3f4f6', '#374151') }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ ...btn('#7c3aed') }}>{saving ? 'Sending...' : '🔬 Send Lab Request'}</button>
            </div>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI MEDICAL ANALYSIS TAB
// ─────────────────────────────────────────────────────────────────────────────
function AIAnalysisTab() {
    const [form, setForm] = useState({ patientPid: '', bp: '', temperature: '', heartRate: '', sugar: '', weight: '', spo2: '' });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const runAnalysis = async () => {
        setLoading(true); setResult(null);
        try {
            const manualVitals = {};
            if (form.bp) manualVitals.bp = form.bp;
            if (form.temperature) manualVitals.temperature = form.temperature;
            if (form.heartRate) manualVitals.heart_rate = parseInt(form.heartRate);
            if (form.sugar) manualVitals.sugar = form.sugar;
            if (form.weight) manualVitals.weight = parseFloat(form.weight);
            if (form.spo2) manualVitals.spo2 = parseInt(form.spo2);
            const d = await api('/doctor/ai-analysis', { method: 'POST',
                body: JSON.stringify({ patientPid: form.patientPid || undefined,
                    manualVitals: Object.keys(manualVitals).length > 0 ? manualVitals : undefined }) });
            setResult(d.data);
        } catch (err) { toast.error(err.message); }
        finally { setLoading(false); }
    };

    const riskColor = r => ({ CRITICAL: '#dc2626', HIGH: '#d97706', MODERATE: '#d97706', LOW: '#16a34a' }[r] || '#6b7280');
    const riskBg    = r => ({ CRITICAL: '#fee2e2', HIGH: '#fef3c7', MODERATE: '#fef9c3', LOW: '#dcfce7' }[r] || '#f3f4f6');
    const alertBorder = t => ({ CRITICAL: '#dc2626', HIGH: '#f97316', MODERATE: '#d97706', INFO: '#3b82f6' }[t] || '#e5e7eb');
    const alertBg     = t => ({ CRITICAL: '#fee2e2', HIGH: '#fff7ed', MODERATE: '#fefce8', INFO: '#eff6ff' }[t] || '#f9fafb');

    return (
        <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 20, border: '1px solid #e5e7eb' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' }}>🧠 AI Medical Analysis</h2>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Enter Patient ID to auto-fetch vitals, lab reports & medical history — or enter vitals manually.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div style={{ gridColumn: 'span 3' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Patient ID (optional — auto-fetches vitals)</label>
                        <input value={form.patientPid} onChange={e => setForm(p => ({ ...p, patientPid: e.target.value }))} style={inputStyle} placeholder="e.g. MT-00001" />
                    </div>
                    {[['BP (e.g. 120/80)','bp'],['Temperature (°F)','temperature'],['Heart Rate (bpm)','heartRate'],
                      ['Blood Sugar (mg/dL)','sugar'],['Weight (kg)','weight'],['SpO2 (%)','spo2']].map(([lbl,field]) => (
                        <div key={field}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>{lbl}</label>
                            <input value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} style={inputStyle} placeholder={lbl} />
                        </div>
                    ))}
                </div>
                <button onClick={runAnalysis} disabled={loading}
                    style={{ ...btn(loading ? '#9ca3af' : 'linear-gradient(135deg,#7c3aed,#6d28d9)'), fontSize: 14, padding: '10px 28px' }}>
                    {loading ? '🔄 Analysing...' : '🧠 Run AI Analysis'}
                </button>
            </div>

            {result && (
                <div>
                    {/* Risk Score Card */}
                    <div style={{ background: riskBg(result.riskLevel), border: `2px solid ${riskColor(result.riskLevel)}`,
                        borderRadius: 16, padding: '24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 52, fontWeight: 800, color: riskColor(result.riskLevel), lineHeight: 1 }}>{result.riskScore}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: riskColor(result.riskLevel), marginTop: 4 }}>RISK SCORE</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: riskColor(result.riskLevel), marginBottom: 6 }}>
                                {result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'LOW' ? '✅' : '🟡'} {result.riskLevel} RISK
                            </div>
                            {result.patient && (
                                <div style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
                                    Patient: <strong>{result.patient.name}</strong> · {result.patient.gender} · Blood Group: {result.patient.bloodGroup || '?'}
                                </div>
                            )}
                            <div style={{ fontSize: 13, color: '#6b7280' }}>Analysis performed at {new Date(result.analysedAt).toLocaleTimeString('en-IN')} · {result.labsAnalysed} lab reports analysed</div>
                        </div>
                        {result.risks.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {result.risks.map((r,i) => (
                                    <span key={i} style={{ padding: '4px 10px', background: '#fff', border: `1.5px solid ${riskColor(result.riskLevel)}`,
                                        color: riskColor(result.riskLevel), borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⚑ {r}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Alerts */}
                    {result.allAlerts.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>🔔 Clinical Alerts ({result.allAlerts.length})</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {result.allAlerts.map((a,i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: alertBg(a.type),
                                        borderLeft: `4px solid ${alertBorder(a.type)}`, borderRadius: 8 }}>
                                        <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: alertBorder(a.type), marginBottom: 2 }}>{a.type}</div>
                                            <div style={{ fontSize: 13, color: '#374151' }}>{a.message}</div>
                                        </div>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', alignSelf: 'center',
                                            padding: '2px 8px', background: '#f3f4f6', borderRadius: 4 }}>{a.category}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Normal Values */}
                    {result.normalSummary.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#16a34a' }}>✅ Normal Values</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {result.normalSummary.map((s,i) => (
                                    <span key={i} style={{ padding: '6px 14px', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ {s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {result.recommendations.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111827' }}>📋 AI Recommendations</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.recommendations.map((r,i) => (
                                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#eff6ff', borderRadius: 8 }}>
                                        <span style={{ color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                                        <span style={{ fontSize: 13, color: '#1e40af' }}>{r}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
