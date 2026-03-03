import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

const Layout = ({ children }) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    // ... Implement layout logic (sidebar, navbar, footer)

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            {/* Header */}
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {children}
            </main>
        </div>
    );
};
export default Layout;
