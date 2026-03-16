import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddMicroActivityIdToMeasurementElement1708196000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('measurement_element');
    const hasColumn = table?.findColumnByName('microActivityId');

    if (!hasColumn) {
      await queryRunner.addColumn(
        'measurement_element',
        new TableColumn({
          name: 'microActivityId',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable('measurement_element');
    const hasForeignKey = refreshedTable?.foreignKeys.some(
      (fk) =>
        fk.columnNames.length === 1 &&
        fk.columnNames[0] === 'microActivityId' &&
        fk.referencedTableName === 'micro_schedule_activity',
    );

    if (!hasForeignKey) {
      await queryRunner.createForeignKey(
        'measurement_element',
        new TableForeignKey({
          columnNames: ['microActivityId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'micro_schedule_activity',
          onDelete: 'SET NULL',
        }),
      );
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_measurement_element_micro_activity"
      ON "measurement_element" ("microActivityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_measurement_element_micro_activity"`,
    );

    const table = await queryRunner.getTable('measurement_element');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('microActivityId') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('measurement_element', foreignKey);
      }
    }

    const refreshedTable = await queryRunner.getTable('measurement_element');
    if (refreshedTable?.findColumnByName('microActivityId')) {
      await queryRunner.dropColumn('measurement_element', 'microActivityId');
    }
  }
}
