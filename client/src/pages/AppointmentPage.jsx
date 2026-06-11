/**
 * AppointmentPage.jsx
 * Matches the Medinest-style UI in screenshots:
 *  Step 1 → Enter Patient ID (verify from DB, suggest register if not found)
 *  Step 2 → Choose consultation type: In-Person | Online
 *  Step 3a → In-Person: City → Hospital → Dept → Date/Time → Confirm
 *  Step 3b → Online: Department → Doctor card → Date/Time slot → Pay & Confirm
 *  Appointment reflects in: receptionist queue (in-person) | doctor dashboard (online)
 *  OP timings come live from receptionist's edits
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const API_BASE = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;

const normalizePatientId = (value = '') => {
    const v = value.trim().toUpperCase();
    if (!v) return '';
    if (/^\d+$/.test(v)) return `MT-${v}`;
    if (/^MT\d+$/.test(v)) return `MT-${v.slice(2)}`;
    return v;
};

/* ── API helpers ────────────────────────────────────────────────────────── */
async function get(path) {
    const r = await fetch(`${API_BASE}${path}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Request failed');
    return d;
}
async function post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Request failed');
    return d;
}

/* ── Static data ────────────────────────────────────────────────────────── */
const DEPARTMENTS = [
    'ENT', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics',
    'General Medicine', 'General Surgery', 'Gynecology', 'Neurology',
    'Ophthalmology', 'Psychiatry', 'Oncology', 'Nephrology',
];

const DOCTORS_BY_DEPT = {
    ENT: [{ name: 'Dr. Meenakshi Iyer', exp: '12 years', rating: '4.8', patients: '2.5k+', fee: 300, availability: 'Mon-Fri', spec: 'Ear, Nose & Throat', img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=face' }],
    Cardiology: [{ name: 'Dr. Anjali Sharma', exp: '15 years', rating: '4.9', patients: '3.2k+', fee: 500, availability: 'Tue-Sat', spec: 'Heart Specialist', img: 'https://images.unsplash.com/photo-1594824947933-d0501ba2fe65?w=120&h=120&fit=crop&crop=face' }],
    Dermatology: [{ name: 'Dr. Karan Patel', exp: '8 years', rating: '4.7', patients: '1.8k+', fee: 250, availability: 'Mon-Sun', spec: 'Skin & Hair', img: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&h=120&fit=crop&crop=face' }],
    Pediatrics: [{ name: 'Dr. Priya Reddy', exp: '10 years', rating: '4.8', patients: '2.1k+', fee: 200, availability: 'Mon-Sat', spec: 'Child Specialist', img: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=120&h=120&fit=crop&crop=face' }],
    Orthopedics: [{ name: 'Dr. Rajesh Kumar', exp: '18 years', rating: '4.9', patients: '4.1k+', fee: 450, availability: 'Wed-Sun', spec: 'Bone & Joint', img: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=face' }],
};

const TIME_SLOTS = ['08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM'];

/* ── Styles ─────────────────────────────────────────────────────────────── */
const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#f3f0ff 0%,#ede9fe 50%,#f0fdf4 100%)', fontFamily: "'Segoe UI',system-ui,sans-serif" },
    header: { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    card: { background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 8px 32px rgba(124,58,237,.12)', border: '1px solid #ede9fe' },
    input: { width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 16, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' },
    select: { width: '100%', padding: '14px 16px 14px 48px', border: '2px solid #e5e7eb', borderRadius: 16, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', appearance: 'none', background: '#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%236b7280\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E") no-repeat right 16px center' },
    btnPurple: { width: '100%', padding: '16px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'opacity .2s' },
    btnGray: { width: '100%', padding: '16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
    label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 },
    iconWrap: { position: 'relative' },
    icon: { position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 16 },
};

/* ── Step 1: Patient ID Verification ────────────────────────────────────── */
function StepVerify({ onVerified }) {
    const [pid, setPid]       = useState('');
    const [status, setStatus] = useState(null); // null | 'loading' | 'found' | 'notfound'
    const [patient, setPatient] = useState(null);
    const navigate = useNavigate();

    const verify = async () => {
        const normalizedPid = normalizePatientId(pid);
        if (!normalizedPid) { toast.error('Please enter your Patient ID'); return; }
        setStatus('loading');
        try {
            const res = await get(`/appointments/verify-patient?pid=${encodeURIComponent(normalizedPid)}`);
            if (res.found) { setPatient(res.data); setStatus('found'); }
            else { setStatus('notfound'); }
        } catch (err) { toast.error(err.message); setStatus(null); }
    };

    return (
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(124,58,237,.3)' }}>
                    <span style={{ fontSize: 36 }}>✅</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1f2937' }}>Book Your Appointment</h1>
                <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 15 }}>Start by entering your Patient ID</p>
            </div>

            <div style={S.card}>
                <div style={S.iconWrap}>
                    <span style={S.icon}>🪪</span>
                    <input
                        value={pid}
                        onChange={e => { setPid(e.target.value.toUpperCase()); setStatus(null); setPatient(null); }}
                        onKeyDown={e => e.key === 'Enter' && verify()}
                        style={{ ...S.input, paddingLeft: 48, letterSpacing: '0.08em', fontWeight: 600, fontSize: 16, borderColor: status === 'notfound' ? '#ef4444' : status === 'found' ? '#10b981' : '#e5e7eb' }}
                        placeholder="Enter Patient ID (e.g., MT-197485)"
                    />
                </div>

                {/* Status feedback */}
                {status === 'found' && patient && (
                    <div style={{ marginTop: 14, padding: '12px 16px', background: '#ecfdf5', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, background: '#a7f3d0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#065f46', fontSize: 18 }}>{patient.full_name?.charAt(0)}</div>
                        <div>
                            <div style={{ fontWeight: 800, color: '#065f46' }}>✅ {patient.full_name}</div>
                            <div style={{ fontSize: 12, color: '#047857' }}>{patient.patient_pid} · {patient.age}y · {patient.gender} · {patient.blood_group || 'Blood N/A'}</div>
                        </div>
                    </div>
                )}

                {status === 'notfound' && (
                    <div style={{ marginTop: 14, padding: '14px 16px', background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
                        <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>❌ Patient ID not found</div>
                        <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 10 }}>
                            No patient record found for "<strong>{pid}</strong>". Please register first at your nearest government hospital to get a MedTrack Patient ID.
                        </div>
                        <button onClick={() => navigate('/register')} style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                            Register Now →
                        </button>
                    </div>
                )}

                <button
                    onClick={status === 'found' ? () => onVerified(patient, normalizePatientId(pid)) : verify}
                    disabled={status === 'loading'}
                    style={{ ...S.btnPurple, marginTop: 20, opacity: status === 'loading' ? .7 : 1 }}
                >
                    {status === 'loading' ? '⏳ Verifying...' : status === 'found' ? '→ Continue to Booking' : '→ Continue to Booking'}
                </button>
            </div>
        </div>
    );
}

/* ── Step 2: Choose Consultation Type ───────────────────────────────────── */
function StepChooseType({ patient, onChoose }) {
    return (
        <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px' }}>
            {/* Patient strip */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <div style={{ width: 38, height: 38, background: '#ede9fe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#7c3aed' }}>{patient.full_name?.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{patient.full_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{patient.patient_pid}</div>
                </div>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Verified</span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1f2937' }}>Choose Consultation Type</h2>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>Select how you'd like to consult with our doctors</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* In-Person */}
                <div onClick={() => onChoose('inperson')} style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 20, padding: '32px 28px', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s', boxShadow: '0 8px 24px rgba(124,58,237,.3)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(124,58,237,.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,.3)'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 28 }}>🏥</span>
                        <h3 style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 20 }}>In-Person Visit</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,.8)', marginBottom: 16, fontSize: 14 }}>Visit our state-of-the-art hospital facilities</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>₹10</span>
                        <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>🕐 30-45 min</span>
                    </div>
                </div>

                {/* Online */}
                <div onClick={() => onChoose('online')} style={{ background: 'linear-gradient(135deg,#059669,#10b981)', borderRadius: 20, padding: '32px 28px', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s', boxShadow: '0 8px 24px rgba(16,185,129,.3)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(16,185,129,.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,.3)'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 28 }}>📹</span>
                        <h3 style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 20 }}>Online Consultation</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,.8)', marginBottom: 16, fontSize: 14 }}>Consult with specialists from the comfort of your home</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>Starting from ₹200</span>
                        <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>🕐 20-30 min</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Step 3a: In-Person Appointment ─────────────────────────────────────── */
function StepInPerson({ patient, pid, onBack, onConfirmed }) {
    const [cities, setCities]     = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [city, setCity]         = useState('');
    const [hospitalId, setHospitalId] = useState('');
    const [dept, setDept]         = useState('');
    const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime]         = useState('');
    const [slots, setSlots]       = useState([]);
    const [timing, setTiming]     = useState(null);
    const [booking, setBooking]   = useState(false);

    useEffect(() => {
        get('/appointments/cities').then(r => setCities(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (!city) return;
        get(`/appointments/hospitals?city=${encodeURIComponent(city)}`).then(r => setHospitals(r.data || [])).catch(() => {});
    }, [city]);

    // Live OP timings — receptionist changes reflect here
    useEffect(() => {
        if (!hospitalId || !dept || !date) { setSlots([]); setTiming(null); return; }
        get(`/appointments/op-timings?hospital_id=${hospitalId}&date=${date}`)
            .then(r => {
                const found = (r.data || []).find(t => t.department === dept);
                setTiming(found || null);
                if (found) {
                    // Generate time slots from OP timing
                    const [sh, sm] = found.start_time.split(':').map(Number);
                    const [eh, em] = found.end_time.split(':').map(Number);
                    const dur = found.slot_duration_minutes || 15;
                    const generated = [];
                    for (let m = sh * 60 + sm; m < eh * 60 + em; m += dur) {
                        const h = Math.floor(m / 60), min = m % 60;
                        const suffix = h < 12 ? 'AM' : 'PM';
                        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
                        generated.push(`${String(displayH).padStart(2,'0')}:${String(min).padStart(2,'0')} ${suffix}`);
                    }
                    setSlots(generated);
                } else {
                    setSlots(TIME_SLOTS);
                }
                setTime('');
            })
            .catch(() => { setSlots(TIME_SLOTS); setTiming(null); });
    }, [hospitalId, dept, date]);

    const confirm = async () => {
        if (!city || !hospitalId || !dept || !date) { toast.error('Please fill all fields'); return; }
        setBooking(true);
        try {
            const res = await post('/appointments/book', {
                patientPid: pid,
                hospitalId,
                department: dept,
                visitDate: date,
                preferredTime: time || null,
                purpose: 'Consultation',
                consultationType: 'IN_PERSON',
            });
            onConfirmed(res.data, 'inperson');
        } catch (err) { toast.error(err.message); }
        finally { setBooking(false); }
    };

    return (
        <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
            <div style={S.card}>
                <h2 style={{ margin: '0 0 24px', fontWeight: 800, fontSize: 22, color: '#1f2937', textAlign: 'center' }}>In-Person Appointment</h2>

                {/* City */}
                <div style={{ marginBottom: 16 }}>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>🏙️</span>
                        <select value={city} onChange={e => { setCity(e.target.value); setHospitalId(''); }} style={S.select}>
                            <option value="">Select City</option>
                            {cities.length > 0
                                ? cities.map(c => <option key={c} value={c}>{c}</option>)
                                : ['Chennai','Madurai','Coimbatore','Trichy','Salem'].map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Hospital */}
                <div style={{ marginBottom: 16 }}>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>🏥</span>
                        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} style={S.select}>
                            <option value="">Select Hospital</option>
                            {hospitals.map(h => <option key={h.id} value={h.id}>{h.hospital_name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Department */}
                <div style={{ marginBottom: 16 }}>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>🩺</span>
                        <select value={dept} onChange={e => setDept(e.target.value)} style={S.select}>
                            <option value="">Select Department</option>
                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Date + Time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>📅</span>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            style={{ ...S.input, paddingLeft: 48 }} />
                    </div>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>🕐</span>
                        <select value={time} onChange={e => setTime(e.target.value)} style={S.select}>
                            <option value="">Select Time</option>
                            {slots.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* OP timing info */}
                {timing && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f5f3ff', borderRadius: 10, fontSize: 13, color: '#5b21b6' }}>
                        ℹ️ OP Hours: <strong>{timing.start_time} – {timing.end_time}</strong> · {timing.slot_duration_minutes}min slots · Max {timing.max_patients} patients
                        {timing.doctor_name && <span> · Dr. {timing.doctor_name}</span>}
                    </div>
                )}
                {!timing && dept && hospitalId && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef3c7', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                        ⚠️ No specific OP timing set for this department. You'll be assigned first available slot.
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 8 }}>
                    <button onClick={onBack} style={S.btnGray}>← Back</button>
                    <button onClick={confirm} disabled={booking} style={{ ...S.btnPurple, opacity: booking ? .7 : 1 }}>
                        💳 {booking ? 'Booking...' : 'Confirm & Pay ₹10'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Step 3b: Online Consultation ───────────────────────────────────────── */
function StepOnline({ patient, pid, onBack, onConfirmed }) {
    const [dept, setDept]             = useState('');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime]             = useState('');
    const [booking, setBooking]       = useState(false);

    const doctors = dept ? (DOCTORS_BY_DEPT[dept] || []) : [];

    const confirm = async () => {
        if (!dept || !selectedDoc || !date || !time) { toast.error('Please fill all fields'); return; }
        setBooking(true);
        try {
            const res = await post('/appointments/book-online', {
                patientPid: pid,
                department: dept,
                doctorName: selectedDoc.name,
                bookingDate: date,
                bookingTime: time,
                fee: selectedDoc.fee,
            });
            onConfirmed({ ...res.data, doctor: selectedDoc, fee: selectedDoc.fee }, 'online');
        } catch (err) {
            // Fallback: book as op_queue with online type
            try {
                const r2 = await post('/appointments/book', {
                    patientPid: pid,
                    hospitalId: null,
                    department: dept,
                    visitDate: date,
                    preferredTime: time,
                    purpose: 'Online Consultation',
                    consultationType: 'ONLINE',
                });
                onConfirmed({ ...r2.data, doctor: selectedDoc, fee: selectedDoc.fee }, 'online');
            } catch (e2) { toast.error(e2.message); }
        } finally { setBooking(false); }
    };

    return (
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
            <div style={S.card}>
                <h2 style={{ margin: '0 0 24px', fontWeight: 800, fontSize: 22, color: '#1f2937', textAlign: 'center' }}>Online Consultation</h2>
                <p style={{ margin: '-16px 0 24px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Choose your specialist and schedule your video consultation</p>

                {/* Department */}
                <div style={{ marginBottom: 20 }}>
                    <div style={S.iconWrap}>
                        <span style={S.icon}>🩺</span>
                        <select value={dept} onChange={e => { setDept(e.target.value); setSelectedDoc(null); }} style={{ ...S.select, borderColor: dept ? '#7c3aed' : '#e5e7eb' }}>
                            <option value="">Select Medical Department</option>
                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Doctor cards */}
                {doctors.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
                        {doctors.map((doc, i) => (
                            <div key={i} onClick={() => setSelectedDoc(doc)}
                                style={{ padding: '16px', borderRadius: 14, border: `2px solid ${selectedDoc?.name === doc.name ? '#7c3aed' : '#e5e7eb'}`, background: selectedDoc?.name === doc.name ? '#f5f3ff' : '#fff', cursor: 'pointer', transition: 'all .2s' }}
                                onMouseEnter={e => { if (selectedDoc?.name !== doc.name) e.currentTarget.style.borderColor = '#7c3aed'; }}
                                onMouseLeave={e => { if (selectedDoc?.name !== doc.name) e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                    <img src={doc.img} alt={doc.name} style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover', border: '2px solid #ede9fe' }} />
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13 }}>{doc.name}</div>
                                        <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{doc.spec}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                                    <span>⭐ {doc.rating}</span>
                                    <span>👤 {doc.exp}</span>
                                    <span>👥 {doc.patients}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>₹{doc.fee}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{doc.availability}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Date + Time when doctor selected */}
                {selectedDoc && (
                    <div style={{ background: '#f5f3ff', borderRadius: 14, padding: '20px', marginBottom: 20 }}>
                        <h4 style={{ margin: '0 0 14px', fontWeight: 700, color: '#5b21b6' }}>📅 Select Date & Time</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                style={{ ...S.input, background: '#fff' }} />
                            <div />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {TIME_SLOTS.map(slot => (
                                <button key={slot} onClick={() => setTime(slot)}
                                    style={{ padding: '8px 14px', borderRadius: 8, border: '2px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: time === slot ? '#7c3aed' : '#e5e7eb', background: time === slot ? '#7c3aed' : '#fff', color: time === slot ? '#fff' : '#374151', transition: 'all .2s' }}>
                                    {slot}
                                </button>
                            ))}
                        </div>

                        {/* Summary */}
                        {time && (
                            <div style={{ marginTop: 16, padding: '14px', background: '#fff', borderRadius: 10, border: '1px solid #ede9fe' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                    <span style={{ color: '#6b7280' }}>Doctor</span>
                                    <span style={{ fontWeight: 700 }}>{selectedDoc.name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                    <span style={{ color: '#6b7280' }}>Fee</span>
                                    <span style={{ fontWeight: 700, color: '#059669' }}>₹{selectedDoc.fee}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                    <span style={{ color: '#6b7280' }}>Date & Time</span>
                                    <span style={{ fontWeight: 700 }}>{date} at {time}</span>
                                </div>
                                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                                    <span>Total</span>
                                    <span style={{ color: '#7c3aed' }}>₹{selectedDoc.fee}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <button onClick={onBack} style={S.btnGray}>← Back</button>
                    <button onClick={confirm} disabled={booking || !selectedDoc || !time}
                        style={{ ...S.btnPurple, background: 'linear-gradient(135deg,#059669,#10b981)', opacity: booking || !selectedDoc || !time ? .6 : 1, cursor: !selectedDoc || !time ? 'not-allowed' : 'pointer' }}>
                        💳 {booking ? 'Booking...' : `Pay & Confirm${selectedDoc ? ` - ₹${selectedDoc.fee}` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Step 4: Confirmation ───────────────────────────────────────────────── */
function StepConfirmed({ confirmed, type, patient, department, hospital, onBookAnother }) {
    const navigate = useNavigate();
    return (
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 20px' }}>
            <div style={{ ...S.card, textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                <h2 style={{ margin: '0 0 8px', fontWeight: 800, color: '#16a34a', fontSize: 24 }}>
                    {type === 'online' ? 'Consultation Booked!' : 'Appointment Confirmed!'}
                </h2>
                <p style={{ color: '#6b7280', marginBottom: 24 }}>
                    {type === 'online'
                        ? `Your video consultation with ${confirmed.doctor?.name} has been scheduled`
                        : 'Your appointment has been successfully booked'}
                </p>

                {/* Token card */}
                <div style={{ background: type === 'online' ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 20, padding: '28px', color: '#fff', marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                    {type === 'inperson' ? (
                        <>
                            <div style={{ fontSize: 13, opacity: .8, marginBottom: 6 }}>Your Queue Token</div>
                            <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1 }}>#{confirmed.tokenNumber || confirmed.token_number}</div>
                            <div style={{ fontSize: 13, opacity: .8, marginTop: 10 }}>{department} · {confirmed.visit_date}</div>
                            {confirmed.opStartTime && (
                                <div style={{ marginTop: 10, background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
                                    OP starts at {confirmed.opStartTime}
                                    {confirmed.estimatedWaitMinutes > 0 && <> · Est. wait ~{confirmed.estimatedWaitMinutes} min</>}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 36, marginBottom: 10 }}>📹</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{confirmed.doctor?.name}</div>
                            <div style={{ fontSize: 13, opacity: .85, marginTop: 4 }}>{department}</div>
                            <div style={{ marginTop: 12, background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 700 }}>
                                {confirmed.booking_date || confirmed.visit_date} at {confirmed.booking_time || confirmed.preferred_time}
                            </div>
                        </>
                    )}
                </div>

                {/* Instructions */}
                <div style={{ background: '#ecfdf5', borderRadius: 14, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 8 }}>📌 Next Steps:</div>
                    {type === 'inperson' ? (
                        <>
                            <div style={{ fontSize: 13, color: '#047857', marginBottom: 4 }}>• Arrive at the hospital and show this token number</div>
                            <div style={{ fontSize: 13, color: '#047857', marginBottom: 4 }}>• Carry your MedTrack Patient ID: <strong>{patient?.patient_pid}</strong></div>
                            {confirmed.estimatedWaitMinutes > 30 && (
                                <div style={{ fontSize: 13, color: '#047857' }}>• You may arrive ~{confirmed.estimatedWaitMinutes} min after OP starts</div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, color: '#047857', marginBottom: 4 }}>• You'll receive a video link before your consultation</div>
                            <div style={{ fontSize: 13, color: '#047857', marginBottom: 4 }}>• Keep your Patient ID: <strong>{patient?.patient_pid}</strong> handy</div>
                            <div style={{ fontSize: 13, color: '#047857' }}>• Consultation fee ₹{confirmed.fee} will be collected online</div>
                        </>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button onClick={onBookAnother} style={S.btnGray}>Book Another</button>
                    <button onClick={() => navigate('/')} style={S.btnPurple}>Go to Home</button>
                </div>
            </div>
        </div>
    );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function AppointmentPage() {
    const navigate   = useNavigate();
    const [step, setStep]         = useState('verify'); // verify | choose | inperson | online | confirmed
    const [patient, setPatient]   = useState(null);
    const [pid, setPid]           = useState('');
    const [confirmed, setConfirmed] = useState(null);
    const [confirmedType, setConfirmedType] = useState(null);
    const [department, setDepartment] = useState('');

    const handleVerified = (pat, patPid) => { setPatient(pat); setPid(patPid); setStep('choose'); };
    const handleChoose   = (type) => setStep(type);
    const handleConfirmed = (data, type) => { setConfirmed(data); setConfirmedType(type); setStep('confirmed'); };
    const handleBookAnother = () => { setStep('verify'); setPatient(null); setPid(''); setConfirmed(null); };

    return (
        <div style={S.page}>
            <Toaster position="top-right" />

            {/* Header */}
            <div style={S.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏥</div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>MedTrack</div>
                        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>Book Appointment</div>
                    </div>
                </div>
                <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    ← Back to Home
                </button>
            </div>

            {/* Steps */}
            {step === 'verify'    && <StepVerify onVerified={handleVerified} />}
            {step === 'choose'    && <StepChooseType patient={patient} onChoose={handleChoose} />}
            {step === 'inperson'  && <StepInPerson patient={patient} pid={pid} onBack={() => setStep('choose')} onConfirmed={handleConfirmed} />}
            {step === 'online'    && <StepOnline patient={patient} pid={pid} onBack={() => setStep('choose')} onConfirmed={handleConfirmed} />}
            {step === 'confirmed' && <StepConfirmed confirmed={confirmed} type={confirmedType} patient={patient} department={department} onBookAnother={handleBookAnother} />}
        </div>
    );
}
