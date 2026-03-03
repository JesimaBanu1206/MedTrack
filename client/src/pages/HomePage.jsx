import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import useAuthStore from '../store/authStore';
import * as bootstrap from 'bootstrap';
import './HomePage.css';

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

    // Initialize AOS
    useEffect(() => {
        AOS.init({
            duration: 1000,
            once: true,
            offset: 100,
        });

        // Load emergency records
        const storedRecords = JSON.parse(localStorage.getItem('emergencyData') || '[]');
        setEmergencyRecords(storedRecords);
    }, []);

    // Bubbles
    const bubbles = Array.from({ length: 15 }).map((_, i) => {
        const size = Math.random() * 80 + 20;
        const left = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 10 + 10;
        return (
            <div
                key={i}
                className="bubble"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `${left}%`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                }}
            />
        );
    });

    // Time Slots
    const timeSlots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
        "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
    ];

    const handleTimeSlotClick = (slot) => {
        setSelectedTime(slot);
    };

    // Appointment Form
    const handleAppointmentSubmit = (e) => {
        e.preventDefault();
        const date = e.target.date.value;

        if (!selectedTime) {
            Swal.fire('Error', 'Please select a time slot.', 'error');
            return;
        }

        const selectedDateTime = new Date(`${date} ${selectedTime}`); // Approximate parsing
        // In real app, standard parsing needed.
        // For demo, just check basic logic

        Swal.fire({
            icon: "success",
            title: "🎉 Appointment Booked!",
            html: `<p>Your appointment is scheduled on <b>${date}</b> at <b>${selectedTime}</b>.</p>`,
            confirmButtonText: "Awesome!",
            confirmButtonColor: "#1976d2",
        });

        e.target.reset();
        setSelectedTime('');
    };

    // Camera and Location Trigger
    const openCamera = () => {
        setCapturedImage(null);
        // Location fetching can start immediately
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
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                        Swal.fire({
                            icon: 'error',
                            title: 'Camera Error',
                            text: 'Permission denied or camera not found.'
                        });
                    });
            }
        };

        const handleHidden = () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
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

            // Set high resolution for capture
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // 1. Premium Location Overlay (Dark background strip at bottom)
            const padding = 20;
            const barHeight = 100;
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

            // 2. Medtrack Watermark (Left side of bar)
            ctx.font = "bold 36px Poppins, Arial";
            ctx.fillStyle = "#22c55e"; // MedTrack Green
            ctx.textAlign = "left";
            ctx.fillText("Medtrack", padding * 2, canvas.height - 40);

            // 3. Coordinates & Time (Right side of bar)
            ctx.fillStyle = "#ffffff";
            ctx.font = "500 20px Poppins, Arial";
            ctx.textAlign = "right";
            const timeStr = new Date().toLocaleString();
            ctx.fillText(locationInfo.text, canvas.width - padding * 2, canvas.height - 55);
            ctx.font = "400 16px Poppins, Arial";
            ctx.fillText(timeStr, canvas.width - padding * 2, canvas.height - 30);

            // 4. Emergency Status Badge (Top Right)
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

            // Stop Stream
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
            // Get patientId from user store if available
            const currentPatientId = user?.patientId || null;

            const payload = {
                image: capturedImage,
                latitude: locationInfo.lat ? parseFloat(locationInfo.lat) : null,
                longitude: locationInfo.lng ? parseFloat(locationInfo.lng) : null,
                timestamp: new Date().toISOString(),
                patientId: currentPatientId
            };

            // Backend API Call
            const response = await fetch('/api/emergency/alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Handle potential non-JSON or error responses gracefully
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                result = await response.json();
            } else {
                const text = await response.text();
                throw new Error("Server error: " + (response.statusText || "Internal Server Error"));
            }

            if (result.success) {
                const assignedUnit = result.data?.assignedUnitNo || `UNIT-${Math.floor(Math.random() * 900) + 100}`;
                Swal.fire({
                    title: "🚑 Alert Dispatched!",
                    html: `
                        <div class="dispatch-success">
                            <p>Assigned Unit: <b>${assignedUnit}</b></p>
                            <p>Alert ID: <small class="text-muted">${result.data?.alertId || 'N/A'}</small></p>
                            <p>Help is arriving from the nearest hospital.</p>
                        </div>
                    `,
                    icon: "success",
                    confirmButtonText: "I'm Safe Now",
                    confirmButtonColor: "#22c55e",
                    backdrop: `rgba(34, 197, 94, 0.4)`
                });

                // Close Modal
                const modalEl = document.getElementById('cameraModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            } else {
                throw new Error(result.message || 'Failed to send alert');
            }
        } catch (error) {
            console.error('Alert error:', error);
            Swal.fire({
                title: "System Error",
                text: "Local connection failed. Please dial 108 immediately for emergency assistance.",
                icon: "error"
            });
        } finally {
            setIsSending(false);
        }
    };

    // Newsletter
    const handleNewsletterSubmit = (e) => {
        e.preventDefault();
        Swal.fire({
            icon: "success",
            title: "Subscribed!",
            text: "Thank you for subscribing.",
            confirmButtonText: "Great!",
            confirmButtonColor: "#1976d2",
        });
        e.target.reset();
    };

    // Contact
    const handleContactSubmit = (e) => {
        e.preventDefault();
        Swal.fire({
            icon: "success",
            title: "Message Sent!",
            text: "We'll get back to you within 24 hours.",
            confirmButtonText: "OK",
            confirmButtonColor: "#1976d2",
        });
        e.target.reset();
    }

    return (
        <div className="homepage-container">
            {/* Navbar */}
            <Navbar />


            {/* Hero Section */}
            <section className="hero" id="home">
                <div className="bubbles" id="bubblesContainer">
                    {bubbles}
                </div>

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
                                Book appointments, consult doctors online, and access your health
                                records seamlessly with India's most trusted healthcare platform.
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
                                    <div className="stats-card text-white">
                                        <div className="number">500+</div>
                                        <div className="label">Expert Doctors</div>
                                    </div>
                                </div>
                                <div className="col-md-4" data-aos="fade-up" data-aos-delay="200">
                                    <div className="stats-card text-white">
                                        <div className="number">50+</div>
                                        <div className="label">Hospitals</div>
                                    </div>
                                </div>
                                <div className="col-md-4" data-aos="fade-up" data-aos-delay="300">
                                    <div className="stats-card text-white">
                                        <div className="number">50K+</div>
                                        <div className="label">Happy Patients</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6" data-aos="fade-left">
                            <div className="text-center">
                                <div className="hero-icon-container" style={{
                                    height: '350px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <div className="pulse-circle">
                                        <i className="fa-solid fa-house-medical-shield text-white" style={{ fontSize: '180px' }}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section >

            {/* Why Choose Us */}
            < section className="py-5 bg-light-custom text-dark" id="about" >
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">
                            Why Choose <span style={{ color: 'var(--primary)' }}>HealthCare+</span>
                        </h2>
                        <p className="section-subtitle">
                            We provide comprehensive healthcare solutions tailored to your needs
                        </p>
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
                                    <div className="icon">
                                        <i className={feature.icon}></i>
                                    </div>
                                    <h5>{feature.title}</h5>
                                    <p>{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* Book Appointment */}
            < section className="py-5" id="book" >
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md-6 mb-5 mb-md-0" data-aos="fade-right">
                            <h2 className="fw-bold mb-3 text-white">Book Your Appointment</h2>
                            <p className="fs-6 mb-4 text-white">
                                Choose your doctor, hospital & time — in just a few clicks.
                            </p>
                            <div className="appointment-features">
                                {[
                                    { icon: "fas fa-user-md", text: "Access top specialists from government hospitals" },
                                    { icon: "fas fa-check-circle", text: "Instant confirmations with SMS reminders" },
                                    { icon: "fas fa-calendar-alt", text: "Manage and reschedule appointments easily" },
                                    { icon: "fas fa-headset", text: "24/7 patient support for all your queries" }
                                ].map((item, idx) => (
                                    <div key={idx} className="feature-item text-white">
                                        <i className={item.icon}></i>
                                        <span>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form */}
                        <div className="col-md-6" data-aos="fade-left">
                            <div className="appointment-card">
                                <div className="card-header">
                                    <h4 className="fw-bold mb-0">Book Appointment</h4>
                                    <p className="mb-0">Fill in your details to schedule your visit</p>
                                </div>
                                <form id="appointmentForm" onSubmit={handleAppointmentSubmit}>
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-id-card"></i> Patient ID</label>
                                        <input type="text" className="form-control" placeholder="Enter your patient ID" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-city"></i> City</label>
                                        <select className="form-control" required>
                                            <option value="">Select City</option>
                                            <option>Madurai</option>
                                            <option>Chennai</option>
                                            <option>Coimbatore</option>
                                            <option>Trichy</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-hospital"></i> Hospital</label>
                                        <select className="form-control" required>
                                            <option value="">Select Hospital</option>
                                            <option>Govt Rajaji Hospital, Madurai</option>
                                            <option>Govt Hospital - Thoppur, Madurai</option>
                                            <option>Govt Medical College Hospital, Chennai</option>
                                            <option>Govt Kilpauk Medical College, Chennai</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-stethoscope"></i> Department</label>
                                        <select className="form-control" required>
                                            <option value="">Select Department</option>
                                            {['General (OP)', 'General Surgery', 'Orthopedics', 'Obstetrics & Gynaecology', 'Paediatric', 'Cardiology', 'Neurology & Neurosurgery', 'Nephrology', 'Oncology', 'Psychiatry', 'STD & TB', 'Dermatology', 'Gastroenterology'].map(dept => (
                                                <option key={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-calendar-day"></i> Date</label>
                                        <input type="date" id="date" name="date" className="form-control" required min={new Date().toISOString().split("T")[0]} defaultValue={new Date().toISOString().split("T")[0]} />
                                    </div>

                                    {/* Time Slot Selection */}
                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-clock"></i> Choose Time Slot</label>
                                        <div className="time-slot-container" id="timeSlotContainer">
                                            {timeSlots.map((slot, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`time-slot ${selectedTime === slot ? 'selected' : ''}`}
                                                    onClick={() => handleTimeSlotClick(slot)}
                                                >
                                                    {slot}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label"><i className="fas fa-bullseye"></i> Purpose of Visit</label>
                                        <select className="form-control" required>
                                            <option value="">Select Purpose</option>
                                            <option>Consultation</option>
                                            <option>Follow-up</option>
                                            <option>Medical Test</option>
                                            <option>Treatment</option>
                                        </select>
                                    </div>

                                    <button className="btn btn-success w-100 btn-modern mt-3" type="submit">
                                        Book Now
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section >

            {/* Partner Hospitals */}
            < section className="py-5 bg-white text-dark" id="hospitals" >
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">
                            Our Partner <span style={{ color: 'var(--primary)' }}>Government Hospitals</span>
                        </h2>
                        <p className="section-subtitle">
                            We collaborate with the best government healthcare institutions across Tamil Nadu
                        </p>
                    </div>
                    <div className="row g-4">
                        <div className="col-lg-3 col-md-6" data-aos="zoom-in">
                            <div className="card hospital-card h-100">
                                <img src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80" className="card-img-top" alt="Govt Rajaji Hospital" />
                                <div className="card-body">
                                    <h5 className="card-title">Govt Rajaji Hospital</h5>
                                    <div className="location"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>Madurai, Tamil Nadu</span></div>
                                    <div className="rating"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star-half-alt"></i><span className="ms-1">4.5</span></div>
                                    <a href="#" className="btn btn-outline-primary btn-sm w-100 mt-2">View Details</a>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-3 col-md-6" data-aos="zoom-in" data-aos-delay="100">
                            <div className="card hospital-card h-100">
                                <img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80" className="card-img-top" alt="Govt Hospital Thoppur" />
                                <div className="card-body">
                                    <h5 className="card-title">Govt Hospital - Thoppur</h5>
                                    <div className="location"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>Madurai, Tamil Nadu</span></div>
                                    <div className="rating"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="far fa-star"></i><span className="ms-1">4.2</span></div>
                                    <a href="#" className="btn btn-outline-primary btn-sm w-100 mt-2">View Details</a>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-3 col-md-6" data-aos="zoom-in" data-aos-delay="200">
                            <div className="card hospital-card h-100">
                                <img src="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80" className="card-img-top" alt="Govt Medical College Hospital" />
                                <div className="card-body">
                                    <h5 className="card-title">Govt Medical College Hospital</h5>
                                    <div className="location"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>Chennai, Tamil Nadu</span></div>
                                    <div className="rating"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><span className="ms-1">4.8</span></div>
                                    <a href="#" className="btn btn-outline-primary btn-sm w-100 mt-2">View Details</a>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-3 col-md-6" data-aos="zoom-in" data-aos-delay="300">
                            <div className="card hospital-card h-100">
                                <img src="https://images.unsplash.com/photo-1599045118108-bf9954418b76?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80" className="card-img-top" alt="Kilpauk Medical College" />
                                <div className="card-body">
                                    <h5 className="card-title">Kilpauk Medical College</h5>
                                    <div className="location"><i className="fas fa-map-marker-alt me-2 text-primary"></i><span>Chennai, Tamil Nadu</span></div>
                                    <div className="rating"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star-half-alt"></i><span className="ms-1">4.6</span></div>
                                    <a href="#" className="btn btn-outline-primary btn-sm w-100 mt-2">View Details</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-5">
                        <a href="#" className="btn btn-primary btn-modern">
                            <i className="fas fa-hospital me-2"></i> View All Hospitals
                        </a>
                    </div>
                </div>
            </section >

            {/* Health Resources */}
            < section className="py-5 health-resources" id="resources" >
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">
                            Health <span style={{ color: 'var(--secondary)' }}>Resources</span>
                        </h2>
                        <p className="section-subtitle">
                            Access valuable health information and tools
                        </p>
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
            </section >

            {/* Testimonials */}
            < section className="py-5 testimonial-section" id="testimonials" >
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title text-white">
                            What Our <span style={{ color: 'var(--secondary)' }}>Patients Say</span>
                        </h2>
                        <p className="section-subtitle">
                            Hear from people who have experienced our healthcare services
                        </p>
                    </div>
                    <div className="row g-4">
                        {[
                            { quote: "Booking was super easy! The doctors were very professional and caring. HealthCare+ saved me hours of waiting time at the hospital.", name: "Rohan Gupta", loc: "Madurai", initials: "RG" },
                            { quote: "The virtual consultation feature is a lifesaver! I could consult with a specialist without traveling. The platform is very user-friendly.", name: "Neha Kapoor", loc: "Chennai", initials: "NK" },
                            { quote: "Best medical platform I've used. Very smooth experience from booking to consultation. The health records feature is incredibly helpful.", name: "Arjun Patel", loc: "Coimbatore", initials: "AP" }
                        ].map((t, i) => (
                            <div key={i} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={i * 100}>
                                <div className="testimonial-card">
                                    <div className="quote">{t.quote}</div>
                                    <div className="user">
                                        <div className="user-avatar">{t.initials}</div>
                                        <div className="user-info">
                                            <h6>{t.name}</h6>
                                            <p>Patient, {t.loc}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* CTA Section */}
            < section className="cta-section" >
                <div className="container">
                    <div className="cta-content" data-aos="zoom-in">
                        <h2 className="mb-4">Take Control of Your Health Today</h2>
                        <p className="mb-4">
                            Join thousands of satisfied patients who have transformed their
                            healthcare experience with HealthCare+.
                        </p>
                        <div className="cta-buttons">
                            <a href="#book" className="btn btn-success-custom btn-modern btn-lg">
                                <i className="fas fa-calendar-plus me-2"></i> Book Appointment
                            </a>
                            <button
                                onClick={() => navigate('/virtual-consult')}
                                className="btn btn-outline-light btn-modern btn-lg"
                            >
                                <i className="fas fa-video me-2"></i> Start Virtual Consult
                            </button>
                        </div>
                    </div>
                </div>
            </section >

            {/* Footer */}
            < footer >
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
                                <li><a href="#hospitals" className="footer-link-item"><i className="fas fa-hospital me-2"></i>Hospitals</a></li>
                                <li><a href="#resources" className="footer-link-item"><i className="fas fa-book-medical me-2"></i>Resources</a></li>
                                <li><a href="#testimonials" className="footer-link-item"><i className="fas fa-star me-2"></i>Testimonials</a></li>
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
                    <div className="copyright">
                        <p>&copy; 2025 HealthCare+. All Rights Reserved.</p>
                    </div>
                </div>
            </footer >

            {/* Floating Emergency Button */}
            <button
                id="ambulanceBtn"
                className="btn btn-danger position-fixed"
                style={{ bottom: '20px', right: '20px' }}
                onClick={openCamera}
                data-bs-toggle="modal"
                data-bs-target="#cameraModal"
            >
                <i className="fas fa-ambulance"></i>
            </button>

            {/* Enhanced Camera Modal */}
            <div className="modal fade" id="cameraModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-2xl overflow-hidden">
                        <div className="modal-header bg-dark text-white border-0 py-4 px-4 position-relative">
                            <div className="d-flex align-items-center">
                                <div className="emergency-icon-bg me-3">
                                    <i className="fas fa-ambulance animate-pulse"></i>
                                </div>
                                <div>
                                    <h5 className="modal-title fw-bold mb-0" style={{ letterSpacing: '1px' }}>EMERGENCY RESPONSE</h5>
                                    <small className="text-danger-custom opacity-75 fw-bold"><i className="fas fa-circle me-1" style={{ fontSize: '8px' }}></i> LIVE TRACKING ACTIVE</small>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                data-bs-dismiss="modal"
                                aria-label="Close"
                            ></button>
                        </div>
                        <div className="modal-body text-center p-0 position-relative bg-black" style={{ minHeight: '500px' }}>
                            {!capturedImage ? (
                                <div className="camera-view-container">
                                    <div className="corner-decor top-left"></div>
                                    <div className="corner-decor top-right"></div>
                                    <div className="corner-decor bottom-left"></div>
                                    <div className="corner-decor bottom-right"></div>

                                    <div className="camera-overlay-top">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="live-dot-pulse"></span>
                                            <span className="text-white fw-bold small">ENCRYPTED FEED</span>
                                        </div>
                                    </div>

                                    <video
                                        ref={videoRef}
                                        id="cameraStream"
                                        autoPlay
                                        playsInline
                                        className="w-100 h-100"
                                        style={{ objectFit: 'cover', minHeight: '500px' }}
                                    ></video>

                                    <div className="camera-scanner"></div>

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
                                    <div className="btn-inner">
                                        <i className="fas fa-camera me-2"></i>
                                        <span>CAPTURE INCIDENT</span>
                                    </div>
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
                                            {isSending ? (
                                                <><span className="spinner-border spinner-border-sm me-2"></span>DISPATCHING...</>
                                            ) : (
                                                <><i className="fas fa-shield-heart me-2"></i> DISPATCH NOW</>
                                            )}
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
