import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerMilestoneTables1711100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE customer_milestone_trigger_type AS ENUM ('QUALITY_APPROVED','PROGRESS_PCT','SNAG_ROUND_RELEASED','MANUAL');
      CREATE TYPE customer_milestone_applicability AS ENUM ('all_units','tower','floor','unit');
      CREATE TYPE customer_milestone_achievement_status AS ENUM ('not_triggered','triggered','invoice_raised','collected','partially_collected','waived');
      CREATE TYPE milestone_payment_mode AS ENUM ('cheque','neft','rtgs','upi','demand_draft','other');
    `);

    await queryRunner.query(`
      CREATE TABLE customer_milestone_template (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES eps_node(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        sequence INTEGER NOT NULL DEFAULT 1,
        collection_pct DECIMAL(5,2) NOT NULL,
        trigger_type customer_milestone_trigger_type NOT NULL,
        trigger_activity_id INTEGER NULL REFERENCES activity(id) ON DELETE SET NULL,
        trigger_quality_activity_id INTEGER NULL REFERENCES quality_activity(id) ON DELETE SET NULL,
        trigger_snag_round INTEGER NULL,
        trigger_progress_pct DECIMAL(5,2) NULL,
        applicable_to customer_milestone_applicability NOT NULL DEFAULT 'all_units',
        applicable_eps_ids INTEGER[] NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE flat_sale_info (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES eps_node(id) ON DELETE CASCADE,
        eps_node_id INTEGER NULL REFERENCES eps_node(id) ON DELETE SET NULL,
        quality_unit_id INTEGER NULL REFERENCES quality_unit(id) ON DELETE SET NULL,
        unit_label VARCHAR(100) NOT NULL,
        total_sale_value DECIMAL(15,2) NOT NULL,
        customer_name VARCHAR(255) NULL,
        agreement_date DATE NULL,
        loan_bank VARCHAR(255) NULL,
        remarks TEXT NULL,
        created_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE customer_milestone_achievement (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES customer_milestone_template(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES eps_node(id) ON DELETE CASCADE,
        eps_node_id INTEGER NULL REFERENCES eps_node(id) ON DELETE SET NULL,
        quality_unit_id INTEGER NULL REFERENCES quality_unit(id) ON DELETE SET NULL,
        unit_label VARCHAR(100) NOT NULL,
        status customer_milestone_achievement_status NOT NULL DEFAULT 'not_triggered',
        triggered_at TIMESTAMP NULL,
        triggered_by VARCHAR(255) NULL,
        trigger_reference VARCHAR(255) NULL,
        collection_pct DECIMAL(5,2) NOT NULL,
        flat_sale_value DECIMAL(15,2) NULL,
        collection_amount DECIMAL(15,2) NULL,
        invoice_number VARCHAR(100) NULL,
        invoice_date DATE NULL,
        invoice_raised_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        amount_received DECIMAL(15,2) NULL,
        received_date DATE NULL,
        received_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        remarks TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_customer_milestone_template_unit
      ON customer_milestone_achievement(template_id, quality_unit_id);
    `);

    await queryRunner.query(`
      CREATE TABLE milestone_collection_tranche (
        id SERIAL PRIMARY KEY,
        achievement_id INTEGER NOT NULL REFERENCES customer_milestone_achievement(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        received_date DATE NOT NULL,
        payment_mode milestone_payment_mode NOT NULL,
        reference_number VARCHAR(100) NOT NULL,
        bank_name VARCHAR(255) NULL,
        remarks TEXT NULL,
        collected_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS milestone_collection_tranche;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_customer_milestone_template_unit;`);
    await queryRunner.query(`DROP TABLE IF EXISTS customer_milestone_achievement;`);
    await queryRunner.query(`DROP TABLE IF EXISTS flat_sale_info;`);
    await queryRunner.query(`DROP TABLE IF EXISTS customer_milestone_template;`);
    await queryRunner.query(`DROP TYPE IF EXISTS milestone_payment_mode;`);
    await queryRunner.query(`DROP TYPE IF EXISTS customer_milestone_achievement_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS customer_milestone_applicability;`);
    await queryRunner.query(`DROP TYPE IF EXISTS customer_milestone_trigger_type;`);
  }
}
