import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import GHPHCPage from './GHPHCPage';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import axiosInstance from '../api/axios';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import './SuperAdminPage.css';
import 'animate.css';
import DistrictOfficerManager from "./DistrictOfficerManager";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

/* ─────────────────────────────────────────────────────
   MONGODB-STYLE SIDEBAR
───────────────────────────────────────────────────── */
const MongoSidebar = ({ currentPage, setCurrentPage, authUser, pendingCount, handleLogout }) => {
    const [expanded, setExpanded] = useState(false);
    const timerRef = useRef(null);

    const enter = () => {
        clearTimeout(timerRef.current);
        setExpanded(true);
    };
    const leave = () => {
        timerRef.current = setTimeout(() => setExpanded(false), 180);
    };

    const navItems = [
        { section: 'State Overview', items: [
            { id: 'DASHBOARD', icon: 'fa-gauge-high', label: 'Dashboard' },
            { id: 'BED',       icon: 'fa-bed-pulse',   label: 'Bed Availability' },
        ]},
        { section: 'Govt Schemes', items: [
            { id: 'CMCHIS',  icon: 'fa-hand-holding-medical', label: 'CMCHIS Claims', disabled: true },
            { id: 'MTM',     icon: 'fa-user-nurse',           label: 'Makkal Thedi Maruthuvam', disabled: true },
        ]},
        { section: 'Network Partners', items: [
            { id: 'GH',        icon: 'fa-hospital',     label: 'GH & PHC Centers' },
            { id: 'AMBULANCE', icon: 'fa-truck-medical', label: '108 Ambulance', badge: pendingCount > 0 ? pendingCount : null },
        ]},
        { section: 'Administration', items: [
            { id: 'DISTRICT_OFFICERS', icon: 'fa-user-shield', label: 'District Officers' },
            { id: 'SETTINGS', icon: 'fa-sliders', label: 'System Settings' },
        ]},
    ];

    return (
        <aside
            className="mongo-sidebar"
            data-expanded={expanded}
            onMouseEnter={enter}
            onMouseLeave={leave}
        >
            {/* Logo */}
            <div className="mongo-sidebar-logo">
                <div className="mongo-logo-icon">
                    <i className="fa-solid fa-heart-pulse text-white text-sm"></i>
                </div>
                <span className="mongo-nav-label text-white font-bold text-base">
                    TN<span className="text-blue-400">Health</span>
                </span>
            </div>

            {/* Nav */}
            <nav className="mongo-sidebar-nav custom-scrollbar">
                {navItems.map(({ section, items }) => (
                    <div key={section} className="mongo-nav-section">
                        <div className="mongo-section-label">{section}</div>
                        {items.map(({ id, icon, label, badge, disabled }) => (
                            <div
                                key={id}
                                className={`mongo-nav-item ${currentPage === id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                onClick={() => !disabled && setCurrentPage(id)}
                            >
                                <div className="mongo-nav-icon">
                                    <i className={`fa-solid ${icon}`}></i>
                                    {badge && <span className="mongo-badge">{badge}</span>}
                                </div>
                                <span className="mongo-nav-label">{label}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Footer / Profile */}
            <div className="mongo-sidebar-footer">
                <div
                    className={`mongo-profile-item ${currentPage === 'SETTINGS' ? 'active' : ''}`}
                    onClick={() => setCurrentPage('SETTINGS')}
                >
                    <div className="mongo-profile-avatar">
                        {authUser?.username?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="mongo-profile-info mongo-nav-label">
                        <p className="text-sm font-bold text-white truncate leading-tight">{authUser?.username || 'admin'}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Super Admin</p>
                    </div>
                </div>
                <button
                    className="mongo-logout-btn"
                    onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                    title="Logout"
                >
                    <i className="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        </aside>
    );
};

/* ─────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
    const cfg = {
        PENDING:  { cls: 'bg-orange-500/10 border-orange-500/30 text-orange-400', icon: 'fa-clock',          label: 'Pending' },
        APPROVED: { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: 'fa-circle-check', label: 'Approved' },
        REJECTED: { cls: 'bg-red-500/10 border-red-500/30 text-red-400',           icon: 'fa-circle-xmark',  label: 'Rejected' },
    }[status] || { cls: 'bg-slate-800 border-white/5 text-slate-400', icon: 'fa-circle', label: status };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${cfg.cls}`}>
            <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
            {cfg.label}
        </span>
    );
};

/* ─────────────────────────────────────────────────────
   DRIVER REGISTRATION CARD  (Pending tab)
───────────────────────────────────────────────────── */
const DriverCard = ({ driver, onApprove, onReject, unitVal, rejectVal, onUnitChange, onRejectChange }) => {
    const initials = driver.driver_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'DR';

    return (
        <div className="driver-card bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
            {/* Header stripe */}
            <div className={`h-1 w-full ${driver.approval_status === 'APPROVED' ? 'bg-emerald-500' : driver.approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-400'}`}></div>

            <div className="p-5">
                {/* Top row: avatar + info + status */}
                <div className="flex items-start gap-4 mb-5">
                    <div className="driver-avatar-wrap rounded-xl overflow-hidden bg-slate-800 border border-white/5 flex items-center justify-center flex-shrink-0">
                        {driver.profile_image_url ? (
                            <img src={driver.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-slate-300 font-black text-xl">{initials}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                                <h3 className="text-white font-extrabold text-base leading-tight capitalize">{driver.driver_name}</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{driver.district}</p>
                            </div>
                            <StatusBadge status={driver.approval_status} />
                        </div>

                        {/* Info pills */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="flex items-center gap-1.5 bg-slate-800/60 border border-white/5 px-3 py-1 rounded-lg text-[11px] text-slate-300 font-semibold">
                                <i className="fa-solid fa-id-card text-blue-400 text-[10px]"></i>
                                {driver.license_number}
                            </span>
                            <span className="flex items-center gap-1.5 bg-slate-800/60 border border-white/5 px-3 py-1 rounded-lg text-[11px] text-slate-300 font-semibold">
                                <i className="fa-solid fa-phone text-emerald-400 text-[10px]"></i>
                                {driver.users?.phone || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1.5 bg-slate-800/60 border border-white/5 px-3 py-1 rounded-lg text-[11px] text-slate-300 font-semibold">
                                <i className="fa-solid fa-envelope text-purple-400 text-[10px]"></i>
                                <span className="truncate max-w-[140px]">{driver.users?.email || 'N/A'}</span>
                            </span>
                            {driver.license_image_url && (
                                <a
                                    href={driver.license_image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-lg text-[11px] text-blue-400 font-bold hover:bg-blue-600/20 transition-colors"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                                    View License
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Registered on */}
                <p className="text-[10px] text-slate-600 font-bold mb-4">
                    <i className="fa-regular fa-calendar mr-1"></i>
                    Registered {driver.created_at ? new Date(driver.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </p>

                {/* Action area — only show if not already decided */}
                {driver.approval_status === 'PENDING' ? (
                    <div className="border-t border-white/5 pt-4 space-y-3">
                        <div className="flex gap-3">
                            <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 py-2">
                                <i className="fa-solid fa-hashtag text-slate-600 text-[10px] flex-shrink-0"></i>
                                <input
                                    type="text"
                                    placeholder="Assign unit no. (e.g. TN-108-001)"
                                    value={unitVal}
                                    onChange={(e) => onUnitChange(e.target.value)}
                                    className="bg-transparent outline-none text-white text-xs font-semibold w-full placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 py-2">
                            <i className="fa-solid fa-comment-slash text-slate-600 text-[10px] flex-shrink-0"></i>
                            <input
                                type="text"
                                placeholder="Reject reason (required if rejecting)"
                                value={rejectVal}
                                onChange={(e) => onRejectChange(e.target.value)}
                                className="bg-transparent outline-none text-white text-xs font-semibold w-full placeholder:text-slate-600"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => onApprove(driver.id)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wide transition-all shadow-lg shadow-emerald-900/20"
                            >
                                <i className="fa-solid fa-check"></i>Grant Access
                            </button>
                            <button
                                onClick={() => onReject(driver.id)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-red-600/80 text-white text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <i className="fa-solid fa-xmark"></i>Deny
                            </button>
                        </div>
                    </div>
                ) : driver.approval_status === 'APPROVED' ? (
                    <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-semibold">Unit Assigned</span>
                        <span className="text-sm font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg">
                            {driver.unit_number || '—'}
                        </span>
                    </div>
                ) : (
                    <div className="border-t border-white/5 pt-4">
                        <p className="text-[11px] text-red-400 font-semibold">
                            <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
                            {driver.reject_reason || 'Access denied'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   FLEET CARD  (Live tracking tab)
───────────────────────────────────────────────────── */
const FleetCard = ({ item }) => {
    const isOnline = item.is_online;
    const isAvailable = item.is_ready_for_response;
    const score = item.today_total_responses || 0;
    const maxScore = 10;
    const pct = Math.min(score / maxScore, 1);
    const circumference = 2 * Math.PI * 28;

    return (
        <div className={`bg-[#111827] border rounded-2xl overflow-hidden transition-all ${isOnline ? 'border-emerald-500/20' : 'border-white/5'}`}>
            <div className={`h-1 w-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
            <div className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${isOnline ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-white/5 text-slate-600'}`}>
                        <i className="fa-solid fa-truck-medical"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-extrabold truncate">{item.driver_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">
                                {item.unit_number || 'Unassigned'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">{item.district}</span>
                        </div>
                    </div>
                    {/* Online dot */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-slate-600'}`}></div>
                        <span className={`text-[9px] font-black uppercase ${isOnline ? 'text-emerald-400' : 'text-slate-600'}`}>{isOnline ? 'Live' : 'Off'}</span>
                    </div>
                </div>

                {/* Status + Duty */}
                <div className="flex gap-2 mb-4">
                    <span className={`flex-1 text-center text-[10px] font-black uppercase py-1.5 rounded-lg border ${isAvailable ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                        {isAvailable ? 'Available' : 'On Mission'}
                    </span>
                    <span className="flex-1 text-center text-[10px] font-black uppercase py-1.5 rounded-lg border bg-slate-800/60 border-white/5 text-slate-400">
                        {item.duty_status || 'OFFLINE'}
                    </span>
                </div>

                {/* GPS */}
                <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 mb-4 font-mono text-[11px]">
                    {item.latitude ? (
                        <div className="flex items-center gap-3">
                            <i className="fa-solid fa-location-dot text-blue-400 text-sm"></i>
                            <div>
                                <span className="text-slate-400">LAT </span><span className="text-emerald-400">{Number(item.latitude).toFixed(5)}</span>
                                <span className="text-slate-600 mx-2">•</span>
                                <span className="text-slate-400">LNG </span><span className="text-emerald-400">{Number(item.longitude).toFixed(5)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-600">
                            <i className="fa-solid fa-satellite text-[12px]"></i>
                            <span>Searching for signal…</span>
                        </div>
                    )}
                    {item.last_location_at && (
                        <p className="text-[9px] text-slate-600 mt-1 ml-5">
                            Updated {new Date(item.last_location_at).toLocaleTimeString()}
                        </p>
                    )}
                </div>

                {/* Today's score ring */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Today's Responses</p>
                        <p className="text-2xl font-black text-white mt-0.5">{score}</p>
                    </div>
                    <svg width="56" height="56" viewBox="0 0 64 64" className="-rotate-90">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                        <circle
                            cx="32" cy="32" r="28"
                            fill="none"
                            stroke={pct >= 0.8 ? '#10b981' : pct >= 0.5 ? '#3b82f6' : '#f59e0b'}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={`${pct * circumference} ${circumference}`}
                        />
                        <text x="32" y="38" textAnchor="middle" className="rotate-90" style={{ fontSize: 14, fontWeight: 900, fill: '#fff', transform: 'rotate(90deg)', transformOrigin: '32px 32px' }}>{score}</text>
                    </svg>
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   OFFLINE BANNER
───────────────────────────────────────────────────── */
const OfflineBanner = () => {
    const [online, setOnline] = React.useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    React.useEffect(() => {
        const on  = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online',  on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online',  on);
            window.removeEventListener('offline', off);
        };
    }, []);
    if (online) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            background: 'linear-gradient(90deg,#dc2626,#b91c1c)',
            color: '#fff', textAlign: 'center', padding: '10px 16px',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
            <i className="fa-solid fa-wifi-slash" />
            &nbsp;No Internet Connection — Data updates paused. Restore network to resume sync.
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */
// ─── Haversine straight-line distance (km) ───────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

const SuperAdminPage = () => {
    const { isAuthenticated, user: authUser, superAdminLogin, logout, setUser, isLoading: authLoading, error: authError, setError: setAuthError } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentPage, setCurrentPage] = useState('DASHBOARD');
    const [ambulanceTab, setAmbulanceTab] = useState('ACCIDENTS');

    // Data state
    const [stats, setStats] = useState(null);
    const [resources, setResources] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [autoSync, setAutoSync] = useState(true);
    const [emergencyDrivers, setEmergencyDrivers] = useState([]);
    const [driversLoading, setDriversLoading] = useState(false);
    const [ambulanceUseData, setAmbulanceUseData] = useState([]);
    const [unitInputs, setUnitInputs] = useState({});
    const [rejectInputs, setRejectInputs] = useState({});
    const [emergencyAlerts, setEmergencyAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [fleetDrivers, setFleetDrivers] = useState([]);
    const [fleetLoading, setFleetLoading] = useState(false);
    const [expandedAlert, setExpandedAlert] = useState(null);
    const [driverSearch, setDriverSearch] = useState('');
    const [driverStatusFilter, setDriverStatusFilter] = useState('ALL');

    // GH & PHC Centres state
    const [ghTab, setGhTab]                   = useState('LIST');  // LIST | CREATE
    const [hospitals, setHospitals]           = useState([]);
    const [hospitalsLoading, setHospitalsLoading] = useState(false);
    const [hospitalAnalytics, setHospitalAnalytics] = useState(null);
    const [ghSearch, setGhSearch]             = useState('');
    const [ghDistrict, setGhDistrict]         = useState('all');
    const [ghType, setGhType]                 = useState('all');
    const [ghStatus, setGhStatus]             = useState('all');
    const [ghPage, setGhPage]                 = useState(1);
    const [ghPagination, setGhPagination]     = useState(null);
    const [editHospital, setEditHospital]     = useState(null);   // hospital obj being edited
    const [viewHospital, setViewHospital]     = useState(null);   // hospital obj in detail modal
    const [createForm, setCreateForm]         = useState({
        hospitalName: '', hospitalCode: '', type: 'GH', address: '',
        district: '', contactEmail: '', contactPhone: '', status: 'ACTIVE'
    });
    const [createLoading, setCreateLoading]   = useState(false);
    const [editLoading, setEditLoading]       = useState(false);

    // BED Availability state
    const [bedData, setBedData]                       = useState([]);
    const [bedLoading, setBedLoading]                 = useState(false);
    const [bedSearch, setBedSearch]                   = useState('');
    const [bedDistrictFilter, setBedDistrictFilter]   = useState('all');
    const [selectedBedHospital, setSelectedBedHospital] = useState(null); // popup
    const [bedError, setBedError]                     = useState(null);

    // Account settings
    const [adminEmail, setAdminEmail] = useState('');
    const [currentAdminPassword, setCurrentAdminPassword] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [confirmAdminPassword, setConfirmAdminPassword] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (authUser?.role === 'SUPER_ADMIN') {
            setAdminEmail(authUser?.username || '');
        }
    }, [authUser]);

    const fetchDashboardData = useCallback(async (district = selectedDistrict) => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setFetching(true);
        try {
            const [statsRes, resourceRes] = await Promise.all([
                axiosInstance.get(`/super-admin/stats?district=${district}`),
                axiosInstance.get(`/super-admin/resources?district=${district}`)
            ]);
            if (statsRes.data.success) { setStats(statsRes.data.data); setLastSynced(new Date()); }
            if (resourceRes.data.success) setResources(resourceRes.data.data);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setFetching(false);
        }
    }, [isAuthenticated, authUser, selectedDistrict]);

    const fetchEmergencyDrivers = useCallback(async () => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setDriversLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/emergency/drivers');
            if (res.data?.success) {
                setEmergencyDrivers(res.data.data || []);
            }
        } catch (err) {
            console.error('Drivers fetch error:', err);
            toast.error('Failed to load driver registrations');
        } finally {
            setDriversLoading(false);
        }
    }, [isAuthenticated, authUser]);

    const fetchAmbulanceUseData = useCallback(async () => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        try {
            const res = await axiosInstance.get('/super-admin/ambulance/use');
            if (res.data?.success) setAmbulanceUseData(res.data.data || []);
        } catch (err) {
            console.error('Ambulance use fetch error:', err);
        }
    }, [isAuthenticated, authUser]);

    const fetchEmergencyAlerts = useCallback(async () => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setAlertsLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/emergency/alerts');
            if (res.data?.success) setEmergencyAlerts(res.data.data || []);
        } catch (err) {
            console.error('Alerts fetch error:', err);
        } finally {
            setAlertsLoading(false);
        }
    }, [isAuthenticated, authUser]);

    // ── GH & PHC ──────────────────────────────────────────────────────────────
    const fetchHospitals = useCallback(async (search = ghSearch, district = ghDistrict, type = ghType, status = ghStatus, page = ghPage) => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setHospitalsLoading(true);
        try {
            const params = new URLSearchParams({ search, district, type, status, page, limit: 20 });
            const res = await axiosInstance.get(`/super-admin/hospitals?${params}`);
            if (res.data?.success) {
                setHospitals(res.data.data || []);
                setGhPagination(res.data.pagination);
            }
        } catch (err) {
            console.error('Hospitals fetch error:', err);
            toast.error('Failed to load hospitals');
        } finally {
            setHospitalsLoading(false);
        }
    }, [isAuthenticated, authUser, ghSearch, ghDistrict, ghType, ghStatus, ghPage]);

    const fetchHospitalAnalytics = useCallback(async () => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        try {
            const res = await axiosInstance.get('/super-admin/hospitals/analytics');
            if (res.data?.success) setHospitalAnalytics(res.data.data);
        } catch (err) { console.error('Analytics fetch error:', err); }
    }, [isAuthenticated, authUser]);

    const fetchFleetDrivers = useCallback(async () => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setFleetLoading(true);
        try {
            const res = await axiosInstance.get('/super-admin/emergency/drivers/fleet');
            if (res.data?.success) setFleetDrivers(res.data.data || []);
        } catch (err) {
            console.error('Fleet fetch error:', err);
        } finally {
            setFleetLoading(false);
        }
    }, [isAuthenticated, authUser]);

    useEffect(() => {
        if (isAuthenticated && authUser?.role === 'SUPER_ADMIN') {
            fetchDashboardData();
            fetchEmergencyDrivers();
            fetchAmbulanceUseData();
            fetchEmergencyAlerts();
            fetchFleetDrivers();
        }
    }, [isAuthenticated, authUser]);

    useEffect(() => {
        if (isAuthenticated && authUser?.role === 'SUPER_ADMIN') {
            fetchDashboardData(selectedDistrict);
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN' || !autoSync) return;
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchDashboardData(selectedDistrict);
                fetchEmergencyDrivers();
                fetchAmbulanceUseData();
                fetchEmergencyAlerts();
                fetchFleetDrivers();
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [isAuthenticated, authUser, autoSync, selectedDistrict, fetchDashboardData, fetchEmergencyDrivers, fetchAmbulanceUseData, fetchEmergencyAlerts, fetchFleetDrivers]);

    // ── BED AVAILABILITY ──────────────────────────────────────────────────────
    const fetchBedAvailability = useCallback(async (search = bedSearch, district = bedDistrictFilter) => {
        if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') return;
        setBedLoading(true);
        setBedError(null);
        try {
            const params = new URLSearchParams({ search, district });
            const res = await axiosInstance.get(`/super-admin/bed-availability?${params}`);
            if (res.data?.success) setBedData(res.data.data || []);
        } catch (err) {
            console.error('Bed availability fetch error:', err);
            const isOffline = !navigator.onLine;
            const status = err?.response?.status;
            if (isOffline) {
                setBedError('No internet connection. Please check your network and retry.');
            } else if (status >= 500) {
                setBedError('Server error loading bed data. Retrying in 3 seconds…');
                setTimeout(() => fetchBedAvailability(search, district), 3000);
            } else {
                setBedError('Failed to load bed availability. Please refresh.');
            }
        } finally {
            setBedLoading(false);
        }
    }, [isAuthenticated, authUser, bedSearch, bedDistrictFilter]);

    // Fetch when navigating to BED page
    useEffect(() => {
        if (currentPage === 'BED' && isAuthenticated && authUser?.role === 'SUPER_ADMIN') {
            fetchBedAvailability();
        }
    }, [currentPage]);

    // Debounced live-search — fires 350 ms after typing stops
    const bedSearchDebounceRef = useRef(null);
    useEffect(() => {
        if (currentPage !== 'BED') return;
        clearTimeout(bedSearchDebounceRef.current);
        bedSearchDebounceRef.current = setTimeout(() => {
            fetchBedAvailability(bedSearch, bedDistrictFilter);
        }, 350);
        return () => clearTimeout(bedSearchDebounceRef.current);
    }, [bedSearch]);

    // Fetch hospitals when navigating to GH page
    useEffect(() => {
        if (currentPage === 'GH' && isAuthenticated && authUser?.role === 'SUPER_ADMIN') {
            fetchHospitals();
            fetchHospitalAnalytics();
        }
    }, [currentPage]);

    // Re-fetch when GH filters change
    useEffect(() => {
        if (currentPage === 'GH') fetchHospitals();
    }, [ghSearch, ghDistrict, ghType, ghStatus, ghPage]);

    const handleCreateHospital = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const res = await axiosInstance.post('/super-admin/hospitals', createForm);
            if (res.data?.success) {
                toast.success('Hospital created! Admin credentials sent via email.');
                setCreateForm({ hospitalName: '', hospitalCode: '', type: 'GH', address: '', district: '', contactEmail: '', contactPhone: '', status: 'ACTIVE' });
                setGhTab('LIST');
                fetchHospitals();
                fetchHospitalAnalytics();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create hospital');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleUpdateHospital = async (id, payload) => {
        setEditLoading(true);
        try {
            const res = await axiosInstance.put(`/super-admin/hospitals/${id}`, payload);
            if (res.data?.success) {
                toast.success('Hospital updated');
                setEditHospital(null);
                fetchHospitals();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update hospital');
        } finally {
            setEditLoading(false);
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await axiosInstance.patch(`/super-admin/hospitals/${id}/toggle-status`);
            if (res.data?.success) {
                toast.success(res.data.message);
                fetchHospitals();
                fetchHospitalAnalytics();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to toggle status');
        }
    };

    const handleDeleteHospital = async (id) => {
        if (!window.confirm('Soft-delete this hospital? All staff will be deactivated.')) return;
        try {
            const res = await axiosInstance.delete(`/super-admin/hospitals/${id}`);
            if (res.data?.success) {
                toast.success('Hospital removed');
                fetchHospitals();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    const handleExportCSV = async () => {
        try {
            const res = await axiosInstance.get('/super-admin/hospitals/export/csv', { responseType: 'blob' });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = 'hospitals.csv'; a.click();
            window.URL.revokeObjectURL(url);
        } catch { toast.error('Export failed'); }
    };

    const handleEmergencyAccess = async (driverId, approvalStatus) => {
        const unit = unitInputs[driverId] || '';
        const reason = rejectInputs[driverId] || '';

        if (approvalStatus === 'APPROVED' && !unit.trim()) {
            toast.error('Please assign a unit number before approving'); return;
        }
        if (approvalStatus === 'REJECTED' && !reason.trim()) {
            toast.error('Please provide a reject reason'); return;
        }

        try {
            await axiosInstance.patch(`/super-admin/emergency/drivers/${driverId}/access`, {
                approvalStatus,
                unitNumber: unit,
                rejectReason: reason
            });
            toast.success(`Driver ${approvalStatus === 'APPROVED' ? 'approved ✓' : 'rejected'}`);
            fetchEmergencyDrivers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update driver access');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username || !password) { toast.error('Enter both credentials'); return; }
        await superAdminLogin({ username, password });
    };

    const handleLogout = () => {
        logout(); setUsername(''); setPassword('');
    };

    const handleAdminAccountUpdate = async (e) => {
        e.preventDefault();
        if (newAdminPassword !== confirmAdminPassword) { toast.error('Passwords do not match'); return; }
        try {
            const res = await axiosInstance.patch('/super-admin/account', {
                email: adminEmail,
                currentPassword: currentAdminPassword,
                newPassword: newAdminPassword,
                confirmNewPassword: confirmAdminPassword
            });
            if (res.data?.success) {
                setUser({ ...(authUser || {}), username: adminEmail });
                toast.success('Account updated');
                setCurrentAdminPassword(''); setNewAdminPassword(''); setConfirmAdminPassword('');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        }
    };

    // Derived
    const pendingCount = emergencyDrivers.filter(d => d.approval_status === 'PENDING').length;
    const filterByTab = (tab) => {
        if (tab === 'PENDING')  return emergencyDrivers.filter(d => d.approval_status === 'PENDING');
        if (tab === 'APPROVED') return emergencyDrivers.filter(d => d.approval_status === 'APPROVED');
        if (tab === 'REJECTED') return emergencyDrivers.filter(d => d.approval_status === 'REJECTED');
        return emergencyDrivers;
    };

    // Chart data
    const trendData = {
        labels: stats?.trends?.length
            ? stats.trends.map(t => new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' }))
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Appointments',
            data: stats?.trends?.length ? stats.trends.map(t => t.count) : [65, 59, 80, 81, 56, 55, 90],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            fill: true,
            tension: 0.4
        }]
    };

    const distributionData = {
        labels: ['Available', 'In Use', 'ICU'],
        datasets: [{
            data: stats ? [stats.hospitals.available_beds, (stats.hospitals.total_beds - stats.hospitals.available_beds), stats.hospitals.icu_beds] : [45, 30, 25],
            backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'],
            borderWidth: 0,
            hoverOffset: 12
        }]
    };

    /* ── Login Screen ── */
    if (!isAuthenticated || authUser?.role !== 'SUPER_ADMIN') {
        return (
            <div className="login-premium-bg font-inter">
                <OfflineBanner />
                <div className="login-glow-1"></div>
                <div className="login-glow-2"></div>
                <div className="login-card-premium animate__animated animate__fadeIn">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                            <i className="fa-solid fa-shield-halved text-blue-500 text-2xl"></i>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">TN Health Portal</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Restricted Super Admin Access</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest ml-1">Admin Identity</label>
                            <div className="premium-input-wrapper">
                                <i className="fa-solid fa-user-shield text-slate-500"></i>
                                <input type="text" required placeholder="Enter Username" value={username}
                                    onChange={(e) => { setUsername(e.target.value); if (authError) setAuthError(null); }}
                                    className="premium-input" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest ml-1">Secure Authorization</label>
                            <div className="premium-input-wrapper">
                                <i className="fa-solid fa-key text-slate-500"></i>
                                <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••" value={password}
                                    onChange={(e) => { setPassword(e.target.value); if (authError) setAuthError(null); }}
                                    className="premium-input" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-white transition-colors">
                                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>
                        {authError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                                <i className="fa-solid fa-triangle-exclamation"></i>{authError}
                            </div>
                        )}
                        <button type="submit" disabled={authLoading}
                            className="w-full premium-button flex items-center justify-center gap-3 disabled:opacity-50">
                            {authLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : (
                                <><span>Authorize Access</span><i className="fa-solid fa-chevron-right text-xs"></i></>
                            )}
                        </button>
                    </form>
                    <div className="mt-10 pt-6 border-t border-white/5 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">TN-GOV Secure Node v4.0.2</p>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Authenticated Layout ── */
    return (
        <div className="flex h-screen overflow-hidden bg-[#070b14] text-[#cbd5e1] font-inter">
            <OfflineBanner />
            <MongoSidebar
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                authUser={authUser}
                pendingCount={pendingCount}
                handleLogout={handleLogout}
            />

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                {/* Header */}
                <header className="main-header flex-shrink-0">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="district-selector">
                            <i className="fa-solid fa-map-location-dot text-blue-500"></i>
                            <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}
                                className="bg-transparent text-white text-sm outline-none cursor-pointer pr-2">
                                <option value="all">All Tamil Nadu</option>
                                <option value="Chennai">Chennai</option>
                                <option value="Madurai">Madurai</option>
                                <option value="Coimbatore">Coimbatore</option>
                                <option value="Salem">Salem</option>
                            </select>
                        </div>
                        <div className="live-badge">
                            <div className={`status-dot ${autoSync ? 'pulse' : ''}`}></div>
                            <span>Live</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <span className="hidden sm:block text-xs font-bold text-slate-600">
                            {currentTime.toLocaleTimeString()}
                        </span>
                        <button onClick={() => { fetchDashboardData(); fetchEmergencyDrivers(); fetchAmbulanceUseData(); }}
                            className={`text-slate-400 hover:text-white transition-colors ${fetching ? 'animate-spin' : ''}`}>
                            <i className="fa-solid fa-rotate-right"></i>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                    {/* ── DASHBOARD ── */}
                    {currentPage === 'DASHBOARD' && (
                        <div className="animate__animated animate__fadeIn">
                            <div className="mb-8">
                                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">Tamil Nadu Overview</h2>
                                <p className="text-slate-400 text-sm">Monitoring public health across <span className="text-blue-400 font-bold">38 Districts</span></p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatCard icon="fa-user-injured" label="Total Patients" value={stats?.patients?.total ?? '—'} sub="Across connected hospitals" color="blue" />
                                <StatCard icon="fa-user-doctor" label="Total Doctors" value={stats?.staff?.doctors ?? '—'} sub={`Nurses: ${stats?.staff?.nurses ?? 0}`} color="purple" />
                                <StatCard icon="fa-bed-pulse" label="Govt ICU Beds" value={stats?.hospitals?.icu_beds ?? '—'} sub="Low Availability" color="pink" />
                                <StatCard icon="fa-users" label="Total Staff" value={stats?.staff?.total ?? '—'} sub={`Hospitals: ${stats?.hospitals?.total_hospitals ?? 0}`} color="red" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                                <div className="lg:col-span-2 glass-card p-5 rounded-2xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-base font-bold text-white">System Activity (Appointments)</h3>
                                    </div>
                                    <div className="h-52">
                                        <Line data={trendData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } }} />
                                    </div>
                                </div>
                                <div className="glass-card p-5 rounded-2xl flex flex-col">
                                    <h3 className="text-base font-bold text-white mb-4">Bed Distribution</h3>
                                    <div className="relative h-40 flex-1">
                                        <Doughnut data={distributionData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }} />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-2xl font-bold text-white">
                                                {stats ? Math.round((stats.hospitals.available_beds / Math.max(stats.hospitals.total_beds, 1)) * 100) : 0}%
                                            </span>
                                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Available</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <LegendItem color="bg-emerald-400" label="Available" value={stats?.hospitals?.available_beds ?? '—'} />
                                        <LegendItem color="bg-blue-400" label="Occupied" value={stats ? stats.hospitals.total_beds - stats.hospitals.available_beds : '—'} />
                                        <LegendItem color="bg-purple-400" label="ICU" value={stats?.hospitals?.icu_beds ?? '—'} />
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">District Resource Monitor</h3>
                                    <button onClick={() => fetchDashboardData()} className="text-blue-400 text-[10px] font-black uppercase tracking-widest hover:underline">
                                        <i className={`fa-solid fa-rotate-right mr-1 ${fetching ? 'animate-spin' : ''}`}></i>Sync
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Hospital / District</th>
                                                <th>ICU Status</th>
                                                <th>Beds</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {resources.map((r, i) => (
                                                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="text-white font-bold">{r.name} <span className="text-slate-500 font-normal">({r.district})</span></td>
                                                    <td><span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${r.icu_beds > 5 ? 'badge-green' : 'badge-red'}`}>{r.icu_beds} ICU</span></td>
                                                    <td className="text-slate-400 text-sm">{r.available_beds} / {r.total_beds}</td>
                                                </tr>
                                            ))}
                                            {resources.length === 0 && (
                                                <tr><td colSpan="3" className="py-10 text-center text-slate-500 italic">No resource data</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── 108 AMBULANCE ── */}
                    {currentPage === 'AMBULANCE' && (() => {
                        const pendingAlerts   = emergencyAlerts.filter(a => a.status === 'PENDING');
                        const activeAlerts    = emergencyAlerts.filter(a => !['PENDING','COMPLETED','REJECTED'].includes(a.status));
                        const completedAlerts = emergencyAlerts.filter(a => a.status === 'COMPLETED');
                        const onlineDrivers   = fleetDrivers.filter(d => d.is_online);
                        const onMission       = fleetDrivers.filter(d => d.duty_status === 'ON_MISSION');
                        const available       = fleetDrivers.filter(d => d.duty_status === 'AVAILABLE');
                        const filteredFleet   = fleetDrivers
                            .filter(d => driverStatusFilter === 'ALL' ? true : driverStatusFilter === 'ONLINE' ? d.is_online : driverStatusFilter === 'ON_MISSION' ? d.duty_status === 'ON_MISSION' : driverStatusFilter === 'AVAILABLE' ? d.duty_status === 'AVAILABLE' : driverStatusFilter === 'OFFLINE' ? d.duty_status === 'OFFLINE' : driverStatusFilter === 'PENDING' ? d.approval_status === 'PENDING' : true)
                            .filter(d => !driverSearch || d.driver_name?.toLowerCase().includes(driverSearch.toLowerCase()) || d.unit_number?.toLowerCase().includes(driverSearch.toLowerCase()) || d.district?.toLowerCase().includes(driverSearch.toLowerCase()));

                        return (
                        <div className="animate__animated animate__fadeIn">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">108 Emergency Network</h2>
                                    <p className="text-slate-400 text-sm">
                                        <span className="text-red-400 font-bold">{pendingAlerts.length} Unassigned</span>
                                        <span className="text-slate-600 mx-2">•</span>
                                        <span className="text-blue-400 font-bold">{activeAlerts.length} Active Missions</span>
                                        <span className="text-slate-600 mx-2">•</span>
                                        <span className="text-emerald-400 font-bold">{onlineDrivers.length} Online Drivers</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => { fetchEmergencyAlerts(); fetchFleetDrivers(); fetchEmergencyDrivers(); }}
                                    className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-white/5 py-2.5 px-5 rounded-xl text-xs font-bold transition-all text-blue-400"
                                >
                                    <i className={`fa-solid fa-rotate-right ${alertsLoading || fleetLoading ? 'animate-spin' : ''}`}></i>
                                    Refresh
                                </button>
                            </div>

                            {/* KPI strip */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                {[
                                    { label: 'Total Accidents', val: emergencyAlerts.length, icon: 'fa-triangle-exclamation', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
                                    { label: 'Unassigned',      val: pendingAlerts.length,   icon: 'fa-hourglass-half',       color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
                                    { label: 'Active Missions', val: activeAlerts.length,    icon: 'fa-truck-medical',        color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
                                    { label: 'Completed',       val: completedAlerts.length, icon: 'fa-circle-check',         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                    { label: 'Online Drivers',  val: onlineDrivers.length,   icon: 'fa-satellite-dish',       color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20' },
                                ].map(({ label, val, icon, color, bg }) => (
                                    <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}>
                                        <i className={`fa-solid ${icon} ${color} text-lg`}></i>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{label}</p>
                                            <p className={`text-xl font-black ${color}`}>{val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tab bar */}
                            <div className="flex gap-1 p-1 bg-slate-900/60 border border-white/5 rounded-2xl mb-6 flex-wrap">
                                {[
                                    { key: 'ACCIDENTS', icon: 'fa-triangle-exclamation', label: 'Reported Accidents', count: emergencyAlerts.length },
                                    { key: 'FLEET',     icon: 'fa-id-card',              label: 'All Drivers',        count: fleetDrivers.length },
                                    { key: 'PENDING',   icon: 'fa-clock',                label: 'Pending Approval',   count: pendingCount },
                                    { key: 'APPROVED',  icon: 'fa-circle-check',         label: 'Approved',           count: emergencyDrivers.filter(d => d.approval_status === 'APPROVED').length },
                                    { key: 'REJECTED',  icon: 'fa-circle-xmark',         label: 'Rejected',           count: emergencyDrivers.filter(d => d.approval_status === 'REJECTED').length },
                                ].map(({ key, icon, label, count }) => (
                                    <button key={key} onClick={() => setAmbulanceTab(key)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                                            ambulanceTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                        }`}>
                                        <i className={`fa-solid ${icon}`}></i>
                                        {label}
                                        {count > 0 && (
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                ambulanceTab === key ? 'bg-white/20 text-white' : key === 'PENDING' ? 'bg-orange-500 text-white' : key === 'ACCIDENTS' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'
                                            }`}>{count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* ── ACCIDENTS TAB ── */}
                            {ambulanceTab === 'ACCIDENTS' && (
                                <div>
                                    {alertsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-red-500"></i>
                                            <p className="text-slate-500 font-bold text-sm">Loading accident reports…</p>
                                        </div>
                                    ) : emergencyAlerts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-700 text-2xl"><i className="fa-solid fa-triangle-exclamation"></i></div>
                                            <p className="text-slate-500 font-bold">No accident reports yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {emergencyAlerts.map(alert => {
                                                const isExpanded = expandedAlert === alert.id;
                                                const statusColor = {
                                                    PENDING: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                                                    DISPATCHED: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                                    REACHED_SPOT: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                                                    LEFT_SPOT: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                                                    REACHED_HOSPITAL: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                                                    COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                                                    REJECTED: 'text-red-400 bg-red-500/10 border-red-500/20',
                                                }[alert.status] || 'text-slate-400 bg-slate-800 border-white/5';

                                                const stageLabel = {
                                                    PENDING: '⏳ Awaiting Driver',
                                                    DISPATCHED: '🚑 En Route',
                                                    REACHED_SPOT: '📍 On Spot',
                                                    LEFT_SPOT: '🏥 To Hospital',
                                                    REACHED_HOSPITAL: '🏨 At Hospital',
                                                    COMPLETED: '✅ Completed',
                                                    REJECTED: '❌ Rejected',
                                                }[alert.status] || alert.status;

                                                return (
                                                    <div key={alert.id} className={`bg-[#111827] border rounded-2xl overflow-hidden transition-all ${
                                                        alert.status === 'PENDING' ? 'border-orange-500/30' :
                                                        alert.status === 'COMPLETED' ? 'border-emerald-500/20' : 'border-blue-500/20'
                                                    }`}>
                                                        {/* Row header — always visible */}
                                                        <div
                                                            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-all"
                                                            onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                                                        >
                                                            {/* Accident photo thumb */}
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800">
                                                                {alert.image_url
                                                                    ? <img src={alert.image_url} alt="Accident" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center text-slate-600"><i className="fa-solid fa-camera"></i></div>
                                                                }
                                                            </div>

                                                            {/* Core info */}
                                                            <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Report Time</p>
                                                                    <p className="text-white text-xs font-bold">{new Date(alert.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Coordinates</p>
                                                                    <a href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer"
                                                                        className="text-emerald-400 font-mono text-[10px] font-bold hover:underline" onClick={e => e.stopPropagation()}>
                                                                        {alert.latitude ? `${Number(alert.latitude).toFixed(4)}, ${Number(alert.longitude).toFixed(4)}` : 'N/A'}
                                                                    </a>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Assigned Unit</p>
                                                                    <p className="text-blue-400 text-xs font-black">{alert.assigned_unit_no || <span className="text-slate-600">Unassigned</span>}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Status</p>
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusColor}`}>{stageLabel}</span>
                                                                </div>
                                                            </div>

                                                            {/* Expand toggle */}
                                                            <i className={`fa-solid fa-chevron-down text-slate-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}></i>
                                                        </div>

                                                        {/* Expanded detail */}
                                                        {isExpanded && (
                                                            <div className="border-t border-white/5 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {/* Left: accident photo + map link */}
                                                                <div className="space-y-4">
                                                                    {alert.image_url && (
                                                                        <div className="rounded-xl overflow-hidden border border-white/5">
                                                                            <img src={alert.image_url} alt="Accident" className="w-full h-48 object-cover" />
                                                                            <div className="p-2 bg-slate-900/60 flex items-center justify-between">
                                                                                <span className="text-[10px] text-slate-500 font-bold">Accident Photo</span>
                                                                                <a href={alert.image_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 font-bold hover:underline">Open Full</a>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="bg-slate-900/60 rounded-xl border border-white/5 p-3 space-y-2">
                                                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Location Details</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-slate-400">Latitude</span>
                                                                            <span className="font-mono text-emerald-400 text-xs">{alert.latitude ?? 'N/A'}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-slate-400">Longitude</span>
                                                                            <span className="font-mono text-emerald-400 text-xs">{alert.longitude ?? 'N/A'}</span>
                                                                        </div>
                                                                        <a href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer"
                                                                            className="flex items-center gap-2 mt-2 text-xs font-bold text-blue-400 hover:text-blue-300">
                                                                            <i className="fa-solid fa-map-location-dot"></i> Open in Google Maps
                                                                        </a>
                                                                    </div>
                                                                </div>

                                                                {/* Right: driver info */}
                                                                <div className="space-y-4">
                                                                    <div className="bg-slate-900/60 rounded-xl border border-white/5 p-4">
                                                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Assigned Driver</p>
                                                                        {alert.driver ? (
                                                                            <div className="space-y-2">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs text-slate-400">Driver Name</span>
                                                                                    <span className="text-white text-xs font-bold">{alert.driver.driver_name}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs text-slate-400">District</span>
                                                                                    <span className="text-white text-xs font-bold">{alert.driver.district}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs text-slate-400">Phone</span>
                                                                                    <a href={`tel:${alert.driver.phone}`} className="text-blue-400 text-xs font-bold hover:underline">{alert.driver.phone || 'N/A'}</a>
                                                                                </div>
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs text-slate-400">Unit No.</span>
                                                                                    <span className="text-blue-400 text-xs font-black">{alert.assigned_unit_no}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs text-slate-400">Duty Status</span>
                                                                                    <span className="text-xs font-black text-orange-400">{alert.driver.duty_status}</span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-slate-600 text-xs italic">No driver assigned yet</p>
                                                                        )}
                                                                    </div>

                                                                    {/* Driver live GPS + Route Map */}
                                                                    {alert.driver?.live_lat && alert.latitude && (
                                                                        <div className="space-y-3">
                                                                            {/* Distance badge */}
                                                                            {(() => {
                                                                                const dist = haversineKm(
                                                                                    parseFloat(alert.driver.live_lat), parseFloat(alert.driver.live_lng),
                                                                                    parseFloat(alert.latitude), parseFloat(alert.longitude)
                                                                                );
                                                                                return dist ? (
                                                                                    <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                                                                                        <i className="fa-solid fa-route text-orange-400 text-lg"></i>
                                                                                        <div>
                                                                                            <p className="text-[9px] text-orange-400 font-black uppercase tracking-widest">Distance to Spot</p>
                                                                                            <p className="text-white font-black text-lg">{dist} <span className="text-orange-400 text-sm font-bold">km</span></p>
                                                                                            <p className="text-[9px] text-slate-500">Straight-line · Est. {Math.ceil(dist / 40 * 60)} min at 40 km/h</p>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : null;
                                                                            })()}

                                                                            {/* Embedded route map */}
                                                                            <div className="rounded-xl overflow-hidden border border-white/10">
                                                                                <div className="bg-slate-900/80 px-3 py-2 flex items-center justify-between">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                                                        <span className="text-[10px] text-slate-400 font-bold">Ambulance</span>
                                                                                        <div className="w-12 h-px bg-slate-600"></div>
                                                                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                                                        <span className="text-[10px] text-slate-400 font-bold">Accident Spot</span>
                                                                                    </div>
                                                                                    <a
                                                                                        href={`https://www.google.com/maps/dir/${alert.driver.live_lat},${alert.driver.live_lng}/${alert.latitude},${alert.longitude}`}
                                                                                        target="_blank" rel="noreferrer"
                                                                                        className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1"
                                                                                    >
                                                                                        <i className="fa-solid fa-arrow-up-right-from-square"></i> Full Route
                                                                                    </a>
                                                                                </div>
                                                                                <iframe
                                                                                    title="route-map"
                                                                                    src={`https://maps.google.com/maps?saddr=${alert.driver.live_lat},${alert.driver.live_lng}&daddr=${alert.latitude},${alert.longitude}&output=embed&t=k`}
                                                                                    width="100%"
                                                                                    height="220"
                                                                                    style={{ border: 0, display: 'block' }}
                                                                                    loading="lazy"
                                                                                    allowFullScreen
                                                                                />
                                                                            </div>

                                                                            {/* Driver GPS info */}
                                                                            <div className="bg-slate-900/60 rounded-xl border border-emerald-500/20 p-3">
                                                                                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-2">Driver Position</p>
                                                                                <div className="flex items-center gap-3 font-mono text-xs mb-1">
                                                                                    <i className="fa-solid fa-location-dot text-emerald-400"></i>
                                                                                    <span className="text-emerald-400">{Number(alert.driver.live_lat).toFixed(5)}, {Number(alert.driver.live_lng).toFixed(5)}</span>
                                                                                </div>
                                                                                <p className="text-[9px] text-slate-600">Updated {alert.driver.last_location_at ? new Date(alert.driver.last_location_at).toLocaleTimeString() : 'N/A'}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {alert.driver && !alert.driver.live_lat && (
                                                                        <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-3 text-center">
                                                                            <i className="fa-solid fa-satellite-dish text-slate-600 text-xl mb-1"></i>
                                                                            <p className="text-[10px] text-slate-500">Driver GPS not available yet</p>
                                                                        </div>
                                                                    )}

                                                                    {/* Mission timeline */}
                                                                    <div className="bg-slate-900/60 rounded-xl border border-white/5 p-4">
                                                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Mission Timeline</p>
                                                                        <div className="flex items-center gap-1">
                                                                            {['PENDING','DISPATCHED','REACHED_SPOT','LEFT_SPOT','REACHED_HOSPITAL','COMPLETED'].map((s, i, arr) => {
                                                                                const idx = arr.indexOf(alert.status);
                                                                                const done = i <= idx;
                                                                                return (
                                                                                    <div key={s} className="flex items-center gap-1 flex-1">
                                                                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                                                                            s === alert.status ? 'bg-blue-500 ring-2 ring-blue-500/30' :
                                                                                            done ? 'bg-emerald-500' : 'bg-slate-700'
                                                                                        }`}></div>
                                                                                        {i < arr.length - 1 && <div className={`flex-1 h-px ${done && i < idx ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-500 mt-2">Updated {new Date(alert.updated_at).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── FLEET / ALL DRIVERS TAB ── */}
                            {ambulanceTab === 'FLEET' && (
                                <div>
                                    {/* Filters */}
                                    <div className="flex flex-wrap gap-3 mb-5">
                                        <div className="flex-1 min-w-[200px] premium-input-wrapper bg-slate-900 border-white/5">
                                            <i className="fa-solid fa-magnifying-glass text-slate-600"></i>
                                            <input
                                                type="text" placeholder="Search driver, unit, district…"
                                                value={driverSearch} onChange={e => setDriverSearch(e.target.value)}
                                                className="premium-input"
                                            />
                                        </div>
                                        <div className="flex gap-1 p-1 bg-slate-900/60 border border-white/5 rounded-xl flex-wrap">
                                            {[
                                                { key: 'ALL',        label: 'All',        color: 'text-white' },
                                                { key: 'ONLINE',     label: 'Online',     color: 'text-emerald-400' },
                                                { key: 'ON_MISSION', label: 'On Mission', color: 'text-blue-400' },
                                                { key: 'AVAILABLE',  label: 'Available',  color: 'text-cyan-400' },
                                                { key: 'OFFLINE',    label: 'Offline',    color: 'text-slate-400' },
                                                { key: 'PENDING',    label: 'Pending Approval', color: 'text-orange-400' },
                                            ].map(({ key, label, color }) => (
                                                <button key={key} onClick={() => setDriverStatusFilter(key)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                                        driverStatusFilter === key ? `bg-slate-700 ${color}` : 'text-slate-600 hover:text-slate-400'
                                                    }`}>
                                                    {label}
                                                    {key !== 'ALL' && (
                                                        <span className="ml-1 opacity-60">({(
                                                            key === 'ONLINE'     ? onlineDrivers.length :
                                                            key === 'ON_MISSION' ? onMission.length :
                                                            key === 'AVAILABLE'  ? available.length :
                                                            key === 'OFFLINE'    ? fleetDrivers.filter(d => d.duty_status === 'OFFLINE').length :
                                                            key === 'PENDING'    ? fleetDrivers.filter(d => d.approval_status === 'PENDING').length : 0
                                                        )})</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {fleetLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-blue-500"></i>
                                            <p className="text-slate-500 font-bold text-sm">Loading driver fleet…</p>
                                        </div>
                                    ) : filteredFleet.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-700 text-2xl"><i className="fa-solid fa-users"></i></div>
                                            <p className="text-slate-500 font-bold">No drivers found</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-2xl border border-white/5">
                                            <table className="w-full text-left text-sm">
                                                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/60">
                                                    <tr>
                                                        <th className="px-4 py-3">Driver</th>
                                                        <th className="px-4 py-3">Unit No.</th>
                                                        <th className="px-4 py-3">District</th>
                                                        <th className="px-4 py-3">Phone</th>
                                                        <th className="px-4 py-3">Duty Status</th>
                                                        <th className="px-4 py-3">Online</th>
                                                        <th className="px-4 py-3">GPS</th>
                                                        <th className="px-4 py-3">Missions Done</th>
                                                        <th className="px-4 py-3">Approval</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredFleet.map(d => {
                                                        const dutyColor = {
                                                            ON_MISSION: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                                            AVAILABLE:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                                                            ON_DUTY:    'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                                                            OFFLINE:    'text-slate-500 bg-slate-800 border-white/5',
                                                        }[d.duty_status] || 'text-slate-500 bg-slate-800 border-white/5';
                                                        const approvalColor = {
                                                            APPROVED: 'text-emerald-400 bg-emerald-500/10',
                                                            REJECTED: 'text-red-400 bg-red-500/10',
                                                            PENDING:  'text-orange-400 bg-orange-500/10',
                                                        }[d.approval_status] || '';
                                                        return (
                                                            <tr key={d.id} className="hover:bg-white/[0.015] transition-all">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-600">
                                                                            {d.profile_image_url
                                                                                ? <img src={d.profile_image_url} alt="" className="w-full h-full object-cover" />
                                                                                : <i className="fa-solid fa-user text-[10px]"></i>
                                                                            }
                                                                        </div>
                                                                        <span className="text-white font-bold text-xs">{d.driver_name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3"><span className="text-blue-400 font-black text-xs">{d.unit_number || <span className="text-slate-600">—</span>}</span></td>
                                                                <td className="px-4 py-3"><span className="text-slate-300 text-xs">{d.district}</span></td>
                                                                <td className="px-4 py-3">
                                                                    {d.phone
                                                                        ? <a href={`tel:${d.phone}`} className="text-blue-400 text-xs font-bold hover:underline">{d.phone}</a>
                                                                        : <span className="text-slate-600 text-xs">—</span>
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${dutyColor}`}>{d.duty_status || 'OFFLINE'}</span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className={`flex items-center gap-1.5 ${ d.is_online ? 'text-emerald-400' : 'text-slate-600' }`}>
                                                                        <div className={`w-2 h-2 rounded-full ${ d.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600' }`}></div>
                                                                        <span className="text-[10px] font-black">{d.is_online ? 'Live' : 'Off'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {d.latitude ? (
                                                                        <a href={`https://maps.google.com/?q=${d.latitude},${d.longitude}`} target="_blank" rel="noreferrer"
                                                                            className="font-mono text-[10px] text-emerald-400 hover:underline">
                                                                            {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}
                                                                        </a>
                                                                    ) : <span className="text-slate-600 text-xs">No GPS</span>}
                                                                </td>
                                                                <td className="px-4 py-3"><span className="text-white font-black text-sm">{d.total_missions_done}</span></td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${approvalColor}`}>{d.approval_status}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── REGISTRATION TABS (PENDING / APPROVED / REJECTED) ── */}
                            {(ambulanceTab === 'PENDING' || ambulanceTab === 'APPROVED' || ambulanceTab === 'REJECTED') && (
                                <>
                                    {driversLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-blue-500"></i>
                                            <p className="text-slate-500 font-bold text-sm">Loading driver registrations…</p>
                                        </div>
                                    ) : filterByTab(ambulanceTab).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-700 text-2xl"><i className="fa-solid fa-box-open"></i></div>
                                            <p className="text-slate-500 font-bold">No {ambulanceTab.toLowerCase()} driver registrations</p>
                                            <button onClick={fetchEmergencyDrivers} className="text-blue-400 text-sm font-bold hover:underline">
                                                <i className="fa-solid fa-rotate-right mr-1"></i>Refresh
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {filterByTab(ambulanceTab).map((driver) => (
                                                <DriverCard
                                                    key={driver.id} driver={driver}
                                                    unitVal={unitInputs[driver.id] ?? driver.unit_number ?? ''}
                                                    rejectVal={rejectInputs[driver.id] ?? driver.reject_reason ?? ''}
                                                    onUnitChange={(v) => setUnitInputs(prev => ({ ...prev, [driver.id]: v }))}
                                                    onRejectChange={(v) => setRejectInputs(prev => ({ ...prev, [driver.id]: v }))}
                                                    onApprove={(id) => handleEmergencyAccess(id, 'APPROVED')}
                                                    onReject={(id) => handleEmergencyAccess(id, 'REJECTED')}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        );
                    })()}

                    {/* ── BED AVAILABILITY ── */}
                    {currentPage === 'BED' && (
                        <div className="animate__animated animate__fadeIn">
                            {/* Header */}
                            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">Bed Availability</h2>
                                    <p className="text-slate-400 text-sm">Real-time ward-wise bed status across all connected hospitals</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {bedData.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const rows = [['Code','Hospital','Type','District','Wards','Total Beds','Available','Occupied','Occupancy%']];
                                                bedData.forEach(h => rows.push([
                                                    h.hospital_code, h.name, h.type, h.district,
                                                    h.totalWards, h.totalBeds, h.availableBeds, h.occupiedBeds, h.occupancyPct
                                                ]));
                                                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                                                const a = document.createElement('a');
                                                a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                                                a.download = `bed-availability-${new Date().toISOString().slice(0,10)}.csv`;
                                                a.click();
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                            <i className="fa-solid fa-file-csv" />&nbsp;Export CSV
                                        </button>
                                    )}
                                    <button onClick={() => fetchBedAvailability(bedSearch, bedDistrictFilter)}
                                        className="text-blue-400 text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                                        <i className={`fa-solid fa-rotate-right ${bedLoading ? 'animate-spin' : ''}`} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Search & Filter bar */}
                            <div className="glass-card p-4 rounded-2xl mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 py-2">
                                    <i className="fa-solid fa-magnifying-glass text-slate-500 text-xs" />
                                    <input
                                        type="text"
                                        value={bedSearch}
                                        onChange={e => setBedSearch(e.target.value)}
                                                placeholder="Search by hospital code, name or district..."
                                        className="bg-transparent outline-none text-sm text-white flex-1 placeholder:text-slate-600"
                                    />
                                    {bedSearch && (
                                        <button onClick={() => { setBedSearch(''); fetchBedAvailability('', bedDistrictFilter); }}
                                            className="text-slate-500 hover:text-white text-xs">×</button>
                                    )}
                                </div>
                                <select value={bedDistrictFilter} onChange={e => { setBedDistrictFilter(e.target.value); fetchBedAvailability(bedSearch, e.target.value); }}
                                    className="bg-slate-900 border border-white/5 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none">
                                    <option value="all">All Districts</option>
                                    {['Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem','Tirunelveli','Vellore','Erode','Tirupur','Thanjavur'].map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <button onClick={() => fetchBedAvailability(bedSearch, bedDistrictFilter)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap">
                                    <i className="fa-solid fa-search mr-2" />Search
                                </button>
                            </div>

                            {/* Error / offline banner */}
                            {bedError && (
                                <div className="flex items-center gap-3 p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 animate__animated animate__fadeIn">
                                    <i className="fa-solid fa-triangle-exclamation flex-shrink-0 text-lg" />
                                    <span className="text-sm font-semibold flex-1">{bedError}</span>
                                    <button
                                        onClick={() => { setBedError(null); fetchBedAvailability(bedSearch, bedDistrictFilter); }}
                                        className="text-red-400 hover:text-white text-xs font-black uppercase tracking-widest border border-red-500/40 hover:border-red-400 px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {/* Summary cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                {[
                                    { label:'Hospitals', val: bedData.length, icon:'fa-hospital', color:'text-blue-400', bg:'bg-blue-600/10' },
                                    { label:'Total Wards', val: bedData.reduce((s,h) => s + h.totalWards, 0), icon:'fa-layer-group', color:'text-purple-400', bg:'bg-purple-600/10' },
                                    { label:'Total Beds', val: bedData.reduce((s,h) => s + h.totalBeds, 0), icon:'fa-bed', color:'text-slate-300', bg:'bg-slate-600/10' },
                                    { label:'Available Beds', val: bedData.reduce((s,h) => s + h.availableBeds, 0), icon:'fa-bed-pulse', color:'text-emerald-400', bg:'bg-emerald-600/10' },
                                ].map(c => (
                                    <div key={c.label} className="glass-card p-4 rounded-2xl flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                                            <i className={`fa-solid ${c.icon} ${c.color} text-base`} />
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{c.label}</p>
                                            <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Table */}
                            <div className="glass-card rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Hospital Name</th>
                                                <th>Type</th>
                                                <th>District</th>
                                                <th>Wards</th>
                                                <th>Available Beds</th>
                                                <th>Occupancy</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {bedLoading ? (
                                                <tr><td colSpan="8" className="py-10 text-center text-slate-500 italic">
                                                    <i className="fa-solid fa-spinner animate-spin mr-2" />Loading...
                                                </td></tr>
                                            ) : bedData.length === 0 ? (
                                                <tr><td colSpan="8" className="py-10 text-center text-slate-500 italic">No hospitals found</td></tr>
                                            ) : bedData.map(h => {
                                                const pct = h.occupancyPct;
                                                const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                                                return (
                                                    <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="text-slate-400 font-mono text-xs">{h.hospital_code}</td>
                                                        <td className="text-white font-bold">{h.name}</td>
                                                        <td>
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/10">
                                                                {h.type || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="text-slate-400 text-sm">{h.district}</td>
                                                        <td className="text-slate-300 text-sm font-bold">{h.totalWards}</td>
                                                        <td>
                                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                                                                h.availableBeds === 0 ? 'badge-red' :
                                                                h.availableBeds <= 5 ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' :
                                                                'badge-green'
                                                            }`}>{h.availableBeds} / {h.totalBeds} free</span>
                                                        </td>
                                                        <td style={{ minWidth: 120 }}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-xs text-slate-400 font-bold w-8">{pct}%</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => setSelectedBedHospital(h)}
                                                                title="View ward-wise details"
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                                                            >
                                                                <i className="fa-solid fa-table-cells-large text-xs" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Ward Detail Modal */}
                            {selectedBedHospital && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
                                    onClick={() => setSelectedBedHospital(null)}>
                                    <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                                        onClick={e => e.stopPropagation()}>
                                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-white font-extrabold text-base">{selectedBedHospital.name}</h3>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    {selectedBedHospital.hospital_code} · {selectedBedHospital.district} · {selectedBedHospital.totalWards} wards
                                                </p>
                                            </div>
                                            <button onClick={() => setSelectedBedHospital(null)}
                                                className="text-slate-500 hover:text-white text-lg leading-none">×</button>
                                        </div>

                                        {/* Summary row */}
                                        <div className="grid grid-cols-3 gap-3 p-4 border-b border-white/5">
                                            {[
                                                { label: 'Total Beds', val: selectedBedHospital.totalBeds, color: 'text-slate-300' },
                                                { label: 'Available', val: selectedBedHospital.availableBeds, color: 'text-emerald-400' },
                                                { label: 'Occupied', val: selectedBedHospital.occupiedBeds, color: 'text-red-400' },
                                            ].map(s => (
                                                <div key={s.label} className="bg-slate-900/60 rounded-xl p-3 text-center">
                                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">{s.label}</p>
                                                    <p className={`text-2xl font-extrabold ${s.color}`}>{s.val}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Ward list */}
                                        <div className="overflow-y-auto flex-1 p-4 space-y-3">
                                            {selectedBedHospital.wards.length === 0 ? (
                                                <p className="text-center text-slate-500 py-8 italic">No ward data available</p>
                                            ) : selectedBedHospital.wards.map((w, i) => {
                                                const bs = w.bedStats;
                                                const wpct = bs.total > 0 ? Math.round(((bs.total - bs.available) / bs.total) * 100) : 0;
                                                const wColor = wpct >= 90 ? 'bg-red-500' : wpct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                                                return (
                                                    <div key={i} className="bg-slate-900/60 rounded-xl p-3 border border-white/5">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div>
                                                                <span className="text-white font-bold text-sm">{w.ward_name}</span>
                                                                <span className="ml-2 text-[10px] font-black uppercase text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{w.ward_type}</span>
                                                                {w.floor_number && <span className="ml-1 text-slate-500 text-xs">Floor {w.floor_number}</span>}
                                                            </div>
                                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                                                                bs.available === 0 ? 'badge-red' :
                                                                bs.available <= 2 ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' :
                                                                'badge-green'
                                                            }`}>{bs.available} / {bs.total} free</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                                <div className={`h-full ${wColor} rounded-full`} style={{ width: `${wpct}%` }} />
                                                            </div>
                                                            <span className="text-xs text-slate-400 w-10 text-right">{wpct}% full</span>
                                                        </div>
                                                        <div className="flex gap-3 mt-2 text-xs text-slate-500">
                                                            <span>🟢 {bs.available} available</span>
                                                            <span>🔴 {bs.occupied} occupied</span>
                                                            {bs.cleaning > 0 && <span>🧹 {bs.cleaning} cleaning</span>}
                                                            {bs.maintenance > 0 && <span>🔧 {bs.maintenance} maintenance</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── GH & PHC CENTRES ── */}
                    {currentPage === 'GH' && (
                        <GHPHCPage />
                    )}

                    {currentPage === 'DISTRICT_OFFICERS' && (
                        <DistrictOfficerManager />
                    )}

                    {/* ── PLACEHOLDER (analytics strip removed) ── */}
                    {false && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    {[
                                        { label: 'Total Hospitals', val: hospitalAnalytics.totalHospitals,    icon: 'fa-hospital',    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
                                        { label: 'Active',          val: hospitalAnalytics.activeHospitals,  icon: 'fa-circle-check', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                        { label: 'Inactive',        val: hospitalAnalytics.inactiveHospitals,icon: 'fa-circle-xmark', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
                                        { label: 'Active Admins',   val: hospitalAnalytics.activeAdmins,     icon: 'fa-user-tie',    color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20' },
                                    ].map(({ label, val, icon, color, bg }) => (
                                        <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}>
                                            <i className={`fa-solid ${icon} ${color} text-lg`}></i>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{label}</p>
                                                <p className={`text-xl font-black ${color}`}>{val ?? '—'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── CREATE FORM ── */}
                            {ghTab === 'CREATE' && (
                                <div className="glass-card p-6 rounded-2xl mb-6">
                                    <h3 className="text-lg font-extrabold text-white mb-5 flex items-center gap-2">
                                        <i className="fa-solid fa-hospital-user text-blue-400"></i> Register New Hospital
                                    </h3>
                                    <form onSubmit={handleCreateHospital}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            {[{label:'Hospital Name*',field:'hospitalName',type:'text',placeholder:'e.g. Madras Medical College'},
                                              {label:'Hospital Code*',field:'hospitalCode',type:'text',placeholder:'e.g. MMC-CHN (immutable)'},
                                              {label:'Contact Email*',field:'contactEmail',type:'email',placeholder:'admin@hospital.gov.in'},
                                              {label:'Contact Phone*',field:'contactPhone',type:'tel',placeholder:'10-digit number'},
                                              {label:'Address',field:'address',type:'text',placeholder:'Full address'},
                                              {label:'District',field:'district',type:'text',placeholder:'e.g. Chennai'},
                                            ].map(({label,field,type,placeholder}) => (
                                                <div key={field}>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">{label}</label>
                                                    <div className="premium-input-wrapper bg-slate-900 border-white/5">
                                                        <input type={type} placeholder={placeholder}
                                                            value={createForm[field]}
                                                            onChange={e => setCreateForm(p => ({...p, [field]: e.target.value}))}
                                                            className="premium-input" required={label.endsWith('*')} />
                                                    </div>
                                                </div>
                                            ))}
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Type*</label>
                                                <select value={createForm.type} onChange={e => setCreateForm(p => ({...p, type: e.target.value}))}
                                                    className="w-full bg-slate-900 border border-white/5 text-white rounded-xl px-4 py-3 text-sm outline-none">
                                                    {['GH','PHC','PRIVATE','CLINIC'].map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Status</label>
                                                <select value={createForm.status} onChange={e => setCreateForm(p => ({...p, status: e.target.value}))}
                                                    className="w-full bg-slate-900 border border-white/5 text-white rounded-xl px-4 py-3 text-sm outline-none">
                                                    <option value="ACTIVE">Active</option>
                                                    <option value="INACTIVE">Inactive</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button type="submit" disabled={createLoading}
                                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all disabled:opacity-50">
                                                {createLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                                                {createLoading ? 'Creating…' : 'Create Hospital & Send Credentials'}
                                            </button>
                                            <button type="button" onClick={() => setGhTab('LIST')}
                                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all">
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ── HOSPITAL LIST ── */}
                            {ghTab === 'LIST' && (
                                <>
                                    {/* Filters */}
                                    <div className="flex flex-wrap gap-3 mb-5">
                                        <div className="flex-1 min-w-[200px] premium-input-wrapper bg-slate-900 border-white/5">
                                            <i className="fa-solid fa-magnifying-glass text-slate-600"></i>
                                            <input type="text" placeholder="Search by name, code, district…"
                                                value={ghSearch} onChange={e => { setGhSearch(e.target.value); setGhPage(1); }}
                                                className="premium-input" />
                                        </div>
                                        {[{val:ghType,set:(v)=>{setGhType(v);setGhPage(1);},opts:[['all','All Types'],['GH','GH'],['PHC','PHC'],['PRIVATE','Private'],['CLINIC','Clinic']]},
                                          {val:ghStatus,set:(v)=>{setGhStatus(v);setGhPage(1);},opts:[['all','All Status'],['active','Active'],['inactive','Inactive']]},
                                        ].map(({val,set,opts},i) => (
                                            <select key={i} value={val} onChange={e => set(e.target.value)}
                                                className="bg-slate-900 border border-white/5 text-slate-300 rounded-xl px-3 py-2.5 text-xs outline-none">
                                                {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                                            </select>
                                        ))}
                                        <button onClick={() => fetchHospitals()}
                                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/5 py-2.5 px-4 rounded-xl text-xs font-bold text-blue-400 transition-all">
                                            <i className={`fa-solid fa-rotate-right ${hospitalsLoading ? 'animate-spin' : ''}`}></i>
                                        </button>
                                    </div>

                                    {/* Table */}
                                    {hospitalsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-blue-500"></i>
                                            <p className="text-slate-500 font-bold text-sm">Loading hospitals…</p>
                                        </div>
                                    ) : hospitals.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-700 text-2xl"><i className="fa-solid fa-hospital"></i></div>
                                            <p className="text-slate-500 font-bold">No hospitals found</p>
                                            <button onClick={() => setGhTab('CREATE')} className="text-blue-400 text-sm font-bold hover:underline">Create first hospital</button>
                                        </div>
                                    ) : (
                                        <div className="glass-card rounded-2xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/60">
                                                        <tr>
                                                            <th className="px-4 py-3">Hospital</th>
                                                            <th className="px-4 py-3">Code</th>
                                                            <th className="px-4 py-3">Type</th>
                                                            <th className="px-4 py-3">District</th>
                                                            <th className="px-4 py-3">Contact</th>
                                                            <th className="px-4 py-3">Staff</th>
                                                            <th className="px-4 py-3">Status</th>
                                                            <th className="px-4 py-3">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {hospitals.map(h => (
                                                            <tr key={h.id} className="hover:bg-white/[0.015] transition-all">
                                                                <td className="px-4 py-3">
                                                                    <p className="text-white font-bold text-sm">{h.hospital_name}</p>
                                                                    <p className="text-[10px] text-slate-500">{h.contact_email}</p>
                                                                </td>
                                                                <td className="px-4 py-3"><span className="font-mono text-blue-400 text-xs font-black">{h.hospital_code}</span></td>
                                                                <td className="px-4 py-3"><span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">{h.type}</span></td>
                                                                <td className="px-4 py-3 text-slate-300 text-xs">{h.district || '—'}</td>
                                                                <td className="px-4 py-3">
                                                                    <p className="text-xs text-slate-400">{h.contact_phone || '—'}</p>
                                                                </td>
                                                                <td className="px-4 py-3"><span className="text-white font-black">{h.staff_count ?? 0}</span></td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                                                        h.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'
                                                                    }`}>{h.is_active ? 'Active' : 'Inactive'}</span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => setViewHospital(h)} title="View"
                                                                            className="text-slate-500 hover:text-blue-400 transition-colors">
                                                                            <i className="fa-solid fa-eye text-sm"></i>
                                                                        </button>
                                                                        <button onClick={() => setEditHospital({...h})} title="Edit"
                                                                            className="text-slate-500 hover:text-yellow-400 transition-colors">
                                                                            <i className="fa-solid fa-pen text-sm"></i>
                                                                        </button>
                                                                        <button onClick={() => handleToggleStatus(h.id)} title="Toggle Status"
                                                                            className="text-slate-500 hover:text-emerald-400 transition-colors">
                                                                            <i className="fa-solid fa-power-off text-sm"></i>
                                                                        </button>
                                                                        <button onClick={() => handleDeleteHospital(h.id)} title="Delete"
                                                                            className="text-slate-500 hover:text-red-400 transition-colors">
                                                                            <i className="fa-solid fa-trash text-sm"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/* Pagination */}
                                            {ghPagination && ghPagination.pages > 1 && (
                                                <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                                    <p className="text-[11px] text-slate-500">Showing {hospitals.length} of {ghPagination.total}</p>
                                                    <div className="flex gap-2">
                                                        <button disabled={ghPage <= 1} onClick={() => setGhPage(p => p - 1)}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-800 disabled:opacity-30">← Prev</button>
                                                        <span className="px-3 py-1.5 text-xs text-slate-400">{ghPage} / {ghPagination.pages}</span>
                                                        <button disabled={ghPage >= ghPagination.pages} onClick={() => setGhPage(p => p + 1)}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-800 disabled:opacity-30">Next →</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* EDIT MODAL */}
                            {editHospital && (
                                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                    <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-5">
                                                <h3 className="text-lg font-extrabold text-white">Edit Hospital</h3>
                                                <button onClick={() => setEditHospital(null)} className="text-slate-500 hover:text-white">
                                                    <i className="fa-solid fa-xmark text-lg"></i>
                                                </button>
                                            </div>
                                            {/* Code is immutable */}
                                            <div className="mb-4 p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Hospital Code (Immutable)</p>
                                                <p className="font-mono text-blue-400 font-black mt-1">{editHospital.hospital_code}</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                                                {[{label:'Hospital Name',field:'hospital_name'},
                                                  {label:'Contact Email',field:'contact_email',type:'email'},
                                                  {label:'Contact Phone',field:'contact_phone'},
                                                  {label:'Address',field:'address'},
                                                  {label:'District',field:'district'},
                                                ].map(({label,field,type='text'}) => (
                                                    <div key={field}>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">{label}</label>
                                                        <input type={type} value={editHospital[field] || ''}
                                                            onChange={e => setEditHospital(p => ({...p, [field]: e.target.value}))}
                                                            className="w-full bg-slate-900 border border-white/5 text-white rounded-xl px-4 py-3 text-sm outline-none" />
                                                    </div>
                                                ))}
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Type</label>
                                                    <select value={editHospital.type || 'GH'} onChange={e => setEditHospital(p => ({...p, type: e.target.value}))}
                                                        className="w-full bg-slate-900 border border-white/5 text-white rounded-xl px-4 py-3 text-sm outline-none">
                                                        {['GH','PHC','PRIVATE','CLINIC'].map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button disabled={editLoading} onClick={() => handleUpdateHospital(editHospital.id, {
                                                    hospitalName: editHospital.hospital_name,
                                                    type: editHospital.type,
                                                    address: editHospital.address,
                                                    district: editHospital.district,
                                                    contactEmail: editHospital.contact_email,
                                                    contactPhone: editHospital.contact_phone
                                                })} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-black disabled:opacity-50">
                                                    {editLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                                                    Save Changes
                                                </button>
                                                <button onClick={() => setEditHospital(null)}
                                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 bg-slate-800">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* VIEW DETAIL MODAL */}
                            {viewHospital && (
                                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                    <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-lg">
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-extrabold text-white">{viewHospital.hospital_name}</h3>
                                                <button onClick={() => setViewHospital(null)} className="text-slate-500 hover:text-white">
                                                    <i className="fa-solid fa-xmark text-lg"></i>
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {[
                                                    ['Code',     viewHospital.hospital_code,  'font-mono text-blue-400'],
                                                    ['Type',     viewHospital.type,            'text-purple-400'],
                                                    ['District', viewHospital.district,        'text-white'],
                                                    ['Address',  viewHospital.address,         'text-slate-300'],
                                                    ['Email',    viewHospital.contact_email,   'text-white'],
                                                    ['Phone',    viewHospital.contact_phone,   'text-white'],
                                                    ['Status',   viewHospital.is_active ? 'Active' : 'Inactive', viewHospital.is_active ? 'text-emerald-400' : 'text-red-400'],
                                                    ['Staff',    viewHospital.staff_count ?? 0, 'text-white'],
                                                    ['Created',  viewHospital.created_at ? new Date(viewHospital.created_at).toLocaleDateString('en-IN') : '—', 'text-slate-400'],
                                                ].map(([label, val, cls]) => (
                                                    <div key={label} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-white/5">
                                                        <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{label}</span>
                                                        <span className={`text-sm font-bold ${cls}`}>{val || '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                    {/* ── SETTINGS ── */}
                    {currentPage === 'SETTINGS' && (
                        <div className="animate__animated animate__fadeIn max-w-2xl">
                            <div className="mb-8">
                                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">System Authority Control</h2>
                                <p className="text-slate-400 text-sm">Update super admin credentials</p>
                            </div>
                            <div className="glass-card p-6 rounded-2xl">
                                <form onSubmit={handleAdminAccountUpdate} className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Admin Email</label>
                                        <div className="premium-input-wrapper bg-slate-900 border-white/5">
                                            <i className="fa-solid fa-at text-slate-600"></i>
                                            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="premium-input" required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Current Password</label>
                                        <div className="premium-input-wrapper bg-slate-900 border-white/5">
                                            <i className="fa-solid fa-lock text-slate-600"></i>
                                            <input type="password" value={currentAdminPassword} onChange={(e) => setCurrentAdminPassword(e.target.value)} className="premium-input" required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">New Password</label>
                                            <div className="premium-input-wrapper bg-slate-900 border-white/5">
                                                <i className="fa-solid fa-shield-halved text-slate-600"></i>
                                                <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} className="premium-input" required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1.5">Confirm Password</label>
                                            <div className="premium-input-wrapper bg-slate-900 border-white/5">
                                                <i className="fa-solid fa-shield-halved text-slate-600"></i>
                                                <input type="password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} className="premium-input" required />
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" className="premium-button px-8 flex items-center gap-3">
                                        <i className="fa-solid fa-check-double text-emerald-400"></i>
                                        Confirm Update
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

/* ── Tiny helper components ── */
const StatCard = ({ icon, label, value, sub, color, alert }) => {
    const colors = {
        blue: 'bg-blue-600/10 text-blue-400',
        purple: 'bg-purple-600/10 text-purple-400',
        pink: 'bg-pink-600/10 text-pink-400',
        red: 'bg-red-600/10 text-red-400',
    };
    return (
        <div className={`glass-card stat-card ${alert ? 'ring-1 ring-red-500/20' : ''}`}>
            <div className={`stat-icon-wrapper ${colors[color] || colors.blue}`}>
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
                <p className="stat-label">{label}</p>
                <h3 className="stat-value">{value}</h3>
                <p className={`stat-subtext ${alert ? 'text-red-400 font-bold' : ''}`}>{sub}</p>
            </div>
        </div>
    );
};

const LegendItem = ({ color, label, value }) => (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/30 border border-white/5">
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${color}`}></span>
            <span className="text-slate-400 text-xs font-bold">{label}</span>
        </div>
        <span className="text-white text-sm font-black">{value}</span>
    </div>
);

// badge classes used in table
// badge-green / badge-red defined in CSS

export default SuperAdminPage;
