/**
 * ReceptionistLoginPage.jsx
 * Dedicated login for receptionist portal
 * Uses /api/receptionist/login and stores receptionistToken
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const API_BASE = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;

const ReceptionistLoginPage = () => {
    const navigate = useNavigate();
    const [form, setForm]     = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) { toast.error('Enter email and password'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/receptionist/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email.trim(), password: form.password }),
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');

            // Store receptionist-specific token
            localStorage.setItem('receptionistToken', data.data.accessToken);
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('receptionistUser', JSON.stringify(data.data.user));

            toast.success(`Welcome, ${data.data.user.fullName || 'Receptionist'}!`);
            navigate('/receptionist');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0891b2,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            <Toaster position="top-right" />
            <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 420, boxShadow: '0 25px 60px rgba(0,0,0,.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>📋</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0e7490' }}>Receptionist Portal</h1>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>MedTrack Hospital Management</p>
                </div>

                <form onSubmit={onSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#374151', marginBottom: 6 }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            placeholder="receptionist@hospital.gov"
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#374151', marginBottom: 6 }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPw ? 'text' : 'password'}
                                required
                                value={form.password}
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                style={{ width: '100%', padding: '12px 44px 12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <button type="button" onClick={() => setShowPw(v => !v)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>
                                {showPw ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', padding: 13, background: loading ? '#a5f3fc' : 'linear-gradient(135deg,#0891b2,#0e7490)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? '⏳ Signing in...' : 'Sign In →'}
                    </button>
                </form>

                <div style={{ marginTop: 20, padding: '12px 14px', background: '#f0f9ff', borderRadius: 10, fontSize: 12, color: '#0e7490' }}>
                    <strong>Demo:</strong> Use credentials created by Hospital Admin
                </div>
            </div>
        </div>
    );
};

export default ReceptionistLoginPage;
