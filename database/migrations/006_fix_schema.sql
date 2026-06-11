-- =============================================================================
-- Migration 006: Fix Schema Issues
-- • Fixes prescriptions table (adds missing doctor columns)
-- • Ensures prescription_items exists with correct schema
-- • Ensures wards/beds/admissions/ward_doctor_assignments exist
-- • Disables RLS on all workflow tables (server uses service_role key)
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- ─── PRESCRIPTIONS: Add missing columns ───────────────────────────────────────
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_id        UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS hospital_id      UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS queue_entry_id   UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_name     VARCHAR(255);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis        TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS chief_complaint  TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS follow_up_date   DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_lab_required  BOOLEAN DEFAULT FALSE;

-- Add FK only if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'prescriptions' AND column_name = 'doctor_id'
        AND data_type = 'uuid'
    ) THEN NULL; END IF;
END $$;

-- Disable RLS on prescriptions (server uses service_role, not per-user JWT)
ALTER TABLE prescriptions DISABLE ROW LEVEL SECURITY;

-- Drop conflicting RLS policies
DROP POLICY IF EXISTS prescriptions_select_own ON prescriptions;
DROP POLICY IF EXISTS prescriptions_insert_own ON prescriptions;

-- ─── PRESCRIPTION ITEMS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name   VARCHAR(255) NOT NULL,
    dosage          VARCHAR(100),
    frequency       VARCHAR(100),
    morning         BOOLEAN DEFAULT FALSE,
    afternoon       BOOLEAN DEFAULT FALSE,
    night           BOOLEAN DEFAULT FALSE,
    before_food     BOOLEAN DEFAULT FALSE,
    duration_days   INTEGER,
    instructions    TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pi_prescription ON prescription_items(prescription_id);
ALTER TABLE prescription_items DISABLE ROW LEVEL SECURITY;

-- ─── DOCTOR PROFILES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    hospital_id       UUID REFERENCES hospitals(id),
    doctor_unique_id  VARCHAR(50) UNIQUE,
    specialization    VARCHAR(100),
    qualification     VARCHAR(255),
    experience_years  INTEGER DEFAULT 0,
    consultation_fee  DECIMAL(10,2),
    profile_bio       TEXT,
    phone             VARCHAR(15),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_user     ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dp_hospital ON doctor_profiles(hospital_id);
ALTER TABLE doctor_profiles DISABLE ROW LEVEL SECURITY;

-- Auto-generate doctor_unique_id trigger
CREATE OR REPLACE FUNCTION generate_doctor_unique_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.doctor_unique_id IS NULL THEN
        NEW.doctor_unique_id := 'DR-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_doctor_unique_id ON doctor_profiles;
CREATE TRIGGER trg_doctor_unique_id
    BEFORE INSERT ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION generate_doctor_unique_id();

-- ─── DOCTOR SCHEDULES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id     UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    hospital_id   UUID REFERENCES hospitals(id),
    assigned_by   UUID REFERENCES users(id),
    schedule_date DATE NOT NULL,
    duty_type     VARCHAR(20) DEFAULT 'OP',
    department    VARCHAR(100),
    room_number   VARCHAR(20),
    shift_start   TIME,
    shift_end     TIME,
    notes         TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ds_doctor   ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ds_hospital ON doctor_schedules(hospital_id);
ALTER TABLE doctor_schedules DISABLE ROW LEVEL SECURITY;

