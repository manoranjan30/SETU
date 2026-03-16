import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { EhsObservation } from './entities/ehs-observation.entity';
import {
  EhsIncident,
  IncidentStatus,
  IncidentType,
} from './entities/ehs-incident.entity';
import { EhsEnvironmental } from './entities/ehs-environmental.entity';
import { EhsTraining } from './entities/ehs-training.entity';
import { EhsProjectConfig } from './entities/ehs-project-config.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { EhsPerformance } from './entities/ehs-performance.entity';
import { EhsManhours } from './entities/ehs-manhours.entity';

import { EhsInspection } from './entities/ehs-inspection.entity';
import { EhsLegalRegister } from './entities/ehs-legal-register.entity';
import { EhsMachinery } from './entities/ehs-machinery.entity';
import { EhsIncidentRegister } from './entities/ehs-incident-register.entity';
import { EhsVehicle } from './entities/ehs-vehicle.entity';
import { EhsCompetency } from './entities/ehs-competency.entity';

@Injectable()
export class EhsService {
  constructor(
    @InjectRepository(EhsObservation)
    private readonly observationRepo: Repository<EhsObservation>,
    @InjectRepository(EhsIncident)
    private readonly incidentRepo: Repository<EhsIncident>,
    @InjectRepository(EhsEnvironmental)
    private readonly environmentalRepo: Repository<EhsEnvironmental>,
    @InjectRepository(EhsTraining)
    private readonly trainingRepo: Repository<EhsTraining>,
    @InjectRepository(EhsProjectConfig)
    private readonly configRepo: Repository<EhsProjectConfig>,
    @InjectRepository(DailyLaborPresence)
    private readonly laborRepo: Repository<DailyLaborPresence>,
    @InjectRepository(EhsPerformance)
    private readonly performanceRepo: Repository<EhsPerformance>,
    @InjectRepository(EhsManhours)
    private readonly manhoursRepo: Repository<EhsManhours>,
    @InjectRepository(EhsInspection)
    private readonly inspectionRepo: Repository<EhsInspection>,
    @InjectRepository(EhsLegalRegister)
    private readonly legalRepo: Repository<EhsLegalRegister>,
    @InjectRepository(EhsMachinery)
    private readonly machineryRepo: Repository<EhsMachinery>,
    @InjectRepository(EhsIncidentRegister)
    private readonly incidentRegisterRepo: Repository<EhsIncidentRegister>,
    @InjectRepository(EhsVehicle)
    private readonly vehicleRepo: Repository<EhsVehicle>,
    @InjectRepository(EhsCompetency)
    private readonly competencyRepo: Repository<EhsCompetency>,
  ) {}

