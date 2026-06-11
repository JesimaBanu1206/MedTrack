-- =============================================================================
-- MedTrack — COMPLETE HOSPITAL WORKFLOW SCHEMA
-- Run this in your Supabase SQL editor (after base schema.sql)
-- Adds all hospital workflow tables the backend controllers reference.
-- All tables include hospital_id isolation for multi-hospital security.
-- =============================================================================

-- Enable UUID extension (if not already)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PATCH EXISTING TABLES (add missing columns)
-- =============================================================================

-- Add missing columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS hospital_id    UUID,
    ADD COLUMN IF NOT EXISTS is_deleted     BOOLEAN DEFAULT FALSE;

-- Add missing roles
INSERT INTO roles (name, description)
VALUES
    ('PHARMACIST',      'Pharmacy staff')    ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description)
VALUES
    ('LAB_TECHNICIAN',  'Lab technician')    ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description)
VALUES
    ('RECEPTIONIST',    'Reception staff')   ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description)
VALUES
    ('OTHER_STAFF',     'Other hospital staff') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description)
VALUES
    ('HOSPITAL_ADMIN',  'Hospital administrator override') ON CONFLICT (name) DO NOTHING;

-- Update hospitals to use hospital_name instead of just name
ALTER TABLE hospitals
    ADD COLUMN IF NOT EXISTS hospital_name  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS hospital_code  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS type           VARCHAR(50)  DEFAULT 'GOVERNMENT',
    ADD COLUMN IF NOT EXISTS latitude       DECIMAL(10,8),
    ADD COLUMN IF NOT EXISTS longitude      DECIMAL(11,8),
    ADD COLUMN IF NOT EXISTS is_deleted     BOOLEAN DEFAULT FALSE;

-- Back-fill hospital_name from name if empty
UPDATE hospitals SET hospital_name = name WHERE hospital_name IS NULL;

-- =============================================================================
-- STAFF PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    hospital_id     UUID REFERENCES hospitals(id),
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(15),
    department      VARCHAR(100),
    staff_role      VARCHAR(50) NOT NULL,   -- DOCTOR, NURSE, etc.
    employee_id     VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sp_hospital  ON staff_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sp_user      ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_role      ON staff_profiles(staff_role);
CREATE INDEX IF NOT EXISTS idx_sp_active    ON staff_profiles(is_active, is_deleted);

-- =============================================================================
-- DOCTOR PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    hospital_id         UUID REFERENCES hospitals(id),
    doctor_unique_id    VARCHAR(50) UNIQUE,
    specialization      VARCHAR(100),
    qualification       VARCHAR(255),
    experience_years    INTEGER DEFAULT 0,
    consultation_fee    DECIMAL(10,2),
    languages           TEXT[],
    profile_bio         TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_user     ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dp_hospital ON doctor_profiles(hospital_id);

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

-- =============================================================================
-- DOCTOR SCHEDULES (daily duty assignment by admin)
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id       UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    hospital_id     UUID REFERENCES hospitals(id),
    assigned_by     UUID REFERENCES users(id),
    schedule_date   DATE NOT NULL,
    duty_type       VARCHAR(20) DEFAULT 'OP',   -- OP, IP, EMERGENCY, ONLINE
    department      VARCHAR(100),
    room_number     VARCHAR(20),
    shift_start     TIME,
    shift_end       TIME,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ds_doctor   ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ds_hospital ON doctor_schedules(hospital_id);
CREATE INDEX IF NOT EXISTS idx_ds_date     ON doctor_schedules(schedule_date);

