-- ============================================================
-- MedTrack: Create emergency_alerts table
-- Paste this entire file into:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Add phone column to emergency_drivers (safe if already exists)
ALTER TABLE emergency_drivers
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 2. Create emergency_alerts table
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_id       UUID,
    image_url        TEXT NOT NULL,
    latitude         DECIMAL(10,8),
    longitude        DECIMAL(11,8),
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    assigned_unit_no VARCHAR(50),
    unit_details     JSONB,
    metadata         JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status
    ON emergency_alerts(status);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_unit
    ON emergency_alerts(assigned_unit_no);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created
    ON emergency_alerts(created_at DESC);

-- 4. Verify: show all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
