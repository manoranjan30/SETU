import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddMicroActivityIdToMeasurementElement1708196000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add microActivityId column to measurement_element table
    await queryRunner.addColumn(
      'measurement_element',
      new TableColumn({
        name: 'microActivityId',
        type: 'int',
        isNullable: true,
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'measurement_element',
      new TableForeignKey({
        columnNames: ['microActivityId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'micro_schedule_activity',
        onDelete: 'SET NULL',
      }),
    );

    // Create index for performance
    await queryRunner.query(`
            CREATE INDEX IDX_measurement_element_micro_activity 
            ON measurement_element(microActivityId)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      `DROP INDEX IDX_measurement_element_micro_activity ON measurement_element`,
    );

    // Drop foreign key
    const table = await queryRunner.getTable('measurement_element');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('microActivityId') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('measurement_element', foreignKey);
      }
    }

    // Drop column
    await queryRunner.dropColumn('measurement_element', 'microActivityId');
  }
}
