const { Client } = require('pg');
const client = new Client({
    user: 'admin', host: 'localhost', database: 'setu_db', password: 'password', port: 5432,
});
async function run() {
    await client.connect();
    const res = await client.query('SELECT id, name, "parentId" FROM eps_node WHERE "projectId" = 2 OR id = 2');
    console.table(res.rows);
    await client.end();
}
run();
