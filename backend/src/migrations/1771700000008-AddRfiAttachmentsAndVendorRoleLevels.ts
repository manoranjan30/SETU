import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfiAttachmentsAndVendorRoleLevels1771700000008
  implements MigrationInterface
{
  name = 'AddRfiAttachmentsAndVendorRoleLevels1771700000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "role"
      ADD COLUMN IF NOT EXISTS "tempRoleTemplateId" integer,
      ADD COLUMN IF NOT EXISTS "vendorRoleLevel" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "temp_users"
      ADD COLUMN IF NOT EXISTS "vendor_approval_role_level" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type
          WHERE typname = 'quality_inspection_attachments_attachmenttype_enum'
        ) THEN
          CREATE TYPE "quality_inspection_attachments_attachmenttype_enum"
          AS ENUM ('DRAWING_MARKUP', 'SUPPORTING_DOCUMENT');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_inspection_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" integer NOT NULL,
        "inspectionId" integer,
        "draftToken" uuid NOT NULL,
        "clientUploadId" uuid NOT NULL,
        "attachmentType" "quality_inspection_attachments_attachmenttype_enum" NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "storedName" character varying(255) NOT NULL,
        "originalUrl" text NOT NULL,
        "annotatedUrl" text,
        "mimeType" character varying(120) NOT NULL,
        "size" integer NOT NULL,
        "annotationData" jsonb,
        "uploadedByUserId" integer,
        "isLocked" boolean NOT NULL DEFAULT false,
        "lockedAt" TIMESTAMP,
        "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_inspection_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quality_inspection_attachments_client_upload"
          UNIQUE ("clientUploadId"),
        CONSTRAINT "FK_quality_inspection_attachments_inspection"
          FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspection_attachments_owner"
      ON "quality_inspection_attachments" ("projectId", "inspectionId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspection_attachments_draft"
      ON "quality_inspection_attachments" ("draftToken")
    `);

    await queryRunner.query(`
      UPDATE "role"
      SET
        "tempRoleTemplateId" = substring("name" from '^TEMP_ROLE_([0-9]+)$')::integer,
        "vendorRoleLevel" = 1
      WHERE "name" ~ '^TEMP_ROLE_[0-9]+$'
        AND "tempRoleTemplateId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "role" r
      SET
        "description" = 'Auto-generated Vendor Approver 1 role for TempRoleTemplate: ' || t."name",
        "isActive" = t."isActive"
      FROM "temp_role_templates" t
      WHERE r."tempRoleTemplateId" = t."id" AND r."vendorRoleLevel" = 1
    `);
    await queryRunner.query(`
      INSERT INTO "role" (
        "name", "description", "dashboardId", "isSystem", "isLocked", "isActive",
        "tempRoleTemplateId", "vendorRoleLevel"
      )
      SELECT
        'TEMP_ROLE_' || t."id" || '_L2',
        'Auto-generated Vendor Approver 2 role for TempRoleTemplate: ' || t."name",
        NULL, false, false, t."isActive", t."id", 2
      FROM "temp_role_templates" t
      ON CONFLICT ("name") DO UPDATE SET
        "description" = EXCLUDED."description",
        "isActive" = EXCLUDED."isActive",
        "tempRoleTemplateId" = EXCLUDED."tempRoleTemplateId",
        "vendorRoleLevel" = EXCLUDED."vendorRoleLevel"
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions_permission" ("roleId", "permissionId")
      SELECT l2."id", rp."permissionId"
      FROM "role" l1
      JOIN "role" l2
        ON l2."tempRoleTemplateId" = l1."tempRoleTemplateId"
       AND l2."vendorRoleLevel" = 2
      JOIN "role_permissions_permission" rp ON rp."roleId" = l1."id"
      WHERE l1."vendorRoleLevel" = 1
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_inspection_attachments"`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type
          WHERE typname = 'quality_inspection_attachments_attachmenttype_enum'
        ) THEN
          DROP TYPE "quality_inspection_attachments_attachmenttype_enum";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "temp_users"
      DROP COLUMN IF EXISTS "vendor_approval_role_level"
    `);
    await queryRunner.query(`
      DELETE FROM "user_project_assignment_roles"
      WHERE "role_id" IN (
        SELECT "id" FROM "role" WHERE "vendorRoleLevel" = 2
      )
    `);
    await queryRunner.query(`
      DELETE FROM "role_permissions_permission"
      WHERE "roleId" IN (
        SELECT "id" FROM "role" WHERE "vendorRoleLevel" = 2
      )
    `);
    await queryRunner.query(`
      DELETE FROM "role" WHERE "vendorRoleLevel" = 2
    `);
    await queryRunner.query(`
      ALTER TABLE "role"
      DROP COLUMN IF EXISTS "vendorRoleLevel",
      DROP COLUMN IF EXISTS "tempRoleTemplateId"
    `);
  }
}
