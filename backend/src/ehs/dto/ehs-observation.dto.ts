import { EhsObservationSeverity } from '../entities/ehs-observation.entity';

export class CreateEhsObservationDto {
  projectId: number;
  epsNodeId?: number;
  severity: EhsObservationSeverity;
  category: string;
  description: string;
  remarks?: string;
  photos?: string[];
  targetDate?: string;
}

export class RectifyEhsObservationDto {
  rectificationText: string;
  rectificationPhotos?: string[];
}

export class CloseEhsObservationDto {
  closureRemarks?: string;
}
