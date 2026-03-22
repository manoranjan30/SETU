import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceIssueTrackerV21711000000000 implements MigrationInterface {
  name = 'EnhanceIssueTrackerV21711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Alter issue_tracker_departments: make it global ───────────────────
    // Drop projectId and memberUserIds; add sequenceOrder, defaultSlaDays, icon
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_departments"
        DROP COLUMN IF EXISTS "projectId",
        DROP COLUMN IF EXISTS "memberUserIds",
        ADD COLUMN IF NOT EXISTS "sequenceOrder" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "defaultSlaDays" integer,
        ADD COLUMN IF NOT EXISTS "icon" character varying(60)
    `);

    // ─── 2. Alter issue_tracker_issues: add priority, issueNumber, etc. ───────
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_issues"
        ADD COLUMN IF NOT EXISTS "issueNumber" character varying(20),
        ADD COLUMN IF NOT EXISTS "priority" character varying(20) NOT NULL DEFAULT 'MEDIUM',
        ADD COLUMN IF NOT EXISTS "customFlowDepartmentIds" jsonb,
        ADD COLUMN IF NOT EXISTS "attachmentCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "commentCount" integer NOT NULL DEFAULT 0
    `);

    // ─── 3. Alter issue_tracker_steps: add coordinator close + commitment history ──
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_steps"
        ADD COLUMN IF NOT EXISTS "slaDays" integer,
        ADD COLUMN IF NOT EXISTS "committedDateHistory" jsonb,
        ADD COLUMN IF NOT EXISTS "coordinatorRemarks" text,
        ADD COLUMN IF NOT EXISTS "coordinatorClosedAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "coordinatorClosedById" integer,
        ADD COLUMN IF NOT EXISTS "memberRespondedAt" TIMESTAMP WITH TIME ZONE
    `);

    // ─── 4. Create issue_tracker_dept_project_config ──────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_dept_project_config" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "departmentId" integer NOT NULL,
        "departmentName" character varying(150) NOT NULL,
        "memberUserIds" jsonb,
        "coordinatorUserId" integer,
        "coordinatorName" character varying(150),
        "isIncludedInDefaultFlow" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_dept_project_config" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dept_project" UNIQUE ("projectId", "departmentId")
      )
    `);

    // ─── 5. Create issue_tracker_activity_log ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_activity_log" (
        "id" SERIAL NOT NULL,
        "issueId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "action" character varying(60) NOT NULL,
        "detail" text,
        "metadata" jsonb,
        "actorUserId" integer,
        "actorName" character varying(150) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_activity_log" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_it_activity_log_issue" ON "issue_tracker_activity_log" ("issueId")
    `);

    // ─── 6. Create issue_tracker_attachments ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_attachments" (
        "id" SERIAL NOT NULL,
        "issueId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "stepId" integer,
        "fileUrl" character varying(500) NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "mimeType" character varying(60),
        "fileSizeBytes" integer,
        "uploadedByUserId" integer NOT NULL,
        "uploadedByName" character varying(150) NOT NULL,
        "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_attachments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_it_attachments_issue" ON "issue_tracker_attachments" ("issueId")
    `);

    // ─── 7. Create issue_tracker_notifications ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_notifications" (
        "id" SERIAL NOT NULL,
        "recipientUserId" integer NOT NULL,
        "issueId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "type" character varying(60) NOT NULL,
        "message" text NOT NULL,
        "issueTitle" character varying(200),
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_it_notifications_recipient" ON "issue_tracker_notifications" ("recipientUserId", "isRead")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_activity_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_dept_project_config"`);

    // Revert issue_tracker_steps
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_steps"
        DROP COLUMN IF EXISTS "slaDays",
        DROP COLUMN IF EXISTS "committedDateHistory",
        DROP COLUMN IF EXISTS "coordinatorRemarks",
        DROP COLUMN IF EXISTS "coordinatorClosedAt",
        DROP COLUMN IF EXISTS "coordinatorClosedById",
        DROP COLUMN IF EXISTS "memberRespondedAt"
    `);

    // Revert issue_tracker_issues
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_issues"
        DROP COLUMN IF EXISTS "issueNumber",
        DROP COLUMN IF EXISTS "priority",
        DROP COLUMN IF EXISTS "customFlowDepartmentIds",
        DROP COLUMN IF EXISTS "attachmentCount",
        DROP COLUMN IF EXISTS "commentCount"
    `);

    // Revert issue_tracker_departments (restore old columns)
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_departments"
        ADD COLUMN IF NOT EXISTS "projectId" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "memberUserIds" jsonb,
        DROP COLUMN IF EXISTS "sequenceOrder",
        DROP COLUMN IF EXISTS "defaultSlaDays",
        DROP COLUMN IF EXISTS "icon"
    `);
  }
}
