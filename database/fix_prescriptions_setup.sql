-- =====================================================
-- PRESCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_name VARCHAR(255),
    hospital_name VARCHAR(255),
    issued_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    custom_id VARCHAR(50),
    medications JSONB DEFAULT '[]',
    category VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Policies for prescriptions
DROP POLICY IF EXISTS prescriptions_select_own ON prescriptions;
CREATE POLICY prescriptions_select_own ON prescriptions
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

DROP POLICY IF EXISTS prescriptions_insert_own ON prescriptions;
CREATE POLICY prescriptions_insert_own ON prescriptions
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_custom_id ON prescriptions(custom_id);

-- STORAGE BUCKET (Run this in the Supabase Dashboard if the below doesn't work)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('medical-records', 'medical-records', true)
-- ON CONFLICT (id) DO NOTHING;
