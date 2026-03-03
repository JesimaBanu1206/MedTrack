import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Swal from 'sweetalert2';
import './Dashboard.css';
import './HealthTips.css'; // Reusing some CSS variables and layout styles

const HealthStatsPage = () => {
    const navigate = useNavigate();
    const { logout, user, fetchProfile } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        Swal.fire({
            title: 'Logout',
            text: 'Are you sure you want to logout?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0d9488',
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'Yes, logout'
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
                navigate('/login');
            }
        });
    };

    const userDisplayName = user?.fullName || user?.name || '';
    const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'User';

    const vitals = [
        { name: 'Blood Pressure', value: '120/80', unit: 'mmHg', status: 'Optimal', icon: 'fa-heart-pulse', color: 'text-rose-500', bg: 'bg-rose-50' },
        { name: 'Heart Rate', value: '72', unit: 'bpm', status: 'Normal', icon: 'fa-heartbeat', color: 'text-pink-500', bg: 'bg-pink-50' },
        { name: 'Blood Sugar', value: '98', unit: 'mg/dL', status: 'Healthy', icon: 'fa-droplet', color: 'text-amber-500', bg: 'bg-amber-50' },
        { name: 'SpO2', value: '99', unit: '%', status: 'Excellent', icon: 'fa-lungs', color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { name: 'Body Temp', value: '98.6', unit: '°F', status: 'Normal', icon: 'fa-thermometer-half', color: 'text-orange-500', bg: 'bg-orange-50' },
        { name: 'BMI', value: '22.4', unit: '', status: 'Normal', icon: 'fa-weight-scale', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    ];

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
                        <div className="flex lg:hidden items-center gap-2 font-bold text-xl sm:text-2xl text-white">
                            <i className="fa-solid fa-stethoscope text-yellow-300"></i>
                            <span>HealthCare<span className="text-teal-300">+</span></span>
                        </div>
                    </div>
                    <div className="navbar-user">
                        <span className="hidden sm:block text-white">Hi, <strong>{firstName}</strong></span>
                        <img
                            src="https://img.icons8.com/fluency/48/user-male-circle.png"
                            className="user-avatar"
                            alt="Profile"
                        />
                    </div>
                </div>
            </nav>

            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="brand">
                    <i className="fa-solid fa-heart-pulse text-red-100"></i>
                    HealthCare+
                </div>
                <ul>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
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
                        <a href="#" className="active" onClick={(e) => e.preventDefault()}>
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
            <main className="main-content flex-1 p-4 sm:p-6 md:p-8 pt-24 min-h-screen">
                <div className="mb-10"><br></br><br></br>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Health Statistics</h1>
                    <p className="text-gray-600">Real-time health monitoring and data insights</p>
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    {vitals.map((vital, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`${vital.bg} ${vital.color} p-4 rounded-2xl text-2xl`}>
                                    <i className={`fa-solid ${vital.icon}`}></i>
                                </div>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${vital.status === 'Optimal' || vital.status === 'Healthy' || vital.status === 'Excellent' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {vital.status}
                                </span>
                            </div>
                            <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">{vital.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-gray-800">{vital.value}</span>
                                <span className="text-gray-400 font-bold text-lg">{vital.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Trends & Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-gray-800">Weight Analysis</h3>
                            <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none text-sm font-bold text-gray-600">
                                <option>Last 6 Months</option>
                                <option>Last Year</option>
                            </select>
                        </div>
                        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <div className="text-center">
                                <i className="fa-solid fa-chart-area text-4xl text-gray-300 mb-4"></i>
                                <p className="text-gray-400 font-medium">Weight trend chart would appear here</p>
                                <p className="text-xs text-gray-300 mt-1">Collecting data points...</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-gray-800">Activity Level</h3>
                            <div className="flex gap-2">
                                <span className="w-3 h-3 bg-teal-500 rounded-full"></span>
                                <span className="text-xs font-bold text-gray-400">Target: 10k Steps</span>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {[
                                { day: 'Mon', steps: '8,240', progress: 82, color: 'bg-teal-500' },
                                { day: 'Tue', steps: '10,120', progress: 100, color: 'bg-teal-500' },
                                { day: 'Wed', steps: '4,500', progress: 45, color: 'bg-amber-500' },
                                { day: 'Thu', steps: '7,800', progress: 78, color: 'bg-teal-500' },
                                { day: 'Fri', steps: '9,100', progress: 91, color: 'bg-teal-500' },
                            ].map((item, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span className="text-gray-600">{item.day}</span>
                                        <span className="text-gray-800">{item.steps} <small className="text-gray-400">Steps</small></span>
                                    </div>
                                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.progress}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Health Summary Banner */}
                <div className="bg-gradient-to-r from-teal-600 to-indigo-700 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <h2 className="text-2xl font-black mb-3 italic">Overall Health Summary</h2>
                            <p className="text-teal-50 text-lg opacity-90 max-w-xl">
                                Your biometrics are currently within the <b>top 15%</b> of your age group. Keep maintaining your current activity level and hydration!
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-6 rounded-full backdrop-blur-md border border-white/30 text-center">
                                <div className="text-4xl font-black">88</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Score</div>
                            </div>
                            <button className="bg-white text-teal-800 font-black px-6 py-3 rounded-2xl hover:bg-teal-50 transition-all flex items-center gap-2">
                                <i className="fa-solid fa-file-pdf"></i> Download Full Report
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                </div>
            </main>
        </div>
    );
};

export default HealthStatsPage;
