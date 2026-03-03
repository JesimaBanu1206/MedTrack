import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Swal from 'sweetalert2';
import AOS from 'aos';
import 'aos/dist/aos.css';
import 'animate.css';
import './Dashboard.css';
import './PrescriptionsPage.css';
import axiosInstance from '../api/axios';

const PrescriptionsPage = () => {
    const navigate = useNavigate();
    const { logout, user, fetchProfile } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMedication, setSelectedMedication] = useState(null);

    const [dbPrescriptions, setDbPrescriptions] = useState([]);
    const [pharmacies, setPharmacies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [prescRes, pharmaRes] = await Promise.all([
                axiosInstance.get('/patient/prescriptions'),
                axiosInstance.get('/patient/nearby-pharmacies')
            ]);
            setDbPrescriptions(prescRes.data.data.prescriptions);
            setPharmacies(pharmaRes.data.data.pharmacies);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
        fetchData();
        AOS.init({
            duration: 1000,
            once: true,
            offset: 50
        });
    }, [fetchProfile]);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleLogout = () => {
        Swal.fire({
            title: "Are you sure?",
            text: "You will be logged out of your account.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#0d9488",
            confirmButtonText: "Yes, logout",
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
                navigate('/login');
            }
        });
    };

    const handleManualUpload = () => {
        Swal.fire({
            title: 'AI Smart Prescription Scanner',
            html: `
                <div class="text-center p-6 bg-teal-50/50 rounded-3xl border-2 border-dashed border-teal-200">
                    <div class="mb-6">
                        <i class="fa-solid fa-microchip text-5xl text-teal-600 animate-pulse"></i>
                    </div>
                    <h4 class="font-black text-gray-800 mb-2">Upload your Prescription</h4>
                    <p class="text-sm text-gray-500 mb-6 font-medium">Our AI will automatically extract doctor names, medicines, and timings from your file.</p>
                    
                    <div class="relative group cursor-pointer">
                        <input type="file" id="prescriptionFile" accept="image/*,application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                        <div class="bg-white p-8 rounded-2xl border border-teal-100 shadow-sm group-hover:bg-teal-50 transition-all flex flex-col items-center">
                            <i class="fa-solid fa-cloud-arrow-up text-3xl text-teal-400 mb-3"></i>
                            <span class="text-sm font-bold text-teal-700">Select Image or PDF</span>
                            <span id="fileName" class="text-xs text-gray-400 mt-2 italic">No file selected</span>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Scan & Save Now',
            confirmButtonColor: '#0d9488',
            showLoaderOnConfirm: true,
            didOpen: () => {
                const fileInput = document.getElementById('prescriptionFile');
                const fileNameDisplay = document.getElementById('fileName');
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        fileNameDisplay.innerText = e.target.files[0].name;
                        fileNameDisplay.classList.remove('text-gray-400');
                        fileNameDisplay.classList.add('text-teal-600', 'font-bold');
                    }
                });
            },
            preConfirm: async () => {
                const file = document.getElementById('prescriptionFile').files[0];

                if (!file) {
                    Swal.showValidationMessage('Please select a file to scan');
                    return false;
                }

                // Show processing indicator
                Swal.update({
                    title: 'AI is reading your prescription...',
                    html: `
                        <div class="p-8">
                            <div class="relative w-24 h-24 mx-auto mb-6">
                                <div class="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                                <div class="absolute inset-0 border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
                                <i class="fa-solid fa-magnifying-glass-chart absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-teal-600"></i>
                            </div>
                            <p class="text-teal-800 font-bold">Scanning for doctor names, medicines, and dosages...</p>
                            <p class="text-xs text-teal-600 mt-2 animate__animated animate__fadeIn animate__infinite">Extracting data without spelling mistakes...</p>
                        </div>
                    `,
                    showConfirmButton: false
                });

                const formData = new FormData();
                formData.append('file', file);
                formData.append('auto_extract', 'true');

                try {
                    const response = await axiosInstance.post('/patient/prescriptions/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    return response.data;
                } catch (error) {
                    Swal.showValidationMessage(`Scanning failed: ${error.response?.data?.message || error.message}`);
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Smart Scan Complete!',
                    text: 'Prescription details have been extracted and saved automatically.',
                    icon: 'success',
                    confirmButtonColor: '#0d9488'
                });
                fetchData();
            }
        });
    };

    const prescriptions = [
        {
            id: 'PR-2023-0456',
            doctor: 'Dr. Priya Sharma',
            specialty: 'Cardiologist',
            hospital: 'HealthCare+ Cardiac Center',
            status: 'active',
            issuedDate: 'October 15, 2023',
            expiryDate: 'April 15, 2024',
            refills: 2,
            refillPercent: 66,
            pharmacy: 'MedPlus, Koramangala',
            lastFilled: 'November 10, 2023',
            medications: [
                {
                    name: 'Atorvastatin 20mg',
                    dosage: 'Take 1 tablet daily at bedtime',
                    category: 'Cholesterol',
                    quantity: '30 Tablets',
                    instructions: 'Take with water. Avoid grapefruit products.'
                },
                {
                    name: 'Metformin 500mg',
                    dosage: 'Take 1 tablet twice daily with meals',
                    category: 'Diabetes',
                    quantity: '60 Tablets',
                    instructions: 'Take with food to reduce stomach upset.'
                }
            ]
        },
        {
            id: 'PR-2023-0789',
            doctor: 'Dr. Anjali Mehta',
            specialty: 'Pulmonologist',
            hospital: 'City Respiratory Institute',
            status: 'active',
            issuedDate: 'November 20, 2023',
            expiryDate: 'May 20, 2024',
            refills: 3,
            refillPercent: 75,
            pharmacy: 'Apollo Pharmacy, HSR Layout',
            lastFilled: 'January 5, 2024',
            medications: [
                {
                    name: 'Montelukast 10mg',
                    dosage: 'Take 1 tablet daily in the evening',
                    category: 'Asthma',
                    quantity: '30 Tablets',
                    instructions: 'Take on an empty stomach or 2 hours after food.'
                }
            ]
        },
        {
            id: 'PR-2023-0321',
            doctor: 'Dr. Ramesh Verma',
            specialty: 'General Physician',
            hospital: 'HealthCare+ General Hospital',
            status: 'completed',
            issuedDate: 'August 10, 2023',
            expiryDate: 'February 10, 2024',
            refills: 0,
            refillPercent: 0,
            pharmacy: 'MedPlus, Koramangala',
            lastFilled: 'September 15, 2023',
            medications: [
                {
                    name: 'Amoxicillin 500mg',
                    dosage: 'Take 1 capsule three times daily for 7 days',
                    category: 'Antibiotic',
                    quantity: '21 Capsules',
                    instructions: 'Complete the full course even if you feel better.'
                }
            ]
        }
    ];

    const allPrescriptions = [
        ...dbPrescriptions.map(p => ({
            id: p.custom_id || p.id.substring(0, 8).toUpperCase(),
            doctor: p.doctor_name,
            hospital: p.hospital_name,
            status: p.status,
            issuedDate: new Date(p.issued_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            expiryDate: p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No Expiry',
            fileUrl: p.file_url,
            isManual: true,
            category: p.category || 'General',
            medications: p.medications || []
        })),
        ...prescriptions
    ];

    const filteredPrescriptions = allPrescriptions.filter(p => {
        const matchesFilter = activeFilter === 'all' || p.status === activeFilter;
        const matchesSearch = p.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.medications && p.medications.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesFilter && matchesSearch;
    });

    const userDisplayName = user?.fullName || user?.name || '';
    const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'User';

    return (
        <div className="dashboard-container min-h-screen">
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
                        <a href="#" onClick={() => navigate('/dashboard')}>
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
                        <a href="#" className="active" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-prescription-bottle-medical"></i>
                            Prescriptions
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/reports')}>
                            <i className="fa-solid fa-file-medical"></i>
                            Reports & Tests
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/stats')}>
                            <i className="fa-solid fa-chart-line"></i>
                            Health Stats
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/tips')}>
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

            {/* Main Content */}<br></br>
            <main className="main-content flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 mt-4 animate__animated animate__fadeIn">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 mb-2 font-inter tracking-tight">
                            My <span className="text-gradient">Prescriptions</span>
                        </h1>
                        <p className="text-gray-500 font-semibold text-lg">
                            Manage and view your medication prescriptions
                        </p>
                    </div>
                    <div className="flex gap-4 mt-6 sm:mt-0">
                        <button className="action-btn btn-outline hover:scale-105 transition-transform shadow-sm">
                            <i className="fa-solid fa-bell text-accent"></i> Set Reminders
                        </button>
                        <button className="action-btn btn-primary shadow-lg hover:shadow-teal-500/30 hover:scale-105 transition-all" onClick={handleManualUpload}>
                            <i className="fa-solid fa-plus-circle"></i> Upload New
                        </button>
                    </div>
                </div>

                {/* Prescription Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Active', value: allPrescriptions.filter(p => p.status === 'active').length, icon: 'fa-prescription-bottle-medical', color: 'teal' },
                        { label: 'Total', value: allPrescriptions.length, icon: 'fa-clock-rotate-left', color: 'amber' },
                        { label: 'Monthly Cost', value: '₹1,850', icon: 'fa-indian-rupee-sign', color: 'blue' },
                        { label: 'Adherence', value: '92%', icon: 'fa-chart-line', color: 'purple' }
                    ].map((stat, idx) => (
                        <div key={idx} className="stats-card group" data-aos="fade-up" data-aos-delay={idx * 100}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                    <p className={`text-4xl font-black text-gray-800 group-hover:text-${stat.color}-600 transition-colors`}>{stat.value}</p>
                                </div>
                                <div className={`stats-icon bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                                    <i className={`fa-solid ${stat.icon}`}></i>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search and Filter Section */}
                <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 mb-12 border border-white/40 transition-all" data-aos="fade-up">
                    <div className="flex flex-col xl:flex-row gap-8 items-start xl:items-center justify-between">
                        <div className="search-box scale-105 ml-2">
                            <i className="fa-solid fa-search text-teal-600"></i>
                            <input
                                type="text"
                                className="bg-transparent border-none focus:ring-0"
                                placeholder="Search by doctor, ID or medication..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="filter-tabs shadow-inner">
                            {['all', 'active', 'completed', 'expired'].map(filter => (
                                <div
                                    key={filter}
                                    className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(filter)}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="medication-reminder">
                            <div className="flex items-start gap-4">
                                <div className="bg-white/40 p-2 rounded-xl">
                                    <i className="fa-solid fa-bell text-amber-700 animate-bounce"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-900">Medication Reminder</h4>
                                    <p className="text-sm text-amber-800 mt-1 font-medium">
                                        Your Metformin prescription has 7 days of medication remaining. Consider requesting a refill soon.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="medication-interaction">
                            <div className="flex items-start gap-4">
                                <div className="bg-white/40 p-2 rounded-xl">
                                    <i className="fa-solid fa-triangle-exclamation text-red-700"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-900">Potential Interaction Alert</h4>
                                    <p className="text-sm text-red-800 mt-1 font-medium">
                                        Atorvastatin may interact with Grapefruit juice. Avoid consuming grapefruit products while taking this medication.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Prescriptions List */}
                <div className="prescriptions-container">
                    {filteredPrescriptions.length > 0 ? (
                        filteredPrescriptions.map((p, pIdx) => (
                            <div key={p.id} className="prescription-card shadow-2xl" data-aos="fade-up" data-aos-delay={pIdx * 150}>
                                <div className="prescription-header relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <h3 className="text-2xl font-black tracking-tight">Prescription {p.id}</h3>
                                                <span className={`status-badge flex items-center gap-2 ${p.status === 'active' ? 'status-active ring-2 ring-emerald-500/20' : 'status-completed ring-2 ring-indigo-500/20'}`}>
                                                    <span className={`w-2 h-2 rounded-full animate-pulse ${p.status === 'active' ? 'bg-emerald-600' : 'bg-indigo-600'}`}></span>
                                                    {p.status.toUpperCase()}
                                                </span>
                                                {p.category && (
                                                    <span className="bg-white/20 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">
                                                        {p.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-teal-50 mt-2 font-bold text-lg opacity-90">
                                                {p.doctor} <span className="mx-2 opacity-50">•</span> {p.specialty}
                                            </p>
                                            <div className="flex items-center gap-3 mt-3 text-teal-100 text-sm font-semibold italic">
                                                <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md">
                                                    <i className="fa-solid fa-hospital-user"></i>
                                                </div>
                                                <span>{p.hospital}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-xl border border-white/20 flex flex-col items-center min-w-[140px] shadow-lg">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Refills</span>
                                            <span className="text-3xl font-black text-white">{p.refills}</span>
                                            <div className="refill-progress h-1.5 mt-3 w-full bg-white/20 rounded-full">
                                                <div className="refill-progress-bar bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]" style={{ width: `${p.refillPercent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="prescription-body bg-white/40">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-sm text-gray-500 font-bold">
                                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl flex items-center gap-4 shadow-sm border border-white/60">
                                            <div className="bg-teal-100/50 p-3 rounded-2xl text-teal-600">
                                                <i className="fa-solid fa-calendar-check text-xl"></i>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest opacity-60">Issued on</p>
                                                <p className="text-gray-800 text-base">{p.issuedDate}</p>
                                            </div>
                                        </div>
                                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl flex items-center gap-4 shadow-sm border border-white/60">
                                            <div className="bg-red-100/50 p-3 rounded-2xl text-red-600">
                                                <i className="fa-solid fa-calendar-xmark text-xl"></i>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest opacity-60">Expires on</p>
                                                <p className="text-gray-800 text-base">{p.expiryDate}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="medications-list">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                            List of Medications <span className="h-[1px] flex-1 bg-gray-100"></span>
                                        </h4>
                                        {p.medications && p.medications.length > 0 ? (
                                            p.medications.map((med, idx) => (
                                                <div key={idx} className="medication-item group hover:bg-white/60 transition-all rounded-3xl border-transparent hover:border-teal-100/50 border mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${med.type === 'Injection' ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-600'}`}>
                                                                <i className={`fa-solid ${med.type === 'Injection' ? 'fa-syringe' : 'fa-pills'} text-xl`}></i>
                                                            </div>
                                                            <div>
                                                                <h5 className="font-black text-gray-800 text-xl tracking-tight group-hover:text-teal-700 transition-colors uppercase">{med.name}</h5>
                                                                <p className="text-gray-500 font-bold italic text-xs">{med.dosage}</p>
                                                            </div>
                                                        </div>

                                                        {med.timings && (
                                                            <div className="flex gap-2 mt-4 ml-1">
                                                                {['morning', 'afternoon', 'evening', 'night'].map(time => (
                                                                    <div key={time} className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all ${med.timings[time] ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 opacity-50'}`}>
                                                                        <i className={`fa-solid ${time === 'morning' ? 'fa-sun' : time === 'afternoon' ? 'fa-cloud-sun' : time === 'evening' ? 'fa-moon' : 'fa-star-and-crescent'} mb-1`}></i>
                                                                        <span className="text-[8px] font-black uppercase tracking-tighter">{time.substring(0, 3)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-3 mt-4">
                                                            <span className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest ${med.category === 'Diabetes' ? 'bg-blue-100 text-blue-600' : med.category === 'Cholesterol' ? 'bg-orange-100 text-orange-600' : med.category === 'Blood Pressure' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                                                                {med.category || 'General'}
                                                            </span>
                                                            <span className="text-[10px] font-black bg-gray-100 text-gray-800 px-4 py-2 rounded-xl uppercase tracking-widest border border-gray-200">
                                                                {med.quantity || med.type}
                                                            </span>
                                                        </div>
                                                        <div className="mt-4 bg-teal-50/50 p-4 rounded-2xl border border-teal-100/30 backdrop-blur-sm group-hover:bg-teal-50 transition-colors">
                                                            <p className="text-xs text-teal-900 leading-relaxed font-bold">
                                                                <i className="fa-solid fa-circle-info mr-2 opacity-50"></i>
                                                                <span className="opacity-60 uppercase mr-1">Instructions:</span> {med.instructions}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="medication-actions flex gap-3 sm:self-center mt-6 lg:mt-0">
                                                        <button
                                                            className="action-btn bg-white hover:bg-teal-50 text-teal-700 border border-teal-100 shadow-sm hover:shadow-md transition-all font-black uppercase text-[10px] tracking-widest px-6"
                                                            onClick={() => setSelectedMedication(med)}
                                                        >
                                                            Details
                                                        </button>
                                                        <button className="action-btn btn-primary shadow-lg shadow-teal-500/20 hover:scale-105 px-8 font-black uppercase text-[10px] tracking-widest">
                                                            Refill
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="bg-teal-50/30 p-8 rounded-3xl text-center border border-dashed border-teal-200">
                                                <i className="fa-solid fa-file-medical text-4xl text-teal-300 mb-3"></i>
                                                <p className="text-gray-500 font-bold">Manual upload - View PDF/Image for details</p>
                                                {p.fileUrl && (
                                                    <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-teal-600 font-black uppercase text-xs tracking-widest border-b-2 border-teal-600 pb-1">
                                                        View Document
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mt-8 pt-8 border-t border-gray-100/50 gap-6">
                                        <div className="flex items-center gap-4 bg-white/50 p-4 rounded-3xl border border-white">
                                            <div className="bg-orange-100/80 p-4 rounded-2xl shadow-inner">
                                                <i className="fa-solid fa-store text-orange-600 text-xl"></i>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selected Pharmacy</p>
                                                <p className="text-base font-black text-gray-800">{p.pharmacy}</p>
                                                <span className="last-filled inline-block mt-2">Last Filled: {p.last_filled || p.lastFilled}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full lg:w-auto">
                                            {p.fileUrl ? (
                                                <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="action-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-100 shadow-sm flex-1 font-bold no-underline justify-center">
                                                    <i className="fa-solid fa-file-pdf text-red-500"></i> View / Download
                                                </a>
                                            ) : (
                                                <button className="action-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-100 shadow-sm flex-1 font-bold">
                                                    <i className="fa-solid fa-file-pdf text-red-500"></i> Download
                                                </button>
                                            )}
                                            <button className="action-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-100 shadow-sm flex-1 font-bold">
                                                <i className="fa-solid fa-share-nodes text-blue-500"></i> Share
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state animate__animated animate__zoomIn">
                            <div className="empty-state-icon text-gray-200">
                                <i className="fa-solid fa-prescription-bottle-alt"></i>
                            </div>
                            <h3 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">No Results Found</h3>
                            <p className="text-gray-500 font-bold text-lg max-w-md mx-auto opacity-70">
                                We couldn't find any prescriptions matching your current search criteria.
                            </p>
                        </div>
                    )}
                </div>

                {/* Nearby Pharmacies Section */}
                <div className="pharmacy-container mt-12" data-aos="fade-up">
                    <div className="pharmacy-title-container">
                        <h3 className="pharmacy-title">Nearby Pharmacies</h3>
                        <div className="title-underline"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {pharmacies.length > 0 ? (
                            pharmacies.map((pharma, idx) => (
                                <div key={idx} className="pharmacy-card">
                                    <div className="pharmacy-header-row">
                                        <div
                                            className="circle-dot"
                                            style={{
                                                backgroundColor:
                                                    pharma.color === 'teal' ? '#99f6e4' :
                                                        pharma.color === 'blue' ? '#bfdbfe' :
                                                            pharma.color === 'indigo' ? '#c7d2fe' :
                                                                pharma.color === 'purple' ? '#e9d5ff' :
                                                                    '#a7f3d0' // emerald/default
                                            }}
                                        ></div>
                                        <h4 className="pharmacy-name">{pharma.name}</h4>
                                    </div>
                                    <div className="pharmacy-details">
                                        <p className="pharmacy-location">
                                            {pharma.area === 'Online' ? 'Online Delivery' : `${pharma.area}, ${pharma.dist} away`}
                                        </p>
                                        <p className="pharmacy-rating">
                                            {pharma.rating} ({pharma.reviews} reviews)
                                        </p>
                                        <span className={`pharmacy-status-badge status-${pharma.color}`}>
                                            {pharma.status === 'Open 24/7' ? '24/7' : pharma.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            [1, 2, 3].map((_, idx) => (
                                <div key={idx} className="pharmacy-card animate-pulse">
                                    <div className="pharmacy-header-row">
                                        <div className="circle-dot bg-gray-200"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                    <div className="pharmacy-details space-y-2">
                                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                                        <div className="h-6 bg-gray-50 rounded w-1/3 mt-2"></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Manual Upload Section - Prompt */}
                <div className="mt-16 mb-8" data-aos="zoom-in">
                    <div className="manual-upload-card group" onClick={handleManualUpload}>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="upload-icon bg-white p-8 rounded-[2.5rem] shadow-2xl mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                                <i className="fa-solid fa-cloud-arrow-up text-5xl text-teal-600"></i>
                            </div>
                            <h3 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">Upload Prescription <span className="text-teal-600">Manually</span></h3>
                            <p className="text-gray-500 font-bold text-lg max-w-lg mx-auto leading-relaxed">
                                Got a physical prescription? Keep your medical records unified and accessible anywhere by digitizing them today.
                            </p>
                            <div className="mt-8">
                                <span className="action-btn btn-primary px-10 py-4 rounded-2xl shadow-xl shadow-teal-500/20 font-black uppercase tracking-widest text-xs">
                                    Get Started <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Medication Info Modal */}
            {selectedMedication && (
                <div className="medication-details-modal-overlay" onClick={() => setSelectedMedication(null)}>
                    <div className="medication-details-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal" onClick={() => setSelectedMedication(null)}>
                            <i className="fa-solid fa-times"></i>
                        </button>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-teal-50 p-4 rounded-2xl">
                                <i className="fa-solid fa-capsules text-3xl text-teal-600"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">{selectedMedication.name}</h2>
                                <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-lg uppercase tracking-widest">{selectedMedication.category}</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-gray-50 p-6 rounded-2xl">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Therapeutic Description</h3>
                                <p className="text-gray-700 font-medium leading-relaxed">
                                    This medication is primarily used for the management of {selectedMedication.category.toLowerCase()}.
                                    Regular monitoring by your healthcare provider is essential while on this treatment.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="border border-gray-100 p-5 rounded-2xl">
                                    <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-2">Recommended Dosage</h4>
                                    <p className="font-bold text-gray-800">{selectedMedication.dosage}</p>
                                </div>
                                <div className="border border-gray-100 p-5 rounded-2xl">
                                    <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-2">Quantity Prescribed</h4>
                                    <p className="font-bold text-gray-800">{selectedMedication.quantity}</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Critical Instructions</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3 text-sm text-amber-900 font-medium">
                                        <i className="fa-solid fa-check-circle mt-1 opacity-50"></i>
                                        {selectedMedication.instructions}
                                    </li>
                                    <li className="flex items-start gap-3 text-sm text-amber-900 font-medium">
                                        <i className="fa-solid fa-check-circle mt-1 opacity-50"></i>
                                        Notify your doctor immediately if you experience unusual side effects.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                className="w-full bg-gray-800 text-white font-black py-4 rounded-2xl hover:bg-black transition-all"
                                onClick={() => setSelectedMedication(null)}
                            >
                                CLOSE INFORMATION
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrescriptionsPage;
