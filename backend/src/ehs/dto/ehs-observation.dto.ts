import { EhsObservationSeverity } from '../entities/ehs-observation.entity';

export class CreateEhsObservationDto {
  projectId: number;
  epsNodeId?: number;
  /** Human-readable breadcrumb path, e.g. "Block A › Tower 1 › Floor 3". */
  locationLabel?: string;
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

export class RejectEhsObservationRectificationDto {
  rejectionRemarks?: string;
}

export class HoldEhsObservationDto {
  holdReason?: string;
}
