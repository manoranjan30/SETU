import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoFieldsToProjectProfile1710902000000
  implements MigrationInterface
{
  name = 'AddLogoFieldsToProjectProfile1710902000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('project_profile'))) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "project_profile" ADD COLUMN IF NOT EXISTS "companyLogoUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_profile" ADD COLUMN IF NOT EXISTS "projectLogoUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('project_profile'))) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "project_profile" DROP COLUMN IF EXISTS "projectLogoUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_profile" DROP COLUMN IF EXISTS "companyLogoUrl"`,
    );
  }
}
