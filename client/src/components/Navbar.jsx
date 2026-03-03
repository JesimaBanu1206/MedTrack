
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user, logout } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown-container')) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileDropdownOpen]);

    const handleBookClick = () => {
        if (location.pathname === '/') {
            const element = document.getElementById('book');
            element?.scrollIntoView({ behavior: 'smooth' });
        } else {
            navigate('/');
            setTimeout(() => {
                const element = document.getElementById('book');
                element?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
        setIsMenuOpen(false);
    };

    return (
        <>
            <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 py-3 px-6 md:px-12 flex justify-between items-center text-white transition-all duration-300 w-[95%] md:w-[90%] lg:w-[85%] rounded-2xl ${isScrolled ? 'bg-[#0d47a1]/90 backdrop-blur-lg shadow-2xl py-2 border border-white/20' : 'bg-[#0d47a1] shadow-xl'}`}>
                {/* Logo */}
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => { navigate('/'); setIsMenuOpen(false); }}
                >
                    <div className="bg-[#22c55e] p-2 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <i className="fas fa-heartbeat text-white text-xl"></i>
                    </div>
                    <span className="text-2xl font-bold tracking-tight">HealthCare<span className="text-white">+</span></span>
                </div>

                {/* Desktop Navigation / Buttons */}
                <div className="hidden lg:flex items-center gap-4">
                    <button
                        onClick={() => navigate('/virtual-consult')}
                        className="bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] hover:from-[#0284c7] hover:to-[#1d4ed8] text-white px-6 py-2.5 rounded-full font-semibold transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95"
                    >
                        <i className="fas fa-video"></i>
                        Virtual Consulting
                    </button>
                    <button
                        onClick={handleBookClick}
                        className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white px-6 py-2.5 rounded-full font-semibold transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95"
                    >
                        <i className="fas fa-calendar-alt"></i>
                        Book Appointment
                    </button>

                    {isAuthenticated ? (
                        <div className="relative profile-dropdown-container ml-2">
                            <div className="flex items-center bg-white/10 border border-white/20 rounded-full transition-all overflow-hidden">
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="flex items-center gap-3 hover:bg-white/10 px-4 py-2 transition-all border-r border-white/10"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22c55e] to-[#0ea5e9] flex items-center justify-center font-bold text-sm shadow-inner group-hover/profile:scale-110 transition-transform">
                                        {(user?.fullName || user?.name || 'U').charAt(0)}
                                    </div>
                                    <span className="font-medium text-sm">{user?.fullName || user?.name || 'User'}</span>
                                </button>
                                <button
                                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                    className="px-3 py-3 hover:bg-white/10 transition-all"
                                >
                                    <i className={`fas fa-chevron-down text-[10px] opacity-70 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`}></i>
                                </button>
                            </div>

                            {/* Dropdown Menu */}
                            <div className={`absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl py-2 text-gray-800 transition-all transform origin-top-right border border-gray-100 ${isProfileDropdownOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
                                <div className="px-4 py-3 border-b border-gray-50 mb-1">
                                    <p className="text-sm font-semibold truncate">{user?.fullName || user?.name || 'User'}</p>
                                    <p className="text-xs text-gray-400 truncate">{user?.email || user?.phone}</p>
                                </div>
                                <button onClick={() => { navigate('/dashboard'); setIsProfileDropdownOpen(false); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center gap-3">
                                    <i className="fas fa-th-large text-blue-500 w-5"></i> Dashboard
                                </button>
                                <button onClick={() => { navigate('/profile'); setIsProfileDropdownOpen(false); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center gap-3">
                                    <i className="fas fa-user text-blue-500 w-5"></i> Profile
                                </button>
                                <hr className="my-1 border-gray-50" />
                                {user?.role === 'SUPER_ADMIN' && (
                                    <button onClick={() => { navigate('/super-admin'); setIsProfileDropdownOpen(false); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-purple-50 text-purple-600 transition-colors flex items-center gap-3 font-medium">
                                        <i className="fas fa-user-shield w-5"></i> Admin Panel
                                    </button>
                                )}
                                <button onClick={() => { logout(); setIsProfileDropdownOpen(false); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-3 font-medium">
                                    <i className="fas fa-sign-out-alt w-5"></i> Logout
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/emergency/login')}
                                className="hidden xl:flex items-center gap-2 bg-blue-900/40 hover:bg-blue-900/60 text-white/70 hover:text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all border border-white/5"
                            >
                                <i className="fas fa-truck-medical text-red-500"></i>
                                Partner Portal
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-2.5 rounded-full font-semibold transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95"
                            >
                                <i className="fas fa-sign-in-alt"></i>
                                Login / Signup
                            </button>
                        </div>
                    )}

                </div>

                {/* Mobile Menu Toggle */}
                <div className="lg:hidden">
                    <button
                        className="text-white p-2 focus:outline-none"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-2xl`}></i>
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Backdrop */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed top-0 right-0 h-full w-[280px] bg-[#0d47a1] z-[60] shadow-2xl transition-transform duration-300 lg:hidden ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full p-6">
                    <div className="flex justify-end mb-8">
                        <button onClick={() => setIsMenuOpen(false)} className="text-white/60 hover:text-white">
                            <i className="fas fa-times text-2xl"></i>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={() => { navigate('/virtual-consult'); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-4 text-white text-lg font-medium p-3 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <i className="fas fa-video w-8 text-blue-400"></i>
                            Virtual Consulting
                        </button>
                        <button
                            onClick={handleBookClick}
                            className="w-full flex items-center gap-4 text-white text-lg font-medium p-3 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <i className="fas fa-calendar-alt w-8 text-green-400"></i>
                            Book Appointment
                        </button>

                        <div className="pt-4 border-t border-white/10">
                            {isAuthenticated ? (
                                <>
                                    <div className="flex items-center gap-3 p-3 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22c55e] to-[#0ea5e9] flex items-center justify-center font-bold text-white shadow-lg">
                                            {(user?.fullName || user?.name || 'U').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold truncate max-w-[150px]">{user?.fullName || user?.name || 'User'}</p>
                                            <p className="text-white/50 text-xs truncate max-w-[150px]">{user?.phone || user?.email}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-3 text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-4">
                                        <i className="fas fa-th-large w-8 text-blue-400"></i> Dashboard
                                    </button>
                                    <button onClick={() => { navigate('/profile'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-3 text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-4">
                                        <i className="fas fa-user w-8 text-blue-400"></i> Profile
                                    </button>
                                    <button onClick={() => { logout(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors flex items-center gap-4 font-semibold mt-4">
                                        <i className="fas fa-sign-out-alt w-8"></i> Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { navigate('/emergency/login'); setIsMenuOpen(false); }}
                                        className="w-full bg-blue-900/40 text-white/70 py-4 rounded-2xl font-bold text-lg border border-white/5 shadow-lg hover:bg-blue-900/60 transition-all flex items-center justify-center gap-3 mb-3"
                                    >
                                        <i className="fas fa-truck-medical text-red-500"></i>
                                        Partner Portal
                                    </button>
                                    <button
                                        onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                                        className="w-full bg-white text-[#0d47a1] py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-3"
                                    >
                                        <i className="fas fa-sign-in-alt"></i>
                                        Login / Signup
                                    </button>
                                </>


                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Navbar;
