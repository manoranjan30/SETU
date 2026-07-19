import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPourCardActivationStage1771700000027
  implements MigrationInterface
{
  name = 'AddPourCardActivationStage1771700000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    if (!table?.findColumnByName('pourCardTriggerStageTemplateId')) {
      await queryRunner.addColumn(
        'quality_activity',
        new TableColumn({
          name: 'pourCardTriggerStageTemplateId',
          type: 'int',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    const table = await queryRunner.getTable('quality_activity');
    if (table?.findColumnByName('pourCardTriggerStageTemplateId')) {
      await queryRunner.dropColumn(
        'quality_activity',
        'pourCardTriggerStageTemplateId',
      );
    }
  }
}
