import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddQualityCardApprovalLifecycle1771100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_pour_cards_status_enum') THEN
          ALTER TYPE "quality_pour_cards_status_enum" ADD VALUE IF NOT EXISTS 'APPROVED';
          ALTER TYPE "quality_pour_cards_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_pre_pour_clearance_cards_status_enum') THEN
          ALTER TYPE "quality_pre_pour_clearance_cards_status_enum" ADD VALUE IF NOT EXISTS 'APPROVED';
          ALTER TYPE "quality_pre_pour_clearance_cards_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED';
        END IF;
      END
      $$;
    `);

    const lifecycleColumns = [
      new TableColumn({ name: 'submittedAt', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'submittedByUserId', type: 'int', isNullable: true }),
      new TableColumn({ name: 'approvedAt', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'approvedByUserId', type: 'int', isNullable: true }),
      new TableColumn({ name: 'approvalRemarks', type: 'text', isNullable: true }),
      new TableColumn({ name: 'rejectedAt', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'rejectedByUserId', type: 'int', isNullable: true }),
      new TableColumn({ name: 'rejectionRemarks', type: 'text', isNullable: true }),
    ];

    for (const tableName of [
      'quality_pour_cards',
      'quality_pre_pour_clearance_cards',
    ]) {
      if (!(await queryRunner.hasTable(tableName))) continue;
      for (const column of lifecycleColumns) {
        if (!(await queryRunner.hasColumn(tableName, column.name))) {
          await queryRunner.addColumn(tableName, column);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of [
      'quality_pour_cards',
      'quality_pre_pour_clearance_cards',
    ]) {
      if (!(await queryRunner.hasTable(tableName))) continue;
      for (const columnName of [
        'rejectionRemarks',
        'rejectedByUserId',
        'rejectedAt',
        'approvalRemarks',
        'approvedByUserId',
        'approvedAt',
        'submittedByUserId',
        'submittedAt',
      ]) {
        if (await queryRunner.hasColumn(tableName, columnName)) {
          await queryRunner.dropColumn(tableName, columnName);
        }
      }
    }
  }
}
