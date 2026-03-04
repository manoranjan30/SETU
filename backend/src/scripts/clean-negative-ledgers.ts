import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Cleaning up Negative Ledgers and Orphaned Micro Activities...');

  // 1. Find ledgers with 0 parent quantity but allocated > 0 (ghost ledgers)
  const ghostLedgers = await dataSource.query(`
    SELECT * FROM micro_quantity_ledger 
    WHERE "totalParentQty" = 0 AND "allocatedQty" > 0;
  `);

  console.log(
    `Found ${ghostLedgers.length} ghost ledgers with negative balance.`,
  );

  for (const ledger of ghostLedgers) {
    console.log(
      `Processing ledger for Activity ID: ${ledger.parentActivityId}, BOQ ID: ${ledger.boqItemId}`,
    );

    // Delete associated micro schedule activities
    await dataSource.query(
      `
       DELETE FROM micro_schedule_activity 
       WHERE "parentActivityId" = $1 AND "boqItemId" = $2;
     `,
      [ledger.parentActivityId, ledger.boqItemId],
    );

    // Delete the ledger itself
    await dataSource.query(
      `
       DELETE FROM micro_quantity_ledger 
       WHERE "id" = $1;
     `,
      [ledger.id],
    );

    console.log(`Deleted orphaned micro activities and ledger ${ledger.id}.`);
  }

  // General cleanup: delete any ledger that has negative balance and no parent quantity
  await dataSource.query(`
    DELETE FROM micro_quantity_ledger 
    WHERE "balanceQty" < 0 AND "totalParentQty" = 0;
  `);

  console.log('Cleanup complete!');
  await app.close();
}

bootstrap();
