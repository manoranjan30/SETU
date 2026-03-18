import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { pluginService, type PluginDefinition } from "../services/plugin.service";
import { useAuth } from "./AuthContext";

interface PluginRuntimeContextType {
  installs: PluginDefinition[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const PluginRuntimeContext = createContext<PluginRuntimeContextType | null>(null);

export const PluginRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [installs, setInstalls] = useState<PluginDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectId = useMemo(() => {
    const match = location.pathname.match(/\/dashboard\/projects\/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }, [location.pathname]);

  const refresh = async () => {
    if (!isAuthenticated) {
      setInstalls([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await pluginService.getRuntimeManifest(projectId);
      setInstalls(data.installs ?? []);
    } catch (error) {
      console.error("Failed to load plugin runtime manifest", error);
      setInstalls([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [isAuthenticated, projectId]);

  return (
    <PluginRuntimeContext.Provider value={{ installs, isLoading, refresh }}>
      {children}
    </PluginRuntimeContext.Provider>
  );
};

export const usePluginRuntime = () => {
  const context = useContext(PluginRuntimeContext);
  if (!context) {
    throw new Error("usePluginRuntime must be used within PluginRuntimeProvider");
  }
  return context;
};
