import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSnagTables1711101000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE snag_list_status AS ENUM ('snagging','desnagging','released','handover_ready');
      CREATE TYPE snag_round_snag_phase_status AS ENUM ('open','submitted');
      CREATE TYPE snag_round_desnag_phase_status AS ENUM ('locked','open','approval_pending','approved','rejected');
      CREATE TYPE snag_item_status AS ENUM ('open','rectified','closed','on_hold');
      CREATE TYPE snag_photo_type AS ENUM ('before','after');
      CREATE TYPE snag_release_approval_status AS ENUM ('pending','approved','rejected');
      CREATE TYPE snag_release_approval_step_status AS ENUM ('waiting','pending','approved','rejected');
    `);

    await queryRunner.query(`
      CREATE TABLE snag_list (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES eps_node(id) ON DELETE CASCADE,
        eps_node_id INTEGER NULL REFERENCES eps_node(id) ON DELETE SET NULL,
        quality_unit_id INTEGER NOT NULL REFERENCES quality_unit(id) ON DELETE CASCADE,
        unit_label VARCHAR(100) NOT NULL,
        current_round INTEGER NOT NULL DEFAULT 1,
        overall_status snag_list_status NOT NULL DEFAULT 'snagging',
        created_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_snag_list_project_quality_unit
      ON snag_list(project_id, quality_unit_id);
    `);

    await queryRunner.query(`
      CREATE TABLE snag_round (
        id SERIAL PRIMARY KEY,
        snag_list_id INTEGER NOT NULL REFERENCES snag_list(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        snag_phase_status snag_round_snag_phase_status NOT NULL DEFAULT 'open',
        snag_submitted_at TIMESTAMP NULL,
        snag_submitted_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        snag_submitted_comments TEXT NULL,
        desnag_phase_status snag_round_desnag_phase_status NOT NULL DEFAULT 'locked',
        desnag_released_at TIMESTAMP NULL,
        desnag_release_comments TEXT NULL,
        initiated_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        initiated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE snag_item (
        id SERIAL PRIMARY KEY,
        snag_list_id INTEGER NOT NULL REFERENCES snag_list(id) ON DELETE CASCADE,
        snag_round_id INTEGER NOT NULL REFERENCES snag_round(id) ON DELETE CASCADE,
        quality_room_id INTEGER NULL REFERENCES quality_room(id) ON DELETE SET NULL,
        room_label VARCHAR(120) NULL,
        defect_title VARCHAR(255) NOT NULL,
        defect_description TEXT NULL,
        trade VARCHAR(120) NULL,
        priority VARCHAR(40) NOT NULL DEFAULT 'medium',
        status snag_item_status NOT NULL DEFAULT 'open',
        raised_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        rectified_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        closed_by_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        hold_reason TEXT NULL,
        raised_at TIMESTAMP NULL,
        rectified_at TIMESTAMP NULL,
        closed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE snag_photo (
        id SERIAL PRIMARY KEY,
        snag_item_id INTEGER NOT NULL REFERENCES snag_item(id) ON DELETE CASCADE,
        type snag_photo_type NOT NULL,
        file_url TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE snag_release_approval (
        id SERIAL PRIMARY KEY,
        snag_round_id INTEGER NOT NULL REFERENCES snag_round(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES eps_node(id) ON DELETE CASCADE,
        current_step_order INTEGER NOT NULL DEFAULT 1,
        status snag_release_approval_status NOT NULL DEFAULT 'pending',
        release_strategy_id INTEGER NULL,
        process_code VARCHAR(120) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE snag_release_approval_step (
        id SERIAL PRIMARY KEY,
        approval_id INTEGER NOT NULL REFERENCES snag_release_approval(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_name VARCHAR(255) NOT NULL,
        assigned_role_id INTEGER NULL,
        assigned_user_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        assigned_user_ids JSONB NULL,
        status snag_release_approval_step_status NOT NULL DEFAULT 'waiting',
        acted_by_user_id INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
        acted_at TIMESTAMP NULL,
        comments TEXT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS snag_release_approval_step;`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_release_approval;`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_photo;`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_item;`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_round;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_snag_list_project_quality_unit;`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_list;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_release_approval_step_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_release_approval_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_photo_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_item_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_round_desnag_phase_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_round_snag_phase_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_list_status;`);
  }
}
