import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityPourCardsAndActivityFlags1770200000000
  implements MigrationInterface
{
  name = 'AddQualityPourCardsAndActivityFlags1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('quality_activity')) {
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        ADD COLUMN IF NOT EXISTS "assignedChecklistIds" integer[] NOT NULL DEFAULT '{}'
      `);
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        ADD COLUMN IF NOT EXISTS "requiresPourCard" boolean NOT NULL DEFAULT false
      `);
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        ADD COLUMN IF NOT EXISTS "requiresPourClearanceCard" boolean NOT NULL DEFAULT false
      `);
    }

    if (await queryRunner.hasTable('quality_inspections')) {
      await queryRunner.query(`
        ALTER TABLE "quality_inspections"
        ADD COLUMN IF NOT EXISTS "element_name" character varying(255)
      `);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quality_pour_cards_status_enum'
        ) THEN
          CREATE TYPE "quality_pour_cards_status_enum" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quality_pre_pour_clearance_cards_status_enum'
        ) THEN
          CREATE TYPE "quality_pre_pour_clearance_cards_status_enum" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');
        END IF;
      END
      $$;
    `);

    if (!(await queryRunner.hasTable('quality_pour_cards'))) {
      await queryRunner.query(`
        CREATE TABLE "quality_pour_cards" (
          "id" SERIAL NOT NULL,
          "inspectionId" integer NOT NULL,
          "projectId" integer NOT NULL,
          "activityId" integer NOT NULL,
          "epsNodeId" integer,
          "elementName" character varying(255),
          "locationText" character varying(255),
          "projectNameSnapshot" character varying(255),
          "clientName" character varying(255),
          "consultantName" character varying(255),
          "contractorName" character varying(255),
          "formatNo" character varying(100) NOT NULL DEFAULT 'F/QA/16',
          "revisionNo" character varying(20),
          "approvedByName" character varying(255),
          "status" "quality_pour_cards_status_enum" NOT NULL DEFAULT 'DRAFT',
          "entries" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "remarks" text,
          "createdByUserId" integer,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_quality_pour_cards_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_quality_pour_cards_inspectionId" UNIQUE ("inspectionId"),
          CONSTRAINT "FK_quality_pour_cards_inspectionId" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
    }

    if (!(await queryRunner.hasTable('quality_pre_pour_clearance_cards'))) {
      await queryRunner.query(`
        CREATE TABLE "quality_pre_pour_clearance_cards" (
          "id" SERIAL NOT NULL,
          "inspectionId" integer NOT NULL,
          "projectId" integer NOT NULL,
          "activityId" integer NOT NULL,
          "epsNodeId" integer,
          "activityLabel" character varying(255),
          "projectNameSnapshot" character varying(255),
          "elementName" character varying(255),
          "locationText" character varying(255),
          "cardDate" date,
          "pourStartTime" character varying(20),
          "pourEndTime" character varying(20),
          "contractorName" character varying(255),
          "formatNo" character varying(100) NOT NULL DEFAULT 'F/QA/20',
          "revisionNo" character varying(20),
          "pourLocation" character varying(255),
          "estimatedConcreteQty" numeric,
          "actualConcreteQty" numeric,
          "pourNo" character varying(100),
          "gradeOfConcrete" character varying(100),
          "placementMethod" character varying(100),
          "concreteSupplier" character varying(255),
          "cubeMouldCount" integer,
          "targetSlump" character varying(100),
          "vibratorCount" integer,
          "attachments" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "signoffs" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "status" "quality_pre_pour_clearance_cards_status_enum" NOT NULL DEFAULT 'DRAFT',
          "createdByUserId" integer,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_quality_pre_pour_clearance_cards_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_quality_pre_pour_clearance_cards_inspectionId" UNIQUE ("inspectionId"),
          CONSTRAINT "FK_quality_pre_pour_clearance_cards_inspectionId" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('quality_pre_pour_clearance_cards')) {
      await queryRunner.query(`DROP TABLE "quality_pre_pour_clearance_cards"`);
    }

    if (await queryRunner.hasTable('quality_pour_cards')) {
      await queryRunner.query(`DROP TABLE "quality_pour_cards"`);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quality_pre_pour_clearance_cards_status_enum'
        ) THEN
          DROP TYPE "quality_pre_pour_clearance_cards_status_enum";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quality_pour_cards_status_enum'
        ) THEN
          DROP TYPE "quality_pour_cards_status_enum";
        END IF;
      END
      $$;
    `);

    if (await queryRunner.hasTable('quality_inspections')) {
      await queryRunner.query(`
        ALTER TABLE "quality_inspections"
        DROP COLUMN IF EXISTS "element_name"
      `);
    }

    if (await queryRunner.hasTable('quality_activity')) {
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        DROP COLUMN IF EXISTS "requiresPourClearanceCard"
      `);
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        DROP COLUMN IF EXISTS "requiresPourCard"
      `);
      await queryRunner.query(`
        ALTER TABLE "quality_activity"
        DROP COLUMN IF EXISTS "assignedChecklistIds"
      `);
    }
  }
}
