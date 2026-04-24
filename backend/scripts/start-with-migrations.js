#!/usr/bin/env node

const { Client } = require('pg');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const truthy = new Set(['1', 'true', 'yes', 'on']);
const falsy = new Set(['0', 'false', 'no', 'off']);

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (truthy.has(normalized)) return true;
  if (falsy.has(normalized)) return false;
  return fallback;
}

function readNumberEnv(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
}

function log(message) {
  console.log(`[db-startup] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDbConfig() {
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: readNumberEnv('DATABASE_PORT', 5432),
    user: process.env.DATABASE_USER || 'admin',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'setu_db',
  };
}

function resolveCommand(command) {
  if (process.platform === 'win32' && command.toLowerCase() === 'npm') {
    return 'npm.cmd';
  }
  return command;
}

function getMigrationScript() {
  if (process.env.DB_MIGRATION_SCRIPT) {
    return process.env.DB_MIGRATION_SCRIPT;
  }

  const sourceDataSource = path.join(process.cwd(), 'src', 'data-source.ts');
  if (fs.existsSync(sourceDataSource)) {
    return 'migration:run';
  }

  return 'migration:run:dist';
}

function getSchemaSyncCommand() {
  const sourceDataSource = path.join(process.cwd(), 'src', 'data-source.ts');
  if (fs.existsSync(sourceDataSource)) {
    return {
      command: 'npm',
      args: [
        'exec',
        'typeorm-ts-node-commonjs',
        '--',
        '-d',
        'src/data-source.ts',
        'schema:sync',
      ],
    };
  }

  return {
    command: 'node',
    args: ['./node_modules/typeorm/cli.js', '-d', 'dist/src/data-source.js', 'schema:sync'],
  };
}

function distArtifactsMissing() {
  return !fs.existsSync(path.join(process.cwd(), 'dist', 'src', 'data-source.js'));
}

async function runProcess(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command "${command} ${args.join(' ')}" exited with code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

async function prepareBuildArtifactsIfNeeded(migrationScript) {
  const buildScript = process.env.DB_BUILD_SCRIPT || 'build';
  const shouldBuildForDistArtifacts =
    migrationScript === 'migration:run:dist' && distArtifactsMissing();

  if (!shouldBuildForDistArtifacts) {
    return;
  }

  log(
    `Dist migration artifacts are missing. Running "npm run ${buildScript}" before migrations.`,
  );
  await runProcess('npm', ['run', buildScript]);
}

async function waitForDatabase() {
  const timeoutMs = readNumberEnv('DB_READY_TIMEOUT_MS', 120000);
  const retryIntervalMs = readNumberEnv('DB_READY_RETRY_INTERVAL_MS', 2000);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const client = new Client(getDbConfig());
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      log('Database connection is ready.');
      return;
    } catch (error) {
      try {
        await client.end();
      } catch {
        // Ignore cleanup failures while retrying the connection loop.
      }
      log('Waiting for database availability...');
      await sleep(retryIntervalMs);
    }
  }

  throw new Error(
    `Database was not reachable within ${timeoutMs}ms. Check container networking and DB readiness.`,
  );
}

async function acquireMigrationLock() {
  const timeoutMs = readNumberEnv('DB_MIGRATION_LOCK_TIMEOUT_MS', 120000);
  const retryIntervalMs = readNumberEnv(
    'DB_MIGRATION_LOCK_RETRY_INTERVAL_MS',
    2000,
  );
  const lockId = readNumberEnv('DB_MIGRATION_LOCK_ID', 640017);
  const deadline = Date.now() + timeoutMs;

  const client = new Client(getDbConfig());
  await client.connect();

  while (Date.now() < deadline) {
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [lockId],
    );

    if (result.rows[0]?.locked) {
      log(`Acquired migration lock ${lockId}.`);
      return { client, lockId };
    }

    log(`Migration lock ${lockId} is busy, waiting...`);
    await sleep(retryIntervalMs);
  }

  await client.end();
  throw new Error(
    `Timed out waiting for migration lock ${lockId} after ${timeoutMs}ms.`,
  );
}

async function releaseMigrationLock(lockHandle) {
  if (!lockHandle) return;

  try {
    await lockHandle.client.query('SELECT pg_advisory_unlock($1)', [
      lockHandle.lockId,
    ]);
    log(`Released migration lock ${lockHandle.lockId}.`);
  } finally {
    await lockHandle.client.end();
  }
}

async function countUserTables() {
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'migrations'
    `);

    return result.rows[0]?.count ?? 0;
  } finally {
    await client.end();
  }
}

async function bootstrapEmptySchemaIfNeeded(migrationScript) {
  const shouldBootstrap = readBooleanEnv('DB_BOOTSTRAP_EMPTY_SCHEMA', true);
  if (!shouldBootstrap) {
    return;
  }

  const userTableCount = await countUserTables();
  if (userTableCount > 0) {
    log(`Detected ${userTableCount} existing application tables. Skipping empty-schema bootstrap.`);
    return;
  }

  await prepareBuildArtifactsIfNeeded(migrationScript);
  const schemaSync = getSchemaSyncCommand();
  log(
    `Database is empty. Bootstrapping schema via "${schemaSync.command} ${schemaSync.args.join(' ')}".`,
  );
  await runProcess(schemaSync.command, schemaSync.args);
  log('Empty-database schema bootstrap completed successfully.');
}

async function runMigrationsIfEnabled() {
  const shouldRun = readBooleanEnv('RUN_DB_MIGRATIONS', true);
  if (!shouldRun) {
    log('Skipping automatic migrations because RUN_DB_MIGRATIONS=false.');
    return;
  }

  await waitForDatabase();
  const lockHandle = await acquireMigrationLock();

  try {
    const migrationScript = getMigrationScript();
    await bootstrapEmptySchemaIfNeeded(migrationScript);
    await prepareBuildArtifactsIfNeeded(migrationScript);
    log(`Running database migrations via "npm run ${migrationScript}".`);
    await runProcess('npm', ['run', migrationScript]);
    log('Database migrations completed successfully.');
  } finally {
    await releaseMigrationLock(lockHandle);
  }
}

async function startApplication(commandArgs) {
  if (!commandArgs.length) {
    throw new Error(
      'No application start command was provided to start-with-migrations.js',
    );
  }

  log(`Starting application: ${commandArgs.join(' ')}`);
  const child = spawn(resolveCommand(commandArgs[0]), commandArgs.slice(1), {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  child.on('error', (error) => {
    console.error(
      `[db-startup] Failed to start application command: ${error.stack || error.message}`,
    );
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

async function main() {
  const commandArgs = process.argv.slice(2);
  await runMigrationsIfEnabled();
  await startApplication(commandArgs);
}

main().catch((error) => {
  console.error(
    `[db-startup] ${error.stack || error.message || 'Startup failed.'}`,
  );
  process.exit(1);
});
