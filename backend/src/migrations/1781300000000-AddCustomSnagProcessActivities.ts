import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCustomSnagProcessActivities1781300000000
  implements MigrationInterface
{
  name = 'AddCustomSnagProcessActivities1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const processActivityTable = await queryRunner.getTable(
      'snag_process_activity',
    );
    if (
      processActivityTable &&
      !processActivityTable.findColumnByName('custom_activity_name')
    ) {
      await queryRunner.addColumn(
        'snag_process_activity',
        new TableColumn({
          name: 'custom_activity_name',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
    if (
      processActivityTable?.findColumnByName('activity_id') &&
      !processActivityTable.findColumnByName('activity_id')?.isNullable
    ) {
      await queryRunner.query(
        'ALTER TABLE "snag_process_activity" ALTER COLUMN "activity_id" DROP NOT NULL',
      );
    }

    const commonPointTable = await queryRunner.getTable('snag_common_point');
    if (
      commonPointTable?.findColumnByName('activity_id') &&
      !commonPointTable.findColumnByName('activity_id')?.isNullable
    ) {
      await queryRunner.query(
        'ALTER TABLE "snag_common_point" ALTER COLUMN "activity_id" DROP NOT NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const processActivityTable = await queryRunner.getTable(
      'snag_process_activity',
    );
    if (processActivityTable?.findColumnByName('custom_activity_name')) {
      await queryRunner.dropColumn(
        'snag_process_activity',
        'custom_activity_name',
      );
    }
  }
}
