import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
    console.log('Starting Progress Aggregates Repair...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    try {
        console.log('1. Cleaning up Orphaned Measurement Elements...');
        const orphansResult = await dataSource.query(`
      DELETE FROM measurement_element 
      WHERE "elementName" IN ('Site Execution', 'Micro Execution')
        AND NOT EXISTS (
          SELECT 1 FROM measurement_progress 
          WHERE "measurementElementId" = measurement_element.id
        )
    `);
        console.log(`✓ Deleted orphaned elements. Affected rows: ${orphansResult[1]}`);

        console.log('2. Recalculating MeasurementElement.executedQty...');
        const meResult = await dataSource.query(`
      UPDATE measurement_element
      SET "executedQty" = COALESCE((
        SELECT SUM("executedQty")
        FROM measurement_progress
        WHERE "measurementElementId" = measurement_element.id
          AND status = 'APPROVED'
      ), 0)
    `);
        console.log(`✓ Updated Measurement Elements. Affected rows: ${meResult[1]}`);

        console.log('3. Recalculating BoqItem.consumedQty...');
        const boqResult = await dataSource.query(`
      UPDATE boq_item
      SET "consumedQty" = COALESCE((
        SELECT SUM("executedQty")
        FROM measurement_element
        WHERE "boqItemId" = boq_item.id
      ), 0)
    `);
        console.log(`✓ Updated BoqItems. Affected rows: ${boqResult[1]}`);

        console.log('\n✅ Repair Completed Successfully!');
    } catch (error) {
        console.error('❌ Error during repair:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
