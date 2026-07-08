import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectHealthReports1771700000017
  implements MigrationInterface
{
  name = 'CreateProjectHealthReports1771700000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_reports" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "reportingMonth" date NOT NULL,
        "cbeSubmissionMonth" date,
        "fiscalYear" varchar(16),
        "status" varchar(24) NOT NULL DEFAULT 'DRAFT',
        "projectNameSnapshot" varchar(255),
        "zoneSnapshot" varchar(120),
        "regionSnapshot" varchar(120),
        "plannerSnapshot" varchar(120),
        "picSnapshot" varchar(120),
        "overallHealthScore" double precision NOT NULL DEFAULT 100,
        "leadHealthScore" double precision NOT NULL DEFAULT 100,
        "lagHealthScore" double precision NOT NULL DEFAULT 100,
        "calculationBreakdown" jsonb,
        "preparedBy" integer,
        "submittedBy" integer,
        "lockedBy" integer,
        "submittedAt" timestamp,
        "lockedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_health_reports_project_month"
      ON "project_health_reports" ("projectId", "reportingMonth")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_burn_rows" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "month" date NOT NULL,
        "metricType" varchar(24) NOT NULL,
        "valueCrores" double precision NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_burn_report_month"
      ON "project_health_burn_rows" ("reportId", "month")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_resource_rows" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "resourceType" varchar(24) NOT NULL,
        "month" date NOT NULL,
        "aop" double precision NOT NULL DEFAULT 0,
        "planned" double precision NOT NULL DEFAULT 0,
        "actual" double precision NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_resource_report_month"
      ON "project_health_resource_rows" ("reportId", "month")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_cycle_metrics" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "month" date NOT NULL,
        "rccSlabCycle" double precision,
        "postPourGap" double precision,
        "internalPlasterGap" double precision,
        "tileFlooringGap" double precision,
        "windowGap" double precision,
        "projected" double precision,
        "actual" double precision,
        "aop" double precision,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_cycle_report_month"
      ON "project_health_cycle_metrics" ("reportId", "month")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_risks" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "tower" varchar(120),
        "package" varchar(160),
        "taskGroup" varchar(160),
        "taskDescription" text NOT NULL,
        "raisedDate" date,
        "plannedDate" date,
        "cbeDate" date,
        "delayDays" integer NOT NULL DEFAULT 0,
        "accountabilityFunction" varchar(120),
        "accountabilityPerson" varchar(160),
        "remarks" text,
        "status" varchar(32) NOT NULL DEFAULT 'OPEN',
        "riskProbability" varchar(24) NOT NULL DEFAULT 'LOW',
        "severity" varchar(24) NOT NULL DEFAULT 'LOW',
        "riskScore" integer NOT NULL DEFAULT 1,
        "linkedDesignItemId" integer,
        "linkedWoId" integer,
        "linkedScheduleActivityId" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_risks_report_status"
      ON "project_health_risks" ("reportId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_catchup_plans" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "package" varchar(160),
        "contractor" varchar(160),
        "plannedCatchupCocCrores" double precision NOT NULL DEFAULT 0,
        "strategy" text,
        "details" text,
        "ownerUserId" integer,
        "targetDate" date,
        "status" varchar(32) NOT NULL DEFAULT 'OPEN',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_catchup_report_status"
      ON "project_health_catchup_plans" ("reportId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_milestones" (
        "id" SERIAL PRIMARY KEY,
        "reportId" integer NOT NULL REFERENCES "project_health_reports"("id") ON DELETE CASCADE,
        "sourceType" varchar(24) NOT NULL DEFAULT 'MANUAL',
        "overrideReason" text,
        "auditSnapshot" jsonb,
        "towerName" varchar(160),
        "milestoneName" varchar(220) NOT NULL,
        "aopDate" date,
        "cbeDate" date,
        "actualDate" date,
        "delayDays" integer NOT NULL DEFAULT 0,
        "milestoneGroup" varchar(80),
        "sourceActivityId" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_milestones_report_tower"
      ON "project_health_milestones" ("reportId", "towerName")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_escalation_rules" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer,
        "scopeType" varchar(24) NOT NULL,
        "functionName" varchar(120),
        "greenRole" varchar(120),
        "amberRole" varchar(120),
        "redRole" varchar(120),
        "greenThreshold" double precision NOT NULL DEFAULT 80,
        "amberThreshold" double precision NOT NULL DEFAULT 60,
        "redThreshold" double precision NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_escalation_project_scope"
      ON "project_health_escalation_rules" ("projectId", "scopeType")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_health_score_config" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer,
        "indicatorGroup" varchar(40) NOT NULL,
        "indicatorName" varchar(160) NOT NULL,
        "weightage" double precision NOT NULL DEFAULT 1,
        "sourceRule" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_health_score_config_project_group"
      ON "project_health_score_config" ("projectId", "indicatorGroup")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_health_score_config"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_health_escalation_rules"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project_health_milestones"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_health_catchup_plans"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project_health_risks"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_health_cycle_metrics"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_health_resource_rows"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project_health_burn_rows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_health_reports"`);
  }
}
