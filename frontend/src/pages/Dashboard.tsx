import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import BackButton from "../components/common/BackButton";

const Dashboard = () => {
  const location = useLocation();

  // Pages where we don't want a back button (top level)
  const hideBackBtn = [
    "/dashboard",
    "/dashboard/",
    "/dashboard/eps",
    "/dashboard/eps/",
  ].includes(location.pathname.toLowerCase());

  return (
    <div className="ui-shell flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden ui-animate-page">
        {!hideBackBtn && (
          <div className="ui-page-header px-6 py-2 flex items-center shadow-sm">
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
