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
  console.log('Connecting to database...');
  await dataSource.initialize();
  console.log('Connected!');
  
  const tables = [
    'micro_daily_log',
    'micro_schedule_activity',
    'micro_quantity_ledger',
    'wo_activity_plan',
    'measurement_progress',
    'measurement_element',
    'work_order_item',
    'work_order_items', // handle plural just in case
    'work_order',
    'boq_sub_item',
    'boq_item',
    'boq_element'
  ];

  for (const t of tables) {
    try {
      await dataSource.query(`TRUNCATE TABLE ${t} CASCADE;`);
      console.log(`Truncated ${t}`);
    } catch(e) { 
        console.log(`Skipped ${t}: ${e.message}`); 
    }
  }

  try {
    await dataSource.query(`DROP TABLE IF EXISTS work_order_boq_map CASCADE;`);
    console.log(`Dropped work_order_boq_map`);
  } catch(e) {}

  try {
    await dataSource.query(`DROP TABLE IF EXISTS boq_activity_plan CASCADE;`);
    console.log(`Dropped boq_activity_plan`);
  } catch(e) {}

  await dataSource.destroy();
  console.log('Cleanup complete.');
}
run();
