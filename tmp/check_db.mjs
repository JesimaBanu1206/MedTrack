
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
    }
});

async function check() {
    try {
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables:', tablesResult.rows.map(r => r.table_name));

        const tablesToCheck = ['hospitals', 'emergency_drivers', 'appointments', 'patients', 'emergency_driver_locations', 'emergency_driver_response_logs'];
        for (const table of tablesToCheck) {
            try {
                const columnsResult = await pool.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1
                `, [table]);
                console.log(`Columns for ${table}:`, columnsResult.rows.map(r => r.column_name));
            } catch (e) {
                console.log(`Error checking table ${table}:`, e.message);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
