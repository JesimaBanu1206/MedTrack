/**
 * add_doctor_module.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Run:  node src/migrations/add_doctor_module.mjs
 *
 * Creates all doctor + nurse module tables:
 *   • doctor_profiles     – extended doctor info (specialization, uid, etc.)
 *   • doctor_schedules    – duty assignments by hospital admin
 *   • doctor_attendance   – login/break/logout tracking
 *   • op_queue            – OP patient queue
 *   • prescriptions       – doctor prescriptions
 *   • prescription_items  – medicine line items
 *   • lab_requests        – doctor → lab referrals
 *   • nurse_vitals        – nurse-recorded patient vitals
 *   • admin_notices       – hospital admin broadcast notices
 *   • hospital_resources  – bed/ICU availability
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
    console.log('\n🏥  MedTrack — Doctor Module Migration\n');
    console.log('═'.repeat(55));

    // ── DOCTOR PROFILES ──────────────────────────────────────────────────────
    console.log('\n👨‍⚕️  doctor_profiles');
    await q('doctor_profiles — create', `
        CREATE TABLE IF NOT EXISTS doctor_profiles (
            id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            hospital_id       UUID         NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            doctor_unique_id  VARCHAR(30)  UNIQUE,
            specialization    VARCHAR(120),
            qualification     VARCHAR(255),
            experience_years  INT          DEFAULT 0,
            consultation_fee  NUMERIC(10,2) DEFAULT 0,
            available_slots   JSONB        DEFAULT '[]',
            languages         TEXT[]       DEFAULT ARRAY['English'],
            online_consult    BOOLEAN      DEFAULT false,
            profile_bio       TEXT,
            rating            NUMERIC(3,2) DEFAULT 0,
            rating_count      INT          DEFAULT 0,
            is_active         BOOLEAN      DEFAULT true,
            created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    await q('doctor_profiles — user index', `CREATE INDEX IF NOT EXISTS idx_dp_user ON doctor_profiles(user_id)`);
    await q('doctor_profiles — hospital index', `CREATE INDEX IF NOT EXISTS idx_dp_hospital ON doctor_profiles(hospital_id)`);

    // Auto-generate doctor_unique_id sequence
    await q('doctor_unique_id sequence', `CREATE SEQUENCE IF NOT EXISTS doctor_uid_seq START 1001`);
    await q('doctor_unique_id trigger fn', `
        CREATE OR REPLACE FUNCTION set_doctor_unique_id()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.doctor_unique_id IS NULL THEN
                NEW.doctor_unique_id := 'DR-' || LPAD(nextval('doctor_uid_seq')::text, 5, '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);
    await q('doctor_unique_id trigger', `
        DROP TRIGGER IF EXISTS trg_doctor_uid ON doctor_profiles;
        CREATE TRIGGER trg_doctor_uid
        BEFORE INSERT ON doctor_profiles
        FOR EACH ROW EXECUTE FUNCTION set_doctor_unique_id();
    `);

    // ── DOCTOR SCHEDULES ─────────────────────────────────────────────────────
    console.log('\n📅  doctor_schedules');
    await q('doctor_schedules — create', `
        CREATE TABLE IF NOT EXISTS doctor_schedules (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id    UUID        NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
            hospital_id  UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            assigned_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
            schedule_date DATE       NOT NULL,
            duty_type    VARCHAR(20) NOT NULL DEFAULT 'OP'
                             CHECK (duty_type IN ('OP','WARD','EMERGENCY','ICU','OT')),
            department   VARCHAR(120),
            room_number  VARCHAR(20),
            shift_start  TIME        NOT NULL,
            shift_end    TIME        NOT NULL,
            notes        TEXT,
            is_active    BOOLEAN     DEFAULT true,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('doctor_schedules — doctor+date index', `
        CREATE INDEX IF NOT EXISTS idx_sched_doctor_date ON doctor_schedules(doctor_id, schedule_date)
    `);
    await q('doctor_schedules — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_sched_hospital ON doctor_schedules(hospital_id)
    `);

    // ── DOCTOR ATTENDANCE ─────────────────────────────────────────────────────
    console.log('\n⏱️  doctor_attendance');
    await q('doctor_attendance — create', `
        CREATE TABLE IF NOT EXISTS doctor_attendance (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id       UUID        NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
            hospital_id     UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            attendance_date DATE        NOT NULL DEFAULT CURRENT_DATE,
            login_time      TIMESTAMPTZ,
            break_start     TIMESTAMPTZ,
            break_end       TIMESTAMPTZ,
            logout_time     TIMESTAMPTZ,
            status          VARCHAR(20) DEFAULT 'ON_DUTY'
                                CHECK (status IN ('ON_DUTY','ON_BREAK','OFF_DUTY','ABSENT')),
            total_minutes   INT         DEFAULT 0,
            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (doctor_id, attendance_date)
        )
    `);
    await q('doctor_attendance — doctor+date index', `
        CREATE INDEX IF NOT EXISTS idx_att_doctor_date ON doctor_attendance(doctor_id, attendance_date)
    `);
    await q('doctor_attendance — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_att_hospital ON doctor_attendance(hospital_id)
    `);

    // ── OP QUEUE ──────────────────────────────────────────────────────────────
    console.log('\n🏥  op_queue');
    await q('op_queue — create', `
        CREATE TABLE IF NOT EXISTS op_queue (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id     UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            doctor_id       UUID        REFERENCES doctor_profiles(id) ON DELETE SET NULL,
            schedule_id     UUID        REFERENCES doctor_schedules(id) ON DELETE SET NULL,
            queue_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
            token_number    INT         NOT NULL,
            patient_id      UUID        REFERENCES patients(id) ON DELETE SET NULL,
            patient_name    VARCHAR(255),
            patient_pid     VARCHAR(50),
            age             INT,
            gender          VARCHAR(10),
            reason          TEXT,
            bp              VARCHAR(20),
            temperature     VARCHAR(10),
            heart_rate      INT,
            sugar           VARCHAR(20),
            weight          NUMERIC(5,2),
            triage_status   VARCHAR(20) DEFAULT 'NORMAL'
                                CHECK (triage_status IN ('NORMAL','URGENT','CRITICAL')),
            status          VARCHAR(20) DEFAULT 'WAITING'
                                CHECK (status IN ('WAITING','IN_CONSULTATION','COMPLETED','CANCELLED','REFERRED')),
            consulted_at    TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('op_queue — hospital+date index', `
        CREATE INDEX IF NOT EXISTS idx_queue_hosp_date ON op_queue(hospital_id, queue_date)
    `);
    await q('op_queue — doctor index', `
        CREATE INDEX IF NOT EXISTS idx_queue_doctor ON op_queue(doctor_id)
    `);

    // ── PRESCRIPTIONS ─────────────────────────────────────────────────────────
    console.log('\n💊  prescriptions');
    await q('prescriptions — create base table', `
        CREATE TABLE IF NOT EXISTS prescriptions (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_name    VARCHAR(255),
            diagnosis       TEXT,
            chief_complaint TEXT,
            notes           TEXT,
            follow_up_date  DATE,
            is_lab_required BOOLEAN     DEFAULT false,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    // Add columns that may be missing from a pre-existing prescriptions table
    const rxCols = [
        ['hospital_id',     'UUID'],
        ['doctor_id',       'UUID'],
        ['patient_id',      'UUID'],
        ['queue_entry_id',  'UUID'],
    ];
    for (const [col, def] of rxCols) {
        await q(`prescriptions.${col}`, `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }
    // Add FK constraints safely — check via pg catalog before ALTERing
    // Using qSafe: runs raw SQL with error suppression (same as q but no log on skip)
    const addFk = async (label, constraint, sql) => {
        const { rows: existing } = await pool.query(
            `SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = $1`, [constraint]
        ).catch(() => ({ rows: [{}] }));
        if (existing.length === 0) {
            await q(label, sql);
        } else {
            console.log(`  ⏭️  ${label} (already exists)`);
        }
    };

    await addFk('prescriptions — hospital_id FK', 'fk_prescriptions_hospital_id',
        `ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_hospital_id FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE`);
    await addFk('prescriptions — doctor_id FK', 'fk_prescriptions_doctor_id',
        `ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE`);
    await addFk('prescriptions — patient_id FK', 'fk_prescriptions_patient_id',
        `ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL`);
    await addFk('prescriptions — queue_entry_id FK', 'fk_prescriptions_queue_entry_id',
        `ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_queue_entry_id FOREIGN KEY (queue_entry_id) REFERENCES op_queue(id) ON DELETE SET NULL`);

    await q('prescriptions — doctor index',  `CREATE INDEX IF NOT EXISTS idx_rx_doctor   ON prescriptions(doctor_id)`);
    await q('prescriptions — patient index', `CREATE INDEX IF NOT EXISTS idx_rx_patient  ON prescriptions(patient_id)`);
    await q('prescriptions — hospital index',`CREATE INDEX IF NOT EXISTS idx_rx_hospital ON prescriptions(hospital_id)`);

    // ── PRESCRIPTION ITEMS ────────────────────────────────────────────────────
    console.log('\n💉  prescription_items');
    await q('prescription_items — create', `
        CREATE TABLE IF NOT EXISTS prescription_items (
            id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            prescription_id  UUID        NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
            medicine_name    VARCHAR(255) NOT NULL,
            dosage           VARCHAR(50),
            frequency        VARCHAR(50),
            morning          BOOLEAN     DEFAULT false,
            afternoon        BOOLEAN     DEFAULT false,
            night            BOOLEAN     DEFAULT false,
            before_food      BOOLEAN     DEFAULT false,
            duration_days    INT         DEFAULT 1,
            instructions     TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('prescription_items — prescription index', `
        CREATE INDEX IF NOT EXISTS idx_rxitem_rx ON prescription_items(prescription_id)`);

    // ── LAB REQUESTS ──────────────────────────────────────────────────────────
    console.log('\n🔬  lab_requests');
    await q('lab_requests — create', `
        CREATE TABLE IF NOT EXISTS lab_requests (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id     UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            doctor_id       UUID        NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
            patient_id      UUID        REFERENCES patients(id) ON DELETE SET NULL,
            prescription_id UUID        REFERENCES prescriptions(id) ON DELETE SET NULL,
            patient_name    VARCHAR(255),
            test_type       VARCHAR(255) NOT NULL,
            urgency         VARCHAR(20) DEFAULT 'ROUTINE'
                                CHECK (urgency IN ('ROUTINE','URGENT','STAT')),
            notes           TEXT,
            status          VARCHAR(20) DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
            result_url      TEXT,
            result_notes    TEXT,
            completed_at    TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('lab_requests — doctor index', `
        CREATE INDEX IF NOT EXISTS idx_lab_doctor ON lab_requests(doctor_id)`);
    await q('lab_requests — hospital+status index', `
        CREATE INDEX IF NOT EXISTS idx_lab_hosp_status ON lab_requests(hospital_id, status)`);

    // ── NURSE VITALS ──────────────────────────────────────────────────────────
    console.log('\n🩺  nurse_vitals');
    await q('nurse_vitals — create', `
        CREATE TABLE IF NOT EXISTS nurse_vitals (
            id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id     UUID         NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            nurse_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
            patient_id      UUID         REFERENCES patients(id) ON DELETE SET NULL,
            queue_entry_id  UUID         REFERENCES op_queue(id) ON DELETE SET NULL,
            patient_name    VARCHAR(255),
            bp              VARCHAR(20),
            temperature     VARCHAR(10),
            heart_rate      INT,
            sugar           VARCHAR(20),
            weight          NUMERIC(5,2),
            spo2            INT,
            respiration     INT,
            pain_scale      INT          CHECK (pain_scale BETWEEN 0 AND 10),
            notes           TEXT,
            recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    await q('nurse_vitals — patient index', `
        CREATE INDEX IF NOT EXISTS idx_vitals_patient ON nurse_vitals(patient_id)`);
    await q('nurse_vitals — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_vitals_hospital ON nurse_vitals(hospital_id)`);

    // ── ADMIN NOTICES ─────────────────────────────────────────────────────────
    console.log('\n📣  admin_notices');
    await q('admin_notices — create', `
        CREATE TABLE IF NOT EXISTS admin_notices (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id  UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
            title        VARCHAR(255) NOT NULL,
            message      TEXT        NOT NULL,
            priority     VARCHAR(10) DEFAULT 'NORMAL'
                             CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
            is_active    BOOLEAN     DEFAULT true,
            expires_at   TIMESTAMPTZ,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await q('admin_notices — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_notices_hospital ON admin_notices(hospital_id)`);

    // ── HOSPITAL RESOURCES ────────────────────────────────────────────────────
    console.log('\n🛏️  hospital_resources');
    await q('hospital_resources — create', `
        CREATE TABLE IF NOT EXISTS hospital_resources (
            id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id      UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE UNIQUE,
            general_beds_total     INT  DEFAULT 0,
            general_beds_available INT  DEFAULT 0,
            icu_beds_total         INT  DEFAULT 0,
            icu_beds_available     INT  DEFAULT 0,
            ventilators_total      INT  DEFAULT 0,
            ventilators_available  INT  DEFAULT 0,
            ot_rooms_total         INT  DEFAULT 0,
            ot_rooms_available     INT  DEFAULT 0,
            updated_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // ── ONLINE CONSULT PROFILES ───────────────────────────────────────────────
    console.log('\n💻  online_consult_profiles');
    await q('online_consult_profiles — create', `
        CREATE TABLE IF NOT EXISTS online_consult_profiles (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id         UUID        NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE UNIQUE,
            is_published      BOOLEAN     DEFAULT false,
            bio               TEXT,
            consultation_fee  NUMERIC(10,2) DEFAULT 0,
            available_days    TEXT[]      DEFAULT ARRAY['MON','TUE','WED','THU','FRI'],
            slot_duration_min INT         DEFAULT 15,
            time_slots        JSONB       DEFAULT '[]',
            languages         TEXT[]      DEFAULT ARRAY['English'],
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // ── UPDATED_AT TRIGGERS ───────────────────────────────────────────────────
    console.log('\n⚡  updated_at triggers');
    await q('update fn exists', `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ LANGUAGE plpgsql;
    `);
    for (const tbl of [
        'doctor_profiles','doctor_schedules','doctor_attendance',
        'op_queue','prescriptions','lab_requests','nurse_vitals',
        'admin_notices','hospital_resources','online_consult_profiles'
    ]) {
        await q(`trigger: ${tbl}`, `
            DROP TRIGGER IF EXISTS trg_${tbl}_upd ON ${tbl};
            CREATE TRIGGER trg_${tbl}_upd
            BEFORE UPDATE ON ${tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
    }

    // ── VERIFY ────────────────────────────────────────────────────────────────
    console.log('\n📊  Tables in public schema:');
    const { rows } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    console.log('    ' + rows.map(r => r.table_name).join(', '));
    console.log('\n✨  Doctor Module Migration complete!\n');
    await pool.end();
}

run().catch(e => { console.error('Migration failed:', e); pool.end(); process.exit(1); });
