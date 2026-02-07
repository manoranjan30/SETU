import { Repository } from 'typeorm';
import { WorkWeek } from './entities/work-week.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
export declare class CalendarsController {
    private calendarRepo;
    private workWeekRepo;
    private profileRepo;
    constructor(calendarRepo: Repository<WorkCalendar>, workWeekRepo: Repository<WorkWeek>, profileRepo: Repository<ProjectProfile>);
    findAll(): Promise<WorkCalendar[]>;
    findOne(id: number): Promise<WorkCalendar>;
    create(calendarData: Partial<WorkCalendar>): Promise<WorkCalendar>;
    update(id: number, calendarData: Partial<WorkCalendar>): Promise<WorkCalendar>;
    remove(id: number): Promise<void>;
}
