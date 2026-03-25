import { useEffect, useState } from "react";
import BuildingProgress3DTab from "./BuildingProgress3DTab";
import {
  buildingLineCoordinatesService,
  type BuildingLineNode,
  type TowerProgressResponse,
} from "../../services/buildingLineCoordinates.service";

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

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const [structure, progress] = await Promise.all([
        buildingLineCoordinatesService.getStructure(projectId),
        buildingLineCoordinatesService.getTowerProgress(projectId),
      ]);
      setRoot(structure);
      setTowerProgress(progress);
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
    try {
      const progress = await buildingLineCoordinatesService.getTowerProgress(projectId);
      setTowerProgress(progress);
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
