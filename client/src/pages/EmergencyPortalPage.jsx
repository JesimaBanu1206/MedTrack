import { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axios';
import './SuperAdminPage.css';
import 'animate.css';

// ─── Offline Detection Banner ────────────────────────────────────────────────
function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const online  = () => setIsOnline(true);
        const offline = () => setIsOnline(false);
        window.addEventListener('online',  online);
        window.addEventListener('offline', offline);
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
    }, []);
    if (isOnline) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: 'linear-gradient(90deg,#dc2626,#b91c1c)',
            color: '#fff', textAlign: 'center', padding: '10px 16px',
            fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
            <i className="fa-solid fa-wifi-slash" />
            No Internet Connection — GPS updates paused. Please restore network access.
        </div>
    );
}

// ─── Mission Map (Leaflet via CDN, dynamic load) ─────────────────────────────
function MissionMap({ driverLat, driverLng, spotLat, spotLng }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const routeLayerRef  = useRef(null);
    const driverMarkerRef = useRef(null);

    const initMap = useCallback(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        const L = window.L;
        if (!L) return;

        // Centre on spot if driver GPS not yet available, otherwise midpoint
        const centerLat = driverLat ? (driverLat + spotLat) / 2 : spotLat;
        const centerLng = driverLng ? (driverLng + spotLng) / 2 : spotLng;

        const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const driverIcon = L.divIcon({
            html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #22c55e"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7], className: ''
        });
        const spotIcon = L.divIcon({
            html: '<div style="background:#ef4444;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #ef4444"></div>',
            iconSize: [18, 18], iconAnchor: [9, 9], className: ''
        });

        // Always show accident spot marker
        L.marker([spotLat, spotLng], { icon: spotIcon })
            .addTo(map).bindPopup('<b>\uD83D\uDD34 Accident Spot</b>').openPopup();

        if (driverLat && driverLng) {
            // Show driver + fetch route
            driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon })
                .addTo(map).bindPopup('<b>\uD83D\uDE91 Your Location</b>');

            fetch(`https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${spotLng},${spotLat}?overview=full&geometries=geojson`)
                .then(r => r.json())
                .then(data => {
                    if (data.routes?.[0]?.geometry) {
                        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
                        routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
                            style: { color: '#3b82f6', weight: 5, opacity: 0.85 }
                        }).addTo(map);
                        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
                    } else {
                        map.fitBounds([[driverLat, driverLng], [spotLat, spotLng]], { padding: [40, 40] });
                    }
                })
                .catch(() => {
                    map.fitBounds([[driverLat, driverLng], [spotLat, spotLng]], { padding: [40, 40] });
                });
        } else {
            // No GPS fix yet — zoom to accident spot only
            map.setView([spotLat, spotLng], 14);
        }
    }, [driverLat, driverLng, spotLat, spotLng]);

    useEffect(() => {
        // Dynamically load Leaflet CSS + JS from CDN
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        if (!document.getElementById('leaflet-js')) {
            const script = document.createElement('script');
            script.id = 'leaflet-js';
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = initMap;
            document.head.appendChild(script);
        } else if (window.L) {
            initMap();
        }
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [initMap]);

    return (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(59,130,246,0.3)', marginTop: 16 }}>
            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
                <i className="fa-solid fa-route" style={{ color: '#3b82f6' }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Route to Accident Spot</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
                    {driverLat ? `Driver: ${driverLat.toFixed(4)}, ${driverLng.toFixed(4)}` : 'Locating...'}
                </span>
            </div>
            <div ref={mapRef} style={{ height: 280, width: '100%' }} />
            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '8px 16px',
                display: 'flex', gap: 20, fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Your Location
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    Accident Spot
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6' }}>
                    <span style={{ width: 24, height: 3, background: '#3b82f6', display: 'inline-block', borderRadius: 2 }} />
                    Shortest Route
                </span>
            </div>
        </div>
    );
}

const EmergencyPortalPage = () => {
    const {
        user,
        logout,
        fetchEmergencyDriverProfile,
        updateEmergencyDriverLocation,
        updateEmergencyDriverDutyStatus,
        submitEmergencyDriverSosNote,
        logEmergencyDriverResponse,
        fetchActiveAlerts,
        updateAlertStatus,
        fetchMissions
    } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [gpsEnabled, setGpsEnabled] = useState(false);
    const [lastLocation, setLastLocation] = useState(null);
    const [locationHistory, setLocationHistory] = useState([]);
    const [dutyStatus, setDutyStatus] = useState('OFFLINE');
    const [sosNote, setSosNote] = useState('');
    const [missions, setMissions] = useState({ ongoing: [], completed: [], pending: [], livesSaved: 0 });
    const [activeAlert, setActiveAlert] = useState(null);
    const [showIncomingAlert, setShowIncomingAlert] = useState(false);
    const [isProcessingAlert, setIsProcessingAlert] = useState(false);
    const locationTimerRef = useRef(null);
    const alertTimerRef = useRef(null);
    const dismissedAlertIds = useRef(new Set()); // Track alerts the driver dismissed or that failed

    const loadProfile = async () => {
        const data = await fetchEmergencyDriverProfile();
        if (data) {
            setProfile(data);
            setDutyStatus(data.duty_status || 'OFFLINE');
        }
    };

    const loadHistory = async () => {
        const res = await axiosInstance.get('/emergency-portal/location-history?limit=10');
        setLocationHistory(res.data?.data || []);
    };

    const loadMissions = async () => {
        const data = await fetchMissions();
        if (data) setMissions(data);
    };

    const checkNewAlerts = async () => {
        // Don't poll while processing an accept/stage update, or if on mission/offline
        if (isProcessingAlert) return;
        if (dutyStatus === 'OFFLINE' || dutyStatus === 'ON_MISSION') return;

        const alerts = await fetchActiveAlerts();

        // Check if there's an ongoing alert (already accepted/dispatched but not completed)
        const ongoing = alerts.find(a => !['COMPLETED', 'REJECTED', 'PENDING'].includes(a.status));
        if (ongoing) {
            setActiveAlert(ongoing);
            setShowIncomingAlert(false);
            return;
        }

        // If no ongoing, show the next PENDING alert (skip dismissed ones)
        const pendingAlert = alerts.find(
            a => a.status === 'PENDING' && !dismissedAlertIds.current.has(a.id)
        );
        if (pendingAlert) {
            setActiveAlert(pendingAlert);
            setShowIncomingAlert(true);
        }
    };

    useEffect(() => {
        loadProfile();
        loadHistory();
        loadMissions();
        return () => {
            if (locationTimerRef.current) clearInterval(locationTimerRef.current);
            if (alertTimerRef.current) clearInterval(alertTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (dutyStatus === 'AVAILABLE' || dutyStatus === 'ON_DUTY') {
            checkNewAlerts();
            alertTimerRef.current = setInterval(checkNewAlerts, 10000);
        } else {
            if (alertTimerRef.current) clearInterval(alertTimerRef.current);
        }
        return () => { if (alertTimerRef.current) clearInterval(alertTimerRef.current); };
    }, [dutyStatus]);

    const pushCurrentLocation = () => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const payload = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracyMeters: position.coords.accuracy
                };
                const ok = await updateEmergencyDriverLocation(payload);
                if (ok) {
                    setLastLocation({ ...payload, recordedAt: new Date().toISOString() });
                    loadProfile();
                    loadHistory();
                }
            },
            () => { },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const toggleGPS = async () => {
        if (gpsEnabled) {
            clearInterval(locationTimerRef.current);
            locationTimerRef.current = null;
            setGpsEnabled(false);
            return;
        }

        setGpsEnabled(true);
        await handleDutyStatus('ON_DUTY');
        pushCurrentLocation();
        locationTimerRef.current = setInterval(pushCurrentLocation, 15000);
    };

    const handleDutyStatus = async (nextStatus) => {
        const ok = await updateEmergencyDriverDutyStatus({ dutyStatus: nextStatus });
        if (ok) {
            setDutyStatus(nextStatus);
            loadProfile();
        }
    };

    const handleAlertStatus = async (status) => {
        if (!activeAlert || isProcessingAlert) return;
        setIsProcessingAlert(true);
        setShowIncomingAlert(false);

        const ok = await updateAlertStatus(activeAlert.id, status);

        if (ok) {
            if (status === 'COMPLETED') {
                setActiveAlert(null);
                setDutyStatus('AVAILABLE'); // sync local state immediately
            } else {
                // After ACCEPTED → DB sets status to DISPATCHED; re-fetch to get updated record
                const alerts = await fetchActiveAlerts();
                const refreshed = alerts.find(a => a.id === activeAlert.id);
                if (refreshed) {
                    setActiveAlert(refreshed);
                    if (status === 'ACCEPTED') {
                        setDutyStatus('ON_MISSION'); // sync local state immediately
                    }
                }
            }
            loadMissions();
            loadProfile();
        } else {
            // On failure, mark alert as dismissed to stop retry loop
            if (status === 'ACCEPTED') {
                dismissedAlertIds.current.add(activeAlert.id);
            }
            setShowIncomingAlert(false);
            setActiveAlert(null);
        }

        setIsProcessingAlert(false);
    };

    const handleSos = async (e) => {
        e.preventDefault();
        if (!sosNote.trim()) return;
        const ok = await submitEmergencyDriverSosNote({ note: sosNote });
        if (ok) {
            setSosNote('');
            loadProfile();
        }
    };

    const handleLogResponse = async () => {
        const ok = await logEmergencyDriverResponse({ status: 'COMPLETED' });
        if (ok) {
            loadHistory();
            loadMissions();
        }
    };

    return (
        <div className="portal-bg font-inter overflow-x-hidden min-h-screen">
            <OfflineBanner />
            {/* Incoming Alert Modal */}
            {showIncomingAlert && activeAlert && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate__animated animate__fadeIn">
                    <div className="portal-card max-w-lg w-full border-red-500/50 shadow-[0_0_50px_rgba(239,44,44,0.3)] animate__animated animate__pulse animate__infinite">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center animate-pulse">
                                <i className="fa-solid fa-triangle-exclamation text-white text-3xl"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Emergency Alert</h1>
                                <p className="text-red-500 font-black uppercase text-xs tracking-[0.3em]">Critical Interception</p>
                            </div>
                        </div>

                        {activeAlert.image_url && (
                            <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 h-48">
                                <img src={activeAlert.image_url} alt="Accident" className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="bg-slate-900/80 rounded-2xl p-4 border border-white/5 mb-8">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                                <span className="text-xs text-slate-500 font-bold uppercase">Coordinates</span>
                                <a
                                    href={`https://maps.google.com/?q=${activeAlert.latitude},${activeAlert.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-500 font-mono font-bold hover:underline"
                                >
                                    {Number(activeAlert.latitude).toFixed(5)}, {Number(activeAlert.longitude).toFixed(5)}
                                </a>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-bold uppercase">Time Received</span>
                                <span className="text-white font-bold">{new Date(activeAlert.created_at).toLocaleTimeString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleAlertStatus('ACCEPTED')}
                                disabled={isProcessingAlert}
                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black uppercase text-sm rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                            >
                                {isProcessingAlert ? (
                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Accepting...</>
                                ) : 'Accept Mission'}
                            </button>
                            <button
                                onClick={() => {
                                    if (activeAlert) dismissedAlertIds.current.add(activeAlert.id);
                                    setShowIncomingAlert(false);
                                    setActiveAlert(null);
                                }}
                                className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black uppercase text-sm rounded-2xl transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="portal-nav">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                        <i className="fa-solid fa-truck-medical text-white text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">108 Emergency Portal</h1>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Driver Terminal v2.4</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-sm font-bold text-white">{profile?.driver_name || user?.driverName}</p>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">ID: {profile?.unit_number || 'PENDING'}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                            {profile?.profile_image_url ? (
                                <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <i className="fa-solid fa-user-ninja text-slate-500"></i>
                            )}
                        </div>
                    </div>

                    <button onClick={logout} className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-red-600 transition-all">
                        <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate__animated animate__fadeIn">
                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <PortalStatCard
                        icon="fa-hashtag"
                        label="Assigned Unit"
                        value={profile?.unit_number || 'UA-000'}
                        subtext={profile?.unit_number ? "Active Fleet Membership" : "Awaiting Unit Assignment"}
                        color="blue"
                    />
                    <PortalStatCard
                        icon="fa-shield-check"
                        label="System Status"
                        value={profile?.approval_status || 'PENDING'}
                        subtext="Identity Verified by HQ"
                        color={profile?.approval_status === 'APPROVED' ? 'green' : 'orange'}
                        pulse={profile?.approval_status === 'PENDING'}
                    />
                    <PortalStatCard
                        icon="fa-heart-pulse"
                        label="Lives Saved"
                        value={missions.livesSaved?.toLocaleString() || '0'}
                        subtext="Total Completed Interceptions"
                        color="pink"
                    />
                    <PortalStatCard
                        icon="fa-signal"
                        label="Duty Presence"
                        value={dutyStatus.replace('_', ' ')}
                        subtext="Real-time Network State"
                        color={dutyStatus === 'ON_DUTY' ? 'blue' : dutyStatus === 'AVAILABLE' ? 'green' : dutyStatus === 'ON_MISSION' ? 'red' : 'slate'}
                    />
                </div>

                {/* Active Mission Flow */}
                {activeAlert && activeAlert.status !== 'PENDING' && (
                    <div className="portal-card bg-gradient-to-r from-blue-900/20 to-emerald-900/10 border-blue-500/30">
                        {/* Current stage badge */}
                        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-900/60 rounded-xl border border-white/5 w-fit">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Stage:</span>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {activeAlert.status === 'DISPATCHED'    ? '🚑 En Route to Spot' :
                                 activeAlert.status === 'REACHED_SPOT'  ? '📍 On Spot' :
                                 activeAlert.status === 'LEFT_SPOT'     ? '🏥 En Route to Hospital' :
                                 activeAlert.status === 'REACHED_HOSPITAL' ? '🏨 At Hospital' :
                                 activeAlert.status === 'COMPLETED'     ? '✅ Completed' : activeAlert.status}
                            </span>
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                                    <i className="fa-solid fa-map-location-dot text-white text-xl"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white truncate">Ongoing Mission</h2>
                                    <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">{activeAlert.id.slice(0, 8)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/30">
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{activeAlert.status.replace('_', ' ')}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { status: 'REACHED_SPOT',    label: 'On Spot',     icon: 'fa-location-dot',    prevStatus: 'DISPATCHED'       },
                                { status: 'LEFT_SPOT',       label: 'Leaving',     icon: 'fa-truck-moving',    prevStatus: 'REACHED_SPOT'    },
                                { status: 'REACHED_HOSPITAL',label: 'At Hospital', icon: 'fa-hospital',        prevStatus: 'LEFT_SPOT'       },
                                { status: 'COMPLETED',       label: 'Done',        icon: 'fa-flag-checkered',  prevStatus: 'REACHED_HOSPITAL'}
                            ].map((step, i) => {
                                const ORDER = ['DISPATCHED', 'REACHED_SPOT', 'LEFT_SPOT', 'REACHED_HOSPITAL', 'COMPLETED'];
                                const currentIdx = ORDER.indexOf(activeAlert.status);
                                const stepIdx    = ORDER.indexOf(step.status);
                                const isDone     = currentIdx > stepIdx;
                                const isNext     = currentIdx === stepIdx - 1; // This is the actionable next step
                                const isCurrent  = currentIdx === stepIdx;

                                return (
                                    <button
                                        key={step.status}
                                        disabled={!isNext}
                                        onClick={() => isNext && handleAlertStatus(step.status)}
                                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all
                                            ${isCurrent  ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white scale-105 z-10 cursor-default' : ''}
                                            ${isDone     ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 opacity-60 cursor-default' : ''}
                                            ${isNext     ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500 hover:text-white hover:scale-105 cursor-pointer animate-pulse' : ''}
                                            ${!isDone && !isCurrent && !isNext ? 'bg-slate-900/50 border-white/5 text-slate-600 grayscale cursor-not-allowed opacity-40' : ''}
                                        `}
                                    >
                                        <i className={`fa-solid ${step.icon} text-lg`}></i>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center">{step.label}</span>
                                        {isDone && <i className="fa-solid fa-check text-[10px]"></i>}
                                        {isNext && <span className="text-[8px] font-black uppercase tracking-widest text-yellow-400">Tap</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mission Map — shown immediately on accept; driver marker appears once GPS is acquired */}
                        {activeAlert && ['DISPATCHED','REACHED_SPOT','LEFT_SPOT','REACHED_HOSPITAL'].includes(activeAlert.status) &&
                            activeAlert.latitude && (
                            <MissionMap
                                driverLat={lastLocation?.latitude ?? null}
                                driverLng={lastLocation?.longitude ?? null}
                                spotLat={Number(activeAlert.latitude)}
                                spotLng={Number(activeAlert.longitude)}
                            />
                        )}
                    </div>
                )}

                {/* Main Action Control */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Live Tracking Card */}
                        <div className="portal-card relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">Status Management</h2>
                                        <p className="text-sm text-slate-500 font-medium">Toggle duty presence to receive interception alerts</p>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${gpsEnabled ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-700'}`}></div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <button
                                        onClick={toggleGPS}
                                        className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all ${gpsEnabled ? 'bg-red-600/10 border-red-500/30 text-red-500' : 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500'}`}
                                    >
                                        <i className={`fa-solid ${gpsEnabled ? 'fa-location-dot' : 'fa-satellite-dish'} text-2xl mb-3`}></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{gpsEnabled ? 'Stop GPS' : 'Start GPS'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleDutyStatus('AVAILABLE')}
                                        disabled={dutyStatus === 'ON_MISSION'}
                                        className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all ${dutyStatus === 'AVAILABLE' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-blue-600/10 border-blue-500/30 text-blue-500 hover:bg-blue-600 hover:text-white'} ${dutyStatus === 'ON_MISSION' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-check-circle text-2xl mb-3"></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Available</span>
                                    </button>
                                    <button
                                        onClick={() => handleDutyStatus('OFFLINE')}
                                        disabled={dutyStatus === 'ON_MISSION'}
                                        className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all ${dutyStatus === 'OFFLINE' ? 'bg-slate-700 border-slate-600 text-white shadow-lg' : 'bg-slate-800/50 border border-white/5 text-slate-400 hover:bg-slate-700 hover:text-white'} ${dutyStatus === 'ON_MISSION' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-power-off text-2xl mb-3"></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                                    </button>
                                    <button
                                        onClick={() => handleDutyStatus('ON_DUTY')}
                                        disabled={dutyStatus === 'ON_MISSION'}
                                        className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all ${dutyStatus === 'ON_DUTY' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white'} ${dutyStatus === 'ON_MISSION' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-id-badge text-2xl mb-3"></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">On Duty</span>
                                    </button>
                                </div>

                                <div className="mt-10 p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                                            <i className="fa-solid fa-clock-rotate-left"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Last HQ Update</p>
                                            <p className="text-white text-xs font-bold">{profile?.last_location_at ? new Date(profile.last_location_at).toLocaleString() : 'Waiting for link...'}</p>
                                        </div>
                                    </div>
                                    {lastLocation && (
                                        <div className="text-right">
                                            <p className="text-emerald-500 font-mono text-xs font-bold">{lastLocation.latitude.toFixed(5)}, {lastLocation.longitude.toFixed(5)}</p>
                                            <p className="text-[10px] text-slate-600 font-black uppercase">Live Telemetry</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Ongoing & Completed Missions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Ongoing tasks */}
                            <div className="portal-card">
                                <h3 className="text-lg font-black text-white tracking-tight mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-bolt text-yellow-500"></i> Ongoing Tasks
                                </h3>
                                <div className="space-y-4">
                                    {missions.ongoing.map(m => (
                                        <div key={m.id} className="p-4 bg-slate-900/60 border border-blue-500/20 rounded-2xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-xs text-white font-black">ID: {m.id.slice(0, 8)}</p>
                                                <span className="text-[9px] font-black uppercase px-2 py-1 bg-blue-500/10 text-blue-400 rounded">{m.status}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold">{new Date(m.created_at).toLocaleString()}</p>
                                        </div>
                                    ))}
                                    {missions.ongoing.length === 0 && <p className="text-center py-6 text-slate-600 text-xs italic">No ongoing missions</p>}
                                </div>
                            </div>
                            {/* Completed tasks */}
                            <div className="portal-card overflow-hidden">
                                <h3 className="text-lg font-black text-white tracking-tight mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500"></i> Completed
                                </h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {missions.completed.map(m => (
                                        <div key={m.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-slate-300 font-bold">ID: {m.id.slice(0, 8)}</p>
                                                <p className="text-[9px] text-slate-600 font-medium">{new Date(m.updated_at).toLocaleDateString()}</p>
                                            </div>
                                            <i className="fa-solid fa-check text-emerald-500"></i>
                                        </div>
                                    ))}
                                    {missions.completed.length === 0 && <p className="text-center py-6 text-slate-600 text-xs italic">No completed missions</p>}
                                </div>
                            </div>
                        </div>

                        {/* Recent History Table */}
                        <div className="portal-card">
                            <h3 className="text-xl font-black text-white tracking-tight mb-6">Satellite Log History</h3>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-white/5">
                                        <tr>
                                            <th className="pb-4">Timestamp</th>
                                            <th className="pb-4">GPS Coordinates</th>
                                            <th className="pb-4">Accuracy</th>
                                            <th className="pb-4">Link Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {locationHistory.map((item, idx) => (
                                            <tr key={idx} className="group hover:bg-white/[0.01]">
                                                <td className="py-4 font-bold text-white text-xs">{new Date(item.recorded_at).toLocaleString()}</td>
                                                <td className="py-4 font-mono text-slate-400 text-[11px]">{Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}</td>
                                                <td className="py-4 text-slate-500 text-xs">{item.accuracy_meters ? `${Math.round(item.accuracy_meters)}m` : '-'}</td>
                                                <td className="py-4">
                                                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Verified</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {locationHistory.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-12 text-center text-slate-600 italic">No telemetry data recorded yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* SOS Note Card */}
                        <div className="portal-card bg-gradient-to-br from-rose-900/20 to-transparent border-rose-500/20">
                            <h3 className="text-xl font-black text-rose-500 tracking-tight mb-2">Emergency Dispatch SOS</h3>
                            <p className="text-xs text-slate-500 font-medium mb-6">Alert control room about traffic or obstacles</p>
                            <form onSubmit={handleSos} className="space-y-4">
                                <textarea
                                    value={sosNote}
                                    onChange={(e) => setSosNote(e.target.value)}
                                    placeholder="e.g., Heavy jam at arterial road..."
                                    className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-rose-500 transition-all resize-none"
                                />
                                <button className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[11px] tracking-widest transition-all shadow-lg shadow-rose-900/20">
                                    Broadcast Alert
                                </button>
                            </form>
                            {profile?.sos_note && (
                                <div className="mt-6 p-4 bg-rose-900/10 rounded-xl border border-rose-500/20">
                                    <p className="text-[10px] text-rose-300 font-black uppercase mb-1">Last Broadcast</p>
                                    <p className="text-sm text-slate-300 font-medium italic">"{profile.sos_note}"</p>
                                </div>
                            )}
                        </div>

                        {/* Duty Summary Card */}
                        <div className="portal-card bg-slate-900/40">
                            <h3 className="text-lg font-black text-white tracking-tight mb-6">Duty Summary</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 font-bold">Registration Area</span>
                                    <span className="text-sm text-white font-bold">{profile?.district || user?.district}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 font-bold">Service Protocol</span>
                                    <span className="text-sm text-blue-500 font-black">108 V2.4</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 font-bold">Total Operations</span>
                                    <span className="text-xl text-white font-black">{missions.livesSaved || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="mt-12 pb-12 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">
                    Tamil Nadu Health Systems Project • Emergency Management
                </p>
            </footer>
        </div>
    );
};


const PortalStatCard = ({ icon, label, value, subtext, color, pulse }) => (
    <div className="portal-stat-card bg-slate-900/40 backdrop-blur-md">
        <div className={`portal-icon ${color === 'blue' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' :
            color === 'green' ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20' :
                color === 'orange' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' :
                    color === 'pink' ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' :
                        'bg-slate-800 text-slate-500 border border-white/5'} ${pulse ? 'animate-pulse' : ''}`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-black text-white tracking-tighter mb-1">{value}</h3>
        <p className="text-[10px] text-slate-600 font-bold uppercase">{subtext}</p>
    </div>
);

export default EmergencyPortalPage;

