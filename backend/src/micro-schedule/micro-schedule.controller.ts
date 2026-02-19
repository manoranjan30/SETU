import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../users/user.entity';
import { MicroScheduleService } from './micro-schedule.service';
import { MicroActivityService } from './micro-activity.service';
import { MicroDailyLogService } from './micro-daily-log.service';
import { MicroLedgerService } from './micro-ledger.service';
import { CreateMicroScheduleDto } from './dto/create-micro-schedule.dto';
import { CreateMicroActivityDto } from './dto/create-micro-activity.dto';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';

@ApiTags('Micro Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('micro-schedules')
export class MicroScheduleController {
  constructor(
    private readonly microScheduleService: MicroScheduleService,
    private readonly microActivityService: MicroActivityService,
    private readonly dailyLogService: MicroDailyLogService,
    private readonly ledgerService: MicroLedgerService,
  ) {}

  @Get('delay-reasons')
  @ApiOperation({ summary: 'Get all active delay reasons' })
  async getDelayReasons() {
    return await this.microScheduleService.findAllDelayReasons();
  }

  // ==================== MICRO SCHEDULE ENDPOINTS ====================

  @Post()
  @ApiOperation({ summary: 'Create a new micro schedule' })
  async createMicroSchedule(
    @Body() dto: CreateMicroScheduleDto,
    @GetUser() user: User,
  ) {
    return await this.microScheduleService.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get micro schedule by ID' })
  async getMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.microScheduleService.findOne(id);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all micro schedules for a project' })
  async getMicroSchedulesByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return await this.microScheduleService.findByProject(projectId);
  }

  @Get('activity/:activityId')
  @ApiOperation({ summary: 'Get all micro schedules for a parent activity' })
  async getMicroSchedulesByActivity(
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return await this.microScheduleService.findByParentActivity(activityId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update micro schedule' })
  async updateMicroSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() updates: any,
    @GetUser() user: User,
  ) {
    return await this.microScheduleService.update(id, updates, user.id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit micro schedule for approval' })
  async submitMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.microScheduleService.submit(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve micro schedule' })
  async approveMicroSchedule(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return await this.microScheduleService.approve(id, user.id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate micro schedule (start execution)' })
  async activateMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.microScheduleService.activate(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete micro schedule' })
  async completeMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.microScheduleService.complete(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete micro schedule (soft delete)' })
  async deleteMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    await this.microScheduleService.delete(id);
    return { message: 'Micro schedule deleted successfully' };
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalculate totals and overshoot flag' })
  async recalculateMicroSchedule(@Param('id', ParseIntPipe) id: number) {
    await this.microScheduleService.recalculateTotals(id);
    await this.microScheduleService.updateOvershootFlag(id);
    return await this.microScheduleService.findOne(id);
  }

  // ==================== MICRO ACTIVITY ENDPOINTS ====================

  @Post('activities')
  @ApiOperation({ summary: 'Create a new micro activity' })
  async createActivity(@Body() dto: CreateMicroActivityDto) {
    try {
      console.log(
        '📥 [Backend] Received create activity request:',
        JSON.stringify(dto, null, 2),
      );
      const result = await this.microActivityService.create(dto);
      console.log('✅ [Backend] Activity created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ [Backend] Error creating activity:');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('DTO received:', JSON.stringify(dto, null, 2));
      throw error;
    }
  }

  @Get('activities/:id')
  @ApiOperation({ summary: 'Get micro activity by ID' })
  async getActivity(@Param('id', ParseIntPipe) id: number) {
    return await this.microActivityService.findOne(id);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Get all activities for a micro schedule' })
  async getActivitiesByMicroSchedule(
    @Param('id', ParseIntPipe) microScheduleId: number,
  ) {
    return await this.microActivityService.findByMicroSchedule(microScheduleId);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Update micro activity' })
  async updateActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() updates: any,
  ) {
    console.log(
      `📝 [Backend] Update activity ${id} with:`,
      JSON.stringify(updates, null, 2),
    );
    return await this.microActivityService.update(id, updates);
  }

  @Delete('activities/:id')
  @ApiOperation({ summary: 'Delete micro activity (soft delete)' })
  async deleteActivity(@Param('id', ParseIntPipe) id: number) {
    await this.microActivityService.delete(id);
    return { message: 'Activity deleted successfully' };
  }

  @Post('activities/:id/calculate-forecast')
  @ApiOperation({ summary: 'Calculate forecast finish date' })
  async calculateForecast(@Param('id', ParseIntPipe) id: number) {
    const forecastDate = await this.microActivityService.calculateForecast(id);
    return { forecastFinish: forecastDate };
  }

  // ==================== DAILY LOG ENDPOINTS ====================

  @Post('logs')
  @ApiOperation({ summary: 'Create a new daily log entry' })
  async createDailyLog(@Body() dto: CreateDailyLogDto, @GetUser() user: User) {
    return await this.dailyLogService.create(dto, user.id);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Get daily log by ID' })
  async getDailyLog(@Param('id', ParseIntPipe) id: number) {
    return await this.dailyLogService.findOne(id);
  }

  @Get('activities/:id/logs')
  @ApiOperation({ summary: 'Get all logs for an activity' })
  async getLogsByActivity(@Param('id', ParseIntPipe) activityId: number) {
    return await this.dailyLogService.findByActivity(activityId);
  }

  @Get('activities/:id/logs/range')
  @ApiOperation({ summary: 'Get logs for a date range' })
  async getLogsByDateRange(
    @Param('id', ParseIntPipe) activityId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.dailyLogService.findByDateRange(
      activityId,
      startDate,
      endDate,
    );
  }

  @Get(':id/logs/today')
  @ApiOperation({ summary: "Get today's logs for a micro schedule" })
  async getTodayLogs(@Param('id', ParseIntPipe) microScheduleId: number) {
    return await this.dailyLogService.getTodayLogs(microScheduleId);
  }

  @Patch('logs/:id')
  @ApiOperation({ summary: 'Update daily log' })
  async updateDailyLog(
    @Param('id', ParseIntPipe) id: number,
    @Body() updates: any,
  ) {
    return await this.dailyLogService.update(id, updates);
  }

  @Delete('logs/:id')
  @ApiOperation({ summary: 'Delete daily log' })
  async deleteDailyLog(@Param('id', ParseIntPipe) id: number) {
    await this.dailyLogService.delete(id);
    return { message: 'Daily log deleted successfully' };
  }

  @Get('activities/:id/productivity')
  @ApiOperation({ summary: 'Get productivity statistics for an activity' })
  async getProductivityStats(@Param('id', ParseIntPipe) activityId: number) {
    return await this.dailyLogService.getProductivityStats(activityId);
  }

  // ==================== LEDGER ENDPOINTS ====================

  @Get('ledger/activity/:activityId')
  @ApiOperation({ summary: 'Get quantity ledger for a parent activity' })
  async getLedgerByActivity(
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return await this.ledgerService.getLedgerStatus(activityId);
  }

  @Post('ledger/reconcile')
  @ApiOperation({ summary: 'Reconcile quantity ledger' })
  async reconcileLedger(
    @Body('parentActivityId') parentActivityId: number,
    @Body('boqItemId') boqItemId: number,
  ) {
    await this.ledgerService.reconcileLedger(parentActivityId, boqItemId);
    return { message: 'Ledger reconciled successfully' };
  }
}
