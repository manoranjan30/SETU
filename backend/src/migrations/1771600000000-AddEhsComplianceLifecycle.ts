import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEhsComplianceLifecycle1771600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'ehs_machineries',
      'ehs_vehicles',
      'ehs_competencies',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'ehs_competencies',
      'ehs_vehicles',
      'ehs_machineries',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "isActive"
      `);
    }
  }
}
