import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { Folder, ChevronRight, Activity } from "lucide-react";

const ExecutionDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      setProjects(flatten(res.data));
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ui-stagger">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() =>
                  navigate(`/dashboard/projects/${project.id}/progress`)
                }
                className="ui-card ui-animate-card p-6 hover:border-primary hover:shadow-xl transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-muted rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Folder className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-1">
                  {project.name}
                </h3>
                <div className="flex items-center text-sm text-text-muted">
                  <Activity className="w-4 h-4 mr-1" />
                  <span>Tap to Enter Progress</span>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-3 text-center py-20 bg-surface-base rounded-lg border border-dashed border-border-strong">
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
