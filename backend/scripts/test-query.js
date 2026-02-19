const { Client } = require('pg');
const client = new Client({
    user: 'admin', host: 'localhost', database: 'setu_db', password: 'password', port: 5432,
});
async function run() {
    await client.connect();

    // Mimic the TypeORM query:
    // SELECT count(*) FROM micro_schedule_activity ma 
    // JOIN micro_schedule ms ON ma.microScheduleId = ms.id
    // WHERE ms.parentActivityId = 4

    const res = await client.query(`
    SELECT count(*) 
    FROM micro_schedule_activity ma
    JOIN micro_schedule ms ON ma."microScheduleId" = ms.id
    WHERE ms."parentActivityId" = 4
  `);

    console.log('Count for Activity 4:', res.rows[0].count);

    const res2 = await client.query(`
    SELECT count(*) 
    FROM micro_schedule_activity ma
    JOIN micro_schedule ms ON ma."microScheduleId" = ms.id
    WHERE ms."parentActivityId" = 1614
  `);
    console.log('Count for Activity 1614:', res2.rows[0].count);

    await client.end();
}
run();
