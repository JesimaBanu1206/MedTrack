/**
 * add_messaging.mjs
 * Run:  node src/migrations/add_messaging.mjs
 * Adds staff_messages + staff_message_reads tables
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
    console.log('\n📨  MedTrack — Messaging Migration\n' + '═'.repeat(50));

    await q('staff_messages — create', `
        CREATE TABLE IF NOT EXISTS staff_messages (
            id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id     UUID         NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            sender_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
            sender_name     VARCHAR(255),
            target_type     VARCHAR(20)  DEFAULT 'ALL'
                                CHECK (target_type IN ('ALL','ROLE','INDIVIDUAL')),
            target_user_id  UUID         REFERENCES users(id) ON DELETE CASCADE,
            target_role     VARCHAR(50),
            title           VARCHAR(255) NOT NULL,
            message         TEXT         NOT NULL,
            priority        VARCHAR(10)  DEFAULT 'NORMAL'
                                CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    await q('staff_messages — hospital idx', `CREATE INDEX IF NOT EXISTS idx_smsg_hospital ON staff_messages(hospital_id)`);
    await q('staff_messages — target idx',   `CREATE INDEX IF NOT EXISTS idx_smsg_target  ON staff_messages(target_user_id)`);

    await q('staff_message_reads — create', `
        CREATE TABLE IF NOT EXISTS staff_message_reads (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id  UUID        NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
            user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(message_id, user_id)
        )
    `);
    await q('staff_message_reads — idx', `CREATE INDEX IF NOT EXISTS idx_smread_user ON staff_message_reads(user_id)`);

    // Add online_consult availability column if missing
    await q('doctor_attendance — current_patient col', `
        ALTER TABLE doctor_attendance ADD COLUMN IF NOT EXISTS current_patient_name VARCHAR(255)
    `);

    console.log('\n✨  Messaging migration complete!\n');
    await pool.end();
}
run().catch(e => { console.error(e); pool.end(); process.exit(1); });
