import React, { useState } from "react";
import clsx from "clsx";
import VendorList from "./VendorList";
import WorkOrderList from "./WorkOrderList";
import WorkDocTemplateList from "./WorkDocTemplateList";
import GlobalMappingBoard from "./GlobalMappingBoard";
import PendingVendorBoard from "./PendingVendorBoard";

interface Props {
  projectId: number;
}

const WorkDocManager: React.FC<Props> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<
    "orders" | "vendors" | "templates" | "onboarding"
  >("orders");
  const [onboardingTab, setOnboardingTab] = useState<"registry" | "pending">(
    "registry",
  );

  return (
    <div className="h-full flex flex-col bg-surface-card shadow rounded-lg overflow-hidden">
      <div className="bg-surface-base border-b border-border-default px-8 py-4 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">
          Contract Management
        </h2>
        <nav
          className="flex bg-slate-200 p-1 rounded-xl border border-slate-300 shadow-inner"
          aria-label="Tabs"
        >
          {[
            { id: "orders", label: "Work Orders" },
            { id: "vendors", label: "Vendors" },
            { id: "onboarding", label: "Vendor Onboarding" },
            { id: "templates", label: "Parsing Templates" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "whitespace-nowrap py-2 px-6 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                activeTab === tab.id
                  ? "bg-surface-card text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto relative bg-surface-card">
        {activeTab === "orders" && <WorkOrderList />}
        {activeTab === "vendors" && <VendorList />}
        {activeTab === "templates" && <WorkDocTemplateList />}
        {activeTab === "onboarding" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border-default bg-surface-base px-6 py-3">
              <div className="flex w-fit rounded-xl border border-border-default bg-slate-100 p-1">
                {[
                  { id: "registry", label: "Vendor On Board" },
                  { id: "pending", label: "Pending Vendor On Board" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setOnboardingTab(tab.id as "registry" | "pending")
                    }
                    className={clsx(
                      "rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      onboardingTab === tab.id
                        ? "bg-surface-card text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {onboardingTab === "registry" ? (
                <GlobalMappingBoard projectId={projectId} />
              ) : (
                <PendingVendorBoard projectId={projectId} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkDocManager;
