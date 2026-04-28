import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import BackButton from "../components/common/BackButton";

const Dashboard = () => {
  const location = useLocation();
  const [showRouteLoader, setShowRouteLoader] = useState(false);
  const previousRouteKeyRef = useRef<string | null>(null);

  // Pages where we don't want a back button (top level)
  const hideBackBtn = [
    "/dashboard",
    "/dashboard/",
    "/dashboard/eps",
    "/dashboard/eps/",
  ].includes(location.pathname.toLowerCase());

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;

    if (previousRouteKeyRef.current === null) {
      previousRouteKeyRef.current = routeKey;
      return;
    }

    if (previousRouteKeyRef.current === routeKey) {
      return;
    }

    previousRouteKeyRef.current = routeKey;
    setShowRouteLoader(true);

    // Keep a short visible loading state so users get feedback
    // instead of seeing the previous page linger during route/data setup.
    const hideTimer = window.setTimeout(() => {
      setShowRouteLoader(false);
    }, 550);

    return () => window.clearTimeout(hideTimer);
  }, [location.hash, location.pathname, location.search]);

  return (
    <div className="ui-shell flex h-screen">
      <Sidebar />
      <main className="relative flex-1 flex flex-col overflow-hidden ui-animate-page">
        {!hideBackBtn && (
          <div className="ui-page-header px-6 py-2 flex items-center shadow-sm">
            <BackButton />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
        {showRouteLoader && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-surface-base/72 backdrop-blur-[2px]">
            <div className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-border-default bg-surface-card px-5 py-4 shadow-xl">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Loading page...
                </p>
                <p className="text-xs text-text-muted">
                  Please wait while we open the next screen.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
