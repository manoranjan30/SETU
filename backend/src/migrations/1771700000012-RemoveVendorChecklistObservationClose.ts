import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveVendorChecklistObservationClose1771700000012
  implements MigrationInterface
{
  name = 'RemoveVendorChecklistObservationClose1771700000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "temp_role_templates"
      SET "allowedPermissions" = (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_array_elements_text("allowedPermissions") AS value
        WHERE value <> 'QUALITY.OBSERVATION.CLOSE'
      )
      WHERE "allowedPermissions" ? 'QUALITY.OBSERVATION.CLOSE'
    `);

    await queryRunner.query(`
      DELETE FROM "role_permissions_permission" rp
      USING "role" r, "permission" p
      WHERE rp."roleId" = r."id"
        AND rp."permissionId" = p."id"
        AND p."permissionCode" = 'QUALITY.OBSERVATION.CLOSE'
        AND r."tempRoleTemplateId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally not restored. This migration removes an unsafe vendor
    // template permission; admins can grant close rights to permanent roles.
  }
}
