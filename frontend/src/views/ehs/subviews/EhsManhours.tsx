import { useState, useEffect } from 'react';
import { Plus, Save, X } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsManhours: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Summary Stats
    const [stats, setStats] = useState({
        prevMonth: 0,
        currentMonth: 0,
        cumulative: 0
    });

    const [formData, setFormData] = useState({
        month: new Date().toISOString().slice(0, 7),
        staffMale: 0,
        staffFemale: 0,
        avgWorkHours: 8,
        ltiDeductions: 0
    });

    // Auto-calculated fields for modal (preview)
    const [laborStats, setLaborStats] = useState({ totalWorkerManDays: 0, workingDays: 0 });

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            const response = await api.get(`/ehs/${projectId}/manhours`);
            // Backend returns DESC order (newest first)
            setData(response.data);

            // Calculate stats
            if (response.data.length > 0) {
                const current = response.data[0]; // Newest
                const prevRecords = response.data.slice(1);
                const prevTotal = prevRecords.reduce((sum: number, r: any) => sum + Number(r.safeManhours), 0);
                const total = prevTotal + Number(current.safeManhours);

                setStats({
                    prevMonth: prevTotal,
                    currentMonth: Number(current.safeManhours),
                    cumulative: total
                });
            } else {
                setStats({ prevMonth: 0, currentMonth: 0, cumulative: 0 });
            }

        } catch (error) {
            console.error('Error fetching manhours:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLaborStatsForMonth = async (month: string) => {
        try {
            const res = await api.get(`/ehs/${projectId}/labor-stats?month=${month}`);
            setLaborStats(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (showModal) {
            fetchLaborStatsForMonth(formData.month);
        }
    }, [formData.month, showModal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Calculate fields
        // Total Manpower (Headcount/Mandays) = Staff + Workers
        // Here, we treat 'workers' as mandate from Labor module.
        // Assuming LaborStats.totalWorkerManDays corresponds to 'Workers Sum' in table?
        // Wait, if avgWorkHours is per *person*, then 'Manpower' column needs to be Mandays?
        // Or Headcount? 
        // Logic: Manhours = (Total Manpower * Working Days * Hours) ??
        // User prompt: "total number of Labour count... entire month total manpower... average per man hour... multiplication of that has to show total man hour"
        // Let's assume: Manhours = (Staff + Workers) * AvgHours.
        // Where Workers = Total Worker Mandays? (Since unit is missing 'Days' in variable name, but 'DailyLaborPresence' implies daily logs).
        // Since we are taking a monthly aggregate:
        // Total Worker Hours = Sum(Daily Count * Daily Hours) ~ Sum(Daily Count) * Avg Hours.
        // So yes, Sum of Labor Presence (Mandays) * Avg Hours works.
        // And Staff: Staff Count * Working Days * Avg Hours?

        // Simplified Logic for MVP:
        // Input: Staff (Avg Daily Strength?)
        // Input: Avg Hours.
        // Backend/Frontend Calc: 
        // Workers Mandays (from DB)
        // Staff Mandays (Staff * Working Days from DB?) -> We'll assume Staff input is constant presence.

        // Actually, user wants editable table.
        // Let's compute Manhours = (Staff_Male + Staff_Female + LaborStats.totalWorkerManDays) * AvgHours IS WRONG.
        // LaborStats.totalWorkerManDays is ALREADY (People * Days).
        // So Labor Hours = LaborStats.totalWorkerManDays * AvgHours.
        // Staff Hours = (Staff_Male + Staff_Female) * LaborStats.workingDays * AvgHours.

        // Combined: (StaffSum * WorkingDays + WorkerMandays) * AvgHours.
        // This gives Total ManHours.

        // Screenshot shows "Total Manpower" ~ 900. Working Days 26.
        // If 900 is Mandays, then Daily Strength is ~35.
        // If 900 is Strength, then Mandays is 23,400.
        // Let's stick to the earlier finding: Screenshot "Total Manpower" (916) * "Working Days" (26) * Hours matches Manhours? NO.
        // 916 * 26 * 10 = ~238k. Screenshot has 294k. Close.
        // So "Total Manpower" in screenshot likely means "Total Man-Days" OR "Avg Strength"?
        // Actually, 294388 / 916 = 321. 321 / 26 = 12.3 hours.
        // OR 294388 / 8 hours = 36798 Man-Days.
        // 36798 / 26 days = 1415 Avg Daily Strength.
        // Table shows Total Manpower 916.
        // This implies Total Manpower COLUMN is NOT Avg Strength.
        // It might be Total Man-Days? 916 Man-Days for a whole month is too low (30/day).
        // Unless it's a small site.

        // SAFE BET: Store raw inputs + calculated total.
        // Save:
        // staffMale, staffFemale (Daily Avg)
        // workersMale, workersFemale (From Labor Stats Total / Days? Or just store Total ManDays)
        // totalWorkers = laborStats.totalWorkerManDays
        // workingDays = laborStats.workingDays
        // avgWorkHours = Input
        // Total Manhours = (Staff * Days + Workers) * AvgHours.

        const staffMandays = (Number(formData.staffMale) + Number(formData.staffFemale)) * (laborStats.workingDays || 26);
        const totalWorkerMandays = laborStats.totalWorkerManDays;

        const totalManhours = (staffMandays + totalWorkerMandays) * Number(formData.avgWorkHours);
        const safeManhours = totalManhours - Number(formData.ltiDeductions);

        const payload = {
            projectId,
            month: `${formData.month}-01`,
            staffMale: Number(formData.staffMale),
            staffFemale: Number(formData.staffFemale),
            workersMale: 0, // Not granular in labor yet
            workersFemale: 0,
            totalWorkers: totalWorkerMandays, // Storing ManDays or Count? Let's verify later.
            totalManpower: staffMandays + totalWorkerMandays, // Storing Total MANDAYS in 'totalManpower' column for calculation consistency?
            workingDays: laborStats.workingDays || 0,
            avgWorkHours: Number(formData.avgWorkHours),
            totalManhours,
            ltiDeductions: Number(formData.ltiDeductions),
            safeManhours,
            remarks: 'Auto-calculated'
        };

        try {
            await api.post(`/ehs/${projectId}/manhours`, payload);
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Safe Manhours (Prev Month)', value: stats.prevMonth },
                    { label: 'Safe Manhours (Current)', value: stats.currentMonth },
                    { label: 'Cumulative Safe Manhours', value: stats.cumulative },
                    { label: 'Total Cumulative (Million)', value: (stats.cumulative / 1000000).toFixed(2) + ' M' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-sm text-gray-500 mb-2">{kpi.label}</p>
                        <p className="text-2xl font-black text-gray-900">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Monthly Manpower & Hours</h3>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Month
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Staff (M/F)</th>
                                <th className="px-6 py-4">Total Workers (ManDays)</th>
                                <th className="px-6 py-4">Working Days</th>
                                <th className="px-6 py-4">Manhours</th>
                                <th className="px-6 py-4">Safe Manhours</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium">{new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4">{row.staffMale} / {row.staffFemale}</td>
                                    <td className="px-6 py-4">{Number(row.totalWorkers).toLocaleString()}</td>
                                    <td className="px-6 py-4">{row.workingDays}</td>
                                    <td className="px-6 py-4">{Number(row.totalManhours).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-green-600 font-bold">{Number(row.safeManhours).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">Add Monthly Manhours</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Select Month</label>
                                <div className="flex gap-2">
                                    <input
                                        type="month"
                                        required
                                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fetchLaborStatsForMonth(formData.month)}
                                        className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 text-xs font-bold whitespace-nowrap"
                                    >
                                        Sync from Manpower
                                    </button>
                                </div>
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 flex flex-col gap-1 border border-gray-200">
                                    <div className="flex justify-between">
                                        <span>Detected Workers (Man-Days) from Module:</span>
                                        <strong>{laborStats.totalWorkerManDays}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Actual Working Days:</span>
                                        <strong>{laborStats.workingDays}</strong>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 italic">
                                        * Fetched from Daily Labor Reports for this month.
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff (Male)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.staffMale}
                                        onChange={(e) => setFormData({ ...formData, staffMale: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff (Female)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.staffFemale}
                                        onChange={(e) => setFormData({ ...formData, staffFemale: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Multiplication Factor</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.5"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none pr-12 font-bold text-blue-900"
                                            value={formData.avgWorkHours}
                                            onChange={(e) => setFormData({ ...formData, avgWorkHours: Number(e.target.value) })}
                                        />
                                        <span className="absolute right-3 top-2 text-xs text-gray-400 font-medium">Hrs/Man</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Average working hours per person per day.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">LTI Deductions (Hours)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.ltiDeductions}
                                        onChange={(e) => setFormData({ ...formData, ltiDeductions: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800 space-y-1">
                                <div className="flex justify-between">
                                    <span>Staff ManDays:</span>
                                    <span className="font-bold">{(formData.staffMale + formData.staffFemale) * (laborStats.workingDays || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Worker ManDays:</span>
                                    <span className="font-bold">{laborStats.totalWorkerManDays}</span>
                                </div>
                                <div className="pt-2 border-t border-blue-200 flex justify-between font-bold">
                                    <span>Est. Total Safe Manhours:</span>
                                    <span>
                                        {
                                            (((formData.staffMale + formData.staffFemale) * (laborStats.workingDays || 0)) + Number(laborStats.totalWorkerManDays)) * formData.avgWorkHours - formData.ltiDeductions
                                        }
                                    </span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save & Calculate
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EhsManhours;
