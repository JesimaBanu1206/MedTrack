
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountVerificationPage from './pages/AccountVerificationPage';
import ErrorPage from './pages/ErrorPage';
import MaintenancePage from './pages/MaintenancePage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ServerErrorPage from './pages/ServerErrorPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import LoadingPage from './pages/LoadingPage';
import ProfilePage from './pages/ProfilePage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import ReportsPage from './pages/ReportsPage';
import HealthStatsPage from './pages/HealthStatsPage';
import HealthTipsPage from './pages/HealthTipsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import EmergencyDriverRegisterPage from './pages/EmergencyDriverRegisterPage';
import EmergencyDriverLoginPage from './pages/EmergencyDriverLoginPage';
import EmergencyPortalPage from './pages/EmergencyPortalPage';

function App() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Toaster position="top-right" />
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<AccountVerificationPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/server-error" element={<ServerErrorPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="/super-admin" element={<SuperAdminPage />} />
                <Route path="/emergency/register" element={<EmergencyDriverRegisterPage />} />
                <Route path="/emergency/login" element={<EmergencyDriverLoginPage />} />

                {/* Protected Routes */}
                <Route
                    path="/emergency/portal"
                    element={
                        <ProtectedRoute allowedRoles={['AMBULANCE']}>
                            <EmergencyPortalPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <ProfilePage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/prescriptions"
                    element={
                        <ProtectedRoute>
                            <PrescriptionsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <ReportsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/stats"
                    element={
                        <ProtectedRoute>
                            <HealthStatsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tips"
                    element={
                        <ProtectedRoute>
                            <HealthTipsPage />
                        </ProtectedRoute>
                    }
                />

                {/* Catch all */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Router>
    );
}

export default App;
