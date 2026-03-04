import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkWeek } from './entities/work-week.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { ProjectProfile } from '../eps/project-profile.entity'; // Import ProjectProfile
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('calendars')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarsController {
  constructor(
    @InjectRepository(WorkCalendar)
    private calendarRepo: Repository<WorkCalendar>,
    @InjectRepository(WorkWeek)
    private workWeekRepo: Repository<WorkWeek>,
    @InjectRepository(ProjectProfile)
    private profileRepo: Repository<ProjectProfile>,
  ) {}

  @Get()
  @Permissions('SCHEDULE.CALENDAR.READ')
  async findAll(): Promise<WorkCalendar[]> {
    const cals = await this.calendarRepo.find();
    // Populate workWeeks manually
    for (const cal of cals) {
      cal.workWeeks = await this.workWeekRepo.find({
        where: { calendar: { id: cal.id } },
      });
    }
    return cals;
  }

  @Get(':id')
  @Permissions('SCHEDULE.CALENDAR.READ')
  async findOne(@Param('id') id: number): Promise<WorkCalendar> {
    const cal = await this.calendarRepo.findOne({ where: { id } });
    if (!cal) throw new NotFoundException(`Calendar with ID ${id} not found`);

    cal.workWeeks = await this.workWeekRepo.find({
      where: { calendar: { id: cal.id } },
    });
    return cal;
  }

  @Post()
  @Permissions('SCHEDULE.CALENDAR.CREATE')
  async create(
    @Body() calendarData: Partial<WorkCalendar>,
  ): Promise<WorkCalendar> {
    // If setting as default, unset others? Ideally yes, but sticking to simple Create for now.
    // Or we can handle "Only one default" logic here.
    if (calendarData.isDefault) {
      await this.calendarRepo.update({ isDefault: true }, { isDefault: false });
    }
    const newCal = this.calendarRepo.create(calendarData);
    return this.calendarRepo.save(newCal);
  }

  @Put(':id')
  @Permissions('SCHEDULE.CALENDAR.UPDATE')
  async update(
    @Param('id') id: number,
    @Body() calendarData: Partial<WorkCalendar>,
  ): Promise<WorkCalendar> {
    const cal = await this.findOne(id);
    if (calendarData.isDefault) {
      await this.calendarRepo.update({ isDefault: true }, { isDefault: false });
    }
    this.calendarRepo.merge(cal, calendarData);
    return this.calendarRepo.save(cal);
  }

  @Delete(':id')
  @Permissions('SCHEDULE.CALENDAR.DELETE')
  async remove(@Param('id') id: number): Promise<void> {
    // Validation: Check if calendar is assigned to any project
    const usageCount = await this.profileRepo.count({
      where: { calendar: { id: id } },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete Calendar. It is currently assigned to ${usageCount} Project(s).`,
      );
    }

    const result = await this.calendarRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Calendar with ID ${id} not found`);
    }
  }
}
