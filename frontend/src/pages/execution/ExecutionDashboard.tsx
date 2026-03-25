import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { Folder, ChevronRight, Activity } from "lucide-react";
import ProjectProgress3DPanel from "../../components/planning/ProjectProgress3DPanel";

const ExecutionDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/eps"); // Reusing EPS list for now
      // Flatten and filter for Projects
      const flatten = (nodes: any[]): any[] => {
        let list: any[] = [];
        nodes.forEach((n) => {
          if (n.type === "PROJECT") list.push(n);
          if (n.children) list = list.concat(flatten(n.children));
        });
        return list;
      };
      const nextProjects = flatten(res.data);
      setProjects(nextProjects);
      setSelectedProjectId((current) => current ?? nextProjects[0]?.id ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-shell h-full overflow-auto">
      <div className="p-8 max-w-7xl mx-auto ui-animate-page">
        <h1 className="ui-title text-3xl mb-2">Site Execution</h1>
        <p className="text-text-muted mb-8">
          Select a project to enter progress and measurements.
        </p>

        {loading ? (
          <div className="animate-pulse flex gap-4">
            <div className="w-64 h-32 bg-surface-raised rounded-xl border border-border-default"></div>
            <div className="w-64 h-32 bg-surface-raised rounded-xl border border-border-default"></div>
            <div className="w-64 h-32 bg-surface-raised rounded-xl border border-border-default"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-default bg-surface-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Project List
                </div>
                <div className="mt-3 space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onMouseEnter={() => setSelectedProjectId(project.id)}
                      className={`ui-card ui-animate-card p-5 transition-all ${
                        selectedProjectId === project.id
                          ? "border-primary shadow-lg"
                          : "hover:border-primary hover:shadow-xl"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-primary-muted rounded-lg text-primary">
                          <Folder className="w-6 h-6" />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/dashboard/projects/${project.id}/progress`)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-primary"
                        >
                          Open
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-text-primary mb-1">
                        {project.name}
                      </h3>
                      <div className="flex items-center text-sm text-text-muted">
                        <Activity className="w-4 h-4 mr-1" />
                        <span>Hover to preview 3D progress</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedProjectId ? (
              <ProjectProgress3DPanel
                projectId={selectedProjectId}
                projectName={
                  projects.find((project) => project.id === selectedProjectId)?.name || "Project"
                }
                subtitle="Live 3D preview sourced from Building Lines > 3D Progress Model"
                autoRotate
                autoRotateSpeed={1.2}
                viewerClassName="h-[620px]"
              />
            ) : (
              <div className="text-center py-20 bg-surface-base rounded-lg border border-dashed border-border-strong">
                <p className="text-text-muted">No Projects found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionDashboard;
