import { MigrationInterface, QueryRunner } from 'typeorm';

export class DedupeFcmTokens1771700000006 implements MigrationInterface {
  name = 'DedupeFcmTokens1771700000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_tokens AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "fcmToken"
            ORDER BY "updatedAt" DESC NULLS LAST, id DESC
          ) AS token_rank
        FROM "user"
        WHERE "fcmToken" IS NOT NULL AND BTRIM("fcmToken") <> ''
      )
      UPDATE "user" u
      SET "fcmToken" = NULL
      FROM ranked_tokens r
      WHERE u.id = r.id AND r.token_rank > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_fcm_token_unique"
      ON "user" ("fcmToken")
      WHERE "fcmToken" IS NOT NULL AND BTRIM("fcmToken") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_fcm_token_unique"`);
  }
}