-- =============================================================================
-- DOCTOR ATTENDANCE
-- =============================================================================
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
    status          VARCHAR(20) DEFAULT 'ABSENT',  -- ABSENT, ON_DUTY, ON_BREAK, OFF_DUTY
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (doctor_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_da_doctor   ON doctor_attendance(doctor_id);
CREATE INDEX IF NOT EXISTS idx_da_hospital ON doctor_attendance(hospital_id);
CREATE INDEX IF NOT EXISTS idx_da_date     ON doctor_attendance(attendance_date);

-- =============================================================================
-- DOCTOR LEAVE REQUESTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_leave_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id       UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    hospital_id     UUID REFERENCES hospitals(id),
    leave_date      DATE NOT NULL,
    leave_type      VARCHAR(30) DEFAULT 'CASUAL',
    reason          TEXT,
    status          VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    requested_by    UUID REFERENCES users(id),
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dlr_doctor   ON doctor_leave_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_dlr_hospital ON doctor_leave_requests(hospital_id);

-- =============================================================================
-- OP QUEUE (outpatient daily token queue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS op_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    doctor_id       UUID REFERENCES doctor_profiles(id),
    queue_date      DATE NOT NULL,
    token_number    INTEGER NOT NULL,
    patient_id      UUID REFERENCES patients(id),
    patient_name    VARCHAR(255) NOT NULL,
    patient_pid     VARCHAR(50),
    age             INTEGER,
    gender          VARCHAR(20),
    reason          TEXT,
    bp              VARCHAR(20),
    temperature     VARCHAR(10),
    heart_rate      INTEGER,
    sugar           VARCHAR(20),
    weight          DECIMAL(6,2),
    triage_status   VARCHAR(20) DEFAULT 'NORMAL',  -- CRITICAL, HIGH, NORMAL, LOW
    status          VARCHAR(30) DEFAULT 'WAITING',  -- WAITING, IN_CONSULTATION, COMPLETED, CANCELLED, REFERRED
    consulted_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opq_hospital ON op_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_opq_doctor   ON op_queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_opq_date     ON op_queue(queue_date);
CREATE INDEX IF NOT EXISTS idx_opq_status   ON op_queue(status);

-- =============================================================================
-- PRESCRIPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID REFERENCES hospitals(id),
    doctor_id           UUID REFERENCES doctor_profiles(id),
    patient_id          UUID REFERENCES patients(id),
    queue_entry_id      UUID REFERENCES op_queue(id),
    patient_name        VARCHAR(255),
    diagnosis           TEXT NOT NULL,
    chief_complaint     TEXT,
    notes               TEXT,
    follow_up_date      DATE,
    is_lab_required     BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prx_hospital ON prescriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_prx_doctor   ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prx_patient  ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prx_created  ON prescriptions(created_at DESC);

-- =============================================================================
-- PRESCRIPTION ITEMS (medicine details)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescription_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name   VARCHAR(255) NOT NULL,
    dosage          VARCHAR(100),
    frequency       VARCHAR(50),
    morning         BOOLEAN DEFAULT FALSE,
    afternoon       BOOLEAN DEFAULT FALSE,
    night           BOOLEAN DEFAULT FALSE,
    before_food     BOOLEAN DEFAULT FALSE,
    duration_days   INTEGER DEFAULT 1,
    instructions    TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pi_prescription ON prescription_items(prescription_id);

-- =============================================================================
-- LAB REQUESTS (doctor orders → lab tech fulfills)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lab_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    doctor_id       UUID REFERENCES doctor_profiles(id),
    patient_id      UUID REFERENCES patients(id),
    prescription_id UUID REFERENCES prescriptions(id),
    patient_name    VARCHAR(255),
    test_type       VARCHAR(255) NOT NULL,
    urgency         VARCHAR(20) DEFAULT 'ROUTINE',  -- ROUTINE, URGENT, STAT
    notes           TEXT,
    status          VARCHAR(30) DEFAULT 'PENDING',  -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    result_notes    TEXT,
    result_url      TEXT,
    completed_at    TIMESTAMP,
    completed_by    UUID REFERENCES users(id),
    notified        BOOLEAN DEFAULT FALSE,          -- doctor notified of result?
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lr_hospital ON lab_requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_lr_doctor   ON lab_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lr_patient  ON lab_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lr_status   ON lab_requests(status);

-- =============================================================================
-- NURSE VITALS (recorded by nurse, visible to doctor)
-- =============================================================================
CREATE TABLE IF NOT EXISTS nurse_vitals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    nurse_user_id   UUID REFERENCES users(id),
    patient_id      UUID REFERENCES patients(id),
    queue_entry_id  UUID REFERENCES op_queue(id),
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
CREATE INDEX IF NOT EXISTS idx_nv_patient  ON nurse_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_nv_nurse    ON nurse_vitals(nurse_user_id);
CREATE INDEX IF NOT EXISTS idx_nv_recorded ON nurse_vitals(recorded_at DESC);

-- =============================================================================
-- WARDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS wards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    ward_name       VARCHAR(100) NOT NULL,
    ward_type       VARCHAR(30) DEFAULT 'GENERAL',  -- GENERAL, ICU, EMERGENCY, MATERNITY, PEDIATRIC
    total_beds      INTEGER NOT NULL DEFAULT 0,
    floor_number    INTEGER,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_w_hospital ON wards(hospital_id);
CREATE INDEX IF NOT EXISTS idx_w_active   ON wards(is_active);

-- =============================================================================
-- BEDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS beds (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id             UUID REFERENCES hospitals(id),
    ward_id                 UUID REFERENCES wards(id) ON DELETE CASCADE,
    bed_code                VARCHAR(50) UNIQUE NOT NULL,  -- e.g. MEDTRK-GENERAL-01
    bed_number              INTEGER NOT NULL,
    status                  VARCHAR(20) DEFAULT 'AVAILABLE',  -- AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE
    current_patient_id      UUID REFERENCES patients(id),
    current_admission_id    UUID,  -- set after admission is created
    notes                   TEXT,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b_hospital ON beds(hospital_id);
CREATE INDEX IF NOT EXISTS idx_b_ward     ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_b_status   ON beds(status);
CREATE INDEX IF NOT EXISTS idx_b_code     ON beds(bed_code);

-- =============================================================================
-- ADMISSIONS (IP patients)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID REFERENCES hospitals(id),
    ward_id             UUID REFERENCES wards(id),
    bed_id              UUID REFERENCES beds(id),
    patient_id          UUID REFERENCES patients(id),
    patient_name        VARCHAR(255) NOT NULL,
    patient_pid         VARCHAR(50),
    age                 INTEGER,
    gender              VARCHAR(20),
    admission_reason    TEXT,
    diagnosis           TEXT,
    treatment_notes     TEXT,
    attending_doctor_id UUID REFERENCES doctor_profiles(id),
    admitted_by         UUID REFERENCES users(id),
    lab_requested       BOOLEAN DEFAULT FALSE,
    status              VARCHAR(20) DEFAULT 'ADMITTED',  -- ADMITTED, DISCHARGED, TRANSFERRED
    is_active           BOOLEAN DEFAULT TRUE,
    admission_date      TIMESTAMP DEFAULT NOW(),
    discharge_date      TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adm_hospital ON admissions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_adm_ward     ON admissions(ward_id);
CREATE INDEX IF NOT EXISTS idx_adm_bed      ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_adm_patient  ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_adm_status   ON admissions(status);

-- =============================================================================
-- WARD DOCTOR ASSIGNMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS ward_doctor_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    ward_id         UUID REFERENCES wards(id) ON DELETE CASCADE,
    doctor_id       UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (ward_id, doctor_id)
);
CREATE INDEX IF NOT EXISTS idx_wda_hospital ON ward_doctor_assignments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_wda_ward     ON ward_doctor_assignments(ward_id);
CREATE INDEX IF NOT EXISTS idx_wda_doctor   ON ward_doctor_assignments(doctor_id);

-- =============================================================================
-- ONLINE CONSULT PROFILES (doctor's availability for online consultation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS online_consult_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id           UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE UNIQUE,
    is_published        BOOLEAN DEFAULT FALSE,
    bio                 TEXT,
    consultation_fee    DECIMAL(10,2),
    available_days      TEXT[],
    slot_duration_min   INTEGER DEFAULT 15,
    time_slots          JSONB DEFAULT '[]',  -- [{day, start, end}]
    languages           TEXT[],
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocp_doctor ON online_consult_profiles(doctor_id);

-- =============================================================================
-- ONLINE CONSULT BOOKINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS online_consult_bookings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID REFERENCES hospitals(id),
    doctor_id           UUID REFERENCES doctor_profiles(id),
    patient_id          UUID REFERENCES patients(id),
    patient_name        VARCHAR(255) NOT NULL,
    patient_phone       VARCHAR(15),
    appointment_date    DATE NOT NULL,
    appointment_time    TIME NOT NULL,
    reason              TEXT,
    status              VARCHAR(30) DEFAULT 'SCHEDULED',  -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    meeting_link        TEXT,
    notes               TEXT,
    prescription_id     UUID REFERENCES prescriptions(id),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocb_doctor  ON online_consult_bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ocb_patient ON online_consult_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_ocb_date    ON online_consult_bookings(appointment_date);

-- =============================================================================
-- HOSPITAL RESOURCES (beds count, location for ambulance)
-- =============================================================================
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

-- =============================================================================
-- ADMIN NOTICES (broadcast to all staff)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_notices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    created_by      UUID REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    priority        VARCHAR(20) DEFAULT 'NORMAL',  -- URGENT, HIGH, NORMAL, LOW
    is_active       BOOLEAN DEFAULT TRUE,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_an_hospital ON admin_notices(hospital_id);
CREATE INDEX IF NOT EXISTS idx_an_active   ON admin_notices(is_active);

-- =============================================================================
-- STAFF MESSAGES (targeted messages from admin to staff)
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    sender_id       UUID REFERENCES users(id),
    sender_name     VARCHAR(255),
    target_type     VARCHAR(20) DEFAULT 'ALL',  -- ALL, ROLE, INDIVIDUAL
    target_user_id  UUID REFERENCES users(id),
    target_role     VARCHAR(50),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    priority        VARCHAR(20) DEFAULT 'NORMAL',
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sm_hospital ON staff_messages(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sm_target   ON staff_messages(target_type, target_user_id, target_role);

-- =============================================================================
-- STAFF MESSAGE READS (track which messages a user has read)
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_message_reads (
    message_id  UUID REFERENCES staff_messages(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

-- =============================================================================
-- STAFF SCHEDULES (general shift scheduling for all staff)
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    staff_user_id   UUID REFERENCES users(id),
    shift_date      DATE NOT NULL,
    shift_type      VARCHAR(30) DEFAULT 'GENERAL',
    shift_start     TIME,
    shift_end       TIME,
    location        VARCHAR(100),
    notes           TEXT,
    assigned_by     UUID REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ss_hospital ON staff_schedules(hospital_id);
CREATE INDEX IF NOT EXISTS idx_ss_staff    ON staff_schedules(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_ss_date     ON staff_schedules(shift_date);

-- =============================================================================
-- ACTIVITY LOGS (audit trail per hospital)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    ip_address      INET,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_al_hospital ON activity_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_al_user     ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_al_action   ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_al_created  ON activity_logs(created_at DESC);

-- =============================================================================
-- AUTO-UPDATE TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['staff_profiles','doctor_profiles','doctor_schedules',
        'doctor_attendance','doctor_leave_requests','op_queue','prescriptions',
        'lab_requests','wards','beds','admissions','ward_doctor_assignments',
        'online_consult_profiles','online_consult_bookings','hospital_resources',
        'admin_notices','staff_schedules']
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_upd_%1$s ON %1$s;
            CREATE TRIGGER trg_upd_%1$s
                BEFORE UPDATE ON %1$s
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', tbl);
    END LOOP;
END $$;

-- =============================================================================
-- VERIFY ALL TABLES EXIST
-- =============================================================================
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'staff_profiles','doctor_profiles','doctor_schedules','doctor_attendance',
        'doctor_leave_requests','op_queue','prescriptions','prescription_items',
        'lab_requests','nurse_vitals','wards','beds','admissions',
        'ward_doctor_assignments','online_consult_profiles','online_consult_bookings',
        'hospital_resources','admin_notices','staff_messages','staff_message_reads',
        'staff_schedules','activity_logs'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            RAISE EXCEPTION 'Table % was not created!', tbl;
        END IF;
    END LOOP;
    RAISE NOTICE '✅ All 22 hospital workflow tables verified successfully.';
END $$;
