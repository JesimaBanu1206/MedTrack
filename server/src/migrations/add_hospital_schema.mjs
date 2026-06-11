/**
 * add_hospital_schema.mjs
 * Run: node src/migrations/add_hospital_schema.mjs
 *
 * Adds / ensures all tables required for the Hospital Admin module:
 *   hospitals (full schema), users (hospital_id + hospital-fields),
 *   staff_profiles, activity_logs, ai_document_analyses
 *
 * Safe — uses IF NOT EXISTS / IF NOT EXISTS on columns.
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

async function run() {
    console.log('\n🚀  MedTrack — Hospital Schema Migration\n');

    /* ─────────────────────────────────────────────────────────────
       HOSPITALS — full schema (replaces minimal version)
    ───────────────────────────────────────────────────────────── */
    await q('hospitals table (full schema)', `
        CREATE TABLE IF NOT EXISTS hospitals (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_name   VARCHAR(255) NOT NULL,
            hospital_code   VARCHAR(50)  NOT NULL UNIQUE,
            type            VARCHAR(20)  NOT NULL DEFAULT 'GH'
                                CHECK (type IN ('GH','PHC','PRIVATE','CLINIC')),
            address         TEXT,
            district        VARCHAR(120),
            contact_email   VARCHAR(255),
            contact_phone   VARCHAR(20),
            is_active       BOOLEAN      NOT NULL DEFAULT true,
            is_deleted      BOOLEAN      NOT NULL DEFAULT false,
            created_by      UUID,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    /* Migrate old "name" column → "hospital_name" if it exists */
    await q('hospitals: copy name→hospital_name if needed', `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='hospitals' AND column_name='name'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='hospitals' AND column_name='hospital_name'
            ) THEN
                ALTER TABLE hospitals RENAME COLUMN name TO hospital_name;
            END IF;
        END $$;
    `);

    /* Add missing columns to existing hospitals table */
    const hospCols = [
        ['hospital_code',   'VARCHAR(50)'],
        ['type',            "VARCHAR(20) DEFAULT 'GH'"],
        ['address',         'TEXT'],
        ['district',        'VARCHAR(120)'],
        ['contact_email',   'VARCHAR(255)'],
        ['contact_phone',   'VARCHAR(20)'],
        ['is_deleted',      'BOOLEAN DEFAULT false'],
        ['created_by',      'UUID'],
    ];
    for (const [col, def] of hospCols) {
        await q(`hospitals.${col}`, `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }

    /* Ensure unique constraint on hospital_code */
    await q('hospitals: unique hospital_code index', `
        CREATE UNIQUE INDEX IF NOT EXISTS uq_hospitals_code ON hospitals(hospital_code)
        WHERE is_deleted = false
    `);

    /* Ensure district index */
    await q('hospitals: district index', `
        CREATE INDEX IF NOT EXISTS idx_hospitals_district ON hospitals(district)
    `);

    /* ─────────────────────────────────────────────────────────────
       USERS — add hospital_id + soft-delete
    ───────────────────────────────────────────────────────────── */
    const userCols = [
        ['hospital_id', 'UUID'],
        ['full_name',   'VARCHAR(255)'],
        ['is_deleted',  'BOOLEAN DEFAULT false'],
    ];
    for (const [col, def] of userCols) {
        await q(`users.${col}`, `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }

    /* FK hospital_id → hospitals.id (only if hospitals table exists) */
    await q('users.hospital_id FK', `
        DO $$
        BEGIN
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

    /* ─────────────────────────────────────────────────────────────
       ROLES — ensure HOSPITAL_ADMIN + staff roles exist
    ───────────────────────────────────────────────────────────── */
    const roles = [
        'HOSPITAL_ADMIN',
        'DOCTOR',
        'NURSE',
        'PHARMACIST',
        'LAB_TECHNICIAN',
        'RECEPTIONIST',
        'OTHER_STAFF'
    ];
    for (const role of roles) {
        await q(`role: ${role}`, `
            INSERT INTO roles (name)
            VALUES ('${role}')
            ON CONFLICT (name) DO NOTHING
        `);
    }

    /* ─────────────────────────────────────────────────────────────
       STAFF PROFILES
    ───────────────────────────────────────────────────────────── */
    await q('staff_profiles table', `
        CREATE TABLE IF NOT EXISTS staff_profiles (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id      UUID        REFERENCES users(id) ON DELETE CASCADE,
            hospital_id  UUID        NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
            full_name    VARCHAR(255) NOT NULL,
            phone        VARCHAR(20),
            department   VARCHAR(120),
            staff_role   VARCHAR(30)  NOT NULL
                             CHECK (staff_role IN ('DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF')),
            is_active    BOOLEAN      NOT NULL DEFAULT true,
            is_deleted   BOOLEAN      NOT NULL DEFAULT false,
            created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('staff_profiles: idx hospital_id', `
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_hospital ON staff_profiles(hospital_id)
    `);
    await q('staff_profiles: idx role', `
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON staff_profiles(staff_role)
    `);

    /* ─────────────────────────────────────────────────────────────
       ACTIVITY LOGS
    ───────────────────────────────────────────────────────────── */
    await q('activity_logs table', `
        CREATE TABLE IF NOT EXISTS activity_logs (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id  UUID        REFERENCES hospitals(id) ON DELETE SET NULL,
            user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
            action       VARCHAR(80)  NOT NULL,
            entity_type  VARCHAR(60),
            entity_id    UUID,
            ip_address   VARCHAR(45),
            metadata     JSONB        DEFAULT '{}',
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('activity_logs: idx hospital_id', `
        CREATE INDEX IF NOT EXISTS idx_activity_logs_hospital ON activity_logs(hospital_id)
    `);
    await q('activity_logs: idx created_at', `
        CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC)
    `);

    /* ─────────────────────────────────────────────────────────────
       PASSWORD RESET TOKENS
    ───────────────────────────────────────────────────────────── */
    await q('password_reset_tokens table', `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token       VARCHAR(255) NOT NULL UNIQUE,
            expires_at  TIMESTAMPTZ  NOT NULL,
            used        BOOLEAN      NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    /* ─────────────────────────────────────────────────────────────
       AI DOCUMENT ANALYSES
    ───────────────────────────────────────────────────────────── */
    await q('ai_document_analyses table', `
        CREATE TABLE IF NOT EXISTS ai_document_analyses (
            id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id         UUID,
            hospital_id        UUID        REFERENCES hospitals(id) ON DELETE SET NULL,
            uploaded_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
            document_type      VARCHAR(30)  NOT NULL DEFAULT 'PRESCRIPTION'
                                   CHECK (document_type IN ('PRESCRIPTION','LAB_REPORT','TEST_REPORT','OTHER')),
            original_file_name VARCHAR(255),
            original_file_url  TEXT,
            ocr_raw_text       TEXT,
            parsed_data        JSONB        DEFAULT '{}',
            expiry_date        DATE,
            ai_status          VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING'
                                   CHECK (ai_status IN ('PROCESSING','DONE','FAILED')),
            is_deleted         BOOLEAN      NOT NULL DEFAULT false,
            created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    await q('ai_document_analyses: idx uploaded_by', `
        CREATE INDEX IF NOT EXISTS idx_ai_docs_uploaded_by ON ai_document_analyses(uploaded_by)
    `);
    await q('ai_document_analyses: idx hospital_id', `
        CREATE INDEX IF NOT EXISTS idx_ai_docs_hospital ON ai_document_analyses(hospital_id)
    `);

    /* ─────────────────────────────────────────────────────────────
       STAFF ROLE PERMISSIONS
    ───────────────────────────────────────────────────────────── */
    await q('staff_role_permissions table', `
        CREATE TABLE IF NOT EXISTS staff_role_permissions (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_role   VARCHAR(30)  NOT NULL,
            permission   VARCHAR(80)  NOT NULL,
            is_allowed   BOOLEAN      NOT NULL DEFAULT true,
            UNIQUE (staff_role, permission)
        )
    `);

    /* Seed default permissions */
    const permMatrix = [
        /* DOCTOR */
        ['DOCTOR', 'view_patients',          true],
        ['DOCTOR', 'edit_prescriptions',     true],
        ['DOCTOR', 'view_lab_reports',       true],
        ['DOCTOR', 'view_appointments',      true],
        /* NURSE */
        ['NURSE',  'view_patients',          true],
        ['NURSE',  'update_vitals',          true],
        ['NURSE',  'view_prescriptions',     true],
        /* PHARMACIST */
        ['PHARMACIST', 'view_prescriptions', true],
        ['PHARMACIST', 'dispense_medicine',  true],
        /* LAB_TECHNICIAN */
        ['LAB_TECHNICIAN', 'upload_lab_reports', true],
        ['LAB_TECHNICIAN', 'view_patients',      true],
        /* RECEPTIONIST */
        ['RECEPTIONIST', 'manage_appointments',  true],
        ['RECEPTIONIST', 'register_patients',    true],
        /* OTHER_STAFF */
        ['OTHER_STAFF', 'view_appointments',     true],
    ];
    for (const [role, perm, allowed] of permMatrix) {
        await q(`permission: ${role}.${perm}`, `
            INSERT INTO staff_role_permissions (staff_role, permission, is_allowed)
            VALUES ('${role}', '${perm}', ${allowed})
            ON CONFLICT (staff_role, permission) DO NOTHING
        `);
    }

    /* ─────────────────────────────────────────────────────────────
       VERIFY
    ───────────────────────────────────────────────────────────── */
    console.log('\n📋  Tables now in DB:');
    const { rows } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('   ', rows.map(r => r.table_name).join(', '));

    console.log('\n✨  Hospital schema migration complete!\n');
    await pool.end();
}

run().catch(e => { console.error(e); pool.end(); });
