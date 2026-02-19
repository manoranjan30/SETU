import React from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import PlanningDashboard from '../components/planning/PlanningDashboard'; // Path adjustment needed depending on folder structure
import SchedulePage from './SchedulePage';
import PlanningMatrix from '../components/planning/PlanningMatrix';
import ExecutionMapper from '../components/planning/mapper/ExecutionMapper';
import WorkingScheduleList from '../components/planning/versions/WorkingScheduleList';
// import ActivityDistributor from '../components/planning/distributor/ActivityDistributor';

import { Construction, CheckSquare } from 'lucide-react'; // Split unused
import WorkDocManager from '../components/workdoc/WorkDocManager';
import LookAheadView from '../components/planning/LookAheadView';
import MicroSchedulePage from './micro-schedule/MicroSchedulePage';

const PlanningPage: React.FC = () => {
    const { projectId } = useParams();
    const pId = parseInt(projectId || '0');
    // projectId is available via useParams in child components if needed, or we can pass it down.
    // Ideally, we keep it here if we need to fetch project-wide planning settings.
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = searchParams.get('view') || 'schedule'; // Default to schedule

    const setCurrentView = (view: string) => {
        setSearchParams({ view });
    };

    const renderContent = () => {
        switch (currentView) {
            case 'schedule':
                return <SchedulePage />;
            case 'matrix':
                return <PlanningMatrix />;
            case 'mapper':
                return <ExecutionMapper />;
            case 'schedules':
                return <WorkingScheduleList />;
            case 'gantt_version':
                return <SchedulePage />;
            case 'contracts':
                return <WorkDocManager projectId={pId} />;

            case 'lookahead':
                return <LookAheadView />;
            case 'micro_schedule':
                return <MicroSchedulePage />;
            case 'recovery':
                return (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <CheckSquare size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Recovery Plans</h3>
                        <p className="text-sm">Coming soon.</p>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Construction size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Work in Progress</h3>
                        <p className="text-sm">This module ({currentView}) is currently under development.</p>
                    </div>
                );
        }
    };

    return (
        <PlanningDashboard currentView={currentView} onViewChange={setCurrentView}>
            {renderContent()}
        </PlanningDashboard>
    );
};

export default PlanningPage;
