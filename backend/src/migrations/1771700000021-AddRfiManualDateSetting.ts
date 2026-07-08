import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfiManualDateSetting1771700000021 implements MigrationInterface {
  name = 'AddRfiManualDateSetting1771700000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value", "description", "group")
      VALUES (
        'QUALITY_RFI_BACKDATING_ENABLED',
        'false',
        'Allow project-enabled Quality RFI request and approval dates to be selected manually from the web/mobile apps.',
        'QUALITY'
      )
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "system_settings"
      WHERE "key" = 'QUALITY_RFI_BACKDATING_ENABLED'
    `);
  }
}
