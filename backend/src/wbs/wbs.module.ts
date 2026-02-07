import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WbsService } from './wbs.service';
import { WbsController } from './wbs.controller';
import { WbsTemplateController } from './wbs-template.controller';
import { WbsNode } from './entities/wbs.entity';
import { ProjectsModule } from '../projects/projects.module'; // For assignment guard
import { AuthModule } from '../auth/auth.module'; // For permissions

import { ProjectProfile } from '../eps/project-profile.entity';

import { Activity } from './entities/activity.entity';
import { ActivityRelationship } from './entities/activity-relationship.entity';
import { WbsTemplate, WbsTemplateNode } from './entities/wbs-template.entity';
import { WbsImportService } from './wbs-import.service';
import { ScheduleImportService } from './schedule-import.service';
import { WbsTemplateActivity } from './entities/wbs-template-activity.entity';
import { CpmService } from './cpm.service';
import { ActivitySchedule } from './entities/activity-schedule.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { WorkWeek } from './entities/work-week.entity';

import { ScheduleController } from './schedule.controller';
import { CalendarsController } from './calendars.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WbsNode,
      ProjectProfile,
      Activity,
      ActivityRelationship,
      WbsTemplate,
      WbsTemplateNode,
      WbsTemplateActivity,
      ActivitySchedule,
      WorkCalendar,
      WorkWeek,
    ]),
    ProjectsModule,
    AuthModule,
  ],
  controllers: [
    WbsController,
    WbsTemplateController,
    ScheduleController,
    CalendarsController,
  ],
  providers: [WbsService, WbsImportService, CpmService, ScheduleImportService],
  exports: [WbsService, CpmService, ScheduleImportService],
})
export class WbsModule {}
