/**
 * add_staff_schedule_and_leave.mjs
 * Run: node src/migrations/add_staff_schedule_and_leave.mjs
 *
 * Adds:
 * - staff_schedules
 * - doctor_leave_requests
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
        console.log(`  OK: ${label}`);
    } catch (e) {
        console.error(`  FAIL: ${label}: ${e.message}`);
    }
}

async function run() {
    console.log('\nMedTrack - staff schedule + leave migration\n');

    await q('staff_schedules create', `
        CREATE TABLE IF NOT EXISTS staff_schedules (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id   UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assigned_by   UUID REFERENCES users(id) ON DELETE SET NULL,
            shift_date    DATE NOT NULL,
            shift_type    VARCHAR(30) NOT NULL DEFAULT 'GENERAL'
                           CHECK (shift_type IN ('GENERAL','OP','IP','EMERGENCY','ICU','OT','NIGHT')),
            shift_start   TIME NOT NULL,
            shift_end     TIME NOT NULL,
            location      VARCHAR(120),
            notes         TEXT,
            is_active     BOOLEAN NOT NULL DEFAULT true,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('staff_schedules hospital/date idx', `
        CREATE INDEX IF NOT EXISTS idx_staff_sched_hosp_date ON staff_schedules(hospital_id, shift_date)
    `);
    await q('staff_schedules staff idx', `
        CREATE INDEX IF NOT EXISTS idx_staff_sched_user ON staff_schedules(staff_user_id)
    `);

    await q('doctor_leave_requests create', `
        CREATE TABLE IF NOT EXISTS doctor_leave_requests (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id     UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
            hospital_id   UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            leave_date    DATE NOT NULL,
            leave_type    VARCHAR(20) NOT NULL DEFAULT 'CASUAL'
                           CHECK (leave_type IN ('CASUAL','SICK','EMERGENCY','OTHER')),
            reason        TEXT,
            status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','APPROVED','REJECTED')),
            reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
            review_note   TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('doctor_leave unique idx', `
        CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_leave_date ON doctor_leave_requests(doctor_id, leave_date)
        WHERE status = 'PENDING'
    `);
    await q('doctor_leave hospital/date idx', `
        CREATE INDEX IF NOT EXISTS idx_doctor_leave_hosp_date ON doctor_leave_requests(hospital_id, leave_date)
    `);

    await q('updated_at function', `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ LANGUAGE plpgsql;
    `);
    for (const table of ['staff_schedules', 'doctor_leave_requests']) {
        await q(`${table} trigger`, `
            DROP TRIGGER IF EXISTS trg_${table}_upd ON ${table};
            CREATE TRIGGER trg_${table}_upd
            BEFORE UPDATE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
    }

    console.log('\nMigration complete.\n');
    await pool.end();
}

run().catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
});
