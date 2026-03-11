import React, { useState } from "react";
import clsx from "clsx";
import VendorList from "./VendorList";
import WorkOrderList from "./WorkOrderList";
import WorkDocTemplateList from "./WorkDocTemplateList";
import GlobalMappingBoard from "./GlobalMappingBoard";

interface Props {
  projectId: number;
}

const WorkDocManager: React.FC<Props> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<
    "orders" | "vendors" | "templates" | "onboarding"
  >("orders");

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
          <GlobalMappingBoard projectId={projectId} />
        )}
      </div>
    </div>
  );
};

export default WorkDocManager;
