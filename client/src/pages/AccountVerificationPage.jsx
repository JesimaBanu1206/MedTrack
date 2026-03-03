
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import AuthLayout from '../components/AuthLayout';

const AccountVerificationPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { verifyOTP, isLoading, error } = useAuthStore();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef([]);

    // Get phone/email from state (passed from register page)
    const phone = location.state?.phone || "";
    const email = location.state?.email || "";

    useEffect(() => {
        if (!phone && !error) {
            navigate('/register');
        }
    }, [phone, navigate, error]);

    const handleChange = (index, value) => {
        if (isNaN(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Move to next input
        if (value !== '' && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length !== 6) return;

        const success = await verifyOTP({ phone, otp: otpString });
        if (success) {
            navigate('/dashboard');
        }
    };

    return (
        <AuthLayout mode="signup">
            <div className="text-center mb-8">
                <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                    <i className="fas fa-envelope-open-text text-2xl text-[#0d47a1]"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Verify Your Email</h3>
                <p className="text-gray-500 text-sm mt-3 px-4">
                    We've sent a 6-digit confirmation code to your email: <br />
                    <span className="text-[#0d47a1] font-bold break-all">{email || 'your email'}</span>
                </p>
                <p className="text-gray-400 text-[11px] mt-2 italic">
                    Registered Phone: +91 {phone}
                </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-8">
                <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => (inputRefs.current[index] = el)}
                            type="text"
                            maxLength="1"
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-11 h-11 text-center font-bold text-xl bg-gray-50 border border-gray-200 rounded-xl focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                        />
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 animate-shake">
                        <i className="fas fa-times-circle text-lg"></i>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 6}
                    className="w-full bg-gradient-to-r from-[#0d47a1] to-[#1976d2] hover:from-[#1565c0] hover:to-[#1e88e5] text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-[0_10px_20px_rgba(13,71,161,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <span>Verify Code</span>
                            <i className="fas fa-check-circle text-sm opacity-60"></i>
                        </>
                    )}
                </button>

                <div className="text-center pt-2">
                    <button type="button" className="text-sm font-bold text-[#0d47a1] hover:underline">
                        Resend OTP Code
                    </button>
                    <p className="text-[10px] text-gray-400 mt-4 leading-relaxed px-4">
                        Didn't receive the code? Please check your messages or try again in 60 seconds.
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
};

export default AccountVerificationPage;
