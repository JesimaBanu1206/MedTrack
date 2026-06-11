-- ============================================================
-- MedTrack: Complete Database Migration
-- Run this ONCE in your Supabase SQL Editor
-- ============================================================

-- ── 1. ROLES ─────────────────────────────────────────────────────────────────
INSERT INTO roles (name) VALUES
  ('SUPER_ADMIN'), ('HOSPITAL_ADMIN'), ('DOCTOR'), ('NURSE'),
  ('PHARMACIST'), ('LAB_TECHNICIAN'), ('RECEPTIONIST'),
  ('OTHER_STAFF'), ('DISTRICT_OFFICER'), ('PATIENT')
ON CONFLICT (name) DO NOTHING;

-- ── 2. EXTEND USERS TABLE ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS district    VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob         DATE;

-- ── 3. EXTEND HOSPITALS TABLE ────────────────────────────────────────────────
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS op_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ip_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS revenue_today  DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_beds     INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS available_beds INTEGER DEFAULT 0;

-- ── 4. OP TIMINGS ────────────────────────────────────────────────────────────
-- Receptionist sets these; appointment page reads them live
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

-- ── 5. OP QUEUE (appointments) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS op_queue (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id       UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_id        UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_pid       VARCHAR(50),
    patient_name      VARCHAR(300) NOT NULL,
    age               INTEGER,
    gender            VARCHAR(20),
    department        VARCHAR(120) NOT NULL,
    reason            TEXT,
    token_number      INTEGER NOT NULL,
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

-- ── 6. ONLINE CONSULTATION BOOKINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_consult_bookings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_pid     VARCHAR(50),
    patient_name    VARCHAR(300) NOT NULL,
    doctor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hospital_id     UUID REFERENCES hospitals(id),
    department      VARCHAR(120) NOT NULL,
    booking_date    DATE NOT NULL,
    booking_time    VARCHAR(10) NOT NULL,
    status          VARCHAR(20) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
    fee             DECIMAL(10,2) DEFAULT 200,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 7. AMBULANCES ────────────────────────────────────────────────────────────
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

-- ── 8. DISEASE ALERTS (AI-generated) ────────────────────────────────────────
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

-- ── 9. INDEXES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_op_timings_hosp_date   ON op_timings(hospital_id, timing_date);
CREATE INDEX IF NOT EXISTS idx_op_timings_dept        ON op_timings(department);
CREATE INDEX IF NOT EXISTS idx_op_queue_hosp_date     ON op_queue(hospital_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_op_queue_patient       ON op_queue(patient_pid);
CREATE INDEX IF NOT EXISTS idx_op_queue_status        ON op_queue(status);
CREATE INDEX IF NOT EXISTS idx_op_queue_doctor        ON op_queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_disease_alerts_dist    ON disease_alerts(district, is_active);
CREATE INDEX IF NOT EXISTS idx_ambulances_hosp        ON ambulances(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_online_consult_doctor  ON online_consult_bookings(doctor_id, booking_date);

-- ── 10. RLS POLICIES (service role full access) ──────────────────────────────
ALTER TABLE op_timings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_consult_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_alerts          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svc_op_timings"    ON op_timings;
DROP POLICY IF EXISTS "svc_op_queue"      ON op_queue;
DROP POLICY IF EXISTS "svc_online"        ON online_consult_bookings;
DROP POLICY IF EXISTS "svc_ambulances"    ON ambulances;
DROP POLICY IF EXISTS "svc_disease"       ON disease_alerts;

CREATE POLICY "svc_op_timings"    ON op_timings              FOR ALL USING (true);
CREATE POLICY "svc_op_queue"      ON op_queue                FOR ALL USING (true);
CREATE POLICY "svc_online"        ON online_consult_bookings  FOR ALL USING (true);
CREATE POLICY "svc_ambulances"    ON ambulances              FOR ALL USING (true);
CREATE POLICY "svc_disease"       ON disease_alerts          FOR ALL USING (true);

-- ── 11. SAMPLE DATA ──────────────────────────────────────────────────────────
-- Sample ambulances (update hospital_id with real UUIDs from your hospitals table)
-- INSERT INTO ambulances (vehicle_number, driver_name, driver_phone, status, hospital_id)
-- SELECT 'TN59-A-1001', 'Murugan S', '9876501001', 'AVAILABLE', id FROM hospitals LIMIT 1;
