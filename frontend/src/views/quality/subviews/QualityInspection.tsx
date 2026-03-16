import { ClipboardCheck, Clock3, Info, ShieldCheck } from "lucide-react";

interface Props {
  projectId: number;
}

const QualityInspection: React.FC<Props> = () => {
  return (
    <div className="flex h-full items-center justify-center bg-surface-base">
      <div className="w-full max-w-4xl rounded-2xl border border-border-default bg-surface-card p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Standalone Inspection Module
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              This tab is reserved for the future standalone inspection module.
              QA/QC RFI checklist execution, stage locking, and approval
              workflow now run only under QA/QC Approvals.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ShieldCheck className="h-4 w-4 text-secondary" />
              QA/QC Approvals
            </div>
            <p className="text-sm text-text-muted">
              Open RFIs, complete checklist items, lock stages, approve
              workflow, reject, delegate, reverse, and download reports there.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Info className="h-4 w-4 text-warning" />
              Current Status
            </div>
            <p className="text-sm text-text-muted">
              This screen is intentionally non-operational for RFIs. No
              checklist editing or approval actions are available here.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Clock3 className="h-4 w-4 text-primary" />
              Planned Later
            </div>
            <p className="text-sm text-text-muted">
              A separate inspection workflow can be added here later without
              changing the current QA/QC RFI process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityInspection;
