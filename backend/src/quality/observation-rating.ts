import { BadRequestException } from '@nestjs/common';
import { SiteObservationSeverity } from './entities/site-observation.entity';

export enum QualityObservationRating {
  OFI = 'OFI',
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export const QUALITY_OBSERVATION_RATINGS = [
  QualityObservationRating.OFI,
  QualityObservationRating.MINOR,
  QualityObservationRating.MODERATE,
  QualityObservationRating.MAJOR,
  QualityObservationRating.CRITICAL,
] as const;

export function normalizeObservationRating(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const aliases: Record<string, QualityObservationRating> = {
    INFO: QualityObservationRating.OFI,
    OPPORTUNITY_FOR_IMPROVEMENT: QualityObservationRating.OFI,
    MI: QualityObservationRating.MINOR,
    MO: QualityObservationRating.MODERATE,
    MA: QualityObservationRating.MAJOR,
    C: QualityObservationRating.CRITICAL,
  };
  const rating =
    aliases[normalized] ||
    QUALITY_OBSERVATION_RATINGS.find((item) => item === normalized);
  if (!rating) {
    throw new BadRequestException('Invalid quality observation category.');
  }
  return rating;
}

export function ratingToSiteSeverity(rating: QualityObservationRating) {
  switch (rating) {
    case QualityObservationRating.OFI:
      return SiteObservationSeverity.INFO;
    case QualityObservationRating.MINOR:
      return SiteObservationSeverity.MINOR;
    case QualityObservationRating.MODERATE:
    case QualityObservationRating.MAJOR:
      return SiteObservationSeverity.MAJOR;
    case QualityObservationRating.CRITICAL:
      return SiteObservationSeverity.CRITICAL;
  }
}

export function ratingLabel(rating: QualityObservationRating) {
  const labels: Record<QualityObservationRating, string> = {
    OFI: 'Opportunity for Improvement (OFI)',
    MINOR: 'Minor (Mi)',
    MODERATE: 'Moderate (Mo)',
    MAJOR: 'Major (Ma)',
    CRITICAL: 'Critical (C)',
  };
  return labels[rating];
}
