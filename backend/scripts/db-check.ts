import { Client } from 'pg';

async function run() {
    const client = new Client({
        user: 'admin',
        host: 'localhost',
        database: 'setu_db',
        password: 'password',
        port: 5432,
    });

    try {
        await client.connect();

        // 1. Get Activity ID for Code 12625
        const actRes = await client.query("SELECT id, \"activityName\", \"projectId\" FROM activity WHERE \"activityCode\" = '12625' LIMIT 1");

        if (actRes.rows.length > 0) {
            const actId = actRes.rows[0].id;
            const pId = actRes.rows[0].projectId;
            console.log(`Checking Plans for Activity ${actId} (Linked to EPS ${pId})`);

            const plans = await client.query(`
                SELECT id, "planningBasis", "measurement_id", "plannedQuantity", "boqSubItemId"
                FROM boq_activity_plan
                WHERE "activity_id" = ${actId}
            `);
            console.table(plans.rows);

            // 2. Check BOQ SubItem Quantities (Global) for context
            if (plans.rows.length > 0) {
                const subItemIds = plans.rows.map(r => r.boqSubItemId).join(',');
                const subItems = await client.query(`SELECT id, qty FROM boq_sub_item WHERE id IN (${subItemIds})`);
                console.log("--- Global BOQ SubItems ---");
                console.table(subItems.rows);
            }
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
