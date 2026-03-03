import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Swal from 'sweetalert2';
import './Dashboard.css';
import './HealthTips.css';

const HealthTipsPage = () => {
    const navigate = useNavigate();
    const { logout, user, fetchProfile } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const tipsData = [
        {
            id: 1,
            category: 'exercise',
            title: 'Daily Walking Benefits',
            content: 'A 30-minute daily walk can significantly improve cardiovascular health, boost mood, and help maintain a healthy weight. It\'s one of the most accessible forms of exercise with numerous health benefits.',
            readTime: '5 min read',
            timestamp: '2 days ago',
            tags: ['Cardio', 'Weight Management'],
            icon: 'fa-person-running',
            iconColor: 'bg-blue-100 text-blue-600'
        },
        {
            id: 2,
            category: 'nutrition',
            title: 'Balanced Diet Essentials',
            content: 'A balanced diet includes fruits, vegetables, whole grains, lean proteins, and healthy fats. Focus on variety and moderation to ensure you\'re getting all essential nutrients your body needs.',
            readTime: '7 min read',
            timestamp: '1 week ago',
            tags: ['Diet', 'Nutrition'],
            icon: 'fa-apple-whole',
            iconColor: 'bg-green-100 text-green-600'
        },
        {
            id: 3,
            category: 'mental',
            title: 'Stress Management Techniques',
            content: 'Practice mindfulness, deep breathing exercises, and regular physical activity to manage stress effectively. Taking breaks and maintaining social connections are also crucial for mental wellbeing.',
            readTime: '6 min read',
            timestamp: '3 days ago',
            tags: ['Mindfulness', 'Wellbeing'],
            icon: 'fa-brain',
            iconColor: 'bg-purple-100 text-purple-600'
        },
        {
            id: 4,
            category: 'sleep',
            title: 'Improve Your Sleep Quality',
            content: 'Create a consistent sleep schedule, avoid screens before bedtime, and ensure your bedroom is dark and cool. These habits can significantly improve sleep quality and overall health.',
            readTime: '4 min read',
            timestamp: '5 days ago',
            tags: ['Rest', 'Recovery'],
            icon: 'fa-moon',
            iconColor: 'bg-indigo-100 text-indigo-600'
        },
        {
            id: 5,
            category: 'prevention',
            title: 'Boosting Your Immune System',
            content: 'Maintain a healthy lifestyle with balanced nutrition, regular exercise, adequate sleep, and stress management. These factors work together to strengthen your immune system naturally.',
            readTime: '8 min read',
            timestamp: '2 weeks ago',
            tags: ['Immunity', 'Prevention'],
            icon: 'fa-shield-virus',
            iconColor: 'bg-red-100 text-red-600'
        },
        {
            id: 6,
            category: 'nutrition',
            title: 'Heart-Healthy Foods',
            content: 'Incorporate omega-3 rich foods like salmon, walnuts, and flaxseeds into your diet. These foods help reduce inflammation and support cardiovascular health when consumed regularly.',
            readTime: '5 min read',
            timestamp: '4 days ago',
            tags: ['Heart Health', 'Omega-3'],
            icon: 'fa-heart',
            iconColor: 'bg-amber-100 text-amber-600'
        }
    ];

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

    const filteredTips = tipsData.filter(tip => {
        const matchesSearch = tip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tip.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || tip.category === activeFilter;
        return matchesSearch && matchesFilter;
    });

    const userDisplayName = user?.fullName || user?.name || '';
    const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'User';

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
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/stats'); }}>
                            <i className="fa-solid fa-chart-line"></i>
                            Health Stats
                        </a>
                    </li>
                    <li>
                        <a href="#" className="active" onClick={(e) => e.preventDefault()}>
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
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
                    <div><br></br><br></br>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Health Tips</h1>
                        <p className="text-gray-600">Expert advice and recommendations for better health</p>
                    </div>
                    <div className="flex gap-3 mt-4 md:mt-0">
                        <button className="action-btn btn-outline-tips hover:bg-teal-50"><i className="fa-solid fa-bookmark mr-2"></i> Saved Tips</button>
                        <button className="action-btn btn-primary-tips bg-teal-600 text-white px-4 py-2 rounded-lg"><i className="fa-solid fa-plus mr-2"></i> New Tip</button>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="health-tips-section mb-8">
                    <div className="search-box relative mb-6">
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            placeholder="Search health tips..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="tips-filter flex flex-wrap gap-2">
                        {['all', 'nutrition', 'exercise', 'mental', 'prevention', 'sleep'].map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`filter-btn capitalize ${activeFilter === filter ? 'active' : ''}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Featured Tip */}
                <div className="featured-tip relative overflow-hidden p-8 rounded-2xl mb-8 bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-xl">
                    <div className="relative z-10">
                        <div className="text-xs font-bold opacity-75 mb-2 tracking-widest uppercase">FEATURED • NUTRITION</div>
                        <h2 className="text-2xl font-bold mb-4">The Power of Hydration: Why Water Matters</h2>
                        <p className="text-teal-50 opacity-90 mb-6 max-w-2xl text-lg">
                            Staying properly hydrated is crucial for maintaining optimal body function. Water helps regulate body temperature, lubricate joints, transport nutrients, and flush out waste products. Aim for 8-10 glasses daily.
                        </p>
                        <div className="health-score bg-white/20 inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm">
                            <i className="fa-solid fa-star text-yellow-300"></i>
                            <span className="font-bold">9.2</span>
                            <span className="text-sm opacity-90 underline decoration-white/30">Health Impact Score</span>
                        </div>
                    </div>
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                {/* Grid */}
                <div>
                    <h3 className="text-xl font-bold text-gray-700 mb-6 pb-2 border-b-2 border-teal-500 w-fit">Latest Health Tips</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {filteredTips.map(tip => (
                            <div key={tip.id} className="tip-card p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                <div className={`tip-icon ${tip.iconColor} p-4 w-fit rounded-xl mb-4 text-2xl`}>
                                    <i className={`fa-solid ${tip.icon}`}></i>
                                </div>
                                <div className="text-teal-600 font-bold text-xs tracking-widest uppercase mb-1">{tip.category}</div>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">{tip.title}</h3>
                                <p className="text-gray-600 text-sm leading-relaxed mb-6">{tip.content}</p>

                                <div className="flex items-center gap-4 text-xs text-gray-400 mb-6">
                                    <span className="flex items-center gap-1"><i className="fa-solid fa-clock"></i> {tip.readTime}</span>
                                    <span className="flex items-center gap-1"><i className="fa-solid fa-calendar"></i> {tip.timestamp}</span>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {tip.tags.map(tag => (
                                        <span key={tag} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[10px] font-bold uppercase">{tag}</span>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <button className="flex-1 py-2 border border-teal-600 text-teal-600 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors">
                                        <i className="fa-solid fa-bookmark mr-2"></i> Save
                                    </button>
                                    <button className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20">
                                        <i className="fa-solid fa-share mr-2"></i> Share
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HealthTipsPage;
