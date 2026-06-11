import axios from 'axios';
import { toast } from 'react-hot-toast';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

// ─── Request: attach correct token per portal ────────────────────────────────
axiosInstance.interceptors.request.use(
    (config) => {
        const url = config.url || '';

        let token;
        if (url.startsWith('/super-admin') || url.startsWith('/emergency/drivers') || url.startsWith('/ambulance')) {
            token = localStorage.getItem('superAdminToken');
        } else if (url.startsWith('/doctor')) {
            token = localStorage.getItem('doctorToken');
        } else if (url.startsWith('/hospital-admin')) {
            token = localStorage.getItem('hospitalAdminToken');
        } else if (url.startsWith('/receptionist')) {
            // Use receptionistToken, fallback to hospitalAdminToken
            token = localStorage.getItem('receptionistToken') || localStorage.getItem('hospitalAdminToken');
        } else if (url.startsWith('/district')) {
            token = localStorage.getItem('districtToken');
        } else if (url.startsWith('/nurse')) {
            token = localStorage.getItem('nurseToken') || localStorage.getItem('doctorToken');
        } else {
            token = localStorage.getItem('token');
        }

        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Refresh-token state machine ─────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
    pendingQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    pendingQueue = [];
};

const TOKEN_KEYS = [
    'token',
    'superAdminToken',
    'doctorToken',
    'hospitalAdminToken',
    'receptionistToken',
    'districtToken',
    'nurseToken',
    'pharmacyToken'
];

const clearStoredAuth = () => {
    TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('user');
    localStorage.removeItem('superAdminUser');
    localStorage.removeItem('doctorUser');
    localStorage.removeItem('hospitalAdminUser');
    localStorage.removeItem('receptionistUser');
    localStorage.removeItem('districtUser');
    localStorage.removeItem('nurseUser');
};

const inferPortalFromRequest = (url = '') => {
    const reqUrl = String(url || '');
    if (reqUrl.startsWith('/super-admin') || reqUrl.startsWith('/emergency') || reqUrl.startsWith('/ambulance')) return 'SUPER_ADMIN';
    if (reqUrl.startsWith('/hospital-admin')) return 'HOSPITAL_ADMIN';
    if (reqUrl.startsWith('/receptionist')) return 'RECEPTIONIST';
    if (reqUrl.startsWith('/district')) return 'DISTRICT_OFFICER';
    if (reqUrl.startsWith('/nurse')) return 'NURSE';
    if (reqUrl.startsWith('/doctor')) return 'DOCTOR';
    if (reqUrl.startsWith('/pharmacy')) return 'PHARMACIST';
    return null;
};

const inferPortalFromPath = () => {
    const path = window.location.pathname || '';
    if (path.startsWith('/super-admin')) return 'SUPER_ADMIN';
    if (path.startsWith('/hospital-admin')) return 'HOSPITAL_ADMIN';
    if (path.startsWith('/receptionist')) return 'RECEPTIONIST';
    if (path.startsWith('/district')) return 'DISTRICT_OFFICER';
    if (path.startsWith('/nurse')) return 'NURSE';
    if (path.startsWith('/doctor')) return 'DOCTOR';
    if (path.startsWith('/pharmacy')) return 'PHARMACIST';
    return null;
};

const persistRefreshedToken = (newToken, requestUrl = '') => {
    if (!newToken) return;
    localStorage.setItem('token', newToken);
    const portal = inferPortalFromRequest(requestUrl) || inferPortalFromPath();
    if (portal === 'SUPER_ADMIN') localStorage.setItem('superAdminToken', newToken);
    if (portal === 'DOCTOR') localStorage.setItem('doctorToken', newToken);
    if (portal === 'HOSPITAL_ADMIN') localStorage.setItem('hospitalAdminToken', newToken);
    if (portal === 'RECEPTIONIST') localStorage.setItem('receptionistToken', newToken);
    if (portal === 'DISTRICT_OFFICER') localStorage.setItem('districtToken', newToken);
    if (portal === 'NURSE') localStorage.setItem('nurseToken', newToken);
    if (portal === 'PHARMACIST') localStorage.setItem('pharmacyToken', newToken);
};

const handleFullLogout = () => {
    const currentPath = window.location.pathname;
    const isSuperAdmin = currentPath.includes('super-admin');
    clearStoredAuth();
    window.location.href = isSuperAdmin ? '/super-admin' : '/login';
};

// ─── Response: handle 401 / 403 ──────────────────────────────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config;

        if (!originalRequest) return Promise.reject(error);

        // ── 401: try token refresh ────────────────────────────────────────
        if (status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh-token') {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingQueue.push({ resolve, reject });
                }).then((newToken) => {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return axiosInstance(originalRequest);
                }).catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshResponse = await axiosInstance.post('/auth/refresh-token');
                const newToken = refreshResponse.data.data.accessToken;
                persistRefreshedToken(newToken, originalRequest.url);
                axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;
                processQueue(null, newToken);
                isRefreshing = false;
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                isRefreshing = false;
                handleFullLogout();
                return Promise.reject(refreshError);
            }
        }

        // ── 403: clear only the relevant portal token ─────────────────────
        if (status === 403 && !originalRequest?._forbiddenHandled) {
            const reqUrl = originalRequest?.url || '';
            originalRequest._forbiddenHandled = true;
            if (reqUrl.startsWith('/hospital-admin')) {
                localStorage.removeItem('hospitalAdminToken');
                localStorage.removeItem('hospitalAdminUser');
                toast.error('Hospital admin session expired. Please login again.');
                if (window.location.pathname.startsWith('/hospital-admin')) window.location.reload();
            } else if (reqUrl.startsWith('/receptionist')) {
                localStorage.removeItem('receptionistToken');
                localStorage.removeItem('receptionistUser');
                toast.error('Session expired. Please login again.');
                if (window.location.pathname.startsWith('/receptionist')) window.location.reload();
            } else if (reqUrl.startsWith('/district')) {
                localStorage.removeItem('districtToken');
                localStorage.removeItem('districtUser');
                toast.error('District officer session expired.');
                if (window.location.pathname.startsWith('/district')) window.location.reload();
            } else if (reqUrl.startsWith('/doctor')) {
                localStorage.removeItem('doctorToken');
                localStorage.removeItem('doctorUser');
                if (window.location.pathname.startsWith('/doctor') || window.location.pathname.startsWith('/nurse')) window.location.reload();
            } else if (reqUrl.startsWith('/super-admin')) {
                localStorage.removeItem('superAdminToken');
                localStorage.removeItem('superAdminUser');
                toast.error('Super admin session expired. Please login again.');
                if (window.location.pathname.startsWith('/super-admin')) window.location.reload();
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
