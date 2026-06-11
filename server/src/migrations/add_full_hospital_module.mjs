/**
 * add_full_hospital_module.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Run:  node src/migrations/add_full_hospital_module.mjs
 *
 * Idempotent migration — safe to run multiple times.
 * Adds / ensures ALL tables for:
 *   • hospitals (clean schema, no bed columns)
 *   • users (hospital_id, soft-delete)
 *   • staff_profiles
 *   • activity_logs
 *   • ai_document_analyses
 *   • staff_role_permissions
 *   • password_reset_tokens
 *   • All required roles
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
    console.log('\n🏥  MedTrack — Full Hospital Module Migration\n');
    console.log('═'.repeat(55));

    // ─── HOSPITALS ───────────────────────────────────────────────────────────
    console.log('\n📦  hospitals table');

    await q('hospitals — create', `
        CREATE TABLE IF NOT EXISTS hospitals (
            id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_name  VARCHAR(255) NOT NULL,
            hospital_code  VARCHAR(50)  NOT NULL,
            type           VARCHAR(20)  NOT NULL DEFAULT 'GH'
                               CHECK (type IN ('GH','PHC','PRIVATE','CLINIC')),
            address        TEXT,
            district       VARCHAR(120),
            contact_email  VARCHAR(255),
            contact_phone  VARCHAR(20),
            is_active      BOOLEAN      NOT NULL DEFAULT true,
            is_deleted     BOOLEAN      NOT NULL DEFAULT false,
            created_by     UUID,
            created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    // Rename legacy "name" → "hospital_name" if needed
    await q('hospitals — rename name→hospital_name', `
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='hospitals' AND column_name='name')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name='hospitals' AND column_name='hospital_name')
            THEN ALTER TABLE hospitals RENAME COLUMN name TO hospital_name; END IF;
        END $$;
    `);

    // Add any missing columns (bed columns are intentionally NOT included)
    const hospCols = [
        ['hospital_code',  "VARCHAR(50)  DEFAULT ''"],
        ['type',           "VARCHAR(20)  DEFAULT 'GH'"],
        ['address',        'TEXT'],
        ['district',       'VARCHAR(120)'],
        ['contact_email',  'VARCHAR(255)'],
        ['contact_phone',  'VARCHAR(20)'],
        ['is_deleted',     'BOOLEAN DEFAULT false'],
        ['created_by',     'UUID'],
    ];
    for (const [col, def] of hospCols) {
        await q(`hospitals.${col}`, `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }

    await q('hospitals — unique code index', `
        CREATE UNIQUE INDEX IF NOT EXISTS uq_hospitals_code ON hospitals(hospital_code)
        WHERE is_deleted = false
    `);
    await q('hospitals — district index', `
        CREATE INDEX IF NOT EXISTS idx_hospitals_district ON hospitals(district)
    `);
    await q('hospitals — is_active index', `
        CREATE INDEX IF NOT EXISTS idx_hospitals_active ON hospitals(is_active)
    `);

    // ─── USERS ───────────────────────────────────────────────────────────────
    console.log('\n👤  users table');

    const userCols = [
        ['hospital_id', 'UUID'],
        ['full_name',   'VARCHAR(255)'],
        ['is_deleted',  'BOOLEAN DEFAULT false'],
    ];
    for (const [col, def] of userCols) {
        await q(`users.${col}`, `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }

    await q('users — hospital_id FK', `
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_users_hospital_id'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT fk_users_hospital_id
                FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;
            END IF;
        END $$;
    `);

    await q('users — hospital_id index', `
        CREATE INDEX IF NOT EXISTS idx_users_hospital_id ON users(hospital_id)
    `);

    // ─── ROLES ───────────────────────────────────────────────────────────────
    console.log('\n🎭  roles');

    const roles = [
        ['HOSPITAL_ADMIN',  'Hospital administrator — manages one hospital'],
        ['DOCTOR',          'Physician role'],
        ['NURSE',           'Nursing staff'],
        ['PHARMACIST',      'Pharmacy staff'],
        ['LAB_TECHNICIAN',  'Laboratory technician'],
        ['RECEPTIONIST',    'Front desk staff'],
        ['OTHER_STAFF',     'General staff'],
    ];
    for (const [name, description] of roles) {
        await q(`role: ${name}`, `
            INSERT INTO roles (name, description)
            VALUES ('${name}', '${description}')
            ON CONFLICT (name) DO NOTHING
        `);
    }

    // ─── STAFF PROFILES ──────────────────────────────────────────────────────
    console.log('\n👩‍⚕️  staff_profiles table');

    await q('staff_profiles — create', `
        CREATE TABLE IF NOT EXISTS staff_profiles (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id      UUID         REFERENCES users(id) ON DELETE CASCADE,
            hospital_id  UUID         NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            full_name    VARCHAR(255) NOT NULL,
            phone        VARCHAR(20),
            department   VARCHAR(120),
            staff_role   VARCHAR(30)  NOT NULL
                             CHECK (staff_role IN ('DOCTOR','NURSE','PHARMACIST',
                                                   'LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF')),
            is_active    BOOLEAN      NOT NULL DEFAULT true,
            is_deleted   BOOLEAN      NOT NULL DEFAULT false,
            created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('staff_profiles — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_staff_hospital ON staff_profiles(hospital_id)
    `);
    await q('staff_profiles — role index', `
        CREATE INDEX IF NOT EXISTS idx_staff_role ON staff_profiles(staff_role)
    `);
    await q('staff_profiles — user_id index', `
        CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff_profiles(user_id)
    `);

    // ─── ACTIVITY LOGS ───────────────────────────────────────────────────────
    console.log('\n📋  activity_logs table');

    await q('activity_logs — create', `
        CREATE TABLE IF NOT EXISTS activity_logs (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id  UUID         REFERENCES hospitals(id) ON DELETE SET NULL,
            user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
            action       VARCHAR(80)  NOT NULL,
            entity_type  VARCHAR(60),
            entity_id    UUID,
            ip_address   VARCHAR(45),
            metadata     JSONB        DEFAULT '{}',
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('activity_logs — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_activity_hospital ON activity_logs(hospital_id)
    `);
    await q('activity_logs — created index', `
        CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC)
    `);
    await q('activity_logs — user index', `
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)
    `);

    // ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────
    console.log('\n🔑  password_reset_tokens table');

    await q('password_reset_tokens — create', `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token       VARCHAR(255) NOT NULL UNIQUE,
            expires_at  TIMESTAMPTZ  NOT NULL,
            used        BOOLEAN      NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('password_reset_tokens — user index', `
        CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)
    `);

    // ─── AI DOCUMENT ANALYSES ─────────────────────────────────────────────────
    console.log('\n🤖  ai_document_analyses table');

    await q('ai_document_analyses — create', `
        CREATE TABLE IF NOT EXISTS ai_document_analyses (
            id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id          UUID,
            hospital_id         UUID         REFERENCES hospitals(id) ON DELETE SET NULL,
            uploaded_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
            document_type       VARCHAR(30)  NOT NULL DEFAULT 'PRESCRIPTION'
                                    CHECK (document_type IN ('PRESCRIPTION','LAB_REPORT','TEST_REPORT','OTHER')),
            original_file_name  VARCHAR(255),
            original_file_url   TEXT,
            ocr_raw_text        TEXT,
            parsed_data         JSONB        DEFAULT '{}',
            expiry_date         DATE,
            ai_status           VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING'
                                    CHECK (ai_status IN ('PROCESSING','DONE','FAILED')),
            is_deleted          BOOLEAN      NOT NULL DEFAULT false,
            created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('ai_document_analyses — uploader index', `
        CREATE INDEX IF NOT EXISTS idx_ai_uploader ON ai_document_analyses(uploaded_by)
    `);
    await q('ai_document_analyses — hospital index', `
        CREATE INDEX IF NOT EXISTS idx_ai_hospital ON ai_document_analyses(hospital_id)
    `);

    // ─── STAFF ROLE PERMISSIONS ──────────────────────────────────────────────
    console.log('\n🔐  staff_role_permissions table');

    await q('staff_role_permissions — create', `
        CREATE TABLE IF NOT EXISTS staff_role_permissions (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_role   VARCHAR(30) NOT NULL,
            permission   VARCHAR(80) NOT NULL,
            is_allowed   BOOLEAN     NOT NULL DEFAULT true,
            UNIQUE (staff_role, permission)
        )
    `);

    // Seed permission matrix
    const permMatrix = [
        // DOCTOR
        ['DOCTOR',         'view_patients',           true],
        ['DOCTOR',         'edit_prescriptions',      true],
        ['DOCTOR',         'view_lab_reports',        true],
        ['DOCTOR',         'view_appointments',       true],
        ['DOCTOR',         'upload_documents',        true],
        // NURSE
        ['NURSE',          'view_patients',           true],
        ['NURSE',          'update_vitals',           true],
        ['NURSE',          'view_prescriptions',      true],
        ['NURSE',          'view_appointments',       true],
        // PHARMACIST
        ['PHARMACIST',     'view_prescriptions',      true],
        ['PHARMACIST',     'dispense_medicine',       true],
        ['PHARMACIST',     'view_patients',           true],
        // LAB_TECHNICIAN
        ['LAB_TECHNICIAN', 'upload_lab_reports',      true],
        ['LAB_TECHNICIAN', 'view_patients',           true],
        ['LAB_TECHNICIAN', 'view_appointments',       true],
        // RECEPTIONIST
        ['RECEPTIONIST',   'manage_appointments',     true],
        ['RECEPTIONIST',   'register_patients',       true],
        ['RECEPTIONIST',   'view_patients',           true],
        // OTHER_STAFF
        ['OTHER_STAFF',    'view_appointments',       true],
    ];

    for (const [role, perm, allowed] of permMatrix) {
        await q(`perm ${role}.${perm}`, `
            INSERT INTO staff_role_permissions (staff_role, permission, is_allowed)
            VALUES ('${role}', '${perm}', ${allowed})
            ON CONFLICT (staff_role, permission) DO NOTHING
        `);
    }

    // ─── TRIGGERS ────────────────────────────────────────────────────────────
    console.log('\n⚡  updated_at triggers');

    // Ensure the update function exists (idempotent)
    await q('update_updated_at fn', `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ LANGUAGE plpgsql;
    `);

    for (const tbl of ['hospitals', 'staff_profiles', 'ai_document_analyses']) {
        await q(`trigger: ${tbl}`, `
            DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};
            CREATE TRIGGER trg_${tbl}_updated_at
            BEFORE UPDATE ON ${tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
    }

    // ─── VERIFY ──────────────────────────────────────────────────────────────
    console.log('\n📊  Tables now in public schema:');
    const { rows } = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    console.log('    ' + rows.map(r => r.table_name).join(', '));

    console.log('\n✨  Full Hospital Module Migration complete!\n');
    await pool.end();
}

run().catch(e => { console.error('Migration failed:', e); pool.end(); process.exit(1); });
