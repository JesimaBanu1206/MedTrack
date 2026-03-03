CREATE TABLE IF NOT EXISTS emergency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_id VARCHAR(50),
    image_url TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'PENDING',
    assigned_unit_no VARCHAR(50),
    unit_details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for emergency_alerts
-- 1. Allow anyone to insert (critical for emergencies)
DROP POLICY IF EXISTS emergency_alerts_insert_all ON emergency_alerts;
CREATE POLICY emergency_alerts_insert_all ON emergency_alerts
    FOR INSERT
    WITH CHECK (true);

-- 2. Allow users to see their own alerts
DROP POLICY IF EXISTS emergency_alerts_select_own ON emergency_alerts;
CREATE POLICY emergency_alerts_select_own ON emergency_alerts
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Allow admins to see all alerts (assuming role_id 1 is admin)
-- You may need to adjust this based on your roles table structure
-- DROP POLICY IF EXISTS emergency_alerts_select_admin ON emergency_alerts;
-- CREATE POLICY emergency_alerts_select_admin ON emergency_alerts
--     FOR SELECT
--     USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_id = 1));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user ON emergency_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status ON emergency_alerts(status);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created_at ON emergency_alerts(created_at);
