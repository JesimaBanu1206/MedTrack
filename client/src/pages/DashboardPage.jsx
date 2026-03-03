
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import './Dashboard.css';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { logout, user, fetchProfile } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showIdCard, setShowIdCard] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleLogout = () => {
        // ... logout logic
    };

    const downloadIDCard = () => {
        const card = document.getElementById('patient-id-card');
        if (card) {
            html2canvas(card, {
                backgroundColor: null,
                scale: 2,
                useCORS: true
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `MedTrack_ID_${user?.patientId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                Swal.fire({
                    title: 'Success!',
                    text: 'ID Card downloaded successfully',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            });
        }
    };

    const userDisplayName = user?.fullName || user?.name || '';
    const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'User';
    const fullName = userDisplayName || 'Valued Patient';

    return (
        <div className="dashboard-container min-h-screen text-gray-800">
            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            ></div>

            {/* Enhanced Navbar */}
            <nav className="navbar-custom">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} className="lg:hidden p-2 text-white">
                            <div className={`hamburger ${isSidebarOpen ? 'active' : ''}`}>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </button>
                        {/* Only show brand on mobile navbar, as sidebar has it on desktop */}
                        <div className="flex lg:hidden items-center gap-2 font-bold text-xl sm:text-2xl">
                            <i className="fa-solid fa-stethoscope text-yellow-300"></i>
                            <span>HealthCare<span className="text-teal-300">+</span></span>
                        </div>
                    </div>
                    <div className="navbar-user">
                        <span className="hidden sm:block">Hi, <strong>{firstName}</strong></span>
                        <img
                            src="https://img.icons8.com/fluency/48/user-male-circle.png"
                            className="user-avatar"
                            alt="Profile"
                        />
                    </div>
                </div>
            </nav>

            {/* Enhanced Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="brand">
                    <i className="fa-solid fa-heart-pulse text-red-100"></i>
                    HealthCare+
                </div>
                <ul>
                    <li>
                        <a href="#" className="active" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
                            <i className="fa-solid fa-gauge-high"></i>
                            Dashboard
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/appointments'); }}>
                            <i className="fa-solid fa-calendar-check"></i>
                            Appointments
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/prescriptions'); }}>
                            <i className="fa-solid fa-prescription-bottle-medical"></i>
                            Prescriptions
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/reports'); }}>
                            <i className="fa-solid fa-file-medical"></i>
                            Reports & Tests
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/stats'); }}>
                            <i className="fa-solid fa-chart-line"></i>
                            Health Stats
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/tips'); }}>
                            <i className="fa-solid fa-lightbulb"></i>
                            Health Tips
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-user-doctor"></i>
                            Doctors
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-hospital"></i>
                            Hospitals
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-gear"></i>
                            Settings
                        </a>
                    </li>
                </ul>
                <button onClick={handleLogout} className="logout-btn">
                    <i className="fa-solid fa-right-from-bracket"></i>
                    Logout
                </button>
            </div>

            {/* Main Content */}
            <main className="main-content flex-1 p-4 sm:p-6 md:p-8">
                {/* Welcome Banner */}<br></br><br></br>
                <div className="welcome-banner p-10 mb-8 text-white flex flex-col md:flex-row items-center justify-between shadow-xl">
                    <div className="w-full md:w-auto text-center md:text-left mb-6 md:mb-0 relative z-10">
                        <h2 className="text-3xl sm:text-5xl font-extrabold mb-4 leading-tight">
                            Welcome Back, <span className="text-yellow-300">{fullName}</span>
                        </h2>
                        <p className="text-teal-50 text-xl mb-8 opacity-90 max-w-lg">
                            Your health summary and records are up to date.
                        </p>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                if (user?.patientId?.startsWith('MT')) {
                                    setShowIdCard(true);
                                } else {
                                    navigate('/profile');
                                }
                            }}
                            className={`bg-white text-teal-700 px-8 py-4 rounded-2xl font-black shadow-2xl transition-all duration-300 flex items-center gap-3 mx-auto md:mx-0 hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 cursor-pointer text-lg`}
                        >
                            <i className="fa-solid fa-id-card text-xl"></i>
                            {user?.patientId?.startsWith('MT') ? `View ID: ${user.patientId}` : 'Generate Patient ID'}
                        </button>
                    </div>
                    <div className="hidden md:flex items-center justify-center w-64 h-64 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                        <i className="fa-solid fa-user-shield text-8xl text-yellow-300 animate-pulse"></i>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="quick-actions">
                    <div className="action-card action-primary">
                        <div className="action-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-700">Book Appointment</h3>
                        <p className="text-gray-500 text-sm mt-1">Schedule with a doctor</p>
                    </div>
                    <div className="action-card action-secondary" onClick={() => navigate('/prescriptions')}>
                        <div className="action-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z" />
                                <path d="M7 10h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-700">My Prescriptions</h3>
                        <p className="text-gray-500 text-sm mt-1">View & refill medications</p>
                    </div>
                    <div className="action-card action-success" onClick={() => navigate('/reports')}>
                        <div className="action-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-700">Reports & Tests</h3>
                        <p className="text-gray-500 text-sm mt-1">Access lab results</p>
                    </div>
                    <div className="action-card action-warning" onClick={() => navigate('/tips')}>
                        <div className="action-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-700">Health Tips</h3>
                        <p className="text-gray-500 text-sm mt-1">Personalized advice</p>
                    </div>
                </div>

                {/* Health Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg hover:scale-[1.02] cursor-pointer transition-all relative">
                        <div className="absolute top-4 right-4 text-xs font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Upcoming</div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-4 rounded-2xl">
                                <i className="fa-solid fa-calendar-check text-4xl text-white"></i>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold mb-1">Next Appointment</h3>
                        <p className="text-teal-50 opacity-90">Dr. Priya Sharma — Cardiologist</p>
                        <p className="text-sm mt-2 font-medium bg-teal-700/50 w-fit px-3 py-1 rounded-lg">10 Oct 2025, 11:30 AM</p>
                    </div>
                    <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg hover:scale-[1.02] cursor-pointer transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-4 rounded-2xl">
                                <i className="fa-solid fa-truck-medical text-4xl text-white"></i>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold mb-1">Emergency Contacts</h3>
                        <p className="text-red-50 opacity-90">24/7 Emergency Services</p>
                        <p className="text-sm mt-2 font-bold bg-red-700/50 w-fit px-3 py-1 rounded-lg">Ambulance: 108</p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg hover:scale-[1.02] cursor-pointer transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-4 rounded-2xl">
                                <i className="fa-solid fa-clipboard-list text-4xl text-white"></i>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold mb-1">Health Records</h3>
                        <p className="text-blue-50 opacity-90">Complete medical history</p>
                        <p className="text-sm mt-2 font-medium bg-blue-700/50 w-fit px-3 py-1 rounded-lg">Last updated: Today</p>
                    </div>
                </div>

                {/* Recent Appointments */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                        <h3 className="section-header text-2xl font-bold text-gray-800">Recent Appointments</h3>
                        <button className="text-teal-600 font-bold hover:underline">View All Records</button>
                    </div>
                    <div className="overflow-x-auto table-container">
                        <table className="w-full text-left border-collapse table-custom">
                            <thead>
                                <tr>
                                    <th className="p-4">Date & Time</th>
                                    <th className="p-4">Hospital</th>
                                    <th className="p-4">Doctor</th>
                                    <th className="p-4">Specialty</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-medium">25 Sep 2025, 10:00 AM</td>
                                    <td className="p-4">HealthCare+ Clinic</td>
                                    <td className="p-4">Dr. Ramesh Verma</td>
                                    <td className="p-4">General Physician</td>
                                    <td className="p-4 text-center">
                                        <span className="status-badge status-completed">Completed</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-medium">12 Aug 2025, 2:30 PM</td>
                                    <td className="p-4">HealthCare+ Clinic</td>
                                    <td className="p-4">Dr. Meena Reddy</td>
                                    <td className="p-4">Dermatologist</td>
                                    <td className="p-4 text-center">
                                        <span className="status-badge status-completed">Completed</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-medium">01 Aug 2025, 9:00 AM</td>
                                    <td className="p-4">HealthCare+ Clinic</td>
                                    <td className="p-4">Dr. Priya Sharma</td>
                                    <td className="p-4">Cardiologist</td>
                                    <td className="p-4 text-center">
                                        <span className="status-badge status-completed">Completed</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Vitals Progress Monitor */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                        <h3 className="section-header text-2xl font-bold text-gray-800">Vitals Progress</h3>
                        <span className="text-gray-400 text-sm font-medium">Monthly Comparison</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl progress-card bg-gray-50/30">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                                    <i className="fa-solid fa-droplet text-red-500"></i>
                                    Fasting Glucose (mg/dL)
                                </h4>
                                <i className="fa-solid fa-arrow-trend-down text-green-500 text-xl"></i>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="border-r border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Last Month</p>
                                    <p className="text-3xl font-black text-gray-700">110</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">This Month</p>
                                    <p className="text-3xl font-black text-green-600">95</p>
                                </div>
                            </div>
                            <p className="text-center text-sm mt-6 text-green-600 font-bold bg-green-50 py-2 rounded-xl">
                                Excellent! Your levels are improving.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl progress-card bg-gray-50/30">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                                    <i className="fa-solid fa-heart-pulse text-teal-500"></i>
                                    Blood Pressure (mmHg)
                                </h4>
                                <i className="fa-solid fa-equals text-gray-400 text-xl"></i>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="border-r border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Last Month</p>
                                    <p className="text-3xl font-black text-gray-700">120/80</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">This Month</p>
                                    <p className="text-3xl font-black text-teal-600">120/80</p>
                                </div>
                            </div>
                            <p className="text-center text-sm mt-6 text-teal-600 font-bold bg-teal-50 py-2 rounded-xl">
                                Stable and within healthy range.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Health Overview Vitals */}
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-gray-100">
                    <h3 className="section-header text-2xl font-bold text-gray-800 mb-6">Vitals Overview</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-teal-50/50 flex flex-col items-center justify-center p-6 rounded-2xl border border-teal-100 hover:bg-teal-50 transition-colors">
                            <p className="text-gray-500 font-bold text-xs uppercase mb-1">Heart Rate</p>
                            <p className="text-2xl font-black text-teal-600">76 bpm</p>
                        </div>
                        <div className="bg-teal-50/50 flex flex-col items-center justify-center p-6 rounded-2xl border border-teal-100 hover:bg-teal-50 transition-colors">
                            <p className="text-gray-500 font-bold text-xs uppercase mb-1">Blood Pressure</p>
                            <p className="text-2xl font-black text-teal-600">120/80</p>
                        </div>
                        <div className="bg-teal-50/50 flex flex-col items-center justify-center p-6 rounded-2xl border border-teal-100 hover:bg-teal-50 transition-colors">
                            <p className="text-gray-500 font-bold text-xs uppercase mb-1">Glucose</p>
                            <p className="text-2xl font-black text-teal-600">95 mg/dL</p>
                        </div>
                        <div className="bg-teal-50/50 flex flex-col items-center justify-center p-6 rounded-2xl border border-teal-100 hover:bg-teal-50 transition-colors">
                            <p className="text-gray-500 font-bold text-xs uppercase mb-1">Oxygen</p>
                            <p className="text-2xl font-black text-teal-600">98%</p>
                        </div>
                    </div>
                </div>

                {/* Health Tips & Recommendations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-gray-100">
                    <h3 className="section-header text-2xl font-bold text-gray-800 mb-6">Health Tips & Recommendations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 hover:bg-blue-50 transition-all">
                            <div className="flex items-center mb-4">
                                <div className="bg-blue-100 p-3 rounded-xl mr-4"><i className="fa-solid fa-apple-whole text-blue-500 text-xl"></i></div>
                                <h4 className="font-bold text-gray-700">Nutrition Advice</h4>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                Increase your intake of leafy greens and reduce processed foods. Your glucose levels have improved significantly with your current diet.
                            </p>
                        </div>
                        <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 hover:bg-green-50 transition-all">
                            <div className="flex items-center mb-4">
                                <div className="bg-green-100 p-3 rounded-xl mr-4"><i className="fa-solid fa-person-walking text-green-500 text-xl"></i></div>
                                <h4 className="font-bold text-gray-700">Exercise Routine</h4>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                Continue with 30 minutes of brisk walking daily. Your heart rate is within optimal range, showing great cardiovascular health.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Upcoming Health Events */}
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-gray-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                        <h3 className="section-header text-2xl font-bold text-gray-800">Upcoming Health Events</h3>
                        <button className="text-teal-600 font-bold hover:underline">View Calendar</button>
                    </div>
                    <div className="space-y-4">
                        <div className="health-event-card vaccination bg-purple-50/50 p-6 rounded-2xl border border-purple-100 flex items-center hover:bg-purple-50 transition-all">
                            <div className="bg-purple-100 p-4 rounded-xl mr-5"><i className="fas fa-syringe text-purple-600 text-xl"></i></div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-700">Annual Flu Vaccination</h4>
                                <p className="text-gray-500 font-medium">Due: November 15, 2025</p>
                            </div>
                            <span className="hidden sm:block text-xs font-bold text-purple-600 bg-white px-4 py-2 rounded-xl shadow-sm">2 weeks left</span>
                        </div>
                        <div className="health-event-card checkup bg-orange-50/50 p-6 rounded-2xl border border-orange-100 flex items-center hover:bg-orange-50 transition-all">
                            <div className="bg-orange-100 p-4 rounded-xl mr-5"><i className="fas fa-user-md text-orange-600 text-xl"></i></div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-700">Annual Physical Checkup</h4>
                                <p className="text-gray-500 font-medium">Scheduled: December 5, 2025</p>
                            </div>
                            <span className="hidden sm:block text-xs font-bold text-orange-600 bg-white px-4 py-2 rounded-xl shadow-sm">1 month left</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Patient ID Card Modal */}
            {showIdCard && (
                <div className="id-card-modal-overlay" onClick={() => setShowIdCard(false)}>
                    <div className="id-card-container" onClick={(e) => e.stopPropagation()}>
                        <div className="id-card-controls">
                            <button className="control-btn download-btn" onClick={downloadIDCard} title="Download ID Card">
                                <i className="fa-solid fa-download"></i>
                            </button>
                            <button className="control-btn close-btn" onClick={() => setShowIdCard(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div id="patient-id-card" className="id-card">
                            <div className="id-card-header">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-heartbeat text-2xl"></i>
                                    <span className="hospital-name text-white">HealthCare+</span>
                                </div>
                                <div className="text-right text-[10px] font-bold opacity-80 uppercase tracking-widest text-white">
                                    Digital Health ID
                                </div>
                            </div>

                            <div className="id-card-body">
                                <img
                                    src={user?.profilePictureUrl || "https://img.icons8.com/fluency/120/user-male-circle.png"}
                                    className="id-card-photo"
                                    alt="Patient"
                                />
                                <div className="id-card-info">
                                    <span className="label">Full Name</span>
                                    <h4 className="text-gray-900">{user?.fullName || 'Valued Patient'}</h4>

                                    <span className="label">Patient ID</span>
                                    <p className="font-bold text-teal-700">{user?.patientId}</p>

                                    <div className="grid grid-cols-2 gap-2 mt-4 text-gray-800">
                                        <div>
                                            <span className="label">DOB</span>
                                            <p>{user?.dob || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="label">Blood Group</span>
                                            <p>{user?.bloodGroup || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="label">Gender</span>
                                            <p>{user?.gender || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="label">Phone</span>
                                            <p>{user?.phone || 'N/A'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="label">City / Location</span>
                                            <p>{user?.city || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="id-card-footer">
                                <div className="text-[10px] text-gray-400 font-bold uppercase">
                                    This is a system generated<br />digital record of MedTrack
                                </div>
                                <div className="bg-white p-1 rounded-lg shadow-inner">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${user?.patientId}`} className="qr-code" alt="QR" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
