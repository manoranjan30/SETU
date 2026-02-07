import { ActivityVersion } from './entities/activity-version.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
export declare class ImportExportService {
    generateRevisionTemplate(sourceActivities: ActivityVersion[], relationships?: ActivityRelationship[]): Buffer;
    parseRevisionFile(buffer: Buffer): any[];
}
