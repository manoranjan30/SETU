import { SiteObservationSeverity } from '../entities/site-observation.entity';

export class CreateSiteObservationDto {
  projectId: number;
  epsNodeId?: number;
  /** Human-readable breadcrumb path, e.g. "Block A › Tower 1 › Floor 3". */
  locationLabel?: string;
  severity: SiteObservationSeverity;
  category: string;
  description: string;
  remarks?: string;
  photos?: string[];
  targetDate?: string;
}

export class RectifySiteObservationDto {
  rectificationText: string;
  rectificationPhotos?: string[];
}

export class CloseSiteObservationDto {
  closureRemarks?: string;
}
