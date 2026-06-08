import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPourClearanceAttachmentDocuments1771200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'quality_pre_pour_clearance_cards';
    if (
      (await queryRunner.hasTable(tableName)) &&
      !(await queryRunner.hasColumn(tableName, 'attachmentDocuments'))
    ) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'attachmentDocuments',
          type: 'jsonb',
          default: "'{}'",
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'quality_pre_pour_clearance_cards';
    if (
      (await queryRunner.hasTable(tableName)) &&
      (await queryRunner.hasColumn(tableName, 'attachmentDocuments'))
    ) {
      await queryRunner.dropColumn(tableName, 'attachmentDocuments');
    }
  }
}
