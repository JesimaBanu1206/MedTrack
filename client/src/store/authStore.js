import { create } from 'zustand';
import axiosInstance from '../api/axios';
import { toast } from 'react-hot-toast';

/**
 * Checks if a stored JWT access token is still valid (not expired).
 * Does NOT verify the signature — that's the server's job.
 * This just prevents pointless API calls when we know the token is dead.
 */
const isTokenAlive = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is in seconds; give a 10-second buffer so we refresh proactively
        return payload.exp * 1000 > Date.now() + 10_000;
    } catch {
        return false;
    }
};

const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
})();

// ─── One-time cleanup: if the stored token is clearly expired, wipe it now
// so the page doesn't render as "authenticated" and immediately 401.
(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
})();

const useAuthStore = create((set, get) => ({
    user: storedUser,
    // Only mark as authenticated if we have a token AND it hasn't expired yet.
    // The axios interceptor will refresh it on the first 401 regardless.
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: false,
    error: null,

    setUser: (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData });
    },
    setIsAuthenticated: (status) => set({ isAuthenticated: status }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (err) => set({ error: err }),

    /* ── Patient Login ────────────────────────────────────────────── */
    login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.post('/auth/login', credentials);
            const { accessToken, user } = response.data.data;
            if (accessToken) {
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
                // NOTE: Don't clear other portal tokens — portals are independent sessions
            }
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            toast.success('Login successful!');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            toast.error(message);
            return false;
        }
    },

    /* ── Super Admin Login ────────────────────────────────────────── */
    superAdminLogin: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.post('/auth/super-admin/login', credentials);
            const { accessToken, user } = response.data.data;
            if (accessToken) {
                // Store in the dedicated super-admin key (used by axios for /super-admin routes)
                // AND in the generic key (used by isAuthenticated / page guard).
                // This way even if another role's login overwrites 'token' later,
                // the super-admin API calls still use the correct JWT.
                localStorage.setItem('superAdminToken', accessToken);
                localStorage.setItem('superAdminUser', JSON.stringify(user));
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
            }
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            toast.success('Access Granted. Welcome, Commander.');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Authentication failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            toast.error(message);
            return false;
        }
    },

    /* ── Emergency Driver Registration ───────────────────────────── */
    emergencyDriverRegister: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            await axiosInstance.post('/emergency-portal/register', payload);
            set({ isLoading: false, error: null });
            toast.success('Driver registration submitted. OTP sent to email.');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Emergency registration failed';
            set({ error: message, isLoading: false });
            toast.error(message);
            return false;
        }
    },

    /* ── Emergency Driver OTP Verify ─────────────────────────────── */
    emergencyDriverVerifyOTP: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            await axiosInstance.post('/emergency-portal/verify-otp', payload);
            set({ isLoading: false, error: null });
            toast.success('OTP verified. Wait for Super Admin approval.');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'OTP verification failed';
            set({ error: message, isLoading: false });
            toast.error(message);
            return false;
        }
    },

    /* ── Emergency Driver Login ───────────────────────────────────── */
    emergencyDriverLogin: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.post('/emergency-portal/login', payload);
            const { accessToken, user } = response.data.data;
            if (accessToken) {
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
            }
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            toast.success('Emergency portal login successful');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Emergency login failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            toast.error(message);
            return false;
        }
    },

    fetchEmergencyDriverProfile: async () => {
        try {
            const response = await axiosInstance.get('/emergency-portal/profile');
            return response.data.data;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch emergency profile');
            return null;
        }
    },

    updateEmergencyDriverLocation: async (payload) => {
        try {
            await axiosInstance.post('/emergency-portal/location', payload);
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Location update failed');
            return false;
        }
    },

    updateEmergencyDriverDutyStatus: async (payload) => {
        try {
            await axiosInstance.patch('/emergency-portal/duty-status', payload);
            toast.success('Duty status updated');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Duty status update failed');
            return false;
        }
    },

    submitEmergencyDriverSosNote: async (payload) => {
        try {
            await axiosInstance.post('/emergency-portal/sos-note', payload);
            toast.success('SOS note sent');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'SOS note failed');
            return false;
        }
    },

    logEmergencyDriverResponse: async (payload = {}) => {
        try {
            await axiosInstance.post('/emergency-portal/response-log', payload);
            toast.success('Response logged');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to log response');
            return false;
        }
    },

    fetchActiveAlerts: async () => {
        try {
            const response = await axiosInstance.get('/emergency-portal/alerts/active');
            return response.data.data || [];
        } catch (error) {
            console.error('Failed to fetch active alerts:', error);
            return [];
        }
    },

    updateAlertStatus: async (alertId, status) => {
        try {
            await axiosInstance.patch(`/emergency-portal/alerts/${alertId}/status`, { status });
            toast.success(`Mission updated: ${status.replace('_', ' ')}`);
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update mission status');
            return false;
        }
    },

    fetchMissions: async () => {
        try {
            const response = await axiosInstance.get('/emergency-portal/missions');
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch missions:', error);
            return null;
        }
    },

    /* ── Patient Registration ─────────────────────────────────────── */
    register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
            await axiosInstance.post('/auth/register', userData);
            set({ isLoading: false, error: null });
            toast.success('Registration successful! Please check your email for OTP.');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Registration failed';
            set({ error: message, isLoading: false });
            toast.error(message);
            return false;
        }
    },

    /* ── OTP Verify ───────────────────────────────────────────────── */
    verifyOTP: async (verifyData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.post('/auth/verify-otp', verifyData);
            const { accessToken, user } = response.data.data;
            if (accessToken) {
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
            }
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            toast.success('Account verified and logged in!');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Verification failed';
            set({ error: message, isLoading: false });
            toast.error(message);
            return false;
        }
    },

    /* ── Logout ───────────────────────────────────────────────────── */
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdminUser');
        set({ user: null, isAuthenticated: false, error: null });
        toast.success('Logged out successfully');
    },

    /* ── Fetch Patient Profile ────────────────────────────────────── */
    /* ── Hospital Admin Login ────────────────────────────────────────────────────── */
    hospitalAdminLogin: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.post('/hospital-admin/login', credentials);
            const { accessToken, user } = response.data.data;
            if (accessToken) {
                // Store in hospital-admin-specific key so other portals don't interfere
                localStorage.setItem('hospitalAdminToken', accessToken);
                localStorage.setItem('hospitalAdminUser', JSON.stringify(user));
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
                // NOTE: Don't clear other portal tokens — portals are independent sessions
            }
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            toast.success('Welcome, Hospital Admin!');
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            toast.error(message);
            return false;
        }
    },

    fetchProfile: async () => {
        try {
            const response = await axiosInstance.get('/patient/dashboard');
            const { patient } = response.data.data;
            const updatedUser = {
                ...(JSON.parse(localStorage.getItem('user')) || {}),
                fullName: patient.fullName,
                patientId: patient.patientId,
                dob: patient.dob,
                gender: patient.gender,
                bloodGroup: patient.bloodGroup,
                address: patient.address,
                guardianName: patient.guardianName,
                guardianPhone: patient.guardianPhone,
                emergencyContact: patient.emergencyContact,
                profilePictureUrl: patient.profilePictureUrl,
                pincode: patient.pincode,
                city: patient.city,
                state: patient.state
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            set({ user: updatedUser });
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    }
}));

export default useAuthStore;
