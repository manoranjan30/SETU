import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityCardApprovalWorkflow1781400000000
  implements MigrationInterface
{
  name = 'AddQualityCardApprovalWorkflow1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_card_approval_runs" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "inspectionId" integer NOT NULL,
        "activityId" integer,
        "epsNodeId" integer,
        "documentType" character varying(80) NOT NULL,
        "documentId" integer NOT NULL,
        "releaseStrategyId" integer NOT NULL,
        "releaseStrategyVersion" integer NOT NULL,
        "strategyName" character varying(200) NOT NULL,
        "moduleCode" character varying(50) NOT NULL DEFAULT 'QUALITY',
        "processCode" character varying(100) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'IN_PROGRESS',
        "currentStepOrder" integer NOT NULL DEFAULT 1,
        "initiatorUserId" integer,
        "contextSnapshot" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_card_approval_runs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quality_card_approval_runs_document"
      ON "quality_card_approval_runs" ("documentType", "documentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_card_approval_runs_pending"
      ON "quality_card_approval_runs" ("projectId", "status", "currentStepOrder")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_card_approval_steps" (
        "id" SERIAL NOT NULL,
        "runId" integer NOT NULL,
        "stepOrder" integer NOT NULL,
        "stepName" character varying(200),
        "approverMode" character varying(50),
        "assignedUserId" integer,
        "assignedUserIds" jsonb,
        "assignedRoleId" integer,
        "minApprovalsRequired" integer NOT NULL DEFAULT 1,
        "currentApprovalCount" integer NOT NULL DEFAULT 0,
        "approvedUserIds" jsonb,
        "status" character varying(50) NOT NULL DEFAULT 'WAITING',
        "signedBy" character varying(255),
        "signerDisplayName" character varying(255),
        "signerCompany" character varying(255),
        "signerRole" character varying(255),
        "completedAt" TIMESTAMP,
        "comments" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_card_approval_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_card_approval_steps_run"
          FOREIGN KEY ("runId")
          REFERENCES "quality_card_approval_runs"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quality_card_approval_steps_run_order"
      ON "quality_card_approval_steps" ("runId", "stepOrder")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_quality_card_approval_steps_run_order"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "quality_card_approval_steps"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_quality_card_approval_runs_pending"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_quality_card_approval_runs_document"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "quality_card_approval_runs"');
  }
}
