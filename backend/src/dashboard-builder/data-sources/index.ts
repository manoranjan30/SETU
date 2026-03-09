import { ActivityListSource } from './activity-list.source';
import { BoqBurnSource } from './boq-burn.source';
import { LaborDailySource } from './labor-daily.source';
import { ProgressDailySource } from './progress-daily.source';
import { ProjectPortfolioSource } from './project-portfolio.source';
import { ProjectProgressSummarySource } from './project-progress-summary.source';
import { QualityRatingSummarySource } from './quality-rating-summary.source';

export { ActivityListSource } from './activity-list.source';
export { BoqBurnSource } from './boq-burn.source';
export { LaborDailySource } from './labor-daily.source';
export { ProgressDailySource } from './progress-daily.source';
export { ProjectPortfolioSource } from './project-portfolio.source';
export { ProjectProgressSummarySource } from './project-progress-summary.source';
export { QualityRatingSummarySource } from './quality-rating-summary.source';

/** All data source provider classes for DI registration */
export const ALL_DATA_SOURCES = [
  ActivityListSource,
  BoqBurnSource,
  LaborDailySource,
  ProgressDailySource,
  ProjectPortfolioSource,
  ProjectProgressSummarySource,
  QualityRatingSummarySource,
];
