import React from 'react';
import { GitCompare, Clock, ArrowRight } from 'lucide-react';

interface ScheduleComparisonProps {
    data: {
        revisions: { v1: string; v2: string };
        changes: Array<{
            activity: string;
            currentDates: { start: string; finish: string };
            impact: 'delayed' | 'advanced' | 'neutral';
            value: number;
        }>;
    };
    loading?: boolean;
}

const ScheduleComparison: React.FC<ScheduleComparisonProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-[300px] animate-pulse">
                <div className="h-6 bg-slate-100 rounded w-1/3 mb-6"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-slate-50 rounded-xl w-full"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <GitCompare className="w-5 h-5 text-indigo-500" />
                        Schedule Revisions
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Comparing {data.revisions.v2} vs {data.revisions.v1}</p>
                </div>
                <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                    View Full Diff
                </button>
            </div>

            <div className="space-y-3">
                {data.changes.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">No significant schedule changes detected.</div>
                ) : (
                    data.changes.slice(0, 5).map((change, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-700 truncate mb-1">{change.activity}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(change.currentDates.finish).toLocaleDateString()}</span>
                                    <ArrowRight className="w-3 h-3" />
                                    <span className={change.impact === 'delayed' ? 'text-amber-600' : 'text-emerald-600'}>
                                        {change.impact === 'delayed' ? 'Delayed' : 'Improved'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-black text-slate-800 block">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(change.value)}
                                </span>
                                <span className="text-[10px] text-slate-400">Impact Value</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ScheduleComparison;
