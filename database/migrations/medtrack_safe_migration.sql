-- ============================================================
-- MedTrack: SAFE Complete Migration (Fixed)
-- ✅ Run this in Supabase SQL Editor
-- ✅ All errors from previous migrations are fixed here
-- ✅ Safe to run even if some tables already exist
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── STEP 1: ROLES ────────────────────────────────────────────────────────────
INSERT INTO roles (name) VALUES ('SUPER_ADMIN')     ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('HOSPITAL_ADMIN')  ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('DOCTOR')          ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('NURSE')           ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('PHARMACIST')      ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('LAB_TECHNICIAN')  ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('RECEPTIONIST')    ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('OTHER_STAFF')     ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('DISTRICT_OFFICER') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('PATIENT')         ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('AMBULANCE')       ON CONFLICT (name) DO NOTHING;

-- ── STEP 2: EXTEND USERS TABLE ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS district    VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob         DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE;

-- ── STEP 3: EXTEND HOSPITALS TABLE ──────────────────────────────────────────
-- Add hospital_name if missing (some schemas use 'name' instead)
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_name  VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_code  VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS type           VARCHAR(50) DEFAULT 'GOVERNMENT';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS district       VARCHAR(100);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address        TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude       DECIMAL(10,8);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude      DECIMAL(11,8);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_deleted     BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS op_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ip_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS revenue_today  DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_beds     INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS available_beds INTEGER DEFAULT 0;

-- ✅ FIXED: Safe back-fill — only copies if 'name' column exists in your schema
-- If your hospitals table has a 'name' column, copy to hospital_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'name'
  ) THEN
    UPDATE hospitals SET hospital_name = name WHERE hospital_name IS NULL;
  END IF;
END $$;

-- ── STEP 4: STAFF PROFILES ───────────────────────────────────────────────────
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
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sp_hospital ON staff_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sp_user     ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_role     ON staff_profiles(staff_role);

-- ── STEP 5: OP TIMINGS ───────────────────────────────────────────────────────
-- Receptionist creates/edits these → patient appointment page reads them live
CREATE TABLE IF NOT EXISTS op_timings (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department            VARCHAR(120) NOT NULL,
    timing_date           DATE NOT NULL,
    start_time            TIME NOT NULL DEFAULT '08:00',
    end_time              TIME NOT NULL DEFAULT '13:00',
    slot_duration_minutes INTEGER NOT NULL DEFAULT 15,
    max_patients          INTEGER NOT NULL DEFAULT 60,
    doctor_name           VARCHAR(200),
    notes                 TEXT,
    is_active             BOOLEAN DEFAULT true,
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    UNIQUE(hospital_id, timing_date, department)
);

-- ── STEP 6: OP QUEUE (appointments) ─────────────────────────────────────────
-- In-person bookings appear here → receptionist sees them
-- Online bookings also stored here with consultation_type = 'ONLINE' → doctor sees them
CREATE TABLE IF NOT EXISTS op_queue (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id       UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_id        UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_pid       VARCHAR(50),
    patient_name      VARCHAR(300) NOT NULL,
    age               INTEGER,
    gender            VARCHAR(20),
    department        VARCHAR(120) NOT NULL,
    reason            TEXT,
    token_number      INTEGER NOT NULL DEFAULT 1,
    status            VARCHAR(30) DEFAULT 'WAITING'
                      CHECK (status IN ('WAITING','IN_CONSULTATION','COMPLETED','CANCELLED','NO_SHOW')),
    triage_status     VARCHAR(20) DEFAULT 'NORMAL'
                      CHECK (triage_status IN ('CRITICAL','URGENT','NORMAL')),
    visit_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    preferred_time    VARCHAR(10),
    consultation_type VARCHAR(20) DEFAULT 'IN_PERSON'
                      CHECK (consultation_type IN ('IN_PERSON','ONLINE')),
    doctor_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    booked_online     BOOLEAN DEFAULT false,
    notes             TEXT,
    registered_by     UUID REFERENCES users(id),
    bp                VARCHAR(20),
    temperature       VARCHAR(20),
    heart_rate        VARCHAR(20),
    sugar             VARCHAR(20),
    weight            DECIMAL(5,2),
    spo2              VARCHAR(10),
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Compatibility patch: older MedTrack schemas used queue_date instead of visit_date.
ALTER TABLE op_queue ADD COLUMN IF NOT EXISTS visit_date DATE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'op_queue' AND column_name = 'queue_date'
  ) THEN
    UPDATE op_queue
    SET visit_date = COALESCE(visit_date, queue_date, CURRENT_DATE);
  END IF;
