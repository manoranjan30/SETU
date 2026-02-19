const { Client } = require('pg');

const client = new Client({
    user: process.env.DATABASE_USER || 'admin',
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'setu_db',
    password: process.env.DATABASE_PASSWORD || 'password',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Check activities
        const activities = await client.query('SELECT id, "activityCode", "activityName" FROM activity WHERE id = 4 OR "activityCode" = \'12624\'');
        console.log('--- Relevant Activities ---');
        console.table(activities.rows);

        // 2. Check micro schedules
        const schedules = await client.query('SELECT id, name, "parentActivityId" FROM micro_schedule WHERE "parentActivityId" = 4');
        console.log('--- Relevant Micro Schedules ---');
        console.table(schedules.rows);

        // 3. Check micro activities
        const microActs = await client.query('SELECT id, name, "parentActivityId", "epsNodeId", "microScheduleId" FROM micro_schedule_activity');
        console.log('--- All Micro Schedule Activities ---');
        console.table(microActs.rows);

        // 4. Check ledger
        const ledgers = await client.query('SELECT id, "parentActivityId", "boqItemId", "totalParentQty" FROM micro_quantity_ledger');
        console.log('--- Micro Quantity Ledgers ---');
        console.table(ledgers.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
