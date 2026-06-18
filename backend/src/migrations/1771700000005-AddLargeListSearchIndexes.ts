import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLargeListSearchIndexes1771700000005
  implements MigrationInterface
{
  name = 'AddLargeListSearchIndexes1771700000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quality_inspections') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_comments_trgm" ON "quality_inspections" USING gin ("comments" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_drawing_no_trgm" ON "quality_inspections" USING gin ("drawing_no" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_element_name_trgm" ON "quality_inspections" USING gin ("element_name" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_contractor_name_trgm" ON "quality_inspections" USING gin ("contractor_name" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_go_details_trgm" ON "quality_inspections" USING gin ("go_details" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_go_label_trgm" ON "quality_inspections" USING gin ("go_label" gin_trgm_ops);
        END IF;

        IF to_regclass('public.drawing_register') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS "IDX_drawing_register_drawing_number_trgm" ON "drawing_register" USING gin ("drawingNumber" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_drawing_register_title_trgm" ON "drawing_register" USING gin ("title" gin_trgm_ops);
        END IF;

        IF to_regclass('public.quality_items') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS "IDX_quality_items_description_trgm" ON "quality_items" USING gin ("description" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_items_location_name_trgm" ON "quality_items" USING gin ("locationName" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_items_trade_trgm" ON "quality_items" USING gin ("trade" gin_trgm_ops);
        END IF;

        IF to_regclass('public.ehs_incidents') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_location_trgm" ON "ehs_incidents" USING gin ("location" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_description_trgm" ON "ehs_incidents" USING gin ("description" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_immediate_cause_trgm" ON "ehs_incidents" USING gin ("immediateCause" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_root_cause_trgm" ON "ehs_incidents" USING gin ("rootCause" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_corrective_actions_trgm" ON "ehs_incidents" USING gin ("correctiveActions" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_preventive_actions_trgm" ON "ehs_incidents" USING gin ("preventiveActions" gin_trgm_ops);
        END IF;

        IF to_regclass('public.quality_cube_test_register') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_cube_id_trgm" ON "quality_cube_test_register" USING gin ("cubeId" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_mix_grade_trgm" ON "quality_cube_test_register" USING gin ("mixIdOrGrade" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_location_trgm" ON "quality_cube_test_register" USING gin ("locationText" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_activity_trgm" ON "quality_cube_test_register" USING gin ("activityName" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_element_trgm" ON "quality_cube_test_register" USING gin ("elementName" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_go_label_trgm" ON "quality_cube_test_register" USING gin ("goLabel" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_go_details_trgm" ON "quality_cube_test_register" USING gin ("goDetails" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_truck_trgm" ON "quality_cube_test_register" USING gin ("truckNo" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_challan_trgm" ON "quality_cube_test_register" USING gin ("deliveryChallanNo" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS "IDX_quality_cube_register_remarks_trgm" ON "quality_cube_test_register" USING gin ("remarks" gin_trgm_ops);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_remarks_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_challan_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_truck_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_go_details_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_go_label_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_element_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_activity_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_location_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_mix_grade_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_register_cube_id_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_preventive_actions_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_corrective_actions_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_root_cause_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_immediate_cause_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_description_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_location_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_items_trade_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_items_location_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_items_description_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drawing_register_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drawing_register_drawing_number_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_go_label_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_go_details_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_contractor_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_element_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_drawing_no_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_inspections_comments_trgm"`);
  }
}
