import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import BackButton from '../components/common/BackButton';

const Dashboard = () => {
    const location = useLocation();

    // Pages where we don't want a back button (top level)
    const hideBackBtn = ['/dashboard', '/dashboard/', '/dashboard/eps', '/dashboard/eps/'].includes(location.pathname.toLowerCase());

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                {!hideBackBtn && (
                    <div className="bg-white border-b px-6 py-2 flex items-center">
                        <BackButton />
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
