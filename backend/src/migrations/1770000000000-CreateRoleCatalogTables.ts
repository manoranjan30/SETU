import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleCatalogTables1770000000000
  implements MigrationInterface
{
  name = 'CreateRoleCatalogTables1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('role')) {
      await queryRunner.query(`
        ALTER TABLE "role"
        ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false
      `);
      await queryRunner.query(`
        ALTER TABLE "role"
        ADD COLUMN IF NOT EXISTS "isLocked" boolean NOT NULL DEFAULT false
      `);
      await queryRunner.query(`
        ALTER TABLE "role"
        ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_preset" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "group" character varying NOT NULL,
        "tier" integer NOT NULL,
        "icon" character varying NOT NULL DEFAULT 'ShieldCheck',
        "isSystem" boolean NOT NULL DEFAULT false,
        "isLocked" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_action_preset_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_action_preset_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_template" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "icon" character varying NOT NULL DEFAULT 'Briefcase',
        "isSystem" boolean NOT NULL DEFAULT false,
        "isLocked" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_role_template_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_template_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_preset_permissions_permission" (
        "actionPresetId" integer NOT NULL,
        "permissionId" integer NOT NULL,
        CONSTRAINT "PK_action_preset_permissions_permission"
          PRIMARY KEY ("actionPresetId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_preset_permissions_action_preset"
      ON "action_preset_permissions_permission" ("actionPresetId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_preset_permissions_permission"
      ON "action_preset_permissions_permission" ("permissionId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_template_presets_action_preset" (
        "roleTemplateId" integer NOT NULL,
        "actionPresetId" integer NOT NULL,
        CONSTRAINT "PK_role_template_presets_action_preset"
          PRIMARY KEY ("roleTemplateId", "actionPresetId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_template_presets_role_template"
      ON "role_template_presets_action_preset" ("roleTemplateId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_template_presets_action_preset"
      ON "role_template_presets_action_preset" ("actionPresetId")
    `);

    if (
      (await queryRunner.hasTable('permission')) &&
      (await queryRunner.hasTable('action_preset'))
    ) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_action_preset_permissions_action_preset'
              AND table_name = 'action_preset_permissions_permission'
          ) THEN
            ALTER TABLE "action_preset_permissions_permission"
            ADD CONSTRAINT "FK_action_preset_permissions_action_preset"
            FOREIGN KEY ("actionPresetId") REFERENCES "action_preset"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_action_preset_permissions_permission'
              AND table_name = 'action_preset_permissions_permission'
          ) THEN
            ALTER TABLE "action_preset_permissions_permission"
            ADD CONSTRAINT "FK_action_preset_permissions_permission"
            FOREIGN KEY ("permissionId") REFERENCES "permission"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);
    }

    if (
      (await queryRunner.hasTable('role_template')) &&
      (await queryRunner.hasTable('action_preset'))
    ) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_role_template_presets_role_template'
              AND table_name = 'role_template_presets_action_preset'
          ) THEN
            ALTER TABLE "role_template_presets_action_preset"
            ADD CONSTRAINT "FK_role_template_presets_role_template"
            FOREIGN KEY ("roleTemplateId") REFERENCES "role_template"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_role_template_presets_action_preset'
              AND table_name = 'role_template_presets_action_preset'
          ) THEN
            ALTER TABLE "role_template_presets_action_preset"
            ADD CONSTRAINT "FK_role_template_presets_action_preset"
            FOREIGN KEY ("actionPresetId") REFERENCES "action_preset"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "role_template_presets_action_preset"
      DROP CONSTRAINT IF EXISTS "FK_role_template_presets_action_preset"
    `);
    await queryRunner.query(`
      ALTER TABLE "role_template_presets_action_preset"
      DROP CONSTRAINT IF EXISTS "FK_role_template_presets_role_template"
    `);
    await queryRunner.query(`
      ALTER TABLE "action_preset_permissions_permission"
      DROP CONSTRAINT IF EXISTS "FK_action_preset_permissions_permission"
    `);
    await queryRunner.query(`
      ALTER TABLE "action_preset_permissions_permission"
      DROP CONSTRAINT IF EXISTS "FK_action_preset_permissions_action_preset"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_role_template_presets_action_preset"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_role_template_presets_role_template"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_action_preset_permissions_permission"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_action_preset_permissions_action_preset"`,
    );

    await queryRunner.query(
      `DROP TABLE IF EXISTS "role_template_presets_action_preset"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "action_preset_permissions_permission"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "role_template"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "action_preset"`);

    if (await queryRunner.hasTable('role')) {
      await queryRunner.query(`
        ALTER TABLE "role"
        DROP COLUMN IF EXISTS "isActive"
      `);
      await queryRunner.query(`
        ALTER TABLE "role"
        DROP COLUMN IF EXISTS "isLocked"
      `);
      await queryRunner.query(`
        ALTER TABLE "role"
        DROP COLUMN IF EXISTS "isSystem"
      `);
    }
  }
}
