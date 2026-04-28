import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectPermissionsToUsers1770400000000
  implements MigrationInterface
{
  name = 'AddDirectPermissionsToUsers1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_direct_permissions_permission" (
        "userId" integer NOT NULL,
        "permissionId" integer NOT NULL,
        CONSTRAINT "PK_user_direct_permissions_permission"
          PRIMARY KEY ("userId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_direct_permissions_user"
      ON "user_direct_permissions_permission" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_direct_permissions_permission"
      ON "user_direct_permissions_permission" ("permissionId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_user_direct_permissions_user'
            AND table_name = 'user_direct_permissions_permission'
        ) THEN
          ALTER TABLE "user_direct_permissions_permission"
          ADD CONSTRAINT "FK_user_direct_permissions_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_user_direct_permissions_permission'
            AND table_name = 'user_direct_permissions_permission'
        ) THEN
          ALTER TABLE "user_direct_permissions_permission"
          ADD CONSTRAINT "FK_user_direct_permissions_permission"
          FOREIGN KEY ("permissionId") REFERENCES "permission"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_direct_permissions_permission"
      DROP CONSTRAINT IF EXISTS "FK_user_direct_permissions_permission"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_direct_permissions_permission"
      DROP CONSTRAINT IF EXISTS "FK_user_direct_permissions_user"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_direct_permissions_permission"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_direct_permissions_user"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_direct_permissions_permission"`,
    );
  }
}
