import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import api from "../../../api/axios";

type DashboardItem = {
  id: number;
  status: string;
  activity?: { activityName?: string };
  pendingApprovalLevel?: number | null;
  pendingApprovalLabel?: string | null;
  pendingApprovalDisplay?: string | null;
  stageApprovalSummary?: {
    approvedStages?: number;
    totalStages?: number;
    pendingFinalApproval?: boolean;
  };
};

type ApprovalDashboardResponse = {
  actor?: {
    displayName?: string;
    companyLabel?: string;
    primaryRoleLabel?: string | null;
  } | null;
  counts?: {
    pendingForMe?: number;
    approvedByMe?: number;
    stageApprovedPendingFinal?: number;
  };
  pendingForMe?: DashboardItem[];
  approvedByMe?: DashboardItem[];
  stageApprovedPendingFinal?: DashboardItem[];
};

interface Props {
  projectId: number;
}

function ApprovalList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: DashboardItem[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-card p-5">
      <div className="text-sm font-semibold text-text-primary">{title}</div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default px-4 py-5 text-sm text-text-muted">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${title}-${item.id}`}
              className="rounded-xl border border-border-subtle bg-surface-base px-4 py-3"
            >
              <div className="text-sm font-semibold text-text-primary">
                {item.activity?.activityName || `Inspection #${item.id}`}
              </div>
              <div className="mt-2 space-y-1 text-xs text-text-secondary">
                {item.pendingApprovalLevel ? (
                  <div>
                    {item.pendingApprovalDisplay ||
                      `Level ${item.pendingApprovalLevel} Pending${
                        item.pendingApprovalLabel
                          ? `: ${item.pendingApprovalLabel}`
                          : ""
                      }`}
                  </div>
                ) : null}
                {item.stageApprovalSummary?.totalStages ? (
                  <div>
                    Stage approvals:{" "}
                    {item.stageApprovalSummary.approvedStages || 0}/
                    {item.stageApprovalSummary.totalStages}
                    {item.stageApprovalSummary.pendingFinalApproval
                      ? " - pending final approval"
                      : ""}
                  </div>
                ) : null}
                <div>Status: {item.status}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function QualityApprovalDashboard({ projectId }: Props) {
  const [dashboard, setDashboard] = useState<ApprovalDashboardResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get("/quality/inspections/approval-dashboard", {
        params: { projectId },
      })
      .then((res) => {
        if (mounted) setDashboard(res.data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-card p-6 text-sm text-text-muted">
        Loading quality approval dashboard...
      </div>
    );
  }

  const counts = dashboard?.counts || {};

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border-default bg-surface-card p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Quality Approval Board
        </div>
        <div className="mt-2 text-2xl font-bold text-text-primary">
          {dashboard?.actor?.displayName || "Approver"}
        </div>
        <div className="mt-1 text-sm text-text-secondary">
          {[dashboard?.actor?.companyLabel, dashboard?.actor?.primaryRoleLabel]
            .filter(Boolean)
            .join(" - ") || "Project-scoped approval queue"}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-warning-muted px-4 py-4">
            <div className="flex items-center gap-2 text-amber-800">
              <Clock3 className="h-4 w-4" />
              <span className="text-sm font-semibold">Pending For Me</span>
            </div>
            <div className="mt-3 text-3xl font-bold text-amber-900">
              {counts.pendingForMe || 0}
            </div>
          </div>
          <div className="rounded-2xl bg-success-muted px-4 py-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Approved By Me</span>
            </div>
            <div className="mt-3 text-3xl font-bold text-emerald-900">
              {counts.approvedByMe || 0}
            </div>
          </div>
          <div className="rounded-2xl bg-info-muted px-4 py-4">
            <div className="flex items-center gap-2 text-blue-800">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Stage Approved, Pending Final
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-blue-900">
              {counts.stageApprovedPendingFinal || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ApprovalList
          title="Pending For My Approval"
          items={dashboard?.pendingForMe || []}
          emptyText="No inspections are currently waiting for your signoff."
        />
        <ApprovalList
          title="Approved By Me"
          items={dashboard?.approvedByMe || []}
          emptyText="Your completed approval levels will appear here."
        />
        <ApprovalList
          title="Stage Approved, Waiting For Final"
          items={dashboard?.stageApprovedPendingFinal || []}
          emptyText="Nothing is stuck between stage signoff and final approval."
        />
      </div>
    </div>
  );
}
