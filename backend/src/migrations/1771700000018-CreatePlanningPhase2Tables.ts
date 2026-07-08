import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlanningPhase2Tables1771700000018
  implements MigrationInterface
{
  name = 'CreatePlanningPhase2Tables1771700000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_tasks" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "title" varchar(240) NOT NULL,
        "description" text,
        "status" varchar(32) NOT NULL DEFAULT 'TODO',
        "priority" varchar(32) NOT NULL DEFAULT 'MEDIUM',
        "assignedToUserId" integer,
        "createdByUserId" integer NOT NULL,
        "dueDate" date,
        "completedAt" timestamp,
        "linkedActivityId" integer,
        "linkedIssueId" integer,
        "epsNodeId" integer,
        "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "attachments" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_project_status"
      ON "project_tasks" ("projectId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_assignee_due"
      ON "project_tasks" ("assignedToUserId", "dueDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_activity"
      ON "project_tasks" ("linkedActivityId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_task_comments" (
        "id" SERIAL PRIMARY KEY,
        "taskId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "authorUserId" integer NOT NULL,
        "comment" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_task_comments_task"
      ON "project_task_comments" ("taskId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "followup_actions" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "actionItem" text NOT NULL,
        "raisedByUserId" integer NOT NULL,
        "assignedToUserId" integer NOT NULL,
        "raisedDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "closedDate" date,
        "status" varchar(32) NOT NULL DEFAULT 'OPEN',
        "priority" varchar(32) NOT NULL DEFAULT 'MEDIUM',
        "remarks" text,
        "linkedIssueId" integer,
        "linkedTaskId" integer,
        "meetingReference" varchar(220),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_project_status"
      ON "followup_actions" ("projectId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_assignee_due"
      ON "followup_actions" ("assignedToUserId", "dueDate")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_journal_entries" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "date" date NOT NULL,
        "authorUserId" integer NOT NULL,
        "weather" varchar(32),
        "summary" text NOT NULL,
        "workDoneToday" text,
        "issuesRaised" text,
        "safetyObservations" text,
        "laborCount" integer,
        "equipmentOnSite" text,
        "visitorsOnSite" text,
        "photoUrls" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "remarks" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_site_journal_project_date" UNIQUE ("projectId", "date")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_journal_project_date"
      ON "site_journal_entries" ("projectId", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "followup_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_task_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_tasks"`);
  }
}
