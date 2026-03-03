
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const AuthLayout = ({ children, mode }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d47a1] via-[#1565c0] to-[#1976d2] flex flex-col font-sans">
            <Navbar />
<br></br><br></br><br></br>
            <div className="flex-1 flex justify-center p-4 pt-52 pb-20">
                <div className="bg-white/95 backdrop-blur-sm rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-[440px] h-fit overflow-hidden border border-white/20">
                    <div className="bg-gradient-to-r from-[#0d47a1] to-[#1976d2] py-8 px-4 text-center">
                        <h2 className="text-3xl font-bold text-white tracking-tight">
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-blue-100/80 text-sm mt-2 font-medium">
                            {mode === 'login'
                                ? 'Please enter your details to continue'
                                : 'Join our healthcare community today'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-2 bg-gray-50/50">
                        <button
                            onClick={() => navigate('/login')}
                            className={`flex-1 py-3.5 text-center font-bold text-base rounded-2xl transition-all duration-300
                                ${mode === 'login'
                                    ? 'bg-white text-[#0d47a1] shadow-md scale-100'
                                    : 'text-gray-400 hover:text-gray-600 scale-95'
                                }`}
                        >
                            <i className="fas fa-sign-in-alt mt-1 mr-2"></i>
                            Login
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className={`flex-1 py-3.5 text-center font-bold text-base rounded-2xl transition-all duration-300
                                ${mode === 'signup'
                                    ? 'bg-white text-[#0d47a1] shadow-md scale-100'
                                    : 'text-gray-400 hover:text-gray-600 scale-95'
                                }`}
                        >
                            <i className="fas fa-user-plus mt-1 mr-2"></i>
                            Signup
                        </button>
                    </div>

                    <div className="p-8 pt-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
