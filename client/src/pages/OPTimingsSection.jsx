/**
 * OPTimingsSection.jsx
 * Standalone OP Timings Manager for Hospital Admin
 * Shows timings by individual date, reflects receptionist changes in real-time
 *
 * HOW TO INTEGRATE IN HospitalAdminPage.jsx:
 * 1. Add this import at the top:
 *    import OPTimingsSection from './OPTimingsSection';
 *
 * 2. In the Sidebar sections array, add to the 'Clinical' items array:
 *    { id:'OP_TIMINGS', icon:'fa-clock', label:'OP Timings' },
 *
 * 3. In the page header label map, add:
 *    OP_TIMINGS: 'OP Timings Management',
 *
 * 4. In the page content area, add:
 *    {page === 'OP_TIMINGS' && <OPTimingsSection />}
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';

const DEPARTMENTS = [
    'General Medicine','Cardiology','Orthopedics','Pediatrics',
    'Neurology','Gynecology','Dermatology','ENT','Ophthalmology',
    'Psychiatry','Radiology','Laboratory','Emergency','Administration',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const cardStyle = {
    background: 'rgba(12,16,36,0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 24,
};

const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(11,18,32,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
};

const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    marginBottom: 6,
};

// ── Bed-occupancy-style progress ───────────────────────────────────────────────
function SlotBar({ used, total }) {
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#2dd4bf';
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>{used} booked / {total} max</span>
                <span style={{ color, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
            </div>
        </div>
    );
}

// ── Date mini-calendar strip ───────────────────────────────────────────────────
function DateStrip({ selected, onChange }) {
    const dates = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const fmt = (iso) => {
        const d = new Date(iso + 'T12:00:00');
        return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), date: d.getDate() };
    };

    return (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {dates.map(iso => {
                const { day, date } = fmt(iso);
                const isSelected = iso === selected;
                const isToday = iso === new Date().toISOString().split('T')[0];
                return (
                    <button key={iso} onClick={() => onChange(iso)} style={{
                        minWidth: 54, padding: '10px 6px', borderRadius: 10, border: isSelected
                            ? '2px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.03)',
                        color: isSelected ? '#2dd4bf' : '#94a3b8',
                        cursor: 'pointer', textAlign: 'center', transition: 'all .2s',
                        flexShrink: 0,
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>{day}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, lineHeight: 1 }}>{date}</div>
                        {isToday && <div style={{ fontSize: 8, marginTop: 2, color: '#2dd4bf', fontWeight: 700 }}>TODAY</div>}
                    </button>
                );
            })}
        </div>
    );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────
function EditTimingModal({ timing, date, onClose, onSaved }) {
    const isNew = !timing?.id;
    const [form, setForm] = useState({
        department: timing?.department || 'General Medicine',
        start_time: timing?.start_time || '08:00',
        end_time: timing?.end_time || '13:00',
        slot_duration_minutes: timing?.slot_duration_minutes || 15,
        max_patients: timing?.max_patients || 60,
        doctor_name: timing?.doctor_name || '',
        notes: timing?.notes || '',
    });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!form.start_time || !form.end_time) { toast.error('Start and end time required'); return; }
        setSaving(true);
        try {
            await axiosInstance.post('/receptionist/op-timings', {
                ...form,
                timing_date: date,
            });
            toast.success(isNew ? '✅ OP timing created' : '✅ OP timing updated');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0d1227', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, width: '100%', maxWidth: 560, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3 style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 18 }}>
                        {isNew ? '➕ Add OP Timing' : '✏️ Edit OP Timing'}
                        <span style={{ marginLeft: 10, fontSize: 13, color: '#2dd4bf', fontWeight: 600 }}>{date}</span>
                    </h3>
                    <button onClick={onClose} style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Department</label>
                        <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={inputStyle}>
                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Start Time</label>
                        <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>End Time</label>
                        <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Slot Duration (min)</label>
                        <input type="number" value={form.slot_duration_minutes} onChange={e => setForm(p => ({ ...p, slot_duration_minutes: +e.target.value }))} style={inputStyle} min={5} max={60} />
                    </div>
                    <div>
                        <label style={labelStyle}>Max Patients</label>
                        <input type="number" value={form.max_patients} onChange={e => setForm(p => ({ ...p, max_patients: +e.target.value }))} style={inputStyle} min={1} />
                    </div>
                    <div>
                        <label style={labelStyle}>Doctor Name (optional)</label>
                        <input value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} style={inputStyle} placeholder="Assigned doctor" />
                    </div>
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} placeholder="Optional" />
                    </div>
                </div>

                {/* Derived stats preview */}
                {form.start_time && form.end_time && form.slot_duration_minutes > 0 && (() => {
                    const [sh, sm] = form.start_time.split(':').map(Number);
                    const [eh, em] = form.end_time.split(':').map(Number);
                    const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                    const slots = totalMins > 0 ? Math.floor(totalMins / form.slot_duration_minutes) : 0;
                    return (
                        <div style={{ marginTop: 14, background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#2dd4bf' }}>
                            ℹ️ {slots} slots available ({form.slot_duration_minutes} min each) · Max {form.max_patients} patients
                        </div>
                    );
                })()}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={save} disabled={saving} style={{ padding: '9px 24px', background: saving ? '#14b8a6' : '#2dd4bf', color: '#0b1220', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                        {saving ? 'Saving...' : '✓ Save Timing'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const OPTimingsSection = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [timings, setTimings]           = useState([]);
    const [queue, setQueue]               = useState([]);
    const [loading, setLoading]           = useState(false);
    const [editModal, setEditModal]       = useState(null); // null | timing obj | 'new'
    const [viewDate, setViewDate]         = useState(new Date().toISOString().split('T')[0]);

    const loadTimings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/receptionist/op-timings?date=${selectedDate}`);
            setTimings(res.data?.data || []);
        } catch (err) { console.warn('Timings load:', err.message); }
        finally { setLoading(false); }
    }, [selectedDate]);

    const loadQueue = useCallback(async () => {
        try {
            const res = await axiosInstance.get(`/receptionist/appointments?date=${selectedDate}`);
            setQueue(res.data?.data || []);
        } catch { /* silent */ }
    }, [selectedDate]);

    useEffect(() => { loadTimings(); loadQueue(); }, [loadTimings, loadQueue]);

    // Auto-refresh every 30s
    useEffect(() => {
        const t = setInterval(() => { loadTimings(); loadQueue(); }, 30000);
        return () => clearInterval(t);
    }, [loadTimings, loadQueue]);

    const getQueueCount = (dept) => queue.filter(q => q.department === dept).length;
    const getWaitingCount = (dept) => queue.filter(q => q.department === dept && q.status === 'WAITING').length;

    const today = new Date().toISOString().split('T')[0];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {editModal !== null && (
                <EditTimingModal
                    timing={editModal === 'new' ? null : editModal}
                    date={selectedDate}
                    onClose={() => setEditModal(null)}
                    onSaved={() => { loadTimings(); loadQueue(); }}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Outfit,sans-serif' }}>
                        🕐 OP Timings Management
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                        Set and manage outpatient department timings per date. Changes reflect immediately in the patient appointment portal.
                    </p>
                </div>
                <button onClick={() => setEditModal('new')} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
                    border: '1px solid rgba(45,212,191,0.2)', padding: '10px 18px',
                    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}>
                    <i className="fa-solid fa-plus" /> Add Timing
                </button>
            </div>

            {/* Date strip */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>
                        📅 Select Date
                        <span style={{ marginLeft: 10, color: '#2dd4bf', fontSize: 13 }}>
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </span>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                        style={{ ...inputStyle, width: 'auto', padding: '7px 12px' }} />
                </div>
                <DateStrip selected={selectedDate} onChange={setSelectedDate} />
            </div>

            {/* Summary pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Depts Configured', val: timings.length, color: '#2dd4bf', icon: '🏥' },
                    { label: 'Total Queue', val: queue.length, color: '#3b82f6', icon: '👥' },
                    { label: 'Waiting', val: queue.filter(q => q.status === 'WAITING').length, color: '#f59e0b', icon: '⏳' },
                    { label: 'Completed', val: queue.filter(q => q.status === 'COMPLETED').length, color: '#10b981', icon: '✅' },
                ].map(s => (
                    <div key={s.label} style={{ ...cardStyle, padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Timings grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading timings for {selectedDate}...</div>
            ) : timings.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No OP Timings Set</div>
                    <div style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                        No OP timings configured for {selectedDate === today ? 'today' : selectedDate}
                    </div>
                    <button onClick={() => setEditModal('new')} style={{
                        padding: '10px 22px', background: 'rgba(45,212,191,0.12)', color: '#2dd4bf',
                        border: '1px solid rgba(45,212,191,0.2)', borderRadius: 10, cursor: 'pointer', fontWeight: 700
                    }}>
                        + Add First Timing
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
                    {timings.map(timing => {
                        const booked = getQueueCount(timing.department);
                        const waiting = getWaitingCount(timing.department);
                        const [sh, sm] = timing.start_time?.split(':').map(Number) || [8, 0];
                        const [eh, em] = timing.end_time?.split(':').map(Number) || [13, 0];
                        const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                        const slots = totalMins > 0 ? Math.floor(totalMins / (timing.slot_duration_minutes || 15)) : 0;

                        return (
                            <div key={timing.id} style={{ ...cardStyle, padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>{timing.department}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                            {timing.start_time} – {timing.end_time}
                                            {timing.doctor_name && <span style={{ color: '#2dd4bf', marginLeft: 8 }}>· Dr. {timing.doctor_name}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => setEditModal(timing)} style={{
                                        padding: '5px 12px', background: 'rgba(45,212,191,0.08)', color: '#2dd4bf',
                                        border: '1px solid rgba(45,212,191,0.15)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700
                                    }}>
                                        Edit
                                    </button>
                                </div>

                                {/* Stats row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                                    {[
                                        { label: 'Slots', val: slots },
                                        { label: 'Max Pts', val: timing.max_patients },
                                        { label: 'Waiting', val: waiting, highlight: waiting > 0 },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: s.highlight ? '#f59e0b' : '#e2e8f0' }}>{s.val}</div>
                                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <SlotBar used={booked} total={timing.max_patients} />

                                {timing.notes && (
                                    <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                                        📝 {timing.notes}
                                    </div>
                                )}

                                {/* Slot duration info */}
                                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                                        ⏱ {timing.slot_duration_minutes}min slots
                                    </span>
                                    <span style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                                        📅 {selectedDate === today ? 'Today' : selectedDate}
                                    </span>
                                    {booked === 0 && (
                                        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
                                            ✓ Open
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Queue by department table */}
            {queue.length > 0 && (
                <div style={{ ...cardStyle, marginTop: 24 }}>
                    <h4 style={{ margin: '0 0 16px', color: '#fff', fontWeight: 800, fontSize: 16 }}>
                        📋 Today's Queue — {selectedDate}
                        <span style={{ marginLeft: 10, fontSize: 13, color: '#64748b' }}>({queue.length} patients)</span>
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    {['Token', 'Patient', 'Department', 'Triage', 'Status', 'Time'].map(h => (
                                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {queue.slice(0, 20).map(q => {
                                    const statusColor = { WAITING: '#f59e0b', IN_CONSULTATION: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#64748b' }[q.status] || '#64748b';
                                    const triageColor = { CRITICAL: '#ef4444', URGENT: '#f97316', NORMAL: '#10b981' }[q.triage_status] || '#64748b';
                                    return (
                                        <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '11px 14px', color: '#2dd4bf', fontWeight: 800, fontSize: 15 }}>#{String(q.token_number).padStart(2, '0')}</td>
                                            <td style={{ padding: '11px 14px', color: '#e2e8f0', fontWeight: 600 }}>
                                                {q.patient_name}
                                                {q.patient_pid && <div style={{ fontSize: 11, color: '#64748b' }}>{q.patient_pid}</div>}
                                            </td>
                                            <td style={{ padding: '11px 14px', color: '#94a3b8' }}>{q.department}</td>
                                            <td style={{ padding: '11px 14px' }}>
                                                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${triageColor}20`, color: triageColor }}>
                                                    {q.triage_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '11px 14px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: `${statusColor}18`, color: statusColor }}>
                                                    {q.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                                                {q.preferred_time || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OPTimingsSection;
