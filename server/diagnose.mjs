// Run: node diagnose.mjs
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgresql://postgres:Yogi_07$331@db.gexwxpijgubbclrhqxpj.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function check(label, sql) {
    try {
        const r = await pool.query(sql);
        const sample = r.rows[0] ? JSON.stringify(r.rows[0]).slice(0, 100) : '(empty)';
        console.log(`✅  ${label}`);
        if (r.rows[0]) console.log(`    sample: ${sample}`);
    } catch (e) {
        console.log(`❌  ${label}`);
        console.log(`    ERROR: ${e.message}`);
    }
}

async function run() {
    console.log('\n=== TABLE & COLUMN CHECKS ===\n');

    // List all tables
    const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('📋 Tables:', tables.rows.map(r => r.table_name).join(', '), '\n');

    // Column checks
    for (const tbl of ['emergency_drivers', 'users', 'hospitals', 'patients', 'appointments', 'emergency_driver_locations', 'emergency_driver_response_logs']) {
        try {
            const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' ORDER BY ordinal_position`);
            if (c.rows.length) console.log(`📌 ${tbl}: ${c.rows.map(r => r.column_name).join(', ')}`);
            else console.log(`⚠️  ${tbl}: TABLE NOT FOUND`);
        } catch (e) { console.log(`❌  column check ${tbl}: ${e.message}`); }
    }

    console.log('\n=== QUERY CHECKS ===\n');

    await check('hospitals aggregate', `SELECT SUM(total_beds),SUM(available_beds),SUM(icu_beds),COUNT(*) FROM hospitals WHERE is_active=true`);
    await check('patients count', `SELECT COUNT(*) as total_patients FROM patients`);
    await check('appointments trend', `SELECT appointment_date,COUNT(*) FROM appointments WHERE appointment_date > CURRENT_DATE - INTERVAL '7 days' GROUP BY appointment_date`);
    await check('drivers join users', `SELECT ed.id,ed.driver_name,ed.approval_status,u.email,u.phone FROM emergency_drivers ed LEFT JOIN users u ON u.id=ed.user_id ORDER BY ed.created_at DESC LIMIT 3`);
    await check('driver_locations lateral', `SELECT ed.id,loc.latitude FROM emergency_drivers ed LEFT JOIN LATERAL (SELECT latitude FROM emergency_driver_locations l WHERE l.driver_id=ed.id ORDER BY l.recorded_at DESC LIMIT 1) loc ON TRUE WHERE ed.approval_status='APPROVED' LIMIT 1`);
    await check('response_logs', `SELECT driver_id,COUNT(*) FROM emergency_driver_response_logs WHERE responded_at::date=CURRENT_DATE GROUP BY driver_id`);

    await pool.end();
    console.log('\n=== DONE ===');
}

run().catch(e => { console.error(e); pool.end(); });
