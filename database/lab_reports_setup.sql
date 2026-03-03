-- =====================================================
-- LAB REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS lab_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255),
    lab_name VARCHAR(255),
    test_date DATE,
    report_date DATE,
    lab_id VARCHAR(50),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    results JSONB DEFAULT '[]', -- List of { parameter: 'Hemoglobin', value: '14.2', unit: 'g/dL', status: 'Normal' }
    status VARCHAR(50) DEFAULT 'Normal', -- Normal, Abnormal, Attention Needed
    category VARCHAR(100) DEFAULT 'General',
    ai_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS reports_select_own ON lab_reports;
CREATE POLICY reports_select_own ON lab_reports
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

DROP POLICY IF EXISTS reports_insert_own ON lab_reports;
CREATE POLICY reports_insert_own ON lab_reports
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_reports_patient ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_category ON lab_reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON lab_reports(status);
