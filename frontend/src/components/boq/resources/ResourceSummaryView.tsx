import React, { useState, useEffect } from "react";
import {
  Download,
  Loader,
  PieChart,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Package,
  User,
  PenTool,
  Truck,
  Box,
} from "lucide-react";
import api from "../../../api/axios";

interface ResourceSummaryViewProps {
  projectId: number;
}

interface ResourceTotal {
  resourceCode: string;
  resourceName: string;
  uom: string;
  totalQty: number;
  standardRate: number;
  totalAmount: number;
  type: string;
}

interface BoqItemSummary {
  id: number;
  boqCode: string;
  description: string;
  totalAmount: number;
  resources: ResourceTotal[];
}

const ResourceSummaryView: React.FC<ResourceSummaryViewProps> = ({
  projectId,
}) => {
  const [aggregated, setAggregated] = useState<ResourceTotal[]>([]);
  const [boqBreakdown, setBoqBreakdown] = useState<BoqItemSummary[]>([]);
  const [typeTotals, setTypeTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedBoqs, setExpandedBoqs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (projectId) fetchTotals();
  }, [projectId]);

  const fetchTotals = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/resources/project-totals/${projectId}`);
      setAggregated(res.data.aggregated || []);
      setBoqBreakdown(res.data.boqBreakdown || []);
      setTypeTotals(res.data.typeTotals || {});
    } catch (err) {
      console.error(err);
      setError("Failed to load resource analysis");
    } finally {
      setLoading(false);
    }
  };

  const toggleBoq = (id: number) => {
    const next = new Set(expandedBoqs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedBoqs(next);
  };

  const overallTotal = aggregated.reduce(
    (sum, item) => sum + item.totalAmount,
    0,
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "MATERIAL":
        return <Package className="w-4 h-4" />;
      case "LABOR":
        return <User className="w-4 h-4" />;
      case "PLANT":
        return <Truck className="w-4 h-4" />;
      case "SUBCONTRACT":
        return <PenTool className="w-4 h-4" />;
      default:
        return <Box className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 px-6 py-4 border-b border-border-default bg-surface-card flex justify-between items-center z-10">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Project Resource Analysis
          </h2>
          <p className="text-xs text-text-muted">
            Estimated resource requirements and cost distributions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-success-muted px-4 py-2 rounded-lg border border-success">
            <div className="text-[10px] text-success uppercase font-bold tracking-wider">
              Project Grand Total
            </div>
            <div className="text-xl font-black text-success tabular-nums">
              {overallTotal.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <button
            title="Export Data"
            className="p-2 bg-surface-raised hover:bg-surface-base rounded-full text-text-secondary transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-disabled">
            <Loader className="w-8 h-8 text-primary animate-spin mb-2" />
            <p className="text-sm">Calculating resource requirements...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-error-muted text-error rounded-md border border-red-200 text-sm">
            {error}
          </div>
        ) : aggregated.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-disabled">
            <PieChart className="w-16 h-16 mb-4 opacity-10" />
            <p>No mapped resources found for this project.</p>
          </div>
        ) : (
          <>
            {/* Category Summary Cards */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-bold text-text-disabled uppercase tracking-widest">
                  Cost Summary by Category
                </h3>
                <div className="h-px flex-1 bg-border-subtle"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(typeTotals)
                  .filter(([_, val]) => val > 0)
                  .map(([type, amount]) => (
                    <div
                      key={type}
                      className="bg-surface-card p-4 rounded-xl border border-border-subtle hover:border-border-strong transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-2 text-primary group-hover:scale-110 transition-transform origin-left">
                        {getTypeIcon(type)}
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {type}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-text-primary tabular-nums">
                        {amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[10px] text-text-disabled mt-1">
                        {((amount / overallTotal) * 100).toFixed(1)}% of Project
                        Cost
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Hierarchical BOQ Breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-bold text-text-disabled uppercase tracking-widest">
                  BOQ Item Hierarchical Breakdown
                </h3>
                <div className="h-px flex-1 bg-border-subtle"></div>
              </div>
              <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse [font-variant-numeric:tabular-nums]">
                    <thead className="bg-surface-base text-[10px] font-bold text-text-muted uppercase tracking-[0.16em] border-b border-border-default sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 w-10"></th>
                        <th className="px-6 py-3">Code / Description</th>
                        <th className="px-6 py-3 text-right">Qty / Rate</th>
                        <th className="px-6 py-3 text-right">UOM</th>
                        <th className="px-6 py-3 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {boqBreakdown.map((boq) => (
                        <React.Fragment key={boq.id}>
                          <tr
                            className="hover:bg-surface-base cursor-pointer transition-colors"
                            onClick={() => toggleBoq(boq.id)}
                          >
                            <td className="px-6 py-4">
                              {expandedBoqs.has(boq.id) ? (
                                <ChevronDown className="w-4 h-4 text-primary" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-text-disabled" />
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs text-text-disabled font-bold mb-0.5 tabular-nums">
                                {boq.boqCode}
                              </div>
                              <div className="font-bold text-text-primary">
                                {boq.description}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right italic text-text-disabled text-xs">
                              Derived from measurements
                            </td>
                            <td className="px-6 py-4 text-right"></td>
                            <td className="px-6 py-4 text-right font-black text-text-primary bg-surface-base/30">
                              {boq.totalAmount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                          {expandedBoqs.has(boq.id) &&
                            boq.resources.map((res) => (
                              <tr
                                key={`${boq.id}-${res.resourceCode}`}
                                className="bg-surface-card border-l-2 border-border-strong"
                              >
                                <td className="px-6 py-2"></td>
                                <td className="px-6 py-2 pl-12 flex items-center gap-2">
                                  <div className="text-primary">
                                    {getTypeIcon(res.type)}
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-text-disabled leading-tight tabular-nums">
                                      {res.resourceCode}
                                    </div>
                                    <div className="text-xs font-semibold text-text-primary">
                                      {res.resourceName}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-2 text-right">
                                  <div className="text-xs font-bold text-text-secondary">
                                    {res.totalQty.toLocaleString("en-IN", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                  <div className="text-[10px] text-text-disabled italic">
                                    @ {res.standardRate.toLocaleString("en-IN")}
                                  </div>
                                </td>
                                <td className="px-6 py-2 text-right text-[10px] font-bold text-text-muted uppercase">
                                  {res.uom}
                                </td>
                                <td className="px-6 py-2 text-right font-bold text-primary tabular-nums">
                                  {res.totalAmount.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Consolidated Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-bold text-text-disabled uppercase tracking-widest">
                  Consolidated Project Requirements
                </h3>
                <div className="h-px flex-1 bg-border-subtle"></div>
              </div>
              <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap [font-variant-numeric:tabular-nums]">
                    <thead className="bg-surface-base text-[10px] font-bold text-text-muted uppercase tracking-[0.16em] border-b border-border-default sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4">Resource Info</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4 text-center">UOM</th>
                        <th className="px-6 py-4 text-right">Total Qty</th>
                        <th className="px-6 py-4 text-right">Std. Rate</th>
                        <th className="px-6 py-4 text-right">Ext. Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {aggregated.map((item) => (
                        <tr
                          key={item.resourceCode}
                          className="hover:bg-surface-base transition-colors"
                        >
                          <td className="px-6 py-3">
                            <div className="text-xs text-text-disabled leading-tight tabular-nums">
                              {item.resourceCode}
                            </div>
                            <div className="font-bold text-text-primary">
                              {item.resourceName}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-text-muted bg-surface-raised px-2 py-1 rounded-md w-fit font-bold uppercase tracking-tighter">
                              {getTypeIcon(item.type)}
                              {item.type}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center text-text-muted font-bold uppercase text-[10px]">
                            {item.uom}
                          </td>
                          <td className="px-6 py-3 text-right font-black text-text-secondary">
                            {item.totalQty.toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-3 text-right text-text-disabled text-xs tabular-nums">
                            {item.standardRate.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-3 text-right font-black text-success bg-success-muted/30 tabular-nums">
                            {item.totalAmount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResourceSummaryView;
