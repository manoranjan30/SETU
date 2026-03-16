import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Users, GitBranch } from "lucide-react";
import { releaseStrategyService, type ReleaseStrategyDto } from "../../../services/releaseStrategy.service";

export default function WorkflowDesignerPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<ReleaseStrategyDto[]>([]);
  const [actors, setActors] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!projectId) return;
      setLoading(true);
      try {
        const [allStrategies, eligibleActors] = await Promise.all([
          releaseStrategyService.list(Number(projectId), { moduleCode: "QUALITY" }),
          releaseStrategyService.getActors(Number(projectId)),
        ]);
        setStrategies(
          allStrategies
            .filter((item) => item.moduleCode === "QUALITY")
            .sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        );
        setActors(eligibleActors);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [projectId]);

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="bg-surface-card border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              navigate(`/dashboard/projects/${projectId}/quality/activity-lists`)
            }
            className="p-2 hover:bg-surface-raised rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              Quality Approval Map
            </h1>
            <p className="text-sm text-text-muted">
              Quality approvals now resolve from Release Strategy.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}/planning`)}
          className="px-4 py-2 bg-[#0E0E0E] text-white rounded-lg text-sm font-medium hover:bg-black"
        >
          Open Release Strategy
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-card border rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-xs uppercase tracking-widest text-text-muted">
                  Active Strategies
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {strategies.filter((s) => s.status === "ACTIVE").length}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-card border rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-xs uppercase tracking-widest text-text-muted">
                  Eligible Approvers
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {actors.length}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-card border rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-xs uppercase tracking-widest text-text-muted">
                  Quality Process
                </div>
                <div className="text-sm font-semibold text-text-primary mt-1">
                  QUALITY / Release Strategy Driven
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-2xl px-5 py-4 text-sm">
          This page is now read-only. Approval routing in Quality is controlled by
          Release Strategy, and project-scoped team members plus temporary users
          are resolved automatically at runtime.
        </div>

        {loading ? (
          <div className="bg-surface-card border rounded-2xl p-8 text-center text-text-muted">
            Loading quality release strategies...
          </div>
        ) : strategies.length === 0 ? (
          <div className="bg-surface-card border rounded-2xl p-8 text-center text-text-muted">
            No quality release strategies found for this project.
          </div>
        ) : (
          <div className="space-y-4">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="bg-surface-card border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b bg-surface-base flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      {strategy.name}
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                      {strategy.processCode}
                      {strategy.documentType ? ` • ${strategy.documentType}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-surface-raised text-text-secondary font-bold uppercase">
                      {strategy.status}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-bold uppercase">
                      Priority {strategy.priority || 0}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {(strategy.steps || [])
                    .slice()
                    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
                    .map((step) => (
                      <div
                        key={`${strategy.id}-${step.sequence}-${step.levelNo}`}
                        className="border rounded-xl p-4 bg-surface-base"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs uppercase tracking-widest text-text-muted">
                              Level {step.levelNo}
                            </div>
                            <div className="font-semibold text-text-primary">
                              {step.stepName}
                            </div>
                          </div>
                          <div className="text-sm text-text-secondary">
                            {step.approverMode === "USER"
                              ? "Specific User"
                              : "Project Role"}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
