import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    console.log('Cleaning up corrupted negative aggregate quantities caused by deleting pending logs...');

    // Reset negative measurement element quantities
    const meResult = await dataSource.query(`
    UPDATE measurement_element
    SET "executedQty" = 0
    WHERE "executedQty" < 0;
  `);

    console.log('Fixed negative executed quantities in MeasurementElement.');

    // Reset negative boq item consumed quantities
    const boqResult = await dataSource.query(`
    UPDATE boq_item
    SET "consumedQty" = 0
    WHERE "consumedQty" < 0;
  `);

    console.log('Fixed negative consumed quantities in BoqItem.');

    console.log('Cleanup complete!');
    await app.close();
}

bootstrap();
