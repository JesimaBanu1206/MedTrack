/**
 * add_messaging_and_leaves.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates:
 *  • staff_messages           — admin → staff broadcasts
 *  • staff_message_reads      — read-receipt tracking
 *  • doctor_leave_requests    — doctor leave applications
 *
 * Run: node src/migrations/add_messaging_and_leaves.mjs
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
    try { await pool.query(sql); console.log(`  ✅  ${label}`); }
    catch (e) { console.error(`  ❌  ${label}: ${e.message}`); }
}

async function run() {
    console.log('\n📨  MedTrack — Messaging & Leave Migration\n' + '═'.repeat(50));

    await q('staff_messages — create', `
        CREATE TABLE IF NOT EXISTS staff_messages (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id     UUID        NOT NULL,
            sender_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
            sender_name     TEXT,
            target_type     TEXT        NOT NULL DEFAULT 'ALL'
                                CHECK (target_type IN ('ALL','ROLE','INDIVIDUAL')),
            target_user_id  UUID        REFERENCES users(id) ON DELETE CASCADE,
            target_role     TEXT,
            title           TEXT        NOT NULL,
            message         TEXT        NOT NULL,
            priority        TEXT        DEFAULT 'NORMAL'
                                CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sm_hospital ON staff_messages(hospital_id);
        CREATE INDEX IF NOT EXISTS idx_sm_target   ON staff_messages(target_user_id);
    `);

    await q('staff_message_reads — create', `
        CREATE TABLE IF NOT EXISTS staff_message_reads (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id  UUID        NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
            user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(message_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_smr_user ON staff_message_reads(user_id);
    `);

    await q('doctor_leave_requests — create', `
        CREATE TABLE IF NOT EXISTS doctor_leave_requests (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id       UUID        NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
            hospital_id     UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            requested_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
            leave_date      DATE        NOT NULL,
            leave_type      TEXT        DEFAULT 'CASUAL'
                                CHECK (leave_type IN ('CASUAL','SICK','EMERGENCY','COMPENSATORY')),
            reason          TEXT,
            status          TEXT        DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','APPROVED','REJECTED')),
            reviewed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(doctor_id, leave_date)
        );
        CREATE INDEX IF NOT EXISTS idx_dlr_doctor   ON doctor_leave_requests(doctor_id);
        CREATE INDEX IF NOT EXISTS idx_dlr_hospital ON doctor_leave_requests(hospital_id);
    `);

    await q('staff_profiles — add phone column if missing', `
        ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
    `);

    await q('users — add full_name column if missing', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
    `);

    await q('hospitals — add hospital_name if missing', `
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_name TEXT;
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'GENERAL';
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_phone TEXT;
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_email TEXT;
    `);

    await q('staff_profiles — add is_deleted', `
        ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    console.log('\n✨  Messaging & Leave Migration complete!\n');
    await pool.end();
}

run().catch(e => { console.error('Migration failed:', e); pool.end(); process.exit(1); });
