import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import './SuperAdminPage.css';
import 'animate.css';

const EmergencyDriverLoginPage = () => {
    const navigate = useNavigate();
    const { emergencyDriverLogin, isLoading, error } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const ok = await emergencyDriverLogin({ username, password });
        if (ok) {
            navigate('/emergency/portal');
        }
    };

    return (
        <div className="min-h-screen login-bg flex flex-col items-center justify-center p-4 font-outfit">
            <div className="login-blur-1"></div>
            <div className="login-blur-2"></div>

            {/* Login Container */}
            <div className="w-full max-w-[480px] z-10 animate__animated animate__fadeIn">
                <div className="glass-card p-10 md:p-14">
                    <div className="text-center mb-10">
                        <div className="portal-icon-container bg-gradient-to-br from-red-600 to-orange-600">
                            <i className="fa-solid fa-truck-medical"></i>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Emergency Portal</h1>
                        <p className="text-slate-500 font-bold text-sm italic">Driver Access Only • TN 108 Service</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-2">
                            <label className="input-label ml-1">Phone or Email</label>
                            <div className="auth-input-container">
                                <i className="fa-solid fa-id-card"></i>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter Credentials"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="auth-input"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="input-label input-label-alt ml-1">Secure Password</label>
                            <div className="auth-input-container">
                                <i className="fa-solid fa-lock"></i>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="auth-input"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="bg-red-900/10 border border-red-900/20 p-4 rounded-xl mb-4">
                            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest text-center">
                                Login allowed only after super admin approval
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-900/30 rounded-xl text-red-400 text-xs font-bold text-center animate__animated animate__shakeX">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary-gradient !bg-gradient-to-r !from-red-600 !to-orange-600 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <i className="fa-solid fa-circle-notch animate-spin text-2xl"></i>
                            ) : (
                                <>
                                    <i className="fa-solid fa-right-to-bracket text-xl"></i>
                                    <span>Secure Login</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            New driver? <Link className="text-red-400 hover:text-red-300 font-bold transition-colors" to="/emergency/register">Register Service</Link>
                        </p>
                    </div>

                    <div className="mt-14 pb-2">
                        <p className="footer-text font-black uppercase">PARTNER V2.1 © 108 SERVICES</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmergencyDriverLoginPage;

