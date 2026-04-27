import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBudgetModule1769600000000 implements MigrationInterface {
  name = 'AddBudgetModule1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEpsNode = await queryRunner.hasTable('eps_node');
    const hasWbsNode = await queryRunner.hasTable('wbs_node');
    const hasBoqItem = await queryRunner.hasTable('boq_item');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status_enum') THEN
          CREATE TYPE "budget_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_line_item_status_enum') THEN
          CREATE TYPE "budget_line_item_status_enum" AS ENUM ('ACTIVE', 'INACTIVE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_boq_map_allocationtype_enum') THEN
          CREATE TYPE "budget_boq_map_allocationtype_enum" AS ENUM ('FULL');
        END IF;
      END
      $$;
    `);

    if (!hasEpsNode || !hasWbsNode || !hasBoqItem) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "budget" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "name" varchar NOT NULL,
        "status" "budget_status_enum" NOT NULL DEFAULT 'DRAFT',
        "version" integer NOT NULL DEFAULT 1,
        "createdBy" varchar NOT NULL DEFAULT 'system',
        "createdOn" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedOn" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_budget_project" FOREIGN KEY ("projectId") REFERENCES "eps_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_project" ON "budget" ("projectId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "budget_line_item" (
        "id" SERIAL NOT NULL,
        "budgetId" integer NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar,
        "uom" varchar,
        "qty" decimal(12,2) NOT NULL DEFAULT 0,
        "rate" decimal(12,2) NOT NULL DEFAULT 0,
        "amount" decimal(12,2) NOT NULL DEFAULT 0,
        "notes" text,
        "status" "budget_line_item_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "wbsNodeId" integer,
        "epsNodeId" integer,
        "createdOn" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedOn" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_line_item_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_budget_line_item_budget" FOREIGN KEY ("budgetId") REFERENCES "budget"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_budget_line_item_wbs" FOREIGN KEY ("wbsNodeId") REFERENCES "wbs_node"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_budget_line_item_eps" FOREIGN KEY ("epsNodeId") REFERENCES "eps_node"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_line_budget" ON "budget_line_item" ("budgetId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "budget_boq_map" (
        "id" SERIAL NOT NULL,
        "budgetLineItemId" integer NOT NULL,
        "boqItemId" integer NOT NULL,
        "allocationType" "budget_boq_map_allocationtype_enum" NOT NULL DEFAULT 'FULL',
        "allocationValue" decimal(6,2) NOT NULL DEFAULT 100,
        "createdBy" varchar NOT NULL DEFAULT 'system',
        "createdOn" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_boq_map_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_budget_boq_map_line" FOREIGN KEY ("budgetLineItemId") REFERENCES "budget_line_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_budget_boq_map_boq" FOREIGN KEY ("boqItemId") REFERENCES "boq_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_boq_map_line" ON "budget_boq_map" ("budgetLineItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_boq_map_boq" ON "budget_boq_map" ("boqItemId")
    `);

    await queryRunner.query(`
      ALTER TABLE "boq_item"
      ADD COLUMN IF NOT EXISTS "budgetLineItemId" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_boq_item_budget_line'
            AND table_name = 'boq_item'
        ) THEN
          ALTER TABLE "boq_item"
          ADD CONSTRAINT "FK_boq_item_budget_line"
          FOREIGN KEY ("budgetLineItemId") REFERENCES "budget_line_item"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    // 1) Create default budgets for all projects
    await queryRunner.query(`
      INSERT INTO "budget" ("projectId", "name", "status", "version", "createdBy")
      SELECT eps.id, 'Default Budget', 'ACTIVE', 1, 'system'
      FROM "eps_node" eps
      WHERE eps.type = 'PROJECT'
        AND NOT EXISTS (
          SELECT 1 FROM "budget" b WHERE b."projectId" = eps.id
        )
    `);

    // 2) Create budget lines from existing BOQ items
    await queryRunner.query(`
      INSERT INTO "budget_line_item" (
        "budgetId", "code", "name", "category", "uom", "qty", "rate", "amount", "notes", "status", "wbsNodeId", "epsNodeId"
      )
      SELECT b.id, bi."boqCode", bi."description", NULL, bi."uom", bi."qty", bi."rate", bi."amount", NULL, 'ACTIVE', NULL, bi."epsNodeId"
      FROM "boq_item" bi
      INNER JOIN "budget" b ON b."projectId" = bi."projectId"
      WHERE NOT EXISTS (
        SELECT 1 FROM "budget_line_item" bl
        WHERE bl."budgetId" = b.id AND bl."code" = bi."boqCode"
      )
    `);

    // 3) Link BOQ items to their budget lines
    await queryRunner.query(`
      UPDATE "boq_item" bi
      SET "budgetLineItemId" = bl.id
      FROM "budget_line_item" bl
      INNER JOIN "budget" b ON b.id = bl."budgetId"
      WHERE b."projectId" = bi."projectId"
        AND bl."code" = bi."boqCode"
        AND bi."budgetLineItemId" IS NULL
    `);

    // 4) Backfill mapping table
    await queryRunner.query(`
      INSERT INTO "budget_boq_map" ("budgetLineItemId", "boqItemId", "allocationType", "allocationValue", "createdBy")
      SELECT bi."budgetLineItemId", bi.id, 'FULL', 100, 'system'
      FROM "boq_item" bi
      WHERE bi."budgetLineItemId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "budget_boq_map" m
          WHERE m."budgetLineItemId" = bi."budgetLineItemId"
            AND m."boqItemId" = bi.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "boq_item"
      DROP CONSTRAINT IF EXISTS "FK_boq_item_budget_line"
    `);
    await queryRunner.query(`
      ALTER TABLE "boq_item"
      DROP COLUMN IF EXISTS "budgetLineItemId"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "budget_boq_map"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budget_line_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budget"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "budget_boq_map_allocationtype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "budget_line_item_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "budget_status_enum"`);
  }
}
