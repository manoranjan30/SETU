import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Folder, FileText } from 'lucide-react';
import { type PlanningActivity } from '../../services/planning.service';

interface ActivityNode {
    wbsId: number;
    wbsCode: string;
    wbsName: string;
    activities: PlanningActivity[];
}

interface ActivitySearchDropdownProps {
    activities: PlanningActivity[];
    wbsNodes: any[];
    selectedActivityId?: number;
    onSelect: (activityId: number, activity: PlanningActivity) => void;
    placeholder?: string;
}

const ActivitySearchDropdown: React.FC<ActivitySearchDropdownProps> = ({
    activities,
    wbsNodes,
    selectedActivityId,
    onSelect,
    placeholder = 'Select a Schedule Activity'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedWbs, setExpandedWbs] = useState<Set<number>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedActivity = activities.find(a => a.id === selectedActivityId);

    console.log('🔍 [ActivitySearchDropdown] Props:', {
        activitiesCount: activities.length,
        wbsNodesCount: wbsNodes.length,
        selectedActivityId
    });

    if (wbsNodes[0]) {
        console.log('🔍 [ActivitySearchDropdown] Sample WBS Node Structure:', {
            id: wbsNodes[0].id,
            wbsCode: wbsNodes[0].wbsCode,
            wbsName: wbsNodes[0].wbsName,
            wbsId: wbsNodes[0].wbsId,
            name: wbsNodes[0].name,
            allKeys: Object.keys(wbsNodes[0])
        });
    }

    if (activities[0]) {
        console.log('🔍 [ActivitySearchDropdown] Sample Activity Structure:', {
            id: activities[0].id,
            activityCode: activities[0].activityCode,
            activityName: activities[0].activityName,
            wbsNodeId: activities[0].wbsNodeId,
            wbsNode: activities[0].wbsNode,
            allKeys: Object.keys(activities[0])
        });
    }

    // Group activities by WBS
    const groupedActivities: ActivityNode[] = wbsNodes.map(wbs => {
        const acts = activities.filter(a => a.wbsNode?.id === wbs.id);
        if (acts.length === 0 && wbs.id <= 5) {
            // Debug first few to understand the mismatch
            console.log(`❌ [ActivitySearchDropdown] No match for WBS ${wbs.id}. Sample activity wbsNodeIds:`,
                activities.slice(0, 5).map(a => ({ actId: a.id, wbsNodeId: a.wbsNodeId, wbsNode: a.wbsNode?.id }))
            );
        }
        return {
            wbsId: wbs.id,
            wbsCode: wbs.wbsCode || wbs.wbsId || '',
            wbsName: wbs.wbsName || wbs.name || '',
            activities: acts
        };
    }).filter(g => g.activities.length > 0);

    console.log('🔍 [ActivitySearchDropdown] Grouped Activities:', groupedActivities);
    console.log('🔍 [ActivitySearchDropdown] Total Groups:', groupedActivities.length);

    // Search and filter logic
    const getFilteredGroups = () => {
        if (!searchTerm.trim()) {
            return groupedActivities;
        }

        const search = searchTerm.toLowerCase();
        const filtered: ActivityNode[] = [];

        groupedActivities.forEach(group => {
            // Check if WBS name matches
            const wbsMatches = group.wbsName.toLowerCase().includes(search) ||
                group.wbsCode.toLowerCase().includes(search);

            // Filter activities that match search
            const matchingActivities = group.activities.filter(act =>
                act.activityName.toLowerCase().includes(search) ||
                act.activityCode.toLowerCase().includes(search) ||
                act.description?.toLowerCase().includes(search)
            );

            // If WBS matches, include all activities; otherwise include only matching activities
            if (wbsMatches || matchingActivities.length > 0) {
                filtered.push({
                    ...group,
                    activities: wbsMatches ? group.activities : matchingActivities
                });

                // Auto-expand groups with matches
                if (matchingActivities.length > 0) {
                    setExpandedWbs(prev => new Set([...prev, group.wbsId]));
                }
            }
        });

        return filtered;
    };

    const filteredGroups = getFilteredGroups();

    console.log('🎯 [ActivitySearchDropdown] Filtered Groups (before render):', {
        count: filteredGroups.length,
        searchTerm,
        isOpen
    });

    const toggleWbs = (wbsId: number) => {
        setExpandedWbs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(wbsId)) {
                newSet.delete(wbsId);
            } else {
                newSet.add(wbsId);
            }
            return newSet;
        });
    };

    const handleSelect = (activity: PlanningActivity) => {
        onSelect(activity.id, activity);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Expand all groups when searching
    useEffect(() => {
        if (searchTerm.trim()) {
            const allWbsIds = filteredGroups.map(g => g.wbsId);
            setExpandedWbs(new Set(allWbsIds));
        }
    }, [searchTerm]);

    return (
        <div ref={dropdownRef} className="relative w-full">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2.5 border-2 border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between text-sm hover:bg-gray-50"
            >
                <span className={selectedActivity ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedActivity
                        ? `[${selectedActivity.activityCode}] ${selectedActivity.activityName}`
                        : placeholder}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-hidden flex flex-col">
                    {/* Search Bar */}
                    <div className="p-2 border-b sticky top-0 bg-white">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search activities or WBS..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Activity List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredGroups.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">
                                {searchTerm ? 'No activities match your search' : 'No activities available'}
                            </div>
                        ) : (
                            filteredGroups.map(group => (
                                <div key={group.wbsId} className="border-b last:border-b-0">
                                    {/* WBS Header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleWbs(group.wbsId)}
                                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left"
                                    >
                                        {expandedWbs.has(group.wbsId) ? (
                                            <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                                        ) : (
                                            <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                        )}
                                        <Folder size={14} className="text-blue-500 flex-shrink-0" />
                                        <span className="text-xs font-bold text-gray-700 flex-1">
                                            [{group.wbsCode}] {group.wbsName}
                                        </span>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {group.activities.length}
                                        </span>
                                    </button>

                                    {/* Activities */}
                                    {expandedWbs.has(group.wbsId) && (
                                        <div className="bg-gray-50">
                                            {group.activities.map(activity => (
                                                <button
                                                    key={activity.id}
                                                    type="button"
                                                    onClick={() => handleSelect(activity)}
                                                    className={`w-full px-3 py-2 pl-10 flex items-start gap-2 hover:bg-blue-50 text-left transition-colors ${selectedActivityId === activity.id ? 'bg-blue-100 border-l-2 border-blue-500' : ''
                                                        }`}
                                                >
                                                    <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 truncate">
                                                            <span className="text-blue-600 font-mono text-xs">
                                                                [{activity.activityCode}]
                                                            </span>{' '}
                                                            {highlightMatch(activity.activityName, searchTerm)}
                                                        </div>
                                                        {activity.description && (
                                                            <div className="text-xs text-gray-500 truncate mt-0.5">
                                                                {activity.description}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                                            {activity.startDatePlanned && (
                                                                <span>
                                                                    Start: {new Date(activity.startDatePlanned).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            {activity.finishDatePlanned && (
                                                                <span>
                                                                    Finish: {new Date(activity.finishDatePlanned).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Info */}
                    {filteredGroups.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
                            {searchTerm ? (
                                <span>
                                    Found {filteredGroups.reduce((sum, g) => sum + g.activities.length, 0)} activities in {filteredGroups.length} WBS groups
                                </span>
                            ) : (
                                <span>
                                    {activities.length} activities available • Click to expand WBS groups
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper function to highlight search matches
const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return text;

    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === search.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 text-gray-900 font-semibold">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

export default ActivitySearchDropdown;
