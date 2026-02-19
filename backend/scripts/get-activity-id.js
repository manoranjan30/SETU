const { Client } = require('pg');
const client = new Client({
    user: 'admin', host: 'localhost', database: 'setu_db', password: 'password', port: 5432,
});
async function run() {
    await client.connect();
    const res = await client.query('SELECT id, "activityCode", "projectId" FROM activity WHERE "activityCode" = \'12624\'');
    console.log(JSON.stringify(res.rows));
    await client.end();
}
run();
