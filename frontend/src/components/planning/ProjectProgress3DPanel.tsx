import { useEffect, useState } from "react";
import BuildingProgress3DTab from "./BuildingProgress3DTab";
import {
  buildingLineCoordinatesService,
  type BuildingLineNode,
  type TowerProgressResponse,
} from "../../services/buildingLineCoordinates.service";

const PROJECT_PROGRESS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type ProjectProgress3DCacheEntry = {
  savedAt: number;
  root: BuildingLineNode | null;
  towerProgress: TowerProgressResponse | null;
};

type ProjectProgress3DPanelProps = {
  projectId: number;
  projectName: string;
  subtitle?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  viewerClassName?: string;
};

export default function ProjectProgress3DPanel({
  projectId,
  projectName,
  subtitle,
  autoRotate = false,
  autoRotateSpeed = 0.8,
  viewerClassName = "h-[420px]",
}: ProjectProgress3DPanelProps) {
  const [root, setRoot] = useState<BuildingLineNode | null>(null);
  const [towerProgress, setTowerProgress] = useState<TowerProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [error, setError] = useState("");

  const getCacheKey = (targetProjectId: number) => `setu.project-progress-3d.${targetProjectId}`;

  const readCache = (targetProjectId: number): ProjectProgress3DCacheEntry | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getCacheKey(targetProjectId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ProjectProgress3DCacheEntry;
      if (!parsed?.savedAt) return null;
      const isExpired = Date.now() - parsed.savedAt > PROJECT_PROGRESS_CACHE_TTL_MS;
      if (isExpired) {
        window.localStorage.removeItem(getCacheKey(targetProjectId));
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCache = (
    targetProjectId: number,
    nextRoot: BuildingLineNode | null,
    nextTowerProgress: TowerProgressResponse | null,
  ) => {
    if (typeof window === "undefined") return;
    try {
      const payload: ProjectProgress3DCacheEntry = {
        savedAt: Date.now(),
        root: nextRoot,
        towerProgress: nextTowerProgress,
      };
      window.localStorage.setItem(getCacheKey(targetProjectId), JSON.stringify(payload));
    } catch {
      // Ignore cache write failures and keep the live response.
    }
  };

  const load = async () => {
    if (!projectId) return;
    const cached = readCache(projectId);
    if (cached) {
      setRoot(cached.root);
      setTowerProgress(cached.towerProgress);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [structure, progress] = await Promise.all([
        buildingLineCoordinatesService.getStructure(projectId),
        buildingLineCoordinatesService.getTowerProgress(projectId),
      ]);
      setRoot(structure);
      setTowerProgress(progress);
      writeCache(projectId, structure, progress);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load 3D progress data.");
      setRoot(null);
      setTowerProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProgress = async () => {
    if (!projectId) return;
    setLoadingProgress(true);
    setError("");
    try {
      const [structure, progress] = await Promise.all([
        buildingLineCoordinatesService.getStructure(projectId),
        buildingLineCoordinatesService.getTowerProgress(projectId),
      ]);
      setRoot(structure);
      setTowerProgress(progress);
      writeCache(projectId, structure, progress);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to refresh 3D progress data.");
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  return (
    loading ? (
      <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
        <div className={`${viewerClassName} flex items-center justify-center text-sm text-text-muted`}>
          Loading 3D project view...
        </div>
      </div>
    ) : error ? (
      <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
        <div className={`${viewerClassName} flex items-center justify-center px-6 text-center text-sm text-text-muted`}>
          {error}
        </div>
      </div>
    ) : root ? (
      <BuildingProgress3DTab
        root={root as any}
        towerProgress={towerProgress}
        loadingProgress={loadingProgress}
        onRefresh={() => void refreshProgress()}
        displayMode="viewerOnly"
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
        viewerClassName={viewerClassName}
        panelTitle={projectName}
        panelSubtitle={subtitle}
      />
    ) : (
      <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
        <div className={`${viewerClassName} flex items-center justify-center text-sm text-text-muted`}>
          No 3D structure available for this project yet.
        </div>
      </div>
    )
  );
}
