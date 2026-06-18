import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpsParentIndex1771700000000 implements MigrationInterface {
  name = 'AddEpsParentIndex1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_eps_node_parent_order" ON "eps_node" ("parentId", "order", "name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eps_node_parent_order"`);
  }
}