END $$;
UPDATE op_queue SET visit_date = CURRENT_DATE WHERE visit_date IS NULL;
ALTER TABLE op_queue ALTER COLUMN visit_date SET DEFAULT CURRENT_DATE;
ALTER TABLE op_queue ALTER COLUMN visit_date SET NOT NULL;

-- Compatibility patch: older MedTrack schemas may not have consultation_type.
ALTER TABLE op_queue ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(20);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'op_queue' AND column_name = 'booked_online'
  ) THEN
    UPDATE op_queue
    SET consultation_type = COALESCE(
      consultation_type,
      CASE WHEN booked_online IS TRUE THEN 'ONLINE' ELSE 'IN_PERSON' END
    );
  ELSE
    UPDATE op_queue
    SET consultation_type = COALESCE(consultation_type, 'IN_PERSON');
  END IF;
END $$;
UPDATE op_queue SET consultation_type = 'IN_PERSON' WHERE consultation_type IS NULL;
UPDATE op_queue
SET consultation_type = 'IN_PERSON'
WHERE consultation_type NOT IN ('IN_PERSON', 'ONLINE');
ALTER TABLE op_queue ALTER COLUMN consultation_type SET DEFAULT 'IN_PERSON';
ALTER TABLE op_queue ALTER COLUMN consultation_type SET NOT NULL;

-- ── STEP 7: ONLINE CONSULTATION BOOKINGS ────────────────────────────────────
-- Online appointments → appear in doctor dashboard
CREATE TABLE IF NOT EXISTS online_consult_bookings (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id    UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_pid   VARCHAR(50),
    patient_name  VARCHAR(300) NOT NULL,
    doctor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    hospital_id   UUID REFERENCES hospitals(id),
    department    VARCHAR(120) NOT NULL,
    booking_date  DATE NOT NULL,
    booking_time  VARCHAR(10) NOT NULL,
    status        VARCHAR(20) DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
    fee           DECIMAL(10,2) DEFAULT 200,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Compatibility patch: older MedTrack schemas used appointment_date instead of booking_date.
ALTER TABLE online_consult_bookings ADD COLUMN IF NOT EXISTS booking_date DATE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'online_consult_bookings' AND column_name = 'appointment_date'
  ) THEN
    UPDATE online_consult_bookings
    SET booking_date = COALESCE(booking_date, appointment_date, CURRENT_DATE);
  END IF;
END $$;
UPDATE online_consult_bookings SET booking_date = CURRENT_DATE WHERE booking_date IS NULL;
ALTER TABLE online_consult_bookings ALTER COLUMN booking_date SET DEFAULT CURRENT_DATE;
ALTER TABLE online_consult_bookings ALTER COLUMN booking_date SET NOT NULL;

