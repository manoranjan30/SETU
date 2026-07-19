import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPrePourClearanceApprovalRequirement1771700000028
  implements MigrationInterface
{
  name = 'AddPrePourClearanceApprovalRequirement1771700000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    if (!table?.findColumnByName('prePourClearanceApprovalRequirement')) {
      await queryRunner.addColumn(
        'quality_activity',
        new TableColumn({
          name: 'prePourClearanceApprovalRequirement',
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'SUBMITTED'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    if (table?.findColumnByName('prePourClearanceApprovalRequirement')) {
      await queryRunner.dropColumn(
        'quality_activity',
        'prePourClearanceApprovalRequirement',
      );
    }
  }
}
