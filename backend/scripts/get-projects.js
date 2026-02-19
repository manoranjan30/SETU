const { Client } = require('pg');
const client = new Client({
    user: 'admin', host: 'localhost', database: 'setu_db', password: 'password', port: 5432,
});
async function run() {
    await client.connect();
    const res = await client.query('SELECT id, name FROM eps_node WHERE id IN (2, 5)');
    console.log(JSON.stringify(res.rows));
    await client.end();
}
run();
