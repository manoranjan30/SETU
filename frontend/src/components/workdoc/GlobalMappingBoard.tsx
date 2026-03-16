import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  Users,
  ShoppingCart,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import clsx from "clsx";

interface Assignment {
  woId: number;
  woNumber: string;
  vendorName: string;
  vendorCode: string;
  woItemId: number;
  woShortText: string;
  factor: number;
}

interface MappingRegistryItem {
  id: number;
  boqCode: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  status: "PENDING" | "PARTIAL" | "ASSIGNED";
  assignments: Assignment[];
  subItems: (any & { assignments: Assignment[]; status: string })[];
}

interface Props {
  projectId: number;
}

const GlobalMappingBoard: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<MappingRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<
    "ALL" | "PENDING" | "PARTIAL" | "ASSIGNED"
  >("ALL");

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workdoc/${projectId}/global-registry`);
      setData(res.data);
    } catch (e) {
      toast.error("Failed to load mapping registry");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.boqCode.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" || item.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading)
    return (
      <div className="p-20 flex justify-center">
        <Loader2 className="animate-spin text-primary h-10 w-10" />
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-surface-base/30">
      {/* Header / Filter Bar */}
      <div className="bg-surface-card border-b border-border-default px-6 py-4 flex flex-wrap items-center gap-6 shadow-sm z-10">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled w-4 h-4" />
          <input
            type="text"
            placeholder="Search BOQ items or codes..."
            className="w-full pl-10 pr-4 py-2 bg-surface-base border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-border-default">
          {(["ALL", "PENDING", "PARTIAL", "ASSIGNED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                filter === f
                  ? "bg-surface-card text-primary shadow-sm"
                  : "text-text-muted hover:text-slate-800",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-l border-border-default pl-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-text-disabled uppercase tracking-tighter leading-none">
              Total Items
            </p>
            <p className="text-lg font-black text-slate-900">{data.length}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-right">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-tighter leading-none">
              Pending
            </p>
            <p className="text-lg font-black text-orange-600">
              {data.filter((i) => i.status === "PENDING").length}
            </p>
          </div>
        </div>
      </div>

      {/* List View */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {filteredData.map((item) => (
          <div
            key={item.id}
            className="bg-surface-card rounded-3xl border border-border-default shadow-sm overflow-hidden transition-all hover:shadow-lg hover:border-blue-100"
          >
            {/* Header Row */}
            <div className="p-5 flex items-center gap-4">
              <button
                onClick={() => toggleExpand(item.id)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-text-disabled"
              >
                {expandedItems.has(item.id) ? (
                  <ChevronDown size={20} />
                ) : (
                  <ChevronRight size={20} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                    {item.boqCode}
                  </span>
                  <h4 className="font-bold text-slate-900 truncate">
                    {item.description}
                  </h4>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-text-disabled font-bold uppercase tracking-wider">
                  <span>
                    {item.qty} {item.uom}
                  </span>
                  <span>Rate: ₹{item.rate}</span>
                  <span>Amount: ₹{Number(item.amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Assignment Indicators */}
                <div className="flex -space-x-2">
                  {item.assignments.map((a, idx) => (
                    <div
                      key={idx}
                      title={`${a.vendorName} (${a.woNumber})`}
                      className="w-8 h-8 rounded-full bg-primary border-2 border-white flex items-center justify-center text-white text-[10px] font-black shadow-sm"
                    >
                      {a.vendorName.charAt(0)}
                    </div>
                  ))}
                  {item.status === "PENDING" && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-text-disabled">
                      <Users size={14} />
                    </div>
                  )}
                </div>

                <div
                  className={clsx(
                    "px-4 py-2 rounded-2xl flex items-center gap-2 border text-[10px] font-black tracking-widest uppercase",
                    item.status === "ASSIGNED"
                      ? "bg-success-muted text-green-700 border-green-200"
                      : item.status === "PARTIAL"
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "bg-slate-100 text-text-muted border-border-default",
                  )}
                >
                  {item.status === "ASSIGNED" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  {item.status}
                </div>
              </div>
            </div>

            {/* Expanded Content: Assignments & Sub-Items */}
            {expandedItems.has(item.id) && (
              <div className="bg-surface-base border-t border-slate-100 px-12 py-6 space-y-6">
                {/* Global Item Assignments */}
                {item.assignments.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-black text-text-disabled uppercase tracking-widest mb-3 flex items-center gap-2">
                      <LinkIcon size={12} /> Direct Item Assignments
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {item.assignments.map((a, idx) => (
                        <div
                          key={idx}
                          className="bg-surface-card p-4 rounded-2xl border border-border-default flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-xs font-black text-slate-900">
                              {a.vendorName}
                            </p>
                            <p className="text-[10px] text-text-disabled font-mono mt-0.5">
                              {a.woNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-primary uppercase">
                              Linked Item
                            </p>
                            <p className="text-[10px] text-text-disabled truncate max-w-[150px]">
                              {a.woShortText}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Items Grid */}
                {item.subItems.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-black text-text-disabled uppercase tracking-widest mb-3 flex items-center gap-2">
                      <ShoppingCart size={12} /> Granular Breakdown (Floor-wise
                      Mapping)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {item.subItems.map((sub: any) => (
                        <div
                          key={sub.id}
                          className={clsx(
                            "bg-surface-card p-4 rounded-2xl border transition-all",
                            sub.status === "ASSIGNED"
                              ? "border-green-100 bg-success-muted/20"
                              : "border-border-default",
                          )}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h6 className="text-sm font-bold text-slate-800">
                              {sub.description}
                            </h6>
                            <div
                              className={clsx(
                                "w-2 h-2 rounded-full",
                                sub.status === "ASSIGNED"
                                  ? "bg-success shadow-lg shadow-green-200"
                                  : "bg-slate-300",
                              )}
                            />
                          </div>

                          {sub.assignments.length > 0 ? (
                            <div className="space-y-2">
                              {sub.assignments.map((a: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[10px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-info-muted text-primary flex items-center justify-center font-black">
                                      {a.vendorName.charAt(0)}
                                    </div>
                                    <span className="font-bold text-text-secondary">
                                      {a.vendorName}
                                    </span>
                                  </div>
                                  <span className="font-mono text-text-disabled">
                                    {a.woNumber}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-2 text-center text-[10px] font-black text-slate-300 uppercase italic">
                              Pending Onboarding
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.assignments.length === 0 &&
                  item.subItems.length === 0 && (
                    <div className="py-10 bg-surface-card rounded-2xl border-2 border-dashed border-border-default text-center">
                      <Users
                        className="mx-auto text-slate-300 mb-2"
                        size={32}
                      />
                      <p className="text-sm font-bold text-text-muted">
                        No vendor assignments found for this item.
                      </p>
                      <button className="mt-4 px-6 py-2 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary-dark transition-all shadow-xl shadow-blue-100">
                        ASSIGN VENDOR
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalMappingBoard;
