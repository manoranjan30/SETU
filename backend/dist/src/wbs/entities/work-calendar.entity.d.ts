import type { WorkWeek } from './work-week.entity';
export declare class WorkCalendar {
    id: number;
    name: string;
    description: string;
    isDefault: boolean;
    workingDays: string[];
    holidays: string[];
    defaultStartTime: string;
    defaultEndTime: string;
    dailyWorkHours: number;
    createdOn: Date;
    updatedOn: Date;
    workWeeks?: WorkWeek[];
}
