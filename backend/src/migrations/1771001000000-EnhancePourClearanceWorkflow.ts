import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class EnhancePourClearanceWorkflow1771001000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('quality_activity', [
      new TableColumn({
        name: 'pourClearanceTriggerStageTemplateId',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'pourClearanceSignoffTemplate',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'",
      }),
    ]);

    await queryRunner.addColumns('quality_pre_pour_clearance_cards', [
      new TableColumn({
        name: 'activationStageTemplateId',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'activationStageName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'isActivated',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'activatedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'attachmentChecklistSelections',
        type: 'jsonb',
        isNullable: false,
        default: "'{}'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('quality_pre_pour_clearance_cards', [
      'attachmentChecklistSelections',
      'activatedAt',
      'isActivated',
      'activationStageName',
      'activationStageTemplateId',
    ]);

    await queryRunner.dropColumns('quality_activity', [
      'pourClearanceSignoffTemplate',
      'pourClearanceTriggerStageTemplateId',
    ]);
  }
}
