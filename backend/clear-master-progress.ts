import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'admin',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'setu_db',
  synchronize: false,
});

async function run() {
  console.log('Connecting to database for Master Schedule Progress cleanup...');
  await dataSource.initialize();
  console.log('Connected!');

  try {
    // 1. Clear quantity progress records
    await dataSource.query(`TRUNCATE TABLE quantity_progress_records CASCADE;`);
    console.log('Truncated quantity_progress_records');
  } catch(e) {
    console.log(`Failed to truncate quantity_progress_records: ${e.message}`);
  }

  try {
    // 2. Reset Activity Progress fields
    await dataSource.query(`
      UPDATE activity 
      SET "percentComplete" = 0, 
          "actualValue" = 0, 
          "startDateActual" = NULL, 
          "finishDateActual" = NULL, 
          "status" = 'NOT_STARTED';
    `);
    console.log('Reset progress columns in Activity table');
  } catch(e) {
    console.log(`Failed to reset activity progress: ${e.message}`);
  }

  try {
    // 3. Clear daily logs just in case they hold old data
    await dataSource.query(`TRUNCATE TABLE micro_daily_log CASCADE;`);
    console.log('Truncated micro_daily_log');
  } catch(e) {}
  
  try {
    await dataSource.query(`TRUNCATE TABLE micro_quantity_ledger CASCADE;`);
    console.log('Truncated micro_quantity_ledger');
  } catch(e) {}

  await dataSource.destroy();
  console.log('Progress Cleanup complete.');
}

run();
