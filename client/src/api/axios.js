import axios from 'axios';
import { toast } from 'react-hot-toast';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api',
    withCredentials: true,          // ← sends the refreshToken cookie on every request
    headers: { 'Content-Type': 'application/json' },
});

// ─── Request: attach Bearer token ────────────────────────────────────────────
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Refresh-token state machine ─────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue = [];          // requests waiting while refresh is in-flight

const processQueue = (error, token = null) => {
    pendingQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    pendingQueue = [];
};

/**
 * Called when both access token AND refresh token are dead.
 * Figures out where to redirect (super-admin vs patient login).
 */
const handleFullLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Decide redirect target based on where the user was
    const currentPath = window.location.pathname;
    const isAdminRoute = currentPath.startsWith('/super-admin') || currentPath.startsWith('/emergency');

    if (isAdminRoute) {
        // Just reload — the SuperAdminPage renders the login form itself when
        // isAuthenticated is false, so no separate redirect needed
        window.location.reload();
    } else if (currentPath !== '/login') {
        window.location.href = '/login';
    }
};

// ─── Response: handle 401 → refresh → retry ──────────────────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        // ── 429 Too Many Requests ─────────────────────────────────────────
        if (status === 429) {
            const msg = error.response?.data?.message || 'Too many requests. Please try again shortly.';
            error.message = msg;
            if (error.response.data) error.response.data.message = msg;
            return Promise.reject(error);
        }

        // ── 401 Unauthorized ─────────────────────────────────────────────
        // Don't retry the refresh-token call itself — that would loop forever
        if (status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh-token') {
            if (isRefreshing) {
                // Queue this request until the ongoing refresh finishes
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
                // The refresh cookie is sent automatically (withCredentials: true)
                const refreshResponse = await axiosInstance.post('/auth/refresh-token');
                const newToken = refreshResponse.data.data.accessToken;

                localStorage.setItem('token', newToken);
                axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                isRefreshing = false;

                // Retry the original request with the new token
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                isRefreshing = false;
                handleFullLogout();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
