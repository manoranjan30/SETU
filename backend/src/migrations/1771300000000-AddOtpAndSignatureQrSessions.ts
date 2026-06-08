import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpAndSignatureQrSessions1771300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_otp_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL,
        "deliveryChannel" character varying(16) NOT NULL,
        "destination" character varying(255) NOT NULL,
        "otpHash" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "requestIp" character varying(64),
        "userAgent" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_otp_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_otp_challenges_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_otp_challenges_user"
      ON "auth_otp_challenges" ("userId", "expiresAt")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'quality_signature_qr_sessions_status_enum'
        ) THEN
          CREATE TYPE "quality_signature_qr_sessions_status_enum" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_signature_qr_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tokenHash" character varying(128) NOT NULL,
        "inspectionId" integer NOT NULL,
        "clearanceCardId" integer NOT NULL,
        "signoffId" character varying(180) NOT NULL,
        "signoffDepartment" character varying(255) NOT NULL,
        "requestedByUserId" integer,
        "consumedByUserId" integer,
        "status" "quality_signature_qr_sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_signature_qr_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quality_signature_qr_sessions_token" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_quality_signature_qr_sessions_card" FOREIGN KEY ("clearanceCardId") REFERENCES "quality_pre_pour_clearance_cards"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quality_signature_qr_sessions_requested_user" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_signature_qr_sessions_target"
      ON "quality_signature_qr_sessions" ("inspectionId", "clearanceCardId", "signoffId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_signature_qr_sessions_target"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_signature_qr_sessions"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'quality_signature_qr_sessions_status_enum'
        ) THEN
          DROP TYPE "quality_signature_qr_sessions_status_enum";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_otp_challenges_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_otp_challenges"`);
  }
}
