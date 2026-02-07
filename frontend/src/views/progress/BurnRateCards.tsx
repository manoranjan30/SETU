import React from 'react';
import { IndianRupee, TrendingUp, Calendar, CalendarDays } from 'lucide-react';

interface BurnRateCardsProps {
    stats: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        total: number;
    };
    loading?: boolean;
}

const BurnRateCards: React.FC<BurnRateCardsProps> = ({ stats, loading }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const cards = [
        {
            title: "Today's Burn",
            value: stats?.today || 0,
            icon: IndianRupee,
            color: 'bg-indigo-600',
            textColor: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            desc: "Value of work executed today"
        },
        {
            title: "This Week",
            value: stats?.thisWeek || 0,
            icon: TrendingUp,
            color: 'bg-emerald-600',
            textColor: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            desc: "Last 7 days cumulative"
        },
        {
            title: "This Month",
            value: stats?.thisMonth || 0,
            icon: CalendarDays,
            color: 'bg-amber-500',
            textColor: 'text-amber-600',
            bgColor: 'bg-amber-50',
            desc: "Current month to date"
        },
        {
            title: "Total Project Burn",
            value: stats?.total || 0,
            icon: Calendar,
            color: 'bg-slate-800',
            textColor: 'text-slate-800',
            bgColor: 'bg-slate-100',
            desc: "Lifetime project execution value"
        }
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse h-32">
                        <div className="h-4 bg-slate-100 rounded w-1/2 mb-4"></div>
                        <div className="h-8 bg-slate-100 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{card.title}</h3>
                                <p className="text-2xl font-black text-slate-800 mt-1 font-mono tracking-tight">
                                    {formatCurrency(card.value)}
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl ${card.bgColor} ${card.textColor}`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${card.color} w-3/4 rounded-full opacity-20`}></div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-2">{card.desc}</p>
                    </div>
                    {/* Background Pattern */}
                    <card.icon className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-50 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                </div>
            ))}
        </div>
    );
};

export default BurnRateCards;
