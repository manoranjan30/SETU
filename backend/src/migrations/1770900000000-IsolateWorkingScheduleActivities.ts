import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class IsolateWorkingScheduleActivities1770900000000
  implements MigrationInterface
{
  name = 'IsolateWorkingScheduleActivities1770900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const activityTable = await queryRunner.getTable('activity');
    if (
      activityTable &&
      !activityTable.findColumnByName('originVersionId')
    ) {
      await queryRunner.addColumn(
        'activity',
        new TableColumn({
          name: 'originVersionId',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    const relationshipTable = await queryRunner.getTable('activity_relationship');
    if (
      relationshipTable &&
      !relationshipTable.findColumnByName('versionId')
    ) {
      await queryRunner.addColumn(
        'activity_relationship',
        new TableColumn({
          name: 'versionId',
          type: 'integer',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const relationshipTable = await queryRunner.getTable('activity_relationship');
    if (relationshipTable?.findColumnByName('versionId')) {
      await queryRunner.dropColumn('activity_relationship', 'versionId');
    }

    const activityTable = await queryRunner.getTable('activity');
    if (activityTable?.findColumnByName('originVersionId')) {
      await queryRunner.dropColumn('activity', 'originVersionId');
    }
  }
}
