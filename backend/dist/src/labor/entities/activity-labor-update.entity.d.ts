import { LaborCategory } from './labor-category.entity';
import { Activity } from '../../wbs/entities/activity.entity';
export declare class ActivityLaborUpdate {
    id: number;
    activityId: number;
    activity: Activity;
    date: string;
    categoryId: number;
    category: LaborCategory;
    count: number;
    createdOn: Date;
    updatedOn: Date;
    updatedBy: string;
}
