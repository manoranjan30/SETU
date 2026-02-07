import { ActivityVersion } from './entities/activity-version.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
export declare class SchedulingEngineService {
    calculateCPM(activities: ActivityVersion[], relationships: ActivityRelationship[], projectStartDate?: Date): ActivityVersion[];
}
