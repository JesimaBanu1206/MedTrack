/**
 * DistrictOfficerManager.jsx
 * Super Admin sub-panel — create & manage District Health Officers
 * Credentials are emailed automatically on creation
 *
 * HOW TO INTEGRATE IN SuperAdminPage.jsx:
 * 1. Add this import at top:
 *    import DistrictOfficerManager from './DistrictOfficerManager';
 *
 * 2. Add a sidebar nav item for it (find where you render sidebar nav items):
 *    { id: 'DISTRICT_OFFICERS', label: 'District Officers', icon: '🏛️' }
 *
 * 3. In the page content rendering section, add:
 *    {currentPage === 'DISTRICT_OFFICERS' && <DistrictOfficerManager />}
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';

const TN_DISTRICTS = [
    'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri',
    'Dindigul','Erode','Kallakurichi','Kancheepuram','Kanyakumari','Karur',
    'Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris',
    'Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga',
    'Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli',
    'Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore',
    'Viluppuram','Virudhunagar',
];

const DESIGNATIONS = [
    'District Health Officer',
    'Deputy District Health Officer',
    'District Medical Officer',
    'Regional Director of Health Services',
    'Joint Director of Health Services',
    'District Epidemiologist',
];

const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.06em', color: '#6b7280', marginBottom: 6,
};

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ active }) => (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: active ? '#dcfce7' : '#f3f4f6', color: active ? '#16a34a' : '#6b7280' }}>
        {active ? '● Active' : '○ Inactive'}
    </span>
);

// ── Create Officer Modal ───────────────────────────────────────────────────────
function CreateOfficerModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        fullName: '', email: '', phone: '', dob: '',
        district: 'Madurai', designation: 'District Health Officer',
        password: '', confirmPassword: '',
    });
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState(null);

    const submit = async () => {
        if (!form.fullName || !form.email || !form.district) {
            toast.error('Name, email, and district are required');
            return;
        }
        if (!form.password) {
            toast.error('Password is required');
            return;
        }
        if (form.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (form.password !== form.confirmPassword) {
            toast.error('Password and confirm password must match');
            return;
        }
        setSaving(true);
        try {
            const payload = { ...form };
            delete payload.confirmPassword;
            const res = await axiosInstance.post('/super-admin/district-officers', payload);
            setCreated(res.data.data);
            toast.success('✅ District Officer created! Credentials sent via email.');
            onCreated();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Creation failed');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: 32 }}>
                {!created ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e3a5f' }}>
                                    🏛️ Create District Officer
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                                    Set district login credentials and send them by email
                                </p>
                            </div>
                            <button onClick={onClose} style={{ width: 32, height: 32, background: '#f3f4f6', border: 'none', borderRadius: '50%', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Full Name *</label>
                                <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inputStyle} placeholder="Dr. Rajesh Kumar" />
                            </div>
                            <div>
                                <label style={labelStyle}>Email Address *</label>
                                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="officer@tn.gov.in" />
                            </div>
                            <div>
                                <label style={labelStyle}>Phone Number</label>
                                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} placeholder="9876543210" maxLength={10} />
                            </div>
                            <div>
                                <label style={labelStyle}>Date of Birth</label>
                                <input type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Assigned District *</label>
                                <select value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} style={inputStyle}>
                                    {TN_DISTRICTS.map(d => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Designation *</label>
                                <select value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} style={inputStyle}>
                                    {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Password *</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Confirm Password *</label>
                                <input
                                    type="password"
                                    value={form.confirmPassword}
                                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1e40af' }}>
                            ℹ️ The same email and password entered here will be used by the district officer to login. Credentials will be emailed to <strong>{form.email || 'the provided email'}</strong>, and access is limited to <strong>{form.district}</strong> district.
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={submit} disabled={saving} style={{ flex: 2, padding: 12, background: saving ? '#93c5fd' : '#1a56db', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
                                {saving ? '⏳ Creating...' : '✓ Create & Send Credentials'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                        <h3 style={{ margin: '0 0 8px', fontWeight: 800, color: '#16a34a', fontSize: 22 }}>Account Created!</h3>
                        <p style={{ color: '#6b7280', marginBottom: 24 }}>Login credentials have been sent to <strong>{created.email}</strong></p>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '18px', marginBottom: 20, textAlign: 'left' }}>
                            {[
                                { label: 'Name', value: created.fullName },
                                { label: 'Email', value: created.email },
                                { label: 'District', value: created.district },
                                { label: 'Designation', value: created.designation },
                                { label: 'Password Type', value: created.passwordMode === 'CUSTOM' ? 'Custom (set by admin)' : 'Auto-generated' },
                                { label: 'Email Sent', value: created.emailSent ? '✅ Yes' : '❌ Failed (check SMTP)' },
                            ].map(r => (
                                <div key={r.label} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #e5e7eb', fontSize: 14 }}>
                                    <span style={{ color: '#6b7280', minWidth: 110 }}>{r.label}</span>
                                    <span style={{ fontWeight: 700, color: '#111' }}>{r.value}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={onClose} style={{ padding: '12px 32px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Done</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const DistrictOfficerManager = () => {
    const [officers, setOfficers]     = useState([]);
    const [loading, setLoading]       = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [districtFilter, setFilter] = useState('');
    const [search, setSearch]         = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/district-officers');
            setOfficers(res.data?.data || []);
        } catch (err) { console.warn(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleActive = async (id, current) => {
        try {
            await axiosInstance.patch(`/super-admin/district-officers/${id}`, { isActive: !current });
            toast.success(`Officer ${!current ? 'activated' : 'deactivated'}`);
            load();
        } catch (err) { toast.error(err?.response?.data?.message || 'Update failed'); }
    };

    const resetPassword = async (id) => {
        if (!window.confirm('Reset this officer\'s password? A new password will be sent via email.')) return;
        try {
            await axiosInstance.post(`/super-admin/district-officers/${id}/reset-password`);
            toast.success('Password reset! New password sent via email.');
        } catch (err) { toast.error(err?.response?.data?.message || 'Reset failed'); }
    };

    const displayed = officers.filter(o => {
        if (districtFilter && o.district !== districtFilter) return false;
        if (search && !o.full_name?.toLowerCase().includes(search.toLowerCase()) && !o.email?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const usedDistricts = [...new Set(officers.map(o => o.district).filter(Boolean))].sort();

    return (
        <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            {showCreate && (
                <CreateOfficerModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { load(); setShowCreate(false); }}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>🏛️ District Officers</h2>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
                        Manage district health officer accounts. Each officer can only monitor their assigned district.
                    </p>
                </div>
                <button onClick={() => setShowCreate(true)} style={{
                    padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none',
                    borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                }}>
                    + Create Officer
                </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                {[
                    { label: 'Total Officers', value: officers.length, icon: '🏛️', color: '#1a56db' },
                    { label: 'Active', value: officers.filter(o => o.is_active).length, icon: '✅', color: '#16a34a' },
                    { label: 'Districts Covered', value: usedDistricts.length, icon: '📍', color: '#7c3aed' },
                ].map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e5e7eb', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 28 }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e5e7eb', display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }} placeholder="Search name or email..." />
                <select value={districtFilter} onChange={e => setFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="">All Districts</option>
                    {usedDistricts.map(d => <option key={d}>{d}</option>)}
                </select>
                <button onClick={load} style={{ padding: '9px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    🔄 Refresh
                </button>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            {['Officer', 'Email', 'District', 'Designation', 'Status', 'Created', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</td></tr>
                        ) : displayed.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 50, color: '#9ca3af' }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏛️</div>
                                    <div style={{ fontWeight: 700 }}>No district officers found</div>
                                    <div style={{ fontSize: 13, marginTop: 6 }}>Create the first officer using the button above</div>
                                </td>
                            </tr>
                        ) : displayed.map(o => (
                            <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 38, height: 38, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1a56db', fontSize: 16 }}>
                                            {(o.full_name || 'O').charAt(0)}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{o.full_name}</div>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>{o.email}</td>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ background: '#eff6ff', color: '#1a56db', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                                        📍 {o.district}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{o.designation || 'District Health Officer'}</td>
                                <td style={{ padding: '14px 16px' }}>
                                    <StatusBadge active={o.is_active} />
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 12, color: '#9ca3af' }}>
                                    {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => toggleActive(o.id, o.is_active)} style={{
                                            padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                            background: o.is_active ? '#fef3c7' : '#dcfce7', color: o.is_active ? '#d97706' : '#16a34a'
                                        }}>
                                            {o.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button onClick={() => resetPassword(o.id)} style={{
                                            padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: '#fff', color: '#374151'
                                        }}>
                                            Reset Pwd
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DistrictOfficerManager;
