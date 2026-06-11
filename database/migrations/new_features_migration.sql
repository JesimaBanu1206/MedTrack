-- ============================================================
-- MedTrack: New Tables Migration
-- op_timings, district officers, disease_alerts, ambulances
-- Run this in your Supabase SQL editor
-- ============================================================

-- ── 1. OP Timings (receptionist editable, reflects in appointment page) ──────
CREATE TABLE IF NOT EXISTS op_timings (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id             UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department              VARCHAR(120) NOT NULL,
    timing_date             DATE NOT NULL,
    start_time              TIME NOT NULL DEFAULT '08:00',
    end_time                TIME NOT NULL DEFAULT '13:00',
    slot_duration_minutes   INTEGER NOT NULL DEFAULT 15,
    max_patients            INTEGER NOT NULL DEFAULT 60,
    doctor_name             VARCHAR(200),
    notes                   TEXT,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE(hospital_id, timing_date, department)
);

-- ── 2. Ambulances ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambulances (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    vehicle_number  VARCHAR(20) NOT NULL,
    driver_name     VARCHAR(200),
    driver_phone    VARCHAR(15),
    status          VARCHAR(20) DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE','DISPATCHED','MAINTENANCE','OFFLINE')),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    last_updated    TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Disease Alerts (AI-generated, district-level) ─────────────────────────
CREATE TABLE IF NOT EXISTS disease_alerts (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    district            VARCHAR(100) NOT NULL,
    hospital_id         UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    disease_name        VARCHAR(200) NOT NULL,
    severity            VARCHAR(20) DEFAULT 'WARNING'
                        CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    case_count          INTEGER DEFAULT 0,
    threshold_exceeded  BOOLEAN DEFAULT false,
    report_date         DATE DEFAULT CURRENT_DATE,
    message             TEXT,
    is_active           BOOLEAN DEFAULT true,
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Extend users table for district officer ────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS district    VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(300);

-- ── 5. Extend hospitals table ─────────────────────────────────────────────────
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS op_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ip_today       INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS revenue_today  DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_beds     INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS available_beds INTEGER DEFAULT 0;

-- ── 6. Insert DISTRICT_OFFICER role if not exists ────────────────────────────
INSERT INTO roles (name) VALUES ('DISTRICT_OFFICER')
ON CONFLICT (name) DO NOTHING;

-- ── 7. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_op_timings_hospital_date   ON op_timings(hospital_id, timing_date);
CREATE INDEX IF NOT EXISTS idx_disease_alerts_district    ON disease_alerts(district, is_active);
CREATE INDEX IF NOT EXISTS idx_ambulances_hospital        ON ambulances(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_op_queue_hospital_date     ON op_queue(hospital_id, visit_date);

-- ── 8. Sample data for testing ────────────────────────────────────────────────
-- Insert sample op timings (replace hospital UUIDs with real ones from your DB)
-- INSERT INTO op_timings (hospital_id, department, timing_date, start_time, end_time)
-- VALUES ('your-hospital-uuid', 'General Medicine', CURRENT_DATE, '08:00', '13:00');

-- ── 9. RLS Policies ──────────────────────────────────────────────────────────
ALTER TABLE op_timings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service key)
CREATE POLICY "service_full_access_op_timings"     ON op_timings     FOR ALL USING (true);
CREATE POLICY "service_full_access_ambulances"     ON ambulances     FOR ALL USING (true);
CREATE POLICY "service_full_access_disease_alerts" ON disease_alerts FOR ALL USING (true);