-- ── STEP 8: AMBULANCES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambulances (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id    UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    vehicle_number VARCHAR(20) NOT NULL UNIQUE,
    driver_name    VARCHAR(200),
    driver_phone   VARCHAR(15),
    status         VARCHAR(20) DEFAULT 'AVAILABLE'
                   CHECK (status IN ('AVAILABLE','DISPATCHED','MAINTENANCE','OFFLINE')),
    latitude       DECIMAL(9,6),
    longitude      DECIMAL(9,6),
    last_updated   TIMESTAMPTZ DEFAULT now(),
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 9: DISEASE ALERTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disease_alerts (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    district           VARCHAR(100) NOT NULL,
    hospital_id        UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    disease_name       VARCHAR(200) NOT NULL,
    severity           VARCHAR(20) DEFAULT 'WARNING'
                       CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    case_count         INTEGER DEFAULT 0,
    threshold_exceeded BOOLEAN DEFAULT false,
    report_date        DATE DEFAULT CURRENT_DATE,
    message            TEXT,
    is_active          BOOLEAN DEFAULT true,
    acknowledged_by    UUID REFERENCES users(id),
    acknowledged_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 10: WARDS & BEDS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wards (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id    UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward_name      VARCHAR(100) NOT NULL,
    ward_type      VARCHAR(50) DEFAULT 'GENERAL',
    total_beds     INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    floor          VARCHAR(20),
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS beds (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ward_id     UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    bed_code    VARCHAR(20) NOT NULL,
    status      VARCHAR(20) DEFAULT 'AVAILABLE'
                CHECK (status IN ('AVAILABLE','OCCUPIED','CLEANING','MAINTENANCE')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 11: PATIENTS TABLE (if not exists) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_pid VARCHAR(50) UNIQUE NOT NULL,
    full_name   VARCHAR(300) NOT NULL,
    age         INTEGER,
    gender      VARCHAR(20),
    phone       VARCHAR(15),
    email       VARCHAR(255),
    blood_group VARCHAR(10),
    address     TEXT,
    district    VARCHAR(100),
    dob         DATE,
    user_id     UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 12: PRESCRIPTIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id      UUID REFERENCES patients(id),
    patient_pid     VARCHAR(50),
    patient_name    VARCHAR(300),
    doctor_id       UUID REFERENCES users(id),
    hospital_id     UUID REFERENCES hospitals(id),
    queue_entry_id  UUID REFERENCES op_queue(id),
    diagnosis       TEXT,
    chief_complaint TEXT,
    notes           TEXT,
    follow_up_date  DATE,
    is_lab_required BOOLEAN DEFAULT false,
    dispense_status VARCHAR(20) DEFAULT 'PENDING'
                    CHECK (dispense_status IN ('PENDING','DISPENSED','PARTIAL')),
    medicines       JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 13: ACTIVITY LOGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES hospitals(id),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id   UUID,
    metadata    JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 14: STAFF SCHEDULES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_schedules (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id   UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    staff_user_id UUID REFERENCES users(id),
    shift_date    DATE NOT NULL,
    shift_type    VARCHAR(30) DEFAULT 'GENERAL',
    shift_start   TIME,
    shift_end     TIME,
    location      VARCHAR(100),
    notes         TEXT,
    assigned_by   UUID REFERENCES users(id),
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 15: VITALS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id      UUID REFERENCES patients(id),
    patient_pid     VARCHAR(50),
    patient_name    VARCHAR(300),
    queue_entry_id  UUID REFERENCES op_queue(id),
    hospital_id     UUID REFERENCES hospitals(id),
    recorded_by     UUID REFERENCES users(id),
    bp              VARCHAR(20),
    temperature     VARCHAR(20),
    heart_rate      VARCHAR(20),
    sugar           VARCHAR(20),
    weight          DECIMAL(5,2),
    spo2            VARCHAR(10),
    respiration     VARCHAR(20),
    pain_scale      INTEGER,
    notes           TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

-- ── STEP 16: INDEXES ─────────────────────────────────────────────────────────
-- Compatibility patch: normalize legacy patient identifier columns.
-- Older schemas used patients.patient_id while this migration expects patient_pid.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_pid VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email VARCHAR(255);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'patient_id'
  ) THEN
    UPDATE patients
    SET patient_pid = COALESCE(patient_pid, patient_id);
  END IF;
END $$;
UPDATE patients
SET patient_pid = 'PID-' || REPLACE(id::text, '-', '')
WHERE patient_pid IS NULL;
UPDATE patients
SET patient_id = COALESCE(patient_id, patient_pid)
WHERE patient_pid IS NOT NULL;

ALTER TABLE op_queue ADD COLUMN IF NOT EXISTS patient_pid VARCHAR(50);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'op_queue' AND column_name = 'patient_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_pid'
    ) THEN
      UPDATE op_queue oq
      SET patient_pid = COALESCE(oq.patient_pid, p.patient_pid)
      FROM patients p
      WHERE oq.patient_id = p.id AND oq.patient_pid IS NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_id'
    ) THEN
      UPDATE op_queue oq
      SET patient_pid = COALESCE(oq.patient_pid, p.patient_id)
      FROM patients p
      WHERE oq.patient_id = p.id AND oq.patient_pid IS NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_pid VARCHAR(50);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'queue_entry_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'op_queue' AND column_name = 'patient_pid'
  ) THEN
    UPDATE prescriptions pr
    SET patient_pid = COALESCE(pr.patient_pid, oq.patient_pid)
    FROM op_queue oq
    WHERE pr.queue_entry_id = oq.id AND pr.patient_pid IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'patient_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_pid'
    ) THEN
      UPDATE prescriptions pr
      SET patient_pid = COALESCE(pr.patient_pid, p.patient_pid)
      FROM patients p
      WHERE pr.patient_id = p.id AND pr.patient_pid IS NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_id'
    ) THEN
      UPDATE prescriptions pr
      SET patient_pid = COALESCE(pr.patient_pid, p.patient_id)
      FROM patients p
      WHERE pr.patient_id = p.id AND pr.patient_pid IS NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE vitals ADD COLUMN IF NOT EXISTS patient_pid VARCHAR(50);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vitals' AND column_name = 'queue_entry_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'op_queue' AND column_name = 'patient_pid'
  ) THEN
    UPDATE vitals v
    SET patient_pid = COALESCE(v.patient_pid, oq.patient_pid)
    FROM op_queue oq
    WHERE v.queue_entry_id = oq.id AND v.patient_pid IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vitals' AND column_name = 'patient_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_pid'
    ) THEN
      UPDATE vitals v
      SET patient_pid = COALESCE(v.patient_pid, p.patient_pid)
      FROM patients p
      WHERE v.patient_id = p.id AND v.patient_pid IS NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'patient_id'
    ) THEN
      UPDATE vitals v
      SET patient_pid = COALESCE(v.patient_pid, p.patient_id)
      FROM patients p
      WHERE v.patient_id = p.id AND v.patient_pid IS NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_op_timings_hosp_date      ON op_timings(hospital_id, timing_date);
