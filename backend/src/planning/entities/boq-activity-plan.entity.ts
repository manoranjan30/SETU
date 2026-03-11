/**
 * BACKWARD COMPATIBILITY ALIAS
 *
 * BoqActivityPlan is now replaced by WoActivityPlan.
 * This file re-exports WoActivityPlan as BoqActivityPlan
 * so that existing service code (planning.service.ts, etc.)
 * continues to compile without massive refactoring.
 *
 * The actual entity class is WoActivityPlan in wo-activity-plan.entity.ts
 * with table name 'wo_activity_plan'.
 */
export {
  WoActivityPlan as BoqActivityPlan,
  PlanningBasis,
  MappingType,
} from './wo-activity-plan.entity';
