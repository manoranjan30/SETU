import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIssueTrackerTables1710904000000
  implements MigrationInterface
{
  name = 'CreateIssueTrackerTables1710904000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_departments" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "color" character varying(20),
        "memberUserIds" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_departments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_tags" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "departmentId" integer NOT NULL,
        "departmentName" character varying(150),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_tags" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_issues" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "tagIds" jsonb NOT NULL,
        "tagNames" jsonb,
        "raisedByUserId" integer,
        "raisedByName" character varying(150),
        "raisedDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "requiredDate" date,
        "respondedDate" TIMESTAMP WITH TIME ZONE,
        "committedCompletionDate" date,
        "status" character varying(20) NOT NULL DEFAULT 'OPEN',
        "currentDepartmentId" integer,
        "currentDepartmentName" character varying(150),
        "currentStepIndex" integer NOT NULL DEFAULT 0,
        "closedDate" TIMESTAMP WITH TIME ZONE,
        "closedRemarks" text,
        "closedByName" character varying(150),
        "closedByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_issues" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issue_tracker_steps" (
        "id" SERIAL NOT NULL,
        "issueId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "sequenceNo" integer NOT NULL,
        "departmentId" integer NOT NULL,
        "departmentName" character varying(150) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "responseText" text,
        "committedCompletionDate" date,
        "respondedDate" TIMESTAMP WITH TIME ZONE,
        "respondedByUserId" integer,
        "respondedByName" character varying(150),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_tracker_steps" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_issues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issue_tracker_departments"`);
  }
}
