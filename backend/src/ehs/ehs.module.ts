import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EhsController } from './ehs.controller';
import { EhsService } from './ehs.service';
import { EhsObservation } from './entities/ehs-observation.entity';
import { EhsIncident } from './entities/ehs-incident.entity';
import { EhsTraining } from './entities/ehs-training.entity';
import { EhsEnvironmental } from './entities/ehs-environmental.entity';
import { EhsProjectConfig } from './entities/ehs-project-config.entity';
import { EhsPerformance } from './entities/ehs-performance.entity';
import { EhsManhours } from './entities/ehs-manhours.entity';
import { EhsInspection } from './entities/ehs-inspection.entity';
import { EhsLegalRegister } from './entities/ehs-legal-register.entity';
import { EhsMachinery } from './entities/ehs-machinery.entity';
import { EhsIncidentRegister } from './entities/ehs-incident-register.entity';
import { EhsVehicle } from './entities/ehs-vehicle.entity';
import { EhsCompetency } from './entities/ehs-competency.entity';
import { EpsNode } from '../eps/eps.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EhsObservation,
      EhsIncident,
      EhsTraining,
      EhsEnvironmental,
      EhsProjectConfig,
      EhsPerformance,
      EhsManhours,
      EhsInspection,
      EhsLegalRegister,
      EhsMachinery,
      EhsIncidentRegister,
      EhsVehicle,
      EhsCompetency,
      EpsNode,
      DailyLaborPresence,
    ]),
  ],
  controllers: [EhsController],
  providers: [EhsService],
  exports: [EhsService],
})
export class EhsModule {}
