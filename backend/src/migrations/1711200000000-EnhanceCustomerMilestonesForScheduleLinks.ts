import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceCustomerMilestonesForScheduleLinks1711200000000
  implements MigrationInterface
{
  name = 'EnhanceCustomerMilestonesForScheduleLinks1711200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTemplates = await queryRunner.hasTable('customer_milestone_template');
    const hasAchievements = await queryRunner.hasTable(
      'customer_milestone_achievement',
    );
    const hasActivity = await queryRunner.hasTable('activity');

    if (hasTemplates) {
    await queryRunner.query(`
      ALTER TABLE customer_milestone_template
      ADD COLUMN IF NOT EXISTS allow_manual_completion BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    }

    if (hasAchievements) {
    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      ADD COLUMN IF NOT EXISTS planned_completion_date DATE NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      ADD COLUMN IF NOT EXISTS actual_completion_date DATE NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      ADD COLUMN IF NOT EXISTS completion_source VARCHAR(50) NULL;
    `);
    }

    if (!hasTemplates || !hasActivity) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customer_milestone_template_activity_link (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES customer_milestone_template(id) ON DELETE CASCADE,
        activity_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_customer_milestone_template_activity
      ON customer_milestone_template_activity_link(template_id, activity_id);
    `);

    await queryRunner.query(`
      INSERT INTO customer_milestone_template_activity_link (template_id, activity_id, sequence)
      SELECT id, trigger_activity_id, 0
      FROM customer_milestone_template
      WHERE trigger_activity_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS UQ_customer_milestone_template_activity;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS customer_milestone_template_activity_link;
    `);
    if (await queryRunner.hasTable('customer_milestone_achievement')) {
    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      DROP COLUMN IF EXISTS completion_source;
    `);
    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      DROP COLUMN IF EXISTS actual_completion_date;
    `);
    await queryRunner.query(`
      ALTER TABLE customer_milestone_achievement
      DROP COLUMN IF EXISTS planned_completion_date;
    `);
    }
    if (await queryRunner.hasTable('customer_milestone_template')) {
    await queryRunner.query(`
      ALTER TABLE customer_milestone_template
      DROP COLUMN IF EXISTS allow_manual_completion;
    `);
    }
  }
}