CREATE INDEX IF NOT EXISTS idx_op_timings_dept           ON op_timings(department);
CREATE INDEX IF NOT EXISTS idx_op_queue_hosp_date        ON op_queue(hospital_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_op_queue_patient          ON op_queue(patient_pid);
CREATE INDEX IF NOT EXISTS idx_op_queue_status           ON op_queue(status);
CREATE INDEX IF NOT EXISTS idx_op_queue_doctor           ON op_queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_op_queue_consult_type     ON op_queue(consultation_type);
CREATE INDEX IF NOT EXISTS idx_disease_alerts_dist       ON disease_alerts(district, is_active);
CREATE INDEX IF NOT EXISTS idx_ambulances_hosp           ON ambulances(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_online_consult_doctor     ON online_consult_bookings(doctor_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_patients_pid              ON patients(patient_pid);
CREATE INDEX IF NOT EXISTS idx_wards_hospital            ON wards(hospital_id);
CREATE INDEX IF NOT EXISTS idx_beds_ward                 ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient     ON prescriptions(patient_pid);
CREATE INDEX IF NOT EXISTS idx_vitals_patient            ON vitals(patient_pid);
CREATE INDEX IF NOT EXISTS idx_activity_hospital         ON activity_logs(hospital_id);

-- ── STEP 17: RLS POLICIES ────────────────────────────────────────────────────
-- Enable RLS on all new tables
ALTER TABLE op_timings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_consult_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs           ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies if any, then recreate
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE tablename IN ('op_timings','op_queue','online_consult_bookings',
                        'ambulances','disease_alerts','wards','beds',
                        'vitals','prescriptions','activity_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Service role full access (your backend uses the service key — this allows all operations)
CREATE POLICY "svc_all_op_timings"    ON op_timings              FOR ALL USING (true);
CREATE POLICY "svc_all_op_queue"      ON op_queue                FOR ALL USING (true);
CREATE POLICY "svc_all_online"        ON online_consult_bookings  FOR ALL USING (true);
CREATE POLICY "svc_all_ambulances"    ON ambulances              FOR ALL USING (true);
CREATE POLICY "svc_all_disease"       ON disease_alerts          FOR ALL USING (true);
CREATE POLICY "svc_all_wards"         ON wards                   FOR ALL USING (true);
CREATE POLICY "svc_all_beds"          ON beds                    FOR ALL USING (true);
CREATE POLICY "svc_all_vitals"        ON vitals                  FOR ALL USING (true);
CREATE POLICY "svc_all_prescriptions" ON prescriptions           FOR ALL USING (true);
CREATE POLICY "svc_all_activity"      ON activity_logs           FOR ALL USING (true);

-- ── STEP 18: SAMPLE TEST DATA ────────────────────────────────────────────────
-- Test patient (for appointment page verification)
INSERT INTO patients (patient_pid, patient_id, full_name, dob, age, gender, phone, blood_group, district)
VALUES
  ('PID100001', 'PID100001', 'Arjun Selvan',   DATE '1992-04-10', 34, 'Male',   '9876543210', 'B+', 'Madurai'),
  ('PID100002', 'PID100002', 'Kavitha Rajan',  DATE '1974-09-22', 52, 'Female', '9876543211', 'A+', 'Chennai'),
  ('PID100003', 'PID100003', 'Murugan Pillai', DATE '1959-01-16', 67, 'Male',   '9876543212', 'O+', 'Coimbatore'),
  ('PID100004', 'PID100004', 'Priya Sundaram', DATE '1998-11-03', 28, 'Female', '9876543213', 'AB+','Madurai'),
  ('PID100005', 'PID100005', 'Ravi Kumar',     DATE '1981-06-28', 45, 'Male',   '9876543214', 'B-', 'Tiruchirappalli')
ON CONFLICT DO NOTHING;

-- ── DONE ─────────────────────────────────────────────────────────────────────
-- ✅ Migration complete
-- Next: Go to Supabase → Table Editor to verify all tables are created
-- Then restart your Node.js server and test the appointment booking flow
