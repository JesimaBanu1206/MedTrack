import './src/utils/dnsOptimizer.js';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

// Use this config for Supabase/Neon/etc
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
});

async function run() {
    console.log('🚀 Starting Data Migrations...');
    try {
        // Test connection
        await pool.query('SELECT 1');
        console.log('📡 Database connection established.');

        // 1. Add username column
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;');
        console.log('✅ Column [username] verified/added to users table');

        // 2. Add description column to roles if missing
        await pool.query('ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;');

        console.log('✨ Migration completed successfully!');

    } catch (err) {
        console.error('❌ Migration Error Details:');
        console.error('Message:', err.message);
        if (err.message.includes('SSL')) {
            console.error('💡 TIP: If you see SSL errors, check if your DATABASE_URL includes ?sslmode=require or similar.');
        }
        console.error('Stack:', err.stack);
    } finally {
        await pool.end();
    }
}

run();
