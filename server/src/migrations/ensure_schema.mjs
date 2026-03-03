/**
 * run:  node src/migrations/ensure_schema.mjs
 *
 * Safe, idempotent migration — creates any missing tables/columns.
 * Run this once after pulling the latest code.
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
        console.log(`✅  ${label}`);
    } catch (e) {
        console.error(`❌  ${label}: ${e.message}`);
    }
}

async function migrate() {
    console.log('\n🚀  MedTrack — Schema Ensure Migration\n');

    /* ── HOSPITALS ───────────────────────────────────────────────── */
    await q('hospitals table', `
        CREATE TABLE IF NOT EXISTS hospitals (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name          VARCHAR(255) NOT NULL,
            district      VARCHAR(100) NOT NULL,
            total_beds    INTEGER DEFAULT 0,
            available_beds INTEGER DEFAULT 0,
            icu_beds      INTEGER DEFAULT 0,
            is_active     BOOLEAN DEFAULT true,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Seed demo data if empty
    const { rows: hRows } = await pool.query('SELECT COUNT(*) FROM hospitals');
    if (parseInt(hRows[0].count) === 0) {
        await q('hospitals seed data', `
            INSERT INTO hospitals (name, district, total_beds, available_beds, icu_beds) VALUES
            ('Madras Medical College',        'Chennai',    500, 120, 45),
            ('Stanley Medical College',       'Chennai',    450,  95, 35),
            ('Rajaji Govt Hospital',          'Madurai',    400,  80, 30),
            ('Coimbatore Medical College',    'Coimbatore', 350,  60, 25),
            ('Tirunelveli Medical College',   'Tirunelveli',300,  50, 20)
        `);
    }

    /* ── PATIENTS ────────────────────────────────────────────────── */
    await q('patients.user_id column', `
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id UUID
    `);
    await q('patients.patient_id column', `
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50)
    `);
    await q('patients.full_name column', `
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)
    `);

    /* ── APPOINTMENTS ────────────────────────────────────────────── */
    await q('appointments table', `
        CREATE TABLE IF NOT EXISTS appointments (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id      UUID REFERENCES hospitals(id) ON DELETE CASCADE,
            appointment_date DATE DEFAULT CURRENT_DATE,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    /* ── USERS ───────────────────────────────────────────────────── */
    await q('users.phone column', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `);
    await q('users.is_verified column', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false
    `);
    await q('users.is_active column', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);

    /* ── EMERGENCY DRIVERS ───────────────────────────────────────── */
    await q('emergency_drivers.approval_status', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING'
    `);
    await q('emergency_drivers.unit_number', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50)
    `);
    await q('emergency_drivers.reject_reason', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS reject_reason TEXT
    `);
    await q('emergency_drivers.duty_status', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS duty_status VARCHAR(20) DEFAULT 'OFFLINE'
    `);
    await q('emergency_drivers.sos_note', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS sos_note TEXT
    `);
    await q('emergency_drivers.last_location_at', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ
    `);
    await q('emergency_drivers.license_image_url', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS license_image_url TEXT
    `);
    await q('emergency_drivers.profile_image_url', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS profile_image_url TEXT
    `);
    await q('emergency_drivers.approved_by', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)
    `);
    await q('emergency_drivers.approved_at', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ
    `);
    await q('emergency_drivers.created_at', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    `);
    await q('emergency_drivers.updated_at', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);

    /* ── EMERGENCY DRIVER LOCATIONS ──────────────────────────────── */
    await q('emergency_driver_locations table', `
        CREATE TABLE IF NOT EXISTS emergency_driver_locations (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            driver_id      UUID REFERENCES emergency_drivers(id) ON DELETE CASCADE,
            latitude       DECIMAL(10,8),
            longitude      DECIMAL(11,8),
            accuracy_meters DECIMAL(10,2),
            source         VARCHAR(20) DEFAULT 'GPS',
            recorded_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    /* ── EMERGENCY DRIVER RESPONSE LOGS ──────────────────────────── */
    await q('emergency_driver_response_logs table', `
        CREATE TABLE IF NOT EXISTS emergency_driver_response_logs (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            driver_id    UUID REFERENCES emergency_drivers(id) ON DELETE CASCADE,
            status       VARCHAR(20) DEFAULT 'COMPLETED',
            notes        TEXT,
            responded_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    /* ── EMERGENCY DRIVERS: phone column ────────────────────────── */
    await q('emergency_drivers.phone column', `
        ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `);

    /* ── EMERGENCY ALERTS ───────────────────────────────────────── */
    await q('emergency_alerts table', `
        CREATE TABLE IF NOT EXISTS emergency_alerts (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
            patient_id       UUID,
            image_url        TEXT NOT NULL,
            latitude         DECIMAL(10,8),
            longitude        DECIMAL(11,8),
            status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',
            assigned_unit_no VARCHAR(50),
            unit_details     JSONB,
            metadata         JSONB,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    await q('idx emergency_alerts status', `
        CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status ON emergency_alerts(status)
    `);
    await q('idx emergency_alerts unit', `
        CREATE INDEX IF NOT EXISTS idx_emergency_alerts_unit ON emergency_alerts(assigned_unit_no)
    `);
    await q('idx emergency_alerts created_at', `
        CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created ON emergency_alerts(created_at DESC)
    `);

    /* ── VERIFY ──────────────────────────────────────────────────── */
    console.log('\n📋  Final table list:');
    const { rows: tables } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('   ', tables.map(r => r.table_name).join(', '));

    console.log('\n📌  emergency_drivers columns:');
    const { rows: edCols } = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='emergency_drivers'
        ORDER BY ordinal_position
    `);
    console.log('   ', edCols.map(r => r.column_name).join(', '));

    console.log('\n✨  Migration complete!\n');
    await pool.end();
}

migrate().catch(e => { console.error(e); pool.end(); });
