
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';
import AuthLayout from '../components/AuthLayout';

const RegisterPage = () => {
    const navigate = useNavigate();
    const { register, handleSubmit, watch, formState: { errors } } = useForm();
    const { register: registerUser, isLoading, error } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const onSubmit = async (data) => {
        const success = await registerUser(data);
        if (success) {
            navigate('/verify-email', { state: { phone: data.phone, email: data.email } });
        }
    };

    const password = watch('password', '');

    return (
        <AuthLayout mode="signup">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Full Name Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0d47a1] transition-colors border-r border-gray-200 pr-3.5">
                            <i className="fas fa-user"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="John Doe"
                            {...register('fullName', { required: 'Full Name is required' })}
                            className="w-full pl-14 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                        />
                    </div>
                    {errors.fullName && (
                        <p className="text-red-500 text-xs font-semibold mt-1 ml-2 flex items-center gap-1">
                            <i className="fas fa-exclamation-circle text-[10px]"></i>
                            {errors.fullName.message}
                        </p>
                    )}
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Email ID</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0d47a1] transition-colors border-r border-gray-200 pr-3.5">
                            <i className="fas fa-envelope"></i>
                        </div>
                        <input
                            type="email"
                            placeholder="john@example.com"
                            {...register('email', {
                                required: 'Email is required',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: "Invalid email address"
                                }
                            })}
                            className="w-full pl-14 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                        />
                    </div>
                    {errors.email && (
                        <p className="text-red-500 text-xs font-semibold mt-1 ml-2 flex items-center gap-1">
                            <i className="fas fa-exclamation-circle text-[10px]"></i>
                            {errors.email.message}
                        </p>
                    )}
                </div>

                {/* Phone Number Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Phone Number</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400 group-focus-within:text-[#0d47a1] transition-colors border-r border-gray-200 pr-3">
                            <img
                                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAKCAYAAAC9Y9beAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3goXFBAu5mS6mAAAALFJREFUKM9jZEACDAwMDCzMTExoIn9+fP3P8P8/AyXm/Gf4/5+BQYSRkRHmYmIsTEyyDAwM0gyYIn//MshA9TMyMsyFqQOpy/DfPwNDIsN/P1AdTFA9TIxEWMzExCSDJm5mZmb6/58BSVxsYWFhYGBgEGVkZGRkZGRm+v8fKjYwMDCwMDAwsrCwsPyHqgW6mInpP1Q8Q/8fSizYIAsLCwvID7///SMLMjEzk2UoA70AAMbPKrNoBfP4AAAAAElFTkSuQmCC"
                                alt="India Flag"
                                className="w-5 h-auto object-cover rounded-sm"
                            />
                            <span className="font-bold text-sm">+91</span>
                        </div>
                        <input
                            type="tel"
                            placeholder="98765 43210"
                            {...register('phone', {
                                required: 'Phone number is required',
                                pattern: {
                                    value: /^[0-9]{10}$/,
                                    message: "Enter 10-digit number"
                                }
                            })}
                            className="w-full pl-[95px] pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                        />
                    </div>
                    {errors.phone && (
                        <p className="text-red-500 text-xs font-semibold mt-1 ml-2 flex items-center gap-1">
                            <i className="fas fa-exclamation-circle text-[10px]"></i>
                            {errors.phone.message}
                        </p>
                    )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Create Password</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0d47a1] transition-colors border-r border-gray-200 pr-3.5">
                            <i className="fas fa-lock"></i>
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...register('password', {
                                required: 'Password is required',
                                minLength: { value: 6, message: 'Minimum 6 characters' }
                            })}
                            className="w-full pl-14 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-red-500 text-xs font-semibold mt-1 ml-2 flex items-center gap-1">
                            <i className="fas fa-exclamation-circle text-[10px]"></i>
                            {errors.password.message}
                        </p>
                    )}
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Confirm Password</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0d47a1] transition-colors border-r border-gray-200 pr-3.5">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...register('confirmPassword', {
                                required: 'Confirm your password',
                                validate: value => value === password || "Passwords do not match"
                            })}
                            className="w-full pl-14 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#0d47a1] focus:ring-4 focus:ring-blue-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                        >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-red-500 text-xs font-semibold mt-1 ml-2 flex items-center gap-1">
                            <i className="fas fa-exclamation-circle text-[10px]"></i>
                            {errors.confirmPassword.message}
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 animate-shake">
                        <i className="fas fa-times-circle text-lg"></i>
                        {error}
                    </div>
                )}

                {/* Signup Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#0d47a1] to-[#1976d2] hover:from-[#1565c0] hover:to-[#1e88e5] text-white font-bold py-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] shadow-[0_10px_20px_rgba(13,71,161,0.2)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Creating Account...</span>
                        </>
                    ) : (
                        <>
                            <span>Create Your Account</span>
                            <i className="fas fa-user-plus text-sm opacity-60"></i>
                        </>
                    )}
                </button>

                <div className="pt-2 text-center">
                    <p className="text-gray-400 text-[10px] leading-relaxed">
                        By signing up, you agree to our <a href="#" className="font-bold text-gray-500">Terms of Service</a> and <a href="#" className="font-bold text-gray-500">Privacy Policy</a>
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
};

export default RegisterPage;
