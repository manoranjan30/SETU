const { Client } = require('pg');
const client = new Client({
    user: 'admin', host: 'localhost', database: 'setu_db', password: 'password', port: 5432,
});
async function run() {
    await client.connect();

    console.log('--- Micro Schedules ---');
    const schedules = await client.query('SELECT id, name, "parentActivityId" FROM micro_schedule');
    console.table(schedules.rows);

    console.log('--- Micro Schedule Activities ---');
    const microActivities = await client.query('SELECT id, name, "parentActivityId", "epsNodeId", "boqItemId", "microScheduleId" FROM micro_schedule_activity');
    console.table(microActivities.rows);

    await client.end();
}
run();
