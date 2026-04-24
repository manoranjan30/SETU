import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBudgetLineActivityMap1769700000000
  implements MigrationInterface
{
  name = 'AddBudgetLineActivityMap1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "budget_line_activity_map" (
        "id" SERIAL NOT NULL,
        "budgetLineItemId" integer NOT NULL,
        "activityId" integer NOT NULL,
        "createdBy" varchar NOT NULL DEFAULT 'system',
        "createdOn" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_line_activity_map_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_budget_line_activity_map_line"
          FOREIGN KEY ("budgetLineItemId") REFERENCES "budget_line_item"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_budget_line_activity_map_activity"
          FOREIGN KEY ("activityId") REFERENCES "activity"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_budget_line_activity"
      ON "budget_line_activity_map" ("budgetLineItemId", "activityId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_line_activity_line"
      ON "budget_line_activity_map" ("budgetLineItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budget_line_activity_activity"
      ON "budget_line_activity_map" ("activityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_budget_line_activity_activity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_budget_line_activity_line"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_budget_line_activity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budget_line_activity_map"`);
  }
}