-- ─── DOCTOR ATTENDANCE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_attendance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id       UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    hospital_id     UUID REFERENCES hospitals(id),
    attendance_date DATE NOT NULL,
    login_time      TIMESTAMP,
    logout_time     TIMESTAMP,
    break_start     TIMESTAMP,
    break_end       TIMESTAMP,
    total_minutes   INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'ABSENT',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (doctor_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_da_doctor   ON doctor_attendance(doctor_id);
CREATE INDEX IF NOT EXISTS idx_da_hospital ON doctor_attendance(hospital_id);
ALTER TABLE doctor_attendance DISABLE ROW LEVEL SECURITY;

-- ─── OP QUEUE ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS op_queue (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id   UUID REFERENCES hospitals(id),
    doctor_id     UUID REFERENCES doctor_profiles(id),
    queue_date    DATE NOT NULL,
    token_number  INTEGER NOT NULL,
    patient_id    UUID,
    patient_name  VARCHAR(255) NOT NULL,
    patient_pid   VARCHAR(50),
    age           INTEGER,
    gender        VARCHAR(20),
    reason        TEXT,
    bp            VARCHAR(20),
    temperature   VARCHAR(10),
    heart_rate    INTEGER,
    sugar         VARCHAR(20),
    weight        DECIMAL(6,2),
    triage_status VARCHAR(20) DEFAULT 'NORMAL',
    status        VARCHAR(30) DEFAULT 'WAITING',
    consulted_at  TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opq_hospital ON op_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_opq_doctor   ON op_queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_opq_date     ON op_queue(queue_date);
ALTER TABLE op_queue DISABLE ROW LEVEL SECURITY;

-- ─── LAB REQUESTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_requests (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id   UUID REFERENCES hospitals(id),
    doctor_id     UUID REFERENCES doctor_profiles(id),
    patient_id    UUID,
    patient_name  VARCHAR(255) NOT NULL,
    patient_pid   VARCHAR(50),
    test_type     VARCHAR(255) NOT NULL,
    urgency       VARCHAR(20) DEFAULT 'ROUTINE',
    notes         TEXT,
    status        VARCHAR(20) DEFAULT 'PENDING',
    result_notes  TEXT,
    completed_at  TIMESTAMP,
    completed_by  UUID REFERENCES users(id),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lr_hospital ON lab_requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_lr_doctor   ON lab_requests(doctor_id);
ALTER TABLE lab_requests DISABLE ROW LEVEL SECURITY;

-- ─── NURSE VITALS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurse_vitals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    nurse_user_id   UUID REFERENCES users(id),
    patient_id      UUID,
    queue_entry_id  UUID,
    patient_name    VARCHAR(255),
    bp              VARCHAR(20),
    temperature     VARCHAR(10),
    heart_rate      INTEGER,
    sugar           VARCHAR(20),
    weight          DECIMAL(6,2),
    spo2            INTEGER,
    respiration     INTEGER,
    pain_scale      INTEGER,
    notes           TEXT,
    recorded_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nv_hospital ON nurse_vitals(hospital_id);
ALTER TABLE nurse_vitals DISABLE ROW LEVEL SECURITY;

-- ─── STAFF PROFILES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id),
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(15),
    department  VARCHAR(100),
    staff_role  VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sp_hospital ON staff_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sp_user     ON staff_profiles(user_id);
ALTER TABLE staff_profiles DISABLE ROW LEVEL SECURITY;

-- ─── WARDS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wards (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id),
    ward_name   VARCHAR(100) NOT NULL,
    ward_type   VARCHAR(30) DEFAULT 'GENERAL',
    total_beds  INTEGER NOT NULL DEFAULT 0,
    floor_number INTEGER,
    notes       TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_w_hospital ON wards(hospital_id);
ALTER TABLE wards DISABLE ROW LEVEL SECURITY;

-- ─── BEDS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beds (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id           UUID REFERENCES hospitals(id),
    ward_id               UUID REFERENCES wards(id) ON DELETE CASCADE,
    bed_code              VARCHAR(50),
    bed_number            INTEGER NOT NULL,
    status                VARCHAR(20) DEFAULT 'AVAILABLE',
    current_patient_id    UUID,
    current_admission_id  UUID,
    notes                 TEXT,
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b_hospital ON beds(hospital_id);
CREATE INDEX IF NOT EXISTS idx_b_ward     ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_b_status   ON beds(status);
ALTER TABLE beds DISABLE ROW LEVEL SECURITY;

-- Unique constraint on bed_code (nullable safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_b_code_unique ON beds(bed_code) WHERE bed_code IS NOT NULL;

-- ─── ADMISSIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID REFERENCES hospitals(id),
    ward_id             UUID REFERENCES wards(id),
    bed_id              UUID REFERENCES beds(id),
    patient_id          UUID,
    patient_name        VARCHAR(255) NOT NULL,
    patient_pid         VARCHAR(50),
    age                 INTEGER,
    gender              VARCHAR(20),
    admission_reason    TEXT,
    diagnosis           TEXT,
    treatment_notes     TEXT,
    attending_doctor_id UUID,
    admitted_by         UUID REFERENCES users(id),
    lab_requested       BOOLEAN DEFAULT FALSE,
    status              VARCHAR(20) DEFAULT 'ADMITTED',
    is_active           BOOLEAN DEFAULT TRUE,
    admission_date      TIMESTAMP DEFAULT NOW(),
    discharge_date      TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adm_hospital ON admissions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_adm_ward     ON admissions(ward_id);
CREATE INDEX IF NOT EXISTS idx_adm_status   ON admissions(status);
ALTER TABLE admissions DISABLE ROW LEVEL SECURITY;

-- ─── WARD DOCTOR ASSIGNMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ward_doctor_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id),
    ward_id     UUID REFERENCES wards(id) ON DELETE CASCADE,
    doctor_id   UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (ward_id, doctor_id)
);
CREATE INDEX IF NOT EXISTS idx_wda_hospital ON ward_doctor_assignments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_wda_ward     ON ward_doctor_assignments(ward_id);
ALTER TABLE ward_doctor_assignments DISABLE ROW LEVEL SECURITY;

-- ─── HOSPITAL RESOURCES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_resources (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id             UUID REFERENCES hospitals(id) UNIQUE,
    general_beds_total      INTEGER DEFAULT 0,
    general_beds_available  INTEGER DEFAULT 0,
    icu_beds_total          INTEGER DEFAULT 0,
    icu_beds_available      INTEGER DEFAULT 0,
    ventilators_total       INTEGER DEFAULT 0,
    ventilators_available   INTEGER DEFAULT 0,
    latitude                DECIMAL(10,8),
    longitude               DECIMAL(11,8),
    address                 TEXT,
    updated_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_hospital ON hospital_resources(hospital_id);
ALTER TABLE hospital_resources DISABLE ROW LEVEL SECURITY;

-- ─── ADMIN NOTICES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notices (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id),
    created_by  UUID REFERENCES users(id),
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    priority    VARCHAR(20) DEFAULT 'NORMAL',
    is_active   BOOLEAN DEFAULT TRUE,
    expires_at  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_an_hospital ON admin_notices(hospital_id);
ALTER TABLE admin_notices DISABLE ROW LEVEL SECURITY;

-- ─── STAFF MESSAGES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    sender_id       UUID REFERENCES users(id),
    sender_name     VARCHAR(255),
    target_type     VARCHAR(20) DEFAULT 'ALL',
    target_user_id  UUID REFERENCES users(id),
    target_role     VARCHAR(50),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    priority        VARCHAR(20) DEFAULT 'NORMAL',
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sm_hospital ON staff_messages(hospital_id);
ALTER TABLE staff_messages DISABLE ROW LEVEL SECURITY;

-- ─── STAFF MESSAGE READS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_message_reads (
    message_id  UUID REFERENCES staff_messages(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);
ALTER TABLE staff_message_reads DISABLE ROW LEVEL SECURITY;

-- ─── STAFF SCHEDULES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_schedules (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id   UUID REFERENCES hospitals(id),
    staff_user_id UUID REFERENCES users(id),
    shift_date    DATE NOT NULL,
    shift_type    VARCHAR(30) DEFAULT 'GENERAL',
    shift_start   TIME,
    shift_end     TIME,
    location      VARCHAR(100),
    notes         TEXT,
    assigned_by   UUID REFERENCES users(id),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ss_hospital ON staff_schedules(hospital_id);
ALTER TABLE staff_schedules DISABLE ROW LEVEL SECURITY;

-- ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    ip_address  INET,
    metadata    JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_al_hospital ON activity_logs(hospital_id);
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- ─── ONLINE CONSULT PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_consult_profiles (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id         UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE UNIQUE,
    is_published      BOOLEAN DEFAULT FALSE,
    bio               TEXT,
    consultation_fee  DECIMAL(10,2),
    available_days    TEXT[],
    slot_duration_min INTEGER DEFAULT 15,
    time_slots        JSONB DEFAULT '[]',
    languages         TEXT[],
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
ALTER TABLE online_consult_profiles DISABLE ROW LEVEL SECURITY;

-- ─── ONLINE CONSULT BOOKINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_consult_bookings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id       UUID REFERENCES hospitals(id),
    doctor_id         UUID REFERENCES doctor_profiles(id),
    patient_id        UUID,
    patient_name      VARCHAR(255) NOT NULL,
    patient_phone     VARCHAR(15),
    appointment_date  DATE NOT NULL,
    appointment_time  TIME NOT NULL,
    reason            TEXT,
    status            VARCHAR(30) DEFAULT 'SCHEDULED',
    meeting_link      TEXT,
    notes             TEXT,
    rating            DECIMAL(3,1),
    review            TEXT,
    fee               DECIMAL(10,2),
    consultation_fee  DECIMAL(10,2),
    prescription_id   UUID REFERENCES prescriptions(id),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocb_doctor  ON online_consult_bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ocb_date    ON online_consult_bookings(appointment_date);
ALTER TABLE online_consult_bookings DISABLE ROW LEVEL SECURITY;

-- ─── hospitals: ensure hospital_name column ───────────────────────────────────
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_name  VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_code  VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_deleted     BOOLEAN DEFAULT FALSE;
UPDATE hospitals SET hospital_name = name WHERE hospital_name IS NULL AND name IS NOT NULL;

-- ─── users: ensure hospital_id + full_name + is_deleted ──────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE;

-- ─── AUTO-UPDATE TRIGGERS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'staff_profiles','doctor_profiles','doctor_schedules',
        'doctor_attendance','op_queue','prescriptions','lab_requests',
        'wards','beds','admissions','ward_doctor_assignments',
        'online_consult_profiles','online_consult_bookings',
        'hospital_resources','admin_notices','staff_schedules'
    ] LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_upd_%1$s ON %1$s;
            CREATE TRIGGER trg_upd_%1$s
                BEFORE UPDATE ON %1$s
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', tbl);
    END LOOP;
END $$;

RAISE NOTICE '✅ Migration 006: Schema fixes applied. All tables verified and RLS disabled.';
