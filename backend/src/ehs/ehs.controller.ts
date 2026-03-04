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
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('ehs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EhsController {
  constructor(private readonly ehsService: EhsService) {}

  @Get(':projectId/summary')
  @Permissions('EHS.DASHBOARD.READ')
  async getSummary(@Param('projectId') projectId: number) {
    return this.ehsService.getSummary(projectId);
  }

  @Get(':projectId/observations')
  @Permissions('EHS.OBSERVATION.READ')
  async getObservations(@Param('projectId') projectId: number) {
    return this.ehsService.getObservations(projectId);
  }

  @Post(':projectId/observations')
  @Permissions('EHS.OBSERVATION.CREATE')
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
  @Permissions('EHS.OBSERVATION.UPDATE')
  async updateObservation(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateObservation(id, data);
  }

  @Get(':projectId/incidents')
  @Permissions('EHS.INCIDENT.READ')
  async getIncidents(@Param('projectId') projectId: number) {
    return this.ehsService.getIncidents(projectId);
  }

  @Post(':projectId/incidents')
  @Permissions('EHS.INCIDENT.CREATE')
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
  @Permissions('EHS.ENVIRONMENTAL.READ')
  async getEnvironmental(@Param('projectId') projectId: number) {
    return this.ehsService.getEnvironmentalLogs(projectId);
  }

  @Post(':projectId/environmental')
  @Permissions('EHS.ENVIRONMENTAL.CREATE')
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
  @Permissions('EHS.DASHBOARD.READ')
  async getTrends(@Param('projectId') projectId: number) {
    return this.ehsService.getTrends(projectId);
  }

  @Get(':projectId/performance')
  @Permissions('EHS.PERFORMANCE.MANAGE')
  async getPerformance(@Param('projectId') projectId: number) {
    return this.ehsService.getPerformance(projectId);
  }

  @Post(':projectId/performance')
  @Permissions('EHS.PERFORMANCE.MANAGE')
  async savePerformance(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.savePerformance(projectId, data);
  }

  @Get(':projectId/manhours')
  @Permissions('EHS.MANHOUR.READ')
  async getManhours(@Param('projectId') projectId: number) {
    return this.ehsService.getManhours(projectId);
  }

  @Post(':projectId/manhours')
  @Permissions('EHS.MANHOUR.CREATE')
  async saveManhours(@Param('projectId') projectId: number, @Body() data: any) {
    return this.ehsService.saveManhours(projectId, data);
  }

  @Get(':projectId/labor-stats')
  @Permissions('EHS.MANHOUR.READ')
  async getLaborStats(
    @Param('projectId') projectId: number,
    @Query('month') month: string,
  ) {
    return this.ehsService.getMonthlyLaborStats(projectId, month);
  }

  // Inspections
  @Get(':projectId/inspections')
  @Permissions('EHS.INSPECTION.READ')
  async getInspections(@Param('projectId') projectId: number) {
    return this.ehsService.getInspections(projectId);
  }

  @Post(':projectId/inspections')
  @Permissions('EHS.INSPECTION.CREATE')
  async createInspection(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createInspection({ ...data, projectId });
  }

  @Put('inspections/:id')
  @Permissions('EHS.INSPECTION.UPDATE')
  async updateInspection(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateInspection(id, data);
  }

  @Delete('inspections/:id')
  @Permissions('EHS.INSPECTION.DELETE')
  async deleteInspection(@Param('id') id: number) {
    return this.ehsService.deleteInspection(id);
  }

  // Training
  @Get(':projectId/trainings')
  @Permissions('EHS.TRAINING.READ')
  async getTrainings(@Param('projectId') projectId: number) {
    return this.ehsService.getTrainings(projectId);
  }

  @Post(':projectId/trainings')
  @Permissions('EHS.TRAINING.CREATE')
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
  @Permissions('EHS.TRAINING.UPDATE')
  async updateTraining(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateTraining(id, data);
  }

  @Delete('trainings/:id')
  @Permissions('EHS.TRAINING.DELETE')
  async deleteTraining(@Param('id') id: number) {
    return this.ehsService.deleteTraining(id);
  }

  // Legal Compliance
  @Get(':projectId/legal')
  @Permissions('EHS.LEGAL.READ')
  async getLegal(@Param('projectId') projectId: number) {
    return this.ehsService.getLegal(projectId);
  }

  @Post(':projectId/legal')
  @Permissions('EHS.LEGAL.MANAGE')
  async createLegal(@Param('projectId') projectId: number, @Body() data: any) {
    return this.ehsService.createLegal({ ...data, projectId });
  }

  @Put('legal/:id')
  @Permissions('EHS.LEGAL.MANAGE')
  async updateLegal(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateLegal(id, data);
  }

  @Delete('legal/:id')
  @Permissions('EHS.LEGAL.MANAGE')
  async deleteLegal(@Param('id') id: number) {
    return this.ehsService.deleteLegal(id);
  }

  // Machinery
  @Get(':projectId/machinery')
  @Permissions('EHS.MACHINERY.MANAGE')
  async getMachinery(@Param('projectId') projectId: number) {
    return this.ehsService.getMachinery(projectId);
  }

  @Post(':projectId/machinery')
  @Permissions('EHS.MACHINERY.MANAGE')
  async createMachinery(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createMachinery({ ...data, projectId });
  }

  @Put('machinery/:id')
  @Permissions('EHS.MACHINERY.MANAGE')
  async updateMachinery(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateMachinery(id, data);
  }

  @Delete('machinery/:id')
  @Permissions('EHS.MACHINERY.MANAGE')
  async deleteMachinery(@Param('id') id: number) {
    return this.ehsService.deleteMachinery(id);
  }

  // Incidents Register
  @Get(':projectId/incidents-register')
  @Permissions('EHS.INCIDENTREGISTER.MANAGE')
  async getIncidentsRegister(@Param('projectId') projectId: number) {
    return this.ehsService.getIncidentsRegister(projectId);
  }

  @Post(':projectId/incidents-register')
  @Permissions('EHS.INCIDENTREGISTER.MANAGE')
  async createIncidentRegister(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createIncidentRegister({ ...data, projectId });
  }

  @Put('incidents-register/:id')
  @Permissions('EHS.INCIDENTREGISTER.MANAGE')
  async updateIncidentRegister(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateIncidentRegister(id, data);
  }

  @Delete('incidents-register/:id')
  @Permissions('EHS.INCIDENTREGISTER.MANAGE')
  async deleteIncidentRegister(@Param('id') id: number) {
    return this.ehsService.deleteIncidentRegister(id);
  }

  // Vehicles
  @Get(':projectId/vehicles')
  @Permissions('EHS.VEHICLE.MANAGE')
  async getVehicles(@Param('projectId') projectId: number) {
    return this.ehsService.getVehicles(projectId);
  }

  @Post(':projectId/vehicles')
  @Permissions('EHS.VEHICLE.MANAGE')
  async createVehicle(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createVehicle({ ...data, projectId });
  }

  @Put('vehicles/:id')
  @Permissions('EHS.VEHICLE.MANAGE')
  async updateVehicle(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateVehicle(id, data);
  }

  @Delete('vehicles/:id')
  @Permissions('EHS.VEHICLE.MANAGE')
  async deleteVehicle(@Param('id') id: number) {
    return this.ehsService.deleteVehicle(id);
  }

  // Competency
  @Get(':projectId/competencies')
  @Permissions('EHS.COMPETENCY.MANAGE')
  async getCompetencies(@Param('projectId') projectId: number) {
    return this.ehsService.getCompetencies(projectId);
  }

  @Post(':projectId/competencies')
  @Permissions('EHS.COMPETENCY.MANAGE')
  async createCompetency(
    @Param('projectId') projectId: number,
    @Body() data: any,
  ) {
    return this.ehsService.createCompetency({ ...data, projectId });
  }

  @Put('competencies/:id')
  @Permissions('EHS.COMPETENCY.MANAGE')
  async updateCompetency(@Param('id') id: number, @Body() data: any) {
    return this.ehsService.updateCompetency(id, data);
  }

  @Delete('competencies/:id')
  @Permissions('EHS.COMPETENCY.MANAGE')
  async deleteCompetency(@Param('id') id: number) {
    return this.ehsService.deleteCompetency(id);
  }
}
