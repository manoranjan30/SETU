import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfiAttachmentUuidDefault1771700000009
  implements MigrationInterface
{
  name = 'AddRfiAttachmentUuidDefault1771700000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_inspection_attachments"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_inspection_attachments"
      ALTER COLUMN "id" DROP DEFAULT
    `);
  }
}
