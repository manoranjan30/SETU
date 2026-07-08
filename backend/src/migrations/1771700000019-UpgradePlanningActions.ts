import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradePlanningActions1771700000019 implements MigrationInterface {
  name = 'UpgradePlanningActions1771700000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_tasks"
        ADD COLUMN IF NOT EXISTS "taskType" varchar(40) NOT NULL DEFAULT 'GENERAL',
        ADD COLUMN IF NOT EXISTS "assignedToType" varchar(24) NOT NULL DEFAULT 'INTERNAL_USER',
        ADD COLUMN IF NOT EXISTS "assignedToTempUserId" integer,
        ADD COLUMN IF NOT EXISTS "completedByUserId" integer,
        ADD COLUMN IF NOT EXISTS "parentTaskId" integer,
        ADD COLUMN IF NOT EXISTS "startDate" date,
        ADD COLUMN IF NOT EXISTS "reminderAt" timestamp,
        ADD COLUMN IF NOT EXISTS "linkedModule" varchar(80),
        ADD COLUMN IF NOT EXISTS "linkedRecordId" integer,
        ADD COLUMN IF NOT EXISTS "recurrenceRule" varchar(120),
        ADD COLUMN IF NOT EXISTS "progressPercent" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "subtaskCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "completedSubtaskCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "watcherUserIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "watcherTempUserIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "checklistItems" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "commentsCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lastActivityAt" timestamp
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_project_type_status"
      ON "project_tasks" ("projectId", "taskType", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_temp_assignee_due"
      ON "project_tasks" ("assignedToTempUserId", "dueDate")
    `);

    await queryRunner.query(`
      ALTER TABLE "followup_actions"
        ADD COLUMN IF NOT EXISTS "assignedToType" varchar(24) NOT NULL DEFAULT 'INTERNAL_USER',
        ADD COLUMN IF NOT EXISTS "assignedToTempUserId" integer,
        ADD COLUMN IF NOT EXISTS "closedByUserId" integer,
        ADD COLUMN IF NOT EXISTS "meetingDate" date,
        ADD COLUMN IF NOT EXISTS "followupType" varchar(40) NOT NULL DEFAULT 'GENERAL',
        ADD COLUMN IF NOT EXISTS "sourceModule" varchar(80),
        ADD COLUMN IF NOT EXISTS "sourceRecordId" integer,
        ADD COLUMN IF NOT EXISTS "epsNodeId" integer,
        ADD COLUMN IF NOT EXISTS "locationText" varchar(260),
        ADD COLUMN IF NOT EXISTS "reminderAt" timestamp,
        ADD COLUMN IF NOT EXISTS "nextReminderAt" timestamp,
        ADD COLUMN IF NOT EXISTS "lastReminderSentAt" timestamp,
        ADD COLUMN IF NOT EXISTS "repeatRule" varchar(120),
        ADD COLUMN IF NOT EXISTS "closureRemarks" text,
        ADD COLUMN IF NOT EXISTS "watcherUserIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "watcherTempUserIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "attachments" text[] NOT NULL DEFAULT ARRAY[]::text[],
        ADD COLUMN IF NOT EXISTS "commentsCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lastActivityAt" timestamp
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_project_type_status"
      ON "followup_actions" ("projectId", "followupType", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_temp_assignee_due"
      ON "followup_actions" ("assignedToTempUserId", "dueDate")
    `);

    await queryRunner.query(`
      ALTER TABLE "site_journal_entries"
        ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS "journalType" varchar(40) NOT NULL DEFAULT 'DAILY_PROGRESS',
        ADD COLUMN IF NOT EXISTS "qualityObservations" text,
        ADD COLUMN IF NOT EXISTS "progressNotes" text,
        ADD COLUMN IF NOT EXISTS "decisionsTaken" text,
        ADD COLUMN IF NOT EXISTS "instructionsGiven" text,
        ADD COLUMN IF NOT EXISTS "materialReceived" text,
        ADD COLUMN IF NOT EXISTS "delaysOrConstraints" text,
        ADD COLUMN IF NOT EXISTS "tomorrowPlan" text,
        ADD COLUMN IF NOT EXISTS "epsNodeId" integer,
        ADD COLUMN IF NOT EXISTS "locationText" varchar(260),
        ADD COLUMN IF NOT EXISTS "linkedActivityIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "linkedTaskIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "linkedFollowupIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "linkedRfiIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        ADD COLUMN IF NOT EXISTS "attachments" text[] NOT NULL DEFAULT ARRAY[]::text[],
        ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
        ADD COLUMN IF NOT EXISTS "submittedAt" timestamp,
        ADD COLUMN IF NOT EXISTS "lockedAt" timestamp
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_journal_project_status_date"
      ON "site_journal_entries" ("projectId", "status", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_site_journal_project_status_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_followup_actions_temp_assignee_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_followup_actions_project_type_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_tasks_temp_assignee_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_tasks_project_type_status"`);
  }
}
