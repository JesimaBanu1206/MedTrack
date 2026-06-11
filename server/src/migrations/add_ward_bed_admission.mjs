/**
 * add_ward_bed_admission.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates:
 *  • wards           — hospital wards (ICU, General, Emergency, etc.)
 *  • beds            — individual beds with unique IDs
 *  • admissions      — IP patient admissions
 *  • online_consult_bookings — telemedicine appointment bookings
 *  • ward_doctor_assignments — which doctors manage which wards
 *
 * Run: node src/migrations/add_ward_bed_admission.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;

async function execSQL(sql, label) {
    console.log(`  ⏳ ${label}`);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ sql })
    });
    const text = await res.text();
    if (res.ok) {
        console.log(`  ✅ ${label}`);
    } else {
        console.log(`  ⚠  ${label}: ${text.slice(0, 160)}`);
    }
}

async function tableExists(name) {
    const { data, error } = await supabase.from(name).select('id').limit(1);
    return !error;
}

async function main() {
    console.log('🏥 MedTrack — Ward / Bed / Admission Migration');
    console.log('=================================================\n');

    // ── WARDS ────────────────────────────────────────────────────────────────
    if (await tableExists('wards')) {
        console.log('⏭  wards — already exists');
    } else {
        await execSQL(`
            CREATE TABLE IF NOT EXISTS wards (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id  UUID NOT NULL,
                ward_name    TEXT NOT NULL,
                ward_type    TEXT NOT NULL DEFAULT 'GENERAL',  -- ICU | GENERAL | EMERGENCY | MATERNITY | PAEDIATRIC | ORTHO
                total_beds   INT NOT NULL DEFAULT 10,
                floor_number INT,
                notes        TEXT,
                is_active    BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_wards_hospital ON wards(hospital_id);
        `, 'Create wards table');
    }

    // ── BEDS ─────────────────────────────────────────────────────────────────
    if (await tableExists('beds')) {
        console.log('⏭  beds — already exists');
    } else {
        await execSQL(`
            CREATE TABLE IF NOT EXISTS beds (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id  UUID NOT NULL,
                ward_id      UUID NOT NULL,
                bed_code     TEXT NOT NULL,        -- e.g. MEDTRK-GENERAL-01
                bed_number   INT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE | OCCUPIED | CLEANING | MAINTENANCE
                current_patient_id   UUID,
                current_admission_id UUID,
                notes        TEXT,
                is_active    BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_beds_hospital ON beds(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_beds_ward    ON beds(ward_id);
            CREATE INDEX IF NOT EXISTS idx_beds_status  ON beds(status);
        `, 'Create beds table');
    }

    // ── ADMISSIONS ───────────────────────────────────────────────────────────
    if (await tableExists('admissions')) {
        console.log('⏭  admissions — already exists');
    } else {
        await execSQL(`
            CREATE TABLE IF NOT EXISTS admissions (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id         UUID NOT NULL,
                ward_id             UUID NOT NULL,
                bed_id              UUID NOT NULL,
                patient_id          UUID,
                patient_name        TEXT NOT NULL,
                patient_pid         TEXT,
                age                 INT,
                gender              TEXT,
                admission_reason    TEXT,
                diagnosis           TEXT,
                attending_doctor_id UUID,
                admitted_by         UUID,         -- user_id of receptionist/nurse
                admission_date      TIMESTAMPTZ DEFAULT NOW(),
                discharge_date      TIMESTAMPTZ,
                status              TEXT DEFAULT 'ADMITTED',  -- ADMITTED | DISCHARGED | TRANSFERRED
                treatment_notes     TEXT,
                is_active           BOOLEAN DEFAULT TRUE,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_admissions_hospital ON admissions(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_admissions_ward     ON admissions(ward_id);
            CREATE INDEX IF NOT EXISTS idx_admissions_bed      ON admissions(bed_id);
            CREATE INDEX IF NOT EXISTS idx_admissions_patient  ON admissions(patient_id);
        `, 'Create admissions table');
    }

    // ── WARD DOCTOR ASSIGNMENTS ───────────────────────────────────────────────
    if (await tableExists('ward_doctor_assignments')) {
        console.log('⏭  ward_doctor_assignments — already exists');
    } else {
        await execSQL(`
            CREATE TABLE IF NOT EXISTS ward_doctor_assignments (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id  UUID NOT NULL,
                ward_id      UUID NOT NULL,
                doctor_id    UUID NOT NULL,   -- doctor_profiles.id
                assigned_by  UUID,
                is_active    BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(ward_id, doctor_id)
            );
            CREATE INDEX IF NOT EXISTS idx_wda_ward   ON ward_doctor_assignments(ward_id);
            CREATE INDEX IF NOT EXISTS idx_wda_doctor ON ward_doctor_assignments(doctor_id);
        `, 'Create ward_doctor_assignments table');
    }

    // ── ONLINE CONSULT BOOKINGS ───────────────────────────────────────────────
    if (await tableExists('online_consult_bookings')) {
        console.log('⏭  online_consult_bookings — already exists');
    } else {
        await execSQL(`
            CREATE TABLE IF NOT EXISTS online_consult_bookings (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id         UUID NOT NULL,
                doctor_id           UUID NOT NULL,  -- doctor_profiles.id
                patient_id          UUID,
                patient_name        TEXT NOT NULL,
                patient_phone       TEXT,
                appointment_date    DATE NOT NULL,
                appointment_time    TEXT NOT NULL,
                reason              TEXT,
                status              TEXT DEFAULT 'SCHEDULED',  -- SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
                meeting_link        TEXT,
                prescription_id     UUID,
                notes               TEXT,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ocb_doctor  ON online_consult_bookings(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_ocb_date    ON online_consult_bookings(appointment_date);
            CREATE INDEX IF NOT EXISTS idx_ocb_patient ON online_consult_bookings(patient_id);
        `, 'Create online_consult_bookings table');
    }

    // ── ADD treatment_notes to admissions (idempotent) ───────────────────────
    await execSQL(`
        ALTER TABLE admissions ADD COLUMN IF NOT EXISTS treatment_notes TEXT;
        ALTER TABLE admissions ADD COLUMN IF NOT EXISTS lab_requested BOOLEAN DEFAULT FALSE;
    `, 'Add extra columns to admissions');

    // ── hospital_resources — add location columns ─────────────────────────────
    await execSQL(`
        ALTER TABLE hospital_resources ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
        ALTER TABLE hospital_resources ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
        ALTER TABLE hospital_resources ADD COLUMN IF NOT EXISTS address   TEXT;
    `, 'Add location to hospital_resources');

    console.log('\n✅ Migration complete!\n');
    console.log('Tables available:');
    console.log('  • wards');
    console.log('  • beds');
    console.log('  • admissions');
    console.log('  • ward_doctor_assignments');
    console.log('  • online_consult_bookings\n');
}

main().catch(console.error);
