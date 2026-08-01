import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddConcreteCardActivationApprovalLevels1780900000000
  implements MigrationInterface
{
  name = 'AddConcreteCardActivationApprovalLevels1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    const columns = [
      'pourClearanceTriggerApprovalLevel',
      'pourCardTriggerApprovalLevel',
    ];

    for (const columnName of columns) {
      if (!table?.findColumnByName(columnName)) {
        await queryRunner.addColumn(
          'quality_activity',
          new TableColumn({
            name: columnName,
            type: 'int',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    for (const columnName of [
      'pourCardTriggerApprovalLevel',
      'pourClearanceTriggerApprovalLevel',
    ]) {
      if (table?.findColumnByName(columnName)) {
        await queryRunner.dropColumn('quality_activity', columnName);
      }
    }
  }
}
