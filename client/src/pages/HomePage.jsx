import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import useAuthStore from '../store/authStore';
import * as bootstrap from 'bootstrap';
import './HomePage.css';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const API_BASE = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;

const normalizePatientId = (value = '') => {
    const v = value.trim().toUpperCase();
    if (!v) return '';
    if (/^\d+$/.test(v)) return `MT-${v}`;
    if (/^MT\d+$/.test(v)) return `MT-${v.slice(2)}`;
    return v;
};

const HomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuthStore();
    const [selectedTime, setSelectedTime] = useState('');
    const [cameraModalOpen, setCameraModalOpen] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [locationInfo, setLocationInfo] = useState({ text: 'Getting your location...', lat: null, lng: null });
    const [currentStream, setCurrentStream] = useState(null);
    const [emergencyRecords, setEmergencyRecords] = useState([]);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const streamRef = useRef(null);

    // Appointment form state
    const [apptPid, setApptPid]         = useState('');
    const [apptPidStatus, setApptPidStatus] = useState(null); // null | 'verifying' | 'found' | 'notfound'
    const [apptPatient, setApptPatient] = useState(null);
    const [cities, setCities]           = useState([]);
    const [hospitals, setHospitals]     = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedDept, setSelectedDept] = useState('General Medicine');
    const [opTimings, setOpTimings]     = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);

    // Initialize AOS
    useEffect(() => {
        AOS.init({ duration: 1000, once: true, offset: 100 });
        const storedRecords = JSON.parse(localStorage.getItem('emergencyData') || '[]');
        setEmergencyRecords(storedRecords);
        // Load cities
        fetch(`${API_BASE}/appointments/cities`)
            .then(r => r.json()).then(d => setCities(d.data || [])).catch(() => {});
    }, []);

    // Load hospitals when city changes
    useEffect(() => {
        if (!selectedCity) return;
        fetch(`${API_BASE}/appointments/hospitals?city=${encodeURIComponent(selectedCity)}`)
            .then(r => r.json()).then(d => setHospitals(d.data || [])).catch(() => {});
    }, [selectedCity]);

    // Load OP timings when hospital + dept changes
    useEffect(() => {
        if (!selectedHospital) return;
        const today = new Date().toISOString().split('T')[0];
        fetch(`${API_BASE}/appointments/op-timings?hospital_id=${selectedHospital}&date=${today}`)
            .then(r => r.json())
            .then(d => {
                const found = (d.data || []).find(t => t.department === selectedDept);
                setOpTimings(d.data || []);
                // Optionally auto-populate time slots from timing
            }).catch(() => {});
    }, [selectedHospital, selectedDept]);

    // Bubbles
    const bubbles = Array.from({ length: 15 }).map((_, i) => {
        const size = Math.random() * 80 + 20;
        const left = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 10 + 10;
        return (
            <div key={i} className="bubble" style={{
                width: `${size}px`, height: `${size}px`, left: `${left}%`,
                animationDelay: `${delay}s`, animationDuration: `${duration}s`,
            }} />
        );
    });

    // Time Slots (static fallback — overridden by OP timings if available)
    const timeSlots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
        "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
    ];

    const handleTimeSlotClick = (slot) => setSelectedTime(slot);

    // Verify patient ID
    const verifyPatientId = async () => {
        const normalizedPid = normalizePatientId(apptPid);
        if (!normalizedPid) return;
        setApptPidStatus('verifying');
        try {
            const res = await fetch(`${API_BASE}/appointments/verify-patient?pid=${encodeURIComponent(normalizedPid)}`);
            const data = await res.json();
            if (data.found) {
                setApptPatient(data.data);
                setApptPid(normalizedPid);
                setApptPidStatus('found');
            } else {
                setApptPatient(null);
                setApptPidStatus('notfound');
            }
        } catch { setApptPidStatus('notfound'); }
    };

    // Appointment Form — now with real backend + redirect to full booking page
    const handleAppointmentSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const date = form.date?.value;

        // If patient not verified, redirect to full appointment page
        if (!apptPatient) {
            if (apptPidStatus === 'notfound') {
                Swal.fire({
                    icon: 'warning', title: 'Patient ID Not Found',
                    html: `Patient ID "<b>${apptPid}</b>" is not registered.<br>Please create a Patient ID first, then continue with appointment booking.`,
                    confirmButtonText: 'Create Patient ID', showCancelButton: true, cancelButtonText: 'Cancel',
                    confirmButtonColor: '#1976d2',
                }).then(r => { if (r.isConfirmed) navigate('/register'); });
            } else {
                navigate('/appointments');
            }
            return;
        }

        if (!selectedHospital) { Swal.fire('Error', 'Please select a hospital.', 'error'); return; }
        if (!selectedTime && opTimings.length > 0) { Swal.fire('Error', 'Please select a time slot.', 'error'); return; }

        setBookingLoading(true);
        try {
            const res = await fetch(`${API_BASE}/appointments/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientPid: normalizePatientId(apptPid),
                    hospitalId: selectedHospital,
                    department: selectedDept,
                    visitDate: date || new Date().toISOString().split('T')[0],
                    preferredTime: selectedTime || null,
                    purpose: form.purpose?.value || 'Consultation',
                    consultationType: 'IN_PERSON',
                })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    icon: 'success', title: '🎉 Appointment Booked!',
                    html: `<p>Token: <b>#${data.data.tokenNumber || data.data.token_number}</b><br>Date: <b>${date}</b><br>${selectedTime ? `Time: <b>${selectedTime}</b>` : ''}</p>`,
                    confirmButtonText: 'View My Appointments', showCancelButton: true, cancelButtonText: 'Close',
                    confirmButtonColor: '#1976d2',
                }).then(r => { if (r.isConfirmed) navigate(`/appointments`); });
                form.reset(); setSelectedTime(''); setApptPid(''); setApptPidStatus(null); setApptPatient(null);
            } else {
                throw new Error(data.message || 'Booking failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Booking Failed', text: err.message });
        } finally { setBookingLoading(false); }
    };

    // Camera and Location Trigger
    const openCamera = () => {
        setCapturedImage(null);
        if (navigator.geolocation) {
            setLocationInfo({ text: '📍 Fetching precise location...', lat: null, lng: null });
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude.toFixed(6);
                    const lng = pos.coords.longitude.toFixed(6);
                    setLocationInfo({ text: `📍 Lat: ${lat}, Lng: ${lng}`, lat, lng });
                },
                (err) => {
                    console.error('Geo error:', err);
                    setLocationInfo({ text: "⚠️ Location unavailable", lat: null, lng: null });
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    };

    // Modal Lifecycle Management
    useEffect(() => {
        const modalEl = document.getElementById('cameraModal');
        if (!modalEl) return;

        const handleShow = () => {
            setCameraModalOpen(true);
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                    .then((stream) => {
                        streamRef.current = stream;
                        setCurrentStream(stream);
                        if (videoRef.current) { videoRef.current.srcObject = stream; }
                    })
                    .catch((err) => {
                        console.error(err);
                        Swal.fire({ icon: 'error', title: 'Camera Error', text: 'Permission denied or camera not found.' });
                    });
            }
        };

        const handleHidden = () => {
            if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
            setCurrentStream(null);
            setCameraModalOpen(false);
            setCapturedImage(null);
        };

        modalEl.addEventListener('show.bs.modal', handleShow);
        modalEl.addEventListener('hidden.bs.modal', handleHidden);
        return () => {
            modalEl.removeEventListener('show.bs.modal', handleShow);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };
    }, []);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            const padding = 20;
            const barHeight = 100;
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
            ctx.font = "bold 36px Poppins, Arial";
            ctx.fillStyle = "#22c55e";
            ctx.textAlign = "left";
            ctx.fillText("Medtrack", padding * 2, canvas.height - 40);
            ctx.fillStyle = "#ffffff";
            ctx.font = "500 20px Poppins, Arial";
            ctx.textAlign = "right";
            const timeStr = new Date().toLocaleString();
            ctx.fillText(locationInfo.text, canvas.width - padding * 2, canvas.height - 55);
            ctx.font = "400 16px Poppins, Arial";
            ctx.fillText(timeStr, canvas.width - padding * 2, canvas.height - 30);
            ctx.fillStyle = "#ef4444";
            const badgeWidth = 200;
            const badgeHeight = 45;
            ctx.roundRect(canvas.width - badgeWidth - padding, padding, badgeWidth, badgeHeight, 8);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = "bold 18px Poppins, Arial";
            ctx.textAlign = "center";
            ctx.fillText("CRITICAL ALERT", canvas.width - (badgeWidth / 2) - padding, padding + 30);

            const imageData = canvas.toDataURL("image/jpeg", 0.95);
            setCapturedImage(imageData);

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setCurrentStream(null);
            }
        }
    };

    const sendEmergencyAlert = async () => {
        if (!capturedImage) return;
        setIsSending(true);
        try {
            const currentPatientId = user?.patientId || null;
            const payload = {
                image: capturedImage,
                latitude: locationInfo.lat ? parseFloat(locationInfo.lat) : null,
                longitude: locationInfo.lng ? parseFloat(locationInfo.lng) : null,
                timestamp: new Date().toISOString(),
                patientId: currentPatientId
            };
            const response = await fetch('/api/emergency/alert', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                result = await response.json();
            } else { throw new Error("Server error: " + (response.statusText || "Internal Server Error")); }

            if (result.success) {
                const assignedUnit = result.data?.assignedUnitNo || `UNIT-${Math.floor(Math.random() * 900) + 100}`;
                Swal.fire({
                    title: "🚑 Alert Dispatched!",
                    html: `<div><p>Assigned Unit: <b>${assignedUnit}</b></p><p>Help is arriving from the nearest hospital.</p></div>`,
                    icon: "success", confirmButtonText: "I'm Safe Now", confirmButtonColor: "#22c55e",
                });
                const modalEl = document.getElementById('cameraModal');
                if (modalEl) { const modal = bootstrap.Modal.getInstance(modalEl); if (modal) modal.hide(); }
            } else { throw new Error(result.message || 'Failed to send alert'); }
        } catch (error) {
            console.error('Alert error:', error);
            Swal.fire({ title: "System Error", text: "Local connection failed. Please dial 108 immediately.", icon: "error" });
        } finally { setIsSending(false); }
    };

    const handleNewsletterSubmit = (e) => {
        e.preventDefault();
        Swal.fire({ icon: "success", title: "Subscribed!", text: "Thank you for subscribing.", confirmButtonColor: "#1976d2" });
        e.target.reset();
    };

    const handleContactSubmit = (e) => {
        e.preventDefault();
        Swal.fire({ icon: "success", title: "Message Sent!", text: "We'll get back to you within 24 hours.", confirmButtonColor: "#1976d2" });
        e.target.reset();
    };

    // ── DEPARTMENTS for appointment form
    const DEPTS = ['General Medicine','General Surgery','Orthopedics','Cardiology','ENT','Gynecology','Pediatrics','Neurology','Dermatology'];

    return (
        <div className="homepage-container">
            <Navbar />

            {/* Hero Section */}
            <section className="hero" id="home">
                <div className="bubbles" id="bubblesContainer">{bubbles}</div>
                <div className="floating-element floating-1"></div>
                <div className="floating-element floating-2"></div>
                <div className="floating-element floating-3"></div>
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-6" data-aos="fade-right">
                            <h1 className="text-white">
                                Your Health, Our <span style={{ color: '#22c55e' }}>Priority</span>
                            </h1>
                            <p className="text-white opacity-100">
                                Book appointments, consult doctors online, and access your health records seamlessly with India's most trusted healthcare platform.
                            </p>
                            <div className="hero-buttons">
                                <button
                                    onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/login')}
                                    className="btn btn-success-custom btn-modern btn-lg"
                                >
                                    <i className={isAuthenticated ? "fas fa-tachometer-alt me-2" : "fas fa-rocket me-2"}></i>
                                    {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                                </button>
                            </div>
                            <div className="row mt-4">
                                <div className="col-md-4" data-aos="fade-up" data-aos-delay="100">
                                    <div className="stats-card text-white"><div className="number">500+</div><div className="label">Expert Doctors</div></div>
                                </div>
                                <div className="col-md-4" data-aos="fade-up" data-aos-delay="200">
                                    <div className="stats-card text-white"><div className="number">50+</div><div className="label">Hospitals</div></div>
                                </div>
                                <div className="col-md-4" data-aos="fade-up" data-aos-delay="300">
                                    <div className="stats-card text-white"><div className="number">50K+</div><div className="label">Happy Patients</div></div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6" data-aos="fade-left">
                            <div className="text-center">
                                <div className="hero-icon-container" style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="pulse-circle">
                                        <i className="fa-solid fa-house-medical-shield text-white" style={{ fontSize: '180px' }}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="py-5 bg-light-custom text-dark" id="about">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">Why Choose <span style={{ color: 'var(--primary)' }}>HealthCare+</span></h2>
                        <p className="section-subtitle">We provide comprehensive healthcare solutions tailored to your needs</p>
                    </div>
                    <div className="row g-4">
                        {[
                            { icon: "fas fa-user-md", title: "Expert Doctors", desc: "Consult with verified and experienced healthcare professionals from top hospitals across India." },
                            { icon: "fas fa-calendar-alt", title: "Easy Booking", desc: "Book appointments in just a few clicks with instant confirmation and reminders." },
                            { icon: "fas fa-laptop-medical", title: "Virtual Consultations", desc: "Get medical advice from the comfort of your home through secure video consultations." },
                            { icon: "fas fa-file-medical", title: "Health Records", desc: "Access and manage your medical history, prescriptions, and test reports in one place." },
                            { icon: "fas fa-pills", title: "Medicine Delivery", desc: "Get prescribed medicines delivered to your doorstep with our pharmacy partners." },
                            { icon: "fas fa-shield-alt", title: "Secure & Private", desc: "Your health data is protected with enterprise-grade security and privacy measures." }
                        ].map((feature, idx) => (
                            <div key={idx} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={idx * 100}>
                                <div className="card feature-card h-100">
                                    <div className="icon"><i className={feature.icon}></i></div>
                                    <h5>{feature.title}</h5>
                                    <p>{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Book Appointment — connected to real backend */}
            <section className="py-5" id="book">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md-6 mb-5 mb-md-0" data-aos="fade-right">
                            <h2 className="fw-bold mb-3 text-white">Book Your Appointment</h2>
                            <p className="fs-6 mb-4 text-white">Choose your doctor, hospital & time — in just a few clicks.</p>
                            <div className="appointment-features">
                                {[
                                    { icon: "fas fa-user-md", text: "Access top specialists from government hospitals" },
                                    { icon: "fas fa-check-circle", text: "Instant confirmations with real-time token number" },
                                    { icon: "fas fa-id-card", text: "Verify your Patient ID before booking" },
                                    { icon: "fas fa-headset", text: "24/7 patient support for all your queries" }
                                ].map((item, idx) => (
                                    <div key={idx} className="feature-item text-white">
                                        <i className={item.icon}></i><span>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="col-md-6" data-aos="fade-left">
                            <div className="appointment-card">
                                <div className="card-header">
                                    <h4 className="fw-bold mb-0">Book Appointment</h4>
                                    <p className="mb-0">Fill in your details to schedule your visit</p>
                                </div>
                                <form id="appointmentForm" onSubmit={handleAppointmentSubmit}>
                                    {/* Patient ID with live verification */}
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-id-card"></i> Patient ID</label>
                                        <div className="d-flex gap-2">
                                            <input type="text" className="form-control" placeholder="Enter Patient ID (e.g., MT-197485)"
                                                value={apptPid}
                                                onChange={e => { setApptPid(e.target.value.toUpperCase()); setApptPidStatus(null); setApptPatient(null); }}
                                                style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} />
                                            <button type="button" onClick={verifyPatientId}
                                                className="btn btn-outline-primary btn-sm"
                                                style={{ whiteSpace: 'nowrap' }}
                                                disabled={apptPidStatus === 'verifying'}>
                                                {apptPidStatus === 'verifying' ? '...' : 'Verify'}
                                            </button>
                                        </div>
                                        {apptPidStatus === 'found' && apptPatient && (
                                            <div style={{ marginTop: 8, padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, fontSize: 13, color: '#065f46', fontWeight: 600 }}>
                                                ✅ {apptPatient.full_name} — {apptPatient.age}y — {apptPatient.blood_group || 'Blood N/A'}
                                            </div>
                                        )}
                                        {apptPidStatus === 'notfound' && (
                                            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
                                                ❌ Patient ID not found.
                                                <button type="button" onClick={() => navigate('/appointments')}
                                                    style={{ marginLeft: 8, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                                                    Use Full Booking Page →
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-city"></i> City</label>
                                        <select className="form-control" value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedHospital(''); }}>
                                            <option value="">Select City</option>
                                            {cities.length > 0
                                                ? cities.map(c => <option key={c} value={c}>{c}</option>)
                                                : ['Madurai','Chennai','Coimbatore','Trichy'].map(c => <option key={c}>{c}</option>)
                                            }
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-hospital"></i> Hospital</label>
                                        <select className="form-control" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)} required>
                                            <option value="">Select Hospital</option>
                                            {hospitals.length > 0
                                                ? hospitals.map(h => <option key={h.id} value={h.id}>{h.hospital_name}</option>)
                                                : ['Govt Rajaji Hospital, Madurai','Govt Hospital - Thoppur','Govt Medical College Hospital, Chennai'].map(h => <option key={h}>{h}</option>)
                                            }
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-stethoscope"></i> Department</label>
                                        <select className="form-control" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} required>
                                            {DEPTS.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>

                                    {/* Show OP timing info if available */}
                                    {opTimings.find(t => t.department === selectedDept) && (
                                        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
                                            ℹ️ OP Hours: {opTimings.find(t => t.department === selectedDept)?.start_time} – {opTimings.find(t => t.department === selectedDept)?.end_time}
                                            &nbsp;|&nbsp; Slot: {opTimings.find(t => t.department === selectedDept)?.slot_duration_minutes}min
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-calendar-day"></i> Date</label>
                                        <input type="date" name="date" className="form-control" required
                                            min={new Date().toISOString().split("T")[0]}
                                            defaultValue={new Date().toISOString().split("T")[0]} />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-clock"></i> Choose Time Slot</label>
                                        <div className="time-slot-container">
                                            {timeSlots.map((slot, idx) => (
                                                <div key={idx} className={`time-slot ${selectedTime === slot ? 'selected' : ''}`}
                                                    onClick={() => handleTimeSlotClick(slot)}>{slot}</div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-bullseye"></i> Purpose of Visit</label>
                                        <select name="purpose" className="form-control" required>
                                            <option>Consultation</option><option>Follow-up</option>
                                            <option>Medical Test</option><option>Treatment</option>
                                        </select>
                                    </div>

                                    <button className="btn btn-success w-100 btn-modern mt-3" type="submit" disabled={bookingLoading}>
                                        {bookingLoading ? '⏳ Booking...' : 'Book Now'}
                                    </button>
                                </form>
                                {/* Full booking page CTA */}
                                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13 }}>
                                    <a href="/appointments" style={{ color: '#1976d2', fontWeight: 600 }}>
                                        📋 Use Full Booking Page (with step-by-step guide) →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Partner Hospitals */}
            <section className="py-5 bg-white text-dark" id="hospitals">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">Our Partner <span style={{ color: 'var(--primary)' }}>Government Hospitals</span></h2>
                        <p className="section-subtitle">We collaborate with the best government healthcare institutions across Tamil Nadu</p>
                    </div>
                    <div className="row g-4">
                        {[
                            { img: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=500&q=80", name: "Govt Rajaji Hospital", loc: "Madurai", rating: "4.5" },
                            { img: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500&q=80", name: "Govt Hospital - Thoppur", loc: "Madurai", rating: "4.2" },
                            { img: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=500&q=80", name: "Govt Medical College Hospital", loc: "Chennai", rating: "4.8" },
                            { img: "https://images.unsplash.com/photo-1599045118108-bf9954418b76?w=500&q=80", name: "Kilpauk Medical College", loc: "Chennai", rating: "4.6" },
                        ].map((h, i) => (
                            <div key={i} className="col-lg-3 col-md-6" data-aos="zoom-in" data-aos-delay={i * 100}>
                                <div className="card hospital-card h-100">
                                    <img src={h.img} className="card-img-top" alt={h.name} />
                                    <div className="card-body">
                                        <h5 className="card-title">{h.name}</h5>
                                        <div className="location"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>{h.loc}, Tamil Nadu</span></div>
                                        <div className="rating">{'⭐'.repeat(Math.floor(parseFloat(h.rating)))} <span className="ms-1">{h.rating}</span></div>
                                        <a href="#book" className="btn btn-outline-primary btn-sm w-100 mt-2">Book Appointment</a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-5">
                        <a href="/appointments" className="btn btn-primary btn-modern">
                            <i className="fas fa-hospital me-2"></i> View All & Book Appointments
                        </a>
                    </div>
                </div>
            </section>

            {/* Health Resources */}
            <section className="py-5 health-resources" id="resources">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">Health <span style={{ color: 'var(--secondary)' }}>Resources</span></h2>
                        <p className="section-subtitle">Access valuable health information and tools</p>
                    </div>
                    <div className="row g-4">
                        {[
                            { icon: "fas fa-book-medical", title: "Health Library", desc: "Comprehensive information on diseases, symptoms, treatments, and preventive care.", action: "Explore" },
                            { icon: "fas fa-calculator", title: "Health Calculators", desc: "Calculate BMI, calorie needs, due dates, and other health metrics.", action: "Calculate" },
                            { icon: "fas fa-first-aid", title: "First Aid Guide", desc: "Step-by-step instructions for common emergencies and first aid procedures.", action: "Learn More" }
                        ].map((r, i) => (
                            <div key={i} className="col-md-4" data-aos="fade-up" data-aos-delay={i * 100}>
                                <div className="resource-card text-center">
                                    <i className={`${r.icon} fa-3x mb-3`}></i>
                                    <h5>{r.title}</h5>
                                    <p>{r.desc}</p>
                                    <a href="#" className="btn btn-outline-light btn-sm mt-2">{r.action}</a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-5 testimonial-section" id="testimonials">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title text-white">What Our <span style={{ color: 'var(--secondary)' }}>Patients Say</span></h2>
                    </div>
                    <div className="row g-4">
                        {[
                            { quote: "Booking was super easy! The doctors were very professional and caring. HealthCare+ saved me hours of waiting time at the hospital.", name: "Rohan Gupta", loc: "Madurai", initials: "RG" },
                            { quote: "The virtual consultation feature is a lifesaver! I could consult with a specialist without traveling.", name: "Neha Kapoor", loc: "Chennai", initials: "NK" },
                            { quote: "Best medical platform I've used. Very smooth experience from booking to consultation.", name: "Arjun Patel", loc: "Coimbatore", initials: "AP" }
                        ].map((t, i) => (
                            <div key={i} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={i * 100}>
                                <div className="testimonial-card">
                                    <div className="quote">{t.quote}</div>
                                    <div className="user">
                                        <div className="user-avatar">{t.initials}</div>
                                        <div className="user-info"><h6>{t.name}</h6><p>Patient, {t.loc}</p></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content" data-aos="zoom-in">
                        <h2 className="mb-4">Take Control of Your Health Today</h2>
                        <p className="mb-4">Join thousands of satisfied patients who have transformed their healthcare experience with HealthCare+.</p>
                        <div className="cta-buttons">
                            <a href="/appointments" className="btn btn-success-custom btn-modern btn-lg">
                                <i className="fas fa-calendar-plus me-2"></i> Book Appointment
                            </a>
                            <button onClick={() => navigate('/virtual-consult')} className="btn btn-outline-light btn-modern btn-lg">
                                <i className="fas fa-video me-2"></i> Start Virtual Consult
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer>
                <div className="container">
                    <div className="row">
                        <div className="col-lg-4 col-md-6 mb-4 mb-md-0">
                            <h5 className="footer-links"><i className="fas fa-heartbeat me-2"></i> HealthCare+</h5>
                            <p className="mt-3">Your trusted partner in healthcare. We connect you with the best medical professionals and provide seamless healthcare experiences across India.</p>
                            <div className="social-links">
                                <a href="#" className="facebook"><i className="fab fa-facebook-f"></i></a>
                                <a href="#" className="x"><i className="fab fa-twitter"></i></a>
                                <a href="#" className="instagram"><i className="fab fa-instagram"></i></a>
                                <a href="#" className="linkedin"><i className="fab fa-linkedin-in"></i></a>
                            </div>
                            <div className="newsletter mt-4">
                                <h6 className="text-white mb-3">Subscribe to Our Newsletter</h6>
                                <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
                                    <div className="input-group">
                                        <input type="email" className="form-control" placeholder="Enter your email" required />
                                        <button className="btn btn-secondary" type="submit"><i className="fas fa-paper-plane"></i></button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-6 mb-4 mb-md-0">
                            <h5 className="footer-links">Quick Links</h5>
                            <ul>
                                <li><a href="#home" className="footer-link-item"><i className="fas fa-home me-2"></i>Home</a></li>
                                <li><a href="#about" className="footer-link-item"><i className="fas fa-info-circle me-2"></i>About Us</a></li>
                                <li><a href="/appointments" className="footer-link-item"><i className="fas fa-calendar-check me-2"></i>Book Appointment</a></li>
                                <li><a href="#hospitals" className="footer-link-item"><i className="fas fa-hospital me-2"></i>Hospitals</a></li>
                                <li><a href="#resources" className="footer-link-item"><i className="fas fa-book-medical me-2"></i>Resources</a></li>
                            </ul>
                        </div>
                        <div className="col-lg-6 col-md-6">
                            <h5 className="footer-links">Contact Us</h5>
                            <div className="contact-info">
                                <div className="contact-item mb-3"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>123 Health Street, Medical City, Tamil Nadu, India - 625001</span></div>
                                <div className="contact-item mb-3"><i className="fas fa-phone me-2 text-primary"></i><a href="tel:+919876543210" className="contact-link">+91 98765 43210</a></div>
                                <div className="contact-item"><i className="fas fa-ambulance me-2 text-danger"></i><a href="tel:108" className="contact-link emergency-link">Emergency: 108</a></div>
                            </div>
                            <div className="contact-form mt-4">
                                <h6 className="text-white mb-3">Quick Contact</h6>
                                <form className="quick-contact-form" onSubmit={handleContactSubmit}>
                                    <div className="mb-2"><input type="text" className="form-control form-control-sm" placeholder="Your Name" required /></div>
                                    <div className="mb-2"><input type="email" className="form-control form-control-sm" placeholder="Your Email" required /></div>
                                    <div className="mb-2"><textarea className="form-control form-control-sm" rows="2" placeholder="Your Message" required></textarea></div>
                                    <button type="submit" className="btn btn-primary btn-sm w-100"><i className="fas fa-paper-plane me-1"></i> Send Message</button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div className="copyright"><p>&copy; 2025 HealthCare+. All Rights Reserved.</p></div>
                </div>
            </footer>

            {/* Emergency Button */}
            <button id="ambulanceBtn" className="btn btn-danger position-fixed"
                style={{ bottom: '20px', right: '20px' }} onClick={openCamera}
                data-bs-toggle="modal" data-bs-target="#cameraModal">
                <i className="fas fa-ambulance"></i>
            </button>

            {/* Camera Modal */}
            <div className="modal fade" id="cameraModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-2xl overflow-hidden">
                        <div className="modal-header bg-dark text-white border-0 py-4 px-4 position-relative">
                            <div className="d-flex align-items-center">
                                <div className="emergency-icon-bg me-3"><i className="fas fa-ambulance animate-pulse"></i></div>
                                <div>
                                    <h5 className="modal-title fw-bold mb-0" style={{ letterSpacing: '1px' }}>EMERGENCY RESPONSE</h5>
                                    <small className="text-danger-custom opacity-75 fw-bold"><i className="fas fa-circle me-1" style={{ fontSize: '8px' }}></i> LIVE TRACKING ACTIVE</small>
                                </div>
                            </div>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body text-center p-0 position-relative bg-black" style={{ minHeight: '500px' }}>
                            {!capturedImage ? (
                                <div className="camera-view-container">
                                    <video ref={videoRef} id="cameraStream" autoPlay playsInline className="w-100 h-100" style={{ objectFit: 'cover', minHeight: '500px' }}></video>
                                    <div className="camera-overlay-bottom">
                                        <div className="location-box">
                                            <i className="fas fa-location-crosshairs me-2 text-danger"></i>
                                            <span className="location-text">{locationInfo.text}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="preview-view-container h-100">
                                    <img src={capturedImage} alt="Captured" className="w-100 h-100" style={{ objectFit: 'cover', minHeight: '500px' }} />
                                    <div className="preview-badge">PHOTO CAPTURED</div>
                                </div>
                            )}
                            <canvas ref={canvasRef} id="snapshotCanvas" style={{ display: 'none' }}></canvas>
                        </div>
                        <div className="modal-footer justify-content-center bg-white border-0 py-4 px-4">
                            {!capturedImage ? (
                                <button id="captureBtn" className="btn btn-emergency-capture" onClick={capturePhoto}>
                                    <div className="btn-inner"><i className="fas fa-camera me-2"></i><span>CAPTURE INCIDENT</span></div>
                                </button>
                            ) : (
                                <div className="row w-100 g-3">
                                    <div className="col-6">
                                        <button className="btn btn-outline-secondary btn-lg w-100 rounded-xl fw-bold" onClick={() => setCapturedImage(null)}>
                                            <i className="fas fa-redo-alt me-2"></i> RETAKE
                                        </button>
                                    </div>
                                    <div className="col-6">
                                        <button className="btn btn-danger-emergency btn-lg w-100 rounded-xl fw-bold" onClick={sendEmergencyAlert} disabled={isSending}>
                                            {isSending ? <><span className="spinner-border spinner-border-sm me-2"></span>DISPATCHING...</> : <><i className="fas fa-shield-heart me-2"></i> DISPATCH NOW</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
