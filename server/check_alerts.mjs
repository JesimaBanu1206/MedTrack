import pg from 'pg';
const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Yogi_07$331@db.gexwxpijgubbclrhqxpj.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});
async function run() {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'emergency_alerts' ORDER BY ordinal_position");
    console.log('📌 emergency_alerts:', res.rows.map(r => r.column_name).join(', '));
    await pool.end();
}
run();
