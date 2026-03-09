import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('Initializing Application Context for Data Cleanup...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Starting data cleanup to transition to WO-centric flow...');
  
  const tablesToTruncate = [
    'micro_daily_log',
    'micro_schedule_activity',
    'micro_quantity_ledger',
    'wo_activity_plan', // new table
    'measurement_progress',
    'measurement_element',
    'work_order_item',
    'work_order',
    'boq_sub_item',
    'boq_item',
    'boq_element'
  ];

  for (const table of tablesToTruncate) {
    try {
      await dataSource.query(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`Truncated ${table}`);
    } catch (e) {
      console.log(`Table ${table} might not exist yet or failed to truncate: ${e.message}`);
    }
  }

  const tablesToDrop = [
    'work_order_boq_map',
    'boq_activity_plan' // we use wo_activity_plan now
  ];

  for (const table of tablesToDrop) {
    try {
      await dataSource.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`Dropped legacy table ${table}`);
    } catch (e) {
      console.log(`Failed to drop ${table}: ${e.message}`);
    }
  }

  console.log('Data cleanup complete.');
  await app.close();
}

bootstrap();
