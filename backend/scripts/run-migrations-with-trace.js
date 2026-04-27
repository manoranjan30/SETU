#!/usr/bin/env node

const path = require('path');
const { MigrationExecutor } = require('typeorm');

async function loadDataSource() {
  const distPath = path.join(process.cwd(), 'dist', 'src', 'data-source.js');
  const mod = require(distPath);
  return mod.default || mod.dataSource || mod;
}

async function main() {
  const dataSource = await loadDataSource();
  await dataSource.initialize();

  try {
    const executor = new MigrationExecutor(dataSource);
    executor.transaction = 'each';
    const queryRunner = dataSource.createQueryRunner();
    const originalQuery = queryRunner.query.bind(queryRunner);
    let currentMigrationName = null;
    let lastSql = null;
    let queryCount = 0;

    queryRunner.query = async (...args) => {
      const [query, parameters] = args;
      queryCount += 1;
      lastSql = typeof query === 'string' ? query : String(query);

      try {
        return await originalQuery(...args);
      } catch (error) {
        const sqlPreview = (lastSql || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200);

        console.error(
          `[migration-trace] Query failed in migration: ${currentMigrationName || 'unknown'}`,
        );
        console.error(`[migration-trace] Failed query #${queryCount}`);
        console.error(`[migration-trace] SQL: ${sqlPreview}`);
        if (parameters?.length) {
          console.error(
            `[migration-trace] Params: ${JSON.stringify(parameters).slice(0, 1000)}`,
          );
        }
        throw error;
      }
    };

    const pending = await executor.getPendingMigrations();

    const executorWithRunner = new MigrationExecutor(dataSource, queryRunner);
    executorWithRunner.transaction = 'each';

    console.log(`[migration-trace] Pending migrations: ${pending.length}`);
    pending.forEach((migration, index) => {
      console.log(
        `[migration-trace] ${index + 1}/${pending.length} ${migration.name}`,
      );
    });

    for (let index = 0; index < pending.length; index += 1) {
      const migration = pending[index];
      currentMigrationName = migration.name;
      console.log(
        `[migration-trace] Executing ${index + 1}/${pending.length}: ${migration.name}`,
      );
      await executorWithRunner.executeMigration(migration);
      console.log(`[migration-trace] Completed: ${migration.name}`);
    }

    console.log('[migration-trace] All pending migrations executed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(
    `[migration-trace] Failed: ${error?.stack || error?.message || error}`,
  );
  process.exit(1);
});
