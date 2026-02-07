import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EhsService } from './ehs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ehs')
@UseGuards(JwtAuthGuard)
export class EhsController {
  constructor(private readonly ehsService: EhsService) {}

  @Get(':projectId/summary')
  async getSummary(@Param('projectId') projectId: number) {
    return this.ehsService.getSummary(projectId);
  }

  @Get(':projectId/observations')
  async getObservations(@Param('projectId') projectId: number) {
    return this.ehsService.getObservations(projectId);
  }

  @Post(':projectId/observations')
  async createObservation(
    @Param('projectId') projectId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.ehsService.createObservation({
      ...data,
      projectId,
      reportedById: req.user.id,
    });
  }

  @Put('observations/:id')
  async updateObservation(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateObservation(id, data);
  }

  @Get(':projectId/incidents')
  async getIncidents(@Param('projectId') projectId: number) {
    return this.ehsService.getIncidents(projectId);
  }

  @Post(':projectId/incidents')
  async createIncident(
    @Param('projectId') projectId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.ehsService.createIncident({
      ...data,
      projectId,
      reportedById: req.user.id,
    });
  }

  @Get(':projectId/environmental')
  async getEnvironmental(@Param('projectId') projectId: number) {
    return this.ehsService.getEnvironmentalLogs(projectId);
  }

  @Post(':projectId/environmental')
  async createEnvironmental(
    @Param('projectId') projectId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.ehsService.createEnvironmentalLog({
      ...data,
      projectId,
      createdById: req.user.id,
    });
  }

  @Get(':projectId/trends')
  async getTrends(@Param('projectId') projectId: number) {
    return this.ehsService.getTrends(projectId);
  }

  @Get(':projectId/performance')
  async getPerformance(@Param('projectId') projectId: number) {
    return this.ehsService.getPerformance(projectId);
  }

  @Post(':projectId/performance')
  async savePerformance(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.savePerformance(projectId, data);
  }

  @Get(':projectId/manhours')
  async getManhours(@Param('projectId') projectId: number) {
    return this.ehsService.getManhours(projectId);
  }

  @Post(':projectId/manhours')
  async saveManhours(@Param('projectId') projectId: number, @Body() data: any) {
    return this.ehsService.saveManhours(projectId, data);
  }

  @Get(':projectId/labor-stats')
  async getLaborStats(
    @Param('projectId') projectId: number,
    @Query('month') month: string,
  ) {
    return this.ehsService.getMonthlyLaborStats(projectId, month);
  }

  // Inspections
  @Get(':projectId/inspections')
  async getInspections(@Param('projectId') projectId: number) {
    return this.ehsService.getInspections(projectId);
  }

  @Post(':projectId/inspections')
  async createInspection(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createInspection({ ...data, projectId });
  }

  @Put('inspections/:id')
  async updateInspection(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateInspection(id, data);
  }

  @Delete('inspections/:id')
  async deleteInspection(@Param('id') id: number) {
    return this.ehsService.deleteInspection(id);
  }

  // Training
  @Get(':projectId/trainings')
  async getTrainings(@Param('projectId') projectId: number) {
    return this.ehsService.getTrainings(projectId);
  }

  @Post(':projectId/trainings')
  async createTraining(
    @Param('projectId') projectId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.ehsService.createTraining({
      ...data,
      projectId,
      createdById: req.user.id,
    });
  }

  @Put('trainings/:id')
  async updateTraining(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateTraining(id, data);
  }

  @Delete('trainings/:id')
  async deleteTraining(@Param('id') id: number) {
    return this.ehsService.deleteTraining(id);
  }

  // Legal Compliance
  @Get(':projectId/legal')
  async getLegal(@Param('projectId') projectId: number) {
    return this.ehsService.getLegal(projectId);
  }

  @Post(':projectId/legal')
  async createLegal(@Param('projectId') projectId: number, @Body() data: any) {
    return this.ehsService.createLegal({ ...data, projectId });
  }

  @Put('legal/:id')
  async updateLegal(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateLegal(id, data);
  }

  @Delete('legal/:id')
  async deleteLegal(@Param('id') id: number) {
    return this.ehsService.deleteLegal(id);
  }

  // Machinery
  @Get(':projectId/machinery')
  async getMachinery(@Param('projectId') projectId: number) {
    return this.ehsService.getMachinery(projectId);
  }

  @Post(':projectId/machinery')
  async createMachinery(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createMachinery({ ...data, projectId });
  }

  @Put('machinery/:id')
  async updateMachinery(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateMachinery(id, data);
  }

  @Delete('machinery/:id')
  async deleteMachinery(@Param('id') id: number) {
    return this.ehsService.deleteMachinery(id);
  }

  // Incidents Register
  @Get(':projectId/incidents-register')
  async getIncidentsRegister(@Param('projectId') projectId: number) {
    return this.ehsService.getIncidentsRegister(projectId);
  }

  @Post(':projectId/incidents-register')
  async createIncidentRegister(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createIncidentRegister({ ...data, projectId });
  }

  @Put('incidents-register/:id')
  async updateIncidentRegister(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateIncidentRegister(id, data);
  }

  @Delete('incidents-register/:id')
  async deleteIncidentRegister(@Param('id') id: number) {
    return this.ehsService.deleteIncidentRegister(id);
  }

  // Vehicles
  @Get(':projectId/vehicles')
  async getVehicles(@Param('projectId') projectId: number) {
    return this.ehsService.getVehicles(projectId);
  }

  @Post(':projectId/vehicles')
  async createVehicle(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createVehicle({ ...data, projectId });
  }

  @Put('vehicles/:id')
  async updateVehicle(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateVehicle(id, data);
  }

  @Delete('vehicles/:id')
  async deleteVehicle(@Param('id') id: number) {
    return this.ehsService.deleteVehicle(id);
  }

  // Competency
  @Get(':projectId/competencies')
  async getCompetencies(@Param('projectId') projectId: number) {
    return this.ehsService.getCompetencies(projectId);
  }

  @Post(':projectId/competencies')
  async createCompetency(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createCompetency({ ...data, projectId });
  }

  @Put('competencies/:id')
  async updateCompetency(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateCompetency(id, data);
  }

  @Delete('competencies/:id')
  async deleteCompetency(@Param('id') id: number) {
    return this.ehsService.deleteCompetency(id);
  }
}
