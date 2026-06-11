/**
 * add_hospital_subscription_fields.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Run: node src/migrations/add_hospital_subscription_fields.mjs
 *
 * Adds subscription and extended fields to hospitals + users tables:
 *   hospitals:  city, license_no, plan_type, plan_start_date, renewal_date, plan_price, last_audit
 *   users:      username, permissions (JSONB), admin_name, admin_phone
 * ─────────────────────────────────────────────────────────────────────────────
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function q(label, sql) {
    try {
        await pool.query(sql);
        console.log(`  ✅  ${label}`);
    } catch (e) {
        console.error(`  ❌  ${label}: ${e.message}`);
    }
}

async function run() {
    console.log('\n🏥  MedTrack — Hospital Subscription Fields Migration\n');
    console.log('═'.repeat(55));

    console.log('\n📦  Extending hospitals table');
    await q('city column',           `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS city VARCHAR(120)`);
    await q('license_no column',     `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS license_no VARCHAR(100)`);
    await q('plan_type column',      `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'MONTHLY'`);
    await q('plan_start_date column',`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS plan_start_date DATE`);
    await q('renewal_date column',   `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS renewal_date DATE`);
    await q('plan_price column',     `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS plan_price VARCHAR(30)`);
    await q('last_audit column',     `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS last_audit DATE`);

    console.log('\n👤  Extending users table');
    await q('username column',       `ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)`);
    await q('permissions column',    `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`);
    await q('admin_phone column',    `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_phone VARCHAR(20)`);

    // Unique index on username (nullable, so partial)
    await q('username unique idx',   `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
        ON users(username) WHERE username IS NOT NULL
    `);

    console.log('\n✨  Subscription fields migration complete!\n');
    await pool.end();
}

run().catch(e => { console.error('Migration failed:', e); pool.end(); process.exit(1); });
