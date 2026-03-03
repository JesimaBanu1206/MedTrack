import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import './SuperAdminPage.css';
import 'animate.css';

const initialForm = {
    driverName: '',
    licenseNumber: '',
    phone: '',
    email: '',
    district: '',
    password: '',
    confirmPassword: ''
};

const EmergencyDriverRegisterPage = () => {
    const navigate = useNavigate();
    const { emergencyDriverRegister, emergencyDriverVerifyOTP, isLoading, error } = useAuthStore();
    const [formData, setFormData] = useState(initialForm);
    const [otp, setOtp] = useState('');
    const [showOtpStep, setShowOtpStep] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [licenseImage, setLicenseImage] = useState(null);
    const [profileImage, setProfileImage] = useState(null);


    const onChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return;
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            data.append(key, formData[key]);
        });
        if (licenseImage) data.append('licenseImage', licenseImage);
        if (profileImage) data.append('profileImage', profileImage);

        const ok = await emergencyDriverRegister(data);
        if (ok) {
            setShowOtpStep(true);
        }

    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const ok = await emergencyDriverVerifyOTP({
            phone: formData.phone,
            otp
        });
        if (ok) {
            navigate('/emergency/login');
        }
    };

    return (
        <div className="login-bg font-inter py-12 px-4">
            <div className="login-blur-1"></div>
            <div className="login-blur-2"></div>

            <div className="w-full max-w-[700px] z-10 animate__animated animate__fadeIn">
                <div className="login-card-premium !max-w-none">
                    <div className="text-center mb-10">
                        <div className="portal-icon-container bg-gradient-to-br from-red-600 to-orange-600">
                            <i className="fa-solid fa-file-signature"></i>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Driver Integration</h1>
                        <p className="text-slate-500 font-bold text-sm italic uppercase tracking-widest">Apply for TN 108 Emergency Network</p>
                    </div>

                    {!showOtpStep ? (
                        <form className="space-y-8" onSubmit={handleRegister}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput
                                    label="Full Name"
                                    name="driverName"
                                    icon="fa-user"
                                    placeholder="Enter Name"
                                    value={formData.driverName}
                                    onChange={onChange}
                                />
                                <FormInput
                                    label="License Number"
                                    name="licenseNumber"
                                    icon="fa-id-card"
                                    placeholder="DL-XXXXXX"
                                    value={formData.licenseNumber}
                                    onChange={onChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput
                                    label="Mobile Link"
                                    name="phone"
                                    icon="fa-phone"
                                    placeholder="Contact No"
                                    value={formData.phone}
                                    onChange={onChange}
                                />
                                <FormInput
                                    label="Official Email"
                                    name="email"
                                    type="email"
                                    icon="fa-envelope"
                                    placeholder="email@service.gov"
                                    value={formData.email}
                                    onChange={onChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="input-label ml-1">Assigned Jurisdiction</label>
                                <div className="auth-input-container">
                                    <i className="fa-solid fa-map-location-dot"></i>
                                    <select
                                        name="district"
                                        className="auth-input !appearance-none"
                                        value={formData.district}
                                        onChange={onChange}
                                        required
                                    >
                                        <option value="">Select Working District</option>
                                        <option value="Chennai">Chennai</option>
                                        <option value="Madurai">Madurai</option>
                                        <option value="Coimbatore">Coimbatore</option>
                                        <option value="Salem">Salem</option>
                                        <option value="Trichy">Trichy</option>
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-5 text-[10px]"></i>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput
                                    label="Access Key"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    icon="fa-lock"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={onChange}
                                />
                                <FormInput
                                    label="Verify Key"
                                    name="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    icon="fa-shield-check"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={onChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="input-label ml-1">Driver Profile Photo</label>
                                    <div className="auth-input-container !h-auto py-3">
                                        <i className="fa-solid fa-camera-retro"></i>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setProfileImage(e.target.files[0])}
                                            className="auth-input !bg-transparent text-xs"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">Clear face photo for verification</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="input-label ml-1">Driving License Scan</label>
                                    <div className="auth-input-container !h-auto py-3">
                                        <i className="fa-solid fa-id-badge"></i>
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(e) => setLicenseImage(e.target.files[0])}
                                            className="auth-input !bg-transparent text-xs"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">Official RTO License copy</p>
                                </div>
                            </div>


                            <div className="flex items-center gap-2 px-2">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    className="w-4 h-4 rounded border-white/5 bg-slate-900"
                                    required
                                />
                                <label htmlFor="terms" className="text-xs text-slate-500 font-medium cursor-pointer">
                                    I agree to the <span className="text-red-400 font-bold">108 Emergency Protocol</span> and data sharing terms.
                                </label>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-900/10 border border-red-900/20 rounded-2xl text-red-400 text-xs font-bold text-center animate__animated animate__headShake">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={isLoading} className="w-full btn-primary-gradient !bg-gradient-to-r !from-red-600 !to-orange-600 flex items-center justify-center gap-3 disabled:opacity-50">
                                {isLoading ? (
                                    <i className="fa-solid fa-circle-notch animate-spin text-2xl"></i>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-file-export text-xl"></i>
                                        <span>Submit Application & Verify</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-8 animate__animated animate__fadeInRight">
                            <div className="text-center p-6 bg-emerald-600/5 rounded-3xl border border-emerald-500/20">
                                <p className="text-sm text-slate-400 font-medium mb-1">Verification code sent to</p>
                                <p className="text-xl font-black text-white">{formData.phone}</p>
                            </div>

                            <form className="space-y-6" onSubmit={handleVerifyOtp}>
                                <div className="space-y-4">
                                    <label className="input-label text-center block">Enter Security OTP</label>
                                    <div className="auth-input-container">
                                        <i className="fa-solid fa-key-skeleton text-emerald-500"></i>
                                        <input
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            placeholder="XXXXXX"
                                            className="auth-input !pl-14 text-center tracking-[1em] font-black text-2xl"
                                            maxLength={6}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-900/10 border border-red-900/20 rounded-2xl text-red-400 text-xs font-bold text-center">
                                        {error}
                                    </div>
                                )}

                                <button type="submit" disabled={isLoading} className="w-full btn-primary-gradient !bg-gradient-to-r !from-emerald-600 !to-teal-600 flex items-center justify-center gap-3 disabled:opacity-50">
                                    {isLoading ? (
                                        <i className="fa-solid fa-circle-notch animate-spin text-2xl"></i>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-shield-circle-check text-xl"></i>
                                            <span>Authorize Identity</span>
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-[10px] text-slate-600 font-black uppercase tracking-widest cursor-pointer hover:text-slate-400 transition-colors">
                                    Resend Secret Token
                                </p>
                            </form>
                        </div>
                    )}

                    <div className="mt-10 text-center border-t border-white/5 pt-8">
                        <p className="text-slate-500 text-sm font-medium">
                            Already in system? <Link className="text-red-400 hover:text-red-300 font-bold transition-colors" to="/emergency/login">Go to Terminal Access</Link>
                        </p>
                    </div>
                </div>

                <p className="footer-text mt-12 font-black uppercase">PARTNER PORTAL v2.1.0-ALPHA</p>
            </div>
        </div>
    );
};

const FormInput = ({ label, icon, ...props }) => (
    <div className="space-y-2">
        <label className="input-label ml-1">{label}</label>
        <div className="auth-input-container">
            <i className={`fa-solid ${icon}`}></i>
            <input {...props} className="auth-input" required />
        </div>
    </div>
);

export default EmergencyDriverRegisterPage;