  private sanitizeObservationCategories(categories?: unknown): string[] {
    const values = Array.isArray(categories) ? categories : [];
    const deduped = Array.from(
      new Set(
        values
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    return deduped.length > 0
      ? deduped
      : [
          'General Safety',
          'Work at Height',
          'PPE',
          'Electrical Safety',
          'Housekeeping',
          'Fire Safety',
          'Lifting Operations',
          'Scaffolding',
          'Excavation',
          'Plant & Machinery',
        ];
  }

  async getProjectConfig(projectId: number): Promise<EhsProjectConfig> {
    let config = await this.configRepo.findOne({ where: { projectId } });
    if (!config) {
      config = this.configRepo.create({ projectId });
      await this.configRepo.save(config);
    }
    return config;
  }

  async getObservationCategories(projectId: number): Promise<string[]> {
    const config = await this.getProjectConfig(projectId);
    return this.sanitizeObservationCategories(config.observationCategories);
  }

  async updateObservationCategories(
    projectId: number,
    categories: unknown,
  ): Promise<string[]> {
    const config = await this.getProjectConfig(projectId);
    config.observationCategories =
      this.sanitizeObservationCategories(categories);
    await this.configRepo.save(config);
    return config.observationCategories;
  }

  async getSummary(projectId: number) {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    // 1. Manhours & Performance
    const manhoursRecords = await this.manhoursRepo.find({
      where: { projectId },
    });
    const cumulativeSafeManhours = manhoursRecords.reduce(
      (sum, rec) => sum + Number(rec.safeManhours),
      0,
    );
    const cumulativeManpower = manhoursRecords.reduce(
      (sum, rec) => sum + Number(rec.totalManpower),
      0,
    );

    // 2. Incidents Breakdown
    const incidents = await this.incidentRegisterRepo.find({
      where: { projectId },
    });
    const incidentStats = {
      total: incidents.length,
      fatal: incidents.filter((i) => i.incidentType === 'Fatal').length,
      major: incidents.filter((i) => i.incidentType === 'Major').length,
      minor: incidents.filter((i) => i.incidentType === 'Minor').length,
      firstAid: incidents.filter((i) => i.incidentType === 'First Aid').length,
      nearMiss: incidents.filter((i) => i.incidentType === 'Near Miss').length,
      dangerous: incidents.filter(
        (i) => i.incidentType === 'Dangerous Occurrence',
      ).length,
    };

    // 3. Legal Compliance Alerts
    const legal = await this.legalRepo.find({ where: { projectId } });
    const legalStats = {
      total: legal.length,
      expired: legal.filter(
        (i) => i.expiryDate && new Date(i.expiryDate) < today,
      ).length,
      expiringSoon: legal.filter(
        (i) =>
          i.expiryDate &&
          new Date(i.expiryDate) >= today &&
          new Date(i.expiryDate) <= next30Days,
      ).length,
      valid: 0,
    };
    legalStats.valid =
      legalStats.total - legalStats.expired - legalStats.expiringSoon;

    // 4. Machinery Alerts
    const machinery = await this.machineryRepo.find({ where: { projectId } });
    const machineryStats = {
      total: machinery.length,
      expired: machinery.filter(
        (i) => i.expiryDate && new Date(i.expiryDate) < today,
      ).length,
      expiringSoon: machinery.filter(
        (i) =>
          i.expiryDate &&
          new Date(i.expiryDate) >= today &&
          new Date(i.expiryDate) <= next30Days,
      ).length,
      valid: 0,
    };
    machineryStats.valid =
      machineryStats.total -
      machineryStats.expired -
      machineryStats.expiringSoon;

    // 5. Vehicle Alerts (Any cert expired = expired)
    const vehicles = await this.vehicleRepo.find({ where: { projectId } });
    let vehicleExpired = 0;
    let vehicleExpiringSoon = 0;
    vehicles.forEach((v) => {
      const certs = [v.fitnessCertDate, v.insuranceDate, v.pollutionDate].map(
        (d) => (d ? new Date(d) : null),
      );
      if (certs.some((d) => d && d < today)) {
        vehicleExpired++;
      } else if (certs.some((d) => d && d <= next30Days)) {
        vehicleExpiringSoon++;
      }
    });
    const vehicleStats = {
      total: vehicles.length,
      expired: vehicleExpired,
      expiringSoon: vehicleExpiringSoon,
      valid: vehicles.length - vehicleExpired - vehicleExpiringSoon,
    };

    // 6. Competency Alerts
    const competency = await this.competencyRepo.find({ where: { projectId } });
    let compExpired = 0;
    let compExpiringSoon = 0;
    competency.forEach((c) => {
      const certs = [c.licenseExpiry, c.fitnessExpiry].map((d) =>
        d ? new Date(d) : null,
      );
      if (certs.some((d) => d && d < today)) {
        compExpired++;
      } else if (certs.some((d) => d && d <= next30Days)) {
        compExpiringSoon++;
      }
    });
    const competencyStats = {
      total: competency.length,
      expired: compExpired,
      expiringSoon: compExpiringSoon,
      valid: competency.length - compExpired - compExpiringSoon,
    };

    // 7. Inspections Status
    const inspections = await this.inspectionRepo.find({
      where: { projectId },
    });
    const inspectionStats = {
      total: inspections.length,
      completed: inspections.filter((i) => i.status === 'Completed').length,
      pending: inspections.filter((i) => i.status === 'Pending').length,
      overdue: inspections.filter(
        (i) =>
          i.status === 'Pending' && i.dueDate && new Date(i.dueDate) < today,
      ).length,
    };

    // 8. Training Status
    const trainings = await this.trainingRepo.find({ where: { projectId } });
    const trainingStats = {
      total: trainings.length,
      participants: trainings.reduce(
        (sum, t) => sum + Number(t.attendeeCount || 0),
        0,
      ),
    };

    return {
      cumulativeSafeManhours,
      cumulativeManpower,
      incidents: incidentStats,
      legal: legalStats,
      machinery: machineryStats,
      vehicle: vehicleStats,
      competency: competencyStats,
      inspections: inspectionStats,
      training: trainingStats,
    };
  }

  // Incidents
  async getIncidents(projectId: number) {
    return this.incidentRepo.find({
      where: { projectId },
      order: { incidentDate: 'DESC' },
    });
  }

  async createIncident(data: any) {
    const incident = this.incidentRepo.create(data);
    return this.incidentRepo.save(incident);
  }

  // Environmental
  async getEnvironmentalLogs(projectId: number) {
    return this.environmentalRepo.find({
      where: { projectId },
      order: { date: 'DESC' },
    });
  }

  async createEnvironmentalLog(data: any) {
    const log = this.environmentalRepo.create(data);
    return this.environmentalRepo.save(log);
  }

  // Trends (Simple 12 months)
  async getTrends(projectId: number) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const incidents = await this.incidentRepo.find({
      where: {
        projectId,
        incidentDate: MoreThanOrEqual(
          twelveMonthsAgo.toISOString().split('T')[0],
        ),
      },
    });

    const observations = await this.observationRepo.find({
      where: {
        projectId,
        createdAt: MoreThanOrEqual(twelveMonthsAgo),
      },
    });

    // Grouping logic would go here for charts
    return {
      incidents,
      observations,
    };
  }

  // Performance
  async getPerformance(projectId: number) {
    return this.performanceRepo.find({
      where: { projectId },
      order: { month: 'DESC' },
    });
  }

  async savePerformance(projectId: number, data: any) {
    const existing = await this.performanceRepo.findOne({
      where: { projectId, month: data.month },
    });

    if (existing) {
      await this.performanceRepo.update(existing.id, data);
      return this.performanceRepo.findOne({ where: { id: existing.id } });
    } else {
      const perf = this.performanceRepo.create({ ...data, projectId });
      return this.performanceRepo.save(perf);
    }
  }

  // Manhours
  async getManhours(projectId: number) {
    return this.manhoursRepo.find({
      where: { projectId },
      order: { month: 'DESC' },
    });
  }

  async saveManhours(projectId: number, data: any) {
    const existing = await this.manhoursRepo.findOne({
      where: { projectId, month: data.month },
    });

    if (existing) {
      await this.manhoursRepo.update(existing.id, { ...data, projectId });
      return this.manhoursRepo.findOne({ where: { id: existing.id } });
    } else {
      const record = this.manhoursRepo.create({ ...data, projectId });
      return this.manhoursRepo.save(record);
    }
  }

  async getMonthlyLaborStats(projectId: number, month: string) {
    const startDate = `${month}-01`;
    const d = new Date(startDate);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    // Last day of month logic
    const endDate = new Date(y, m, 0).toISOString().split('T')[0];

    const monthlyLabor = await this.laborRepo.find({
      where: {
        projectId,
        date: Between(startDate, endDate),
      },
    });

    const totalWorkerManDays = monthlyLabor.reduce(
      (sum, rec) => sum + Number(rec.count),
      0,
    );
    const uniqueDays = new Set(
      monthlyLabor.filter((r) => Number(r.count) > 0).map((r) => r.date),
    ).size;

    return {
      totalWorkerManDays,
      workingDays: uniqueDays,
    };
  }

  // Inspections
  async getInspections(projectId: number) {
    return this.inspectionRepo.find({
      where: { projectId },
      order: { dueDate: 'DESC' },
    });
  }

  async createInspection(data: any) {
    const inspection = this.inspectionRepo.create(data);
    return this.inspectionRepo.save(inspection);
  }

  async updateInspection(id: number, data: any) {
    await this.inspectionRepo.update(id, data);
    return this.inspectionRepo.findOne({ where: { id } });
  }

  async deleteInspection(id: number) {
    return this.inspectionRepo.delete(id);
  }

  // Training
  async getTrainings(projectId: number) {
    return this.trainingRepo.find({
      where: { projectId },
      order: { date: 'DESC' },
    });
  }

  async createTraining(data: any) {
    const training = this.trainingRepo.create({
      ...data,
      attendeeCount: Number(data.attendeeCount),
      duration: Number(data.duration),
    });
    return this.trainingRepo.save(training);
  }

  async updateTraining(id: number, data: any) {
    await this.trainingRepo.update(id, data);
    return this.trainingRepo.findOne({ where: { id } });
  }

  async deleteTraining(id: number) {
    return this.trainingRepo.delete(id);
  }

  // Legal Compliance
  async getLegal(projectId: number) {
    return this.legalRepo.find({
      where: { projectId },
      order: { expiryDate: 'ASC' },
    });
  }

  async createLegal(data: any) {
    const legal = this.legalRepo.create(data);
    return this.legalRepo.save(legal);
  }

  async updateLegal(id: number, data: any) {
    await this.legalRepo.update(id, data);
    return this.legalRepo.findOne({ where: { id } });
  }

  async deleteLegal(id: number) {
    return this.legalRepo.delete(id);
  }

  // Machinery
  async getMachinery(projectId: number) {
    return this.machineryRepo.find({
      where: { projectId },
      order: { expiryDate: 'ASC' },
    });
  }
  async createMachinery(data: any) {
    const item = this.machineryRepo.create(data);
    return this.machineryRepo.save(item);
  }
  async updateMachinery(id: number, data: any) {
    await this.machineryRepo.update(id, data);
    return this.machineryRepo.findOne({ where: { id } });
  }
  async deleteMachinery(id: number) {
    return this.machineryRepo.delete(id);
  }

  // Incidents Register
  async getIncidentsRegister(projectId: number) {
    return this.incidentRegisterRepo.find({
      where: { projectId },
      order: { date: 'DESC' },
    });
  }
  async createIncidentRegister(data: any) {
    const item = this.incidentRegisterRepo.create(data);
    return this.incidentRegisterRepo.save(item);
  }
  async updateIncidentRegister(id: number, data: any) {
    await this.incidentRegisterRepo.update(id, data);
    return this.incidentRegisterRepo.findOne({ where: { id } });
  }
  async deleteIncidentRegister(id: number) {
    return this.incidentRegisterRepo.delete(id);
  }

  // Vehicles
  async getVehicles(projectId: number) {
    return this.vehicleRepo.find({ where: { projectId } });
  }
  async createVehicle(data: any) {
    const item = this.vehicleRepo.create(data);
    return this.vehicleRepo.save(item);
  }
  async updateVehicle(id: number, data: any) {
    await this.vehicleRepo.update(id, data);
    return this.vehicleRepo.findOne({ where: { id } });
  }
  async deleteVehicle(id: number) {
    return this.vehicleRepo.delete(id);
  }

  // Competency
  async getCompetencies(projectId: number) {
    return this.competencyRepo.find({ where: { projectId } });
  }
  async createCompetency(data: any) {
    const item = this.competencyRepo.create(data);
    return this.competencyRepo.save(item);
  }
  async updateCompetency(id: number, data: any) {
    await this.competencyRepo.update(id, data);
    return this.competencyRepo.findOne({ where: { id } });
  }
  async deleteCompetency(id: number) {
    return this.competencyRepo.delete(id);
  }
}
