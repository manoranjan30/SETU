import { MigrationInterface, QueryRunner } from 'typeorm';

type EpsRow = {
  id: number;
  parentId: number | null;
  type: string | null;
};

type PlanScopeRow = {
  id: number;
  activityId: number;
  boqItemId: number | null;
  measurementId: number | null;
  activityProjectId: number | null;
  boqEpsNodeId: number | null;
  measurementEpsNodeId: number | null;
};

export class RefactorExecutionProgressStorage1769500000000
  implements MigrationInterface
{
  name = 'RefactorExecutionProgressStorage1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'work_order_items_nodetype_enum'
        ) THEN
          CREATE TYPE "work_order_items_nodetype_enum" AS ENUM ('ITEM', 'SUB_ITEM', 'MEASUREMENT');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      ADD COLUMN IF NOT EXISTS "nodeType" "work_order_items_nodetype_enum" NOT NULL DEFAULT 'ITEM'
    `);
    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      ADD COLUMN IF NOT EXISTS "parentWorkOrderItemId" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_work_order_items_parent'
            AND table_name = 'work_order_items'
        ) THEN
          ALTER TABLE "work_order_items"
          ADD CONSTRAINT "FK_work_order_items_parent"
          FOREIGN KEY ("parentWorkOrderItemId") REFERENCES "work_order_items"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      UPDATE "work_order_items"
      SET "nodeType" = CASE
        WHEN "measurementElementId" IS NOT NULL THEN 'MEASUREMENT'::"work_order_items_nodetype_enum"
        WHEN "boqSubItemId" IS NOT NULL THEN 'SUB_ITEM'::"work_order_items_nodetype_enum"
        ELSE 'ITEM'::"work_order_items_nodetype_enum"
      END
    `);

    await queryRunner.query(`
      UPDATE "work_order_items" child
      SET "parentWorkOrderItemId" = parent.id
      FROM "work_order_items" parent
      WHERE child."parentWorkOrderItemId" IS NULL
        AND child."nodeType" = 'SUB_ITEM'
        AND parent."workOrderId" = child."workOrderId"
        AND parent."boqItemId" = child."boqItemId"
        AND parent."boqSubItemId" IS NULL
        AND parent."measurementElementId" IS NULL
        AND parent."nodeType" = 'ITEM'
    `);

    await queryRunner.query(`
      UPDATE "work_order_items" child
      SET "parentWorkOrderItemId" = parent.id
      FROM "work_order_items" parent
      WHERE child."parentWorkOrderItemId" IS NULL
        AND child."nodeType" = 'MEASUREMENT'
        AND parent."workOrderId" = child."workOrderId"
        AND parent."boqItemId" = child."boqItemId"
        AND (
          (parent."boqSubItemId" = child."boqSubItemId" AND parent."nodeType" = 'SUB_ITEM')
          OR (
            child."boqSubItemId" IS NULL
            AND parent."boqSubItemId" IS NULL
            AND parent."measurementElementId" IS NULL
            AND parent."nodeType" = 'ITEM'
          )
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "wo_activity_plan"
      ADD COLUMN IF NOT EXISTS "execution_eps_node_id" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_wo_activity_plan_execution_eps_node'
            AND table_name = 'wo_activity_plan'
        ) THEN
          ALTER TABLE "wo_activity_plan"
          ADD CONSTRAINT "FK_wo_activity_plan_execution_eps_node"
          FOREIGN KEY ("execution_eps_node_id") REFERENCES "eps_node"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE typname = 'execution_progress_entry_status_enum'
        ) THEN
          CREATE TYPE "execution_progress_entry_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "execution_progress_entry" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "workOrderId" integer,
        "workOrderItemId" integer,
        "activityId" integer,
        "woActivityPlanId" integer,
        "executionEpsNodeId" integer,
        "microActivityId" integer,
        "entryDate" date NOT NULL,
        "enteredQty" numeric(12,3) NOT NULL DEFAULT '0',
        "remarks" text,
        "status" "execution_progress_entry_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdBy" character varying,
        "approvedBy" character varying,
        "approvedAt" TIMESTAMP,
        "rejectionReason" text,
        "legacyMeasurementProgressId" integer,
        "legacyQuantityProgressRecordId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_execution_progress_entry" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "execution_progress_adjustment" (
        "id" SERIAL NOT NULL,
        "executionProgressEntryId" integer NOT NULL,
        "oldQty" numeric(12,3) NOT NULL DEFAULT '0',
        "newQty" numeric(12,3) NOT NULL DEFAULT '0',
        "reason" text,
        "changedBy" character varying,
        "changedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_execution_progress_adjustment" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_execution_progress_entry_project_date"
      ON "execution_progress_entry" ("projectId", "entryDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_execution_progress_entry_plan_status"
      ON "execution_progress_entry" ("woActivityPlanId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_execution_progress_entry_activity_eps"
      ON "execution_progress_entry" ("activityId", "executionEpsNodeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_execution_progress_entry_wo_item"
      ON "execution_progress_entry" ("workOrderItemId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_execution_progress_entry_work_order'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_work_order"
          FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_entry_work_order_item'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_work_order_item"
          FOREIGN KEY ("workOrderItemId") REFERENCES "work_order_items"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_entry_activity'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_activity"
          FOREIGN KEY ("activityId") REFERENCES "activity"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_entry_plan'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_plan"
          FOREIGN KEY ("woActivityPlanId") REFERENCES "wo_activity_plan"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_entry_eps'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_eps"
          FOREIGN KEY ("executionEpsNodeId") REFERENCES "eps_node"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_entry_micro'
            AND table_name = 'execution_progress_entry'
        ) THEN
          ALTER TABLE "execution_progress_entry"
          ADD CONSTRAINT "FK_execution_progress_entry_micro"
          FOREIGN KEY ("microActivityId") REFERENCES "micro_schedule_activity"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_execution_progress_adjustment_entry'
            AND table_name = 'execution_progress_adjustment'
        ) THEN
          ALTER TABLE "execution_progress_adjustment"
          ADD CONSTRAINT "FK_execution_progress_adjustment_entry"
          FOREIGN KEY ("executionProgressEntryId") REFERENCES "execution_progress_entry"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await this.backfillExecutionScopes(queryRunner);
    await this.backfillExecutionEntries(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "execution_progress_adjustment"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_adjustment_entry"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_micro"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_eps"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_plan"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_activity"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_work_order_item"
    `);
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP CONSTRAINT IF EXISTS "FK_execution_progress_entry_work_order"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_execution_progress_entry_project_date"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_execution_progress_entry_plan_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_execution_progress_entry_activity_eps"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_execution_progress_entry_wo_item"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "execution_progress_adjustment"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "execution_progress_entry"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "execution_progress_entry_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "wo_activity_plan"
      DROP CONSTRAINT IF EXISTS "FK_wo_activity_plan_execution_eps_node"
    `);
    await queryRunner.query(`
      ALTER TABLE "wo_activity_plan"
      DROP COLUMN IF EXISTS "execution_eps_node_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      DROP CONSTRAINT IF EXISTS "FK_work_order_items_parent"
    `);
    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      DROP COLUMN IF EXISTS "parentWorkOrderItemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      DROP COLUMN IF EXISTS "nodeType"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "work_order_items_nodetype_enum"
    `);
  }

  private async backfillExecutionScopes(queryRunner: QueryRunner): Promise<void> {
    const epsRows = (await queryRunner.query(`
      SELECT id, "parentId", type
      FROM "eps_node"
    `)) as EpsRow[];
    const epsMap = new Map<number, EpsRow>(
      epsRows.map((row) => [Number(row.id), row]),
    );

    const resolveFloorScope = (startId: number | null): number | null => {
      if (!startId) return null;
      let currentId: number | null = Number(startId);
      while (currentId != null) {
        const node = epsMap.get(currentId);
        if (!node) return startId;
        const nodeType = String(node.type || '').toUpperCase();
        if (nodeType === 'FLOOR' || nodeType === 'LEVEL') {
          return node.id;
        }
        currentId = node.parentId == null ? null : Number(node.parentId);
      }
      return startId;
    };

    const planRows = (await queryRunner.query(`
      SELECT
        plan.id,
        plan.activity_id AS "activityId",
        plan.boq_item_id AS "boqItemId",
        plan.measurement_id AS "measurementId",
        act."projectId" AS "activityProjectId",
        boq."epsNodeId" AS "boqEpsNodeId",
        meas."epsNodeId" AS "measurementEpsNodeId"
      FROM "wo_activity_plan" plan
      LEFT JOIN "activity" act ON act.id = plan.activity_id
      LEFT JOIN "boq_item" boq ON boq.id = plan.boq_item_id
      LEFT JOIN "measurement_element" meas ON meas.id = plan.measurement_id
      WHERE plan.execution_eps_node_id IS NULL
    `)) as PlanScopeRow[];

    for (const row of planRows) {
      const scopeId = resolveFloorScope(
        row.activityProjectId ??
          row.measurementEpsNodeId ??
          row.boqEpsNodeId ??
          null,
      );
      if (!scopeId) continue;
      await queryRunner.query(
        `
          UPDATE "wo_activity_plan"
          SET "execution_eps_node_id" = $1
          WHERE id = $2
        `,
        [scopeId, row.id],
      );
    }
  }

  private async backfillExecutionEntries(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "execution_progress_entry" (
        "projectId",
        "workOrderId",
        "workOrderItemId",
        "activityId",
        "woActivityPlanId",
        "executionEpsNodeId",
        "microActivityId",
        "entryDate",
        "enteredQty",
        "remarks",
        "status",
        "createdBy",
        "approvedBy",
        "approvedAt",
        "rejectionReason",
        "legacyMeasurementProgressId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        me."projectId",
        me."workOrderId",
        me."workOrderItemId",
        COALESCE(plan.activity_id, me."activityId"),
        plan.id,
        COALESCE(plan.execution_eps_node_id, me."epsNodeId"),
        me."microActivityId",
        mp.date,
        mp."executedQty",
        COALESCE(mp."customAttributes"::text, ''),
        CASE
          WHEN mp.status = 'APPROVED' THEN 'APPROVED'::"execution_progress_entry_status_enum"
          WHEN mp.status = 'REJECTED' THEN 'REJECTED'::"execution_progress_entry_status_enum"
          ELSE 'PENDING'::"execution_progress_entry_status_enum"
        END,
        mp."updatedBy",
        mp."reviewedBy",
        mp."reviewedAt",
        mp."rejectionReason",
        mp.id,
        COALESCE(mp."loggedOn", now()),
        COALESCE(mp."loggedOn", now())
      FROM "measurement_progress" mp
      INNER JOIN "measurement_element" me
        ON me.id = mp."measurementElementId"
      LEFT JOIN "wo_activity_plan" plan
        ON plan.work_order_item_id = me."workOrderItemId"
       AND plan.activity_id = me."activityId"
       AND (
         plan.execution_eps_node_id = me."epsNodeId"
         OR plan.execution_eps_node_id IS NULL
       )
      WHERE NOT EXISTS (
        SELECT 1
        FROM "execution_progress_entry" e
        WHERE e."legacyMeasurementProgressId" = mp.id
      )
    `);

    await queryRunner.query(`
      INSERT INTO "execution_progress_entry" (
        "projectId",
        "activityId",
        "entryDate",
        "enteredQty",
        "remarks",
        "status",
        "createdBy",
        "approvedBy",
        "approvedAt",
        "legacyQuantityProgressRecordId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        qpr."projectId",
        NULL,
        qpr."measureDate",
        qpr."measuredQty",
        qpr.remarks,
        CASE
          WHEN qpr.status = 'APPROVED' THEN 'APPROVED'::"execution_progress_entry_status_enum"
          WHEN qpr.status = 'REJECTED' THEN 'REJECTED'::"execution_progress_entry_status_enum"
          ELSE 'PENDING'::"execution_progress_entry_status_enum"
        END,
        qpr."createdBy",
        qpr."approvedBy",
        CASE
          WHEN qpr."approvedDate" IS NULL THEN NULL
          ELSE qpr."approvedDate"::timestamp
        END,
        qpr.id,
        qpr."createdOn",
        qpr."updatedOn"
      FROM "quantity_progress_record" qpr
      WHERE NOT EXISTS (
        SELECT 1
        FROM "execution_progress_entry" e
        WHERE e."legacyQuantityProgressRecordId" = qpr.id
      )
    `);
  }
}
