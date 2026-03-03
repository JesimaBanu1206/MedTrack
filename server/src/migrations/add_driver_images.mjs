
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
    }
});

async function migrate() {
    console.log('🚀 Adding license_image_url to emergency_drivers...');
    try {
        await pool.query(`
            ALTER TABLE emergency_drivers 
            ADD COLUMN IF NOT EXISTS license_image_url TEXT,
            ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
        `);
        console.log('✅ Columns added successfully');
    } catch (err) {
        console.error('❌ Migration Error:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
