-- =====================================================
-- MEDTRACK HEALTHCARE PLATFORM - DATABASE SCHEMA
-- Production-Ready with Row Level Security (RLS)
-- =====================================================

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('PATIENT', 'Patient/User role'),
('DOCTOR', 'Doctor role'),
('NURSE', 'Nurse role'),
('HOSPITAL_ADMIN', 'Hospital administrator'),
('DISTRICT_ADMIN', 'District administrator'),
('SUPER_ADMIN', 'Super administrator'),
('AMBULANCE', 'Emergency response partner')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) NOT NULL DEFAULT 1,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own data
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = current_setting('app.current_user_id', true)::uuid);

-- RLS Policy: Users can only update their own data
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = current_setting('app.current_user_id', true)::uuid);

-- =====================================================
-- OTPs TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(15),
    email VARCHAR(255),
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_user ON otps(user_id);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_purpose ON otps(purpose);
CREATE INDEX IF NOT EXISTS idx_otps_used ON otps(is_used);

-- Enable RLS on otps table
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own OTPs
CREATE POLICY otps_select_own ON otps
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- =====================================================
-- REFRESH TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_info TEXT,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_revoked ON refresh_tokens(is_revoked);

-- Enable RLS on refresh_tokens table
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own refresh tokens
CREATE POLICY refresh_tokens_select_own ON refresh_tokens
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- =====================================================
-- PATIENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    dob DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(5),
    address TEXT,
    emergency_contact VARCHAR(15),
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(15),
    profile_picture_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_pid ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);

-- Enable RLS on patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Patients can only access their own data
CREATE POLICY patients_select_own ON patients
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- RLS Policy: Patients can only update their own data
CREATE POLICY patients_update_own ON patients
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- =====================================================
-- MEDICAL RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    category VARCHAR(50) DEFAULT 'GENERAL',
    description TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_category ON medical_records(category);
CREATE INDEX IF NOT EXISTS idx_medical_created ON medical_records(created_at);

-- Enable RLS on medical_records table
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Patients can only access their own medical records
CREATE POLICY medical_records_select_own ON medical_records
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- RLS Policy: Patients can only insert their own medical records
CREATE POLICY medical_records_insert_own ON medical_records
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- RLS Policy: Patients can only delete their own medical records
CREATE POLICY medical_records_delete_own ON medical_records
    FOR DELETE
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status);

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own audit logs
CREATE POLICY audit_logs_select_own ON audit_logs
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to cleanup expired tokens and OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    DELETE FROM otps WHERE expires_at < NOW() AND is_used = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at 
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at 
    BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique patient ID
CREATE OR REPLACE FUNCTION generate_patient_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    year_part TEXT;
    sequence_part TEXT;
    counter INTEGER;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    -- Get the count of patients created this year
    SELECT COUNT(*) INTO counter
    FROM patients
    WHERE patient_id LIKE 'PT-' || year_part || '-%';
    
    -- Increment and format
    counter := counter + 1;
    sequence_part := LPAD(counter::TEXT, 4, '0');
    
    new_id := 'PT-' || year_part || '-' || sequence_part;
    
    -- Check if ID already exists (race condition protection)
    WHILE EXISTS (SELECT 1 FROM patients WHERE patient_id = new_id) LOOP
        counter := counter + 1;
        sequence_part := LPAD(counter::TEXT, 4, '0');
        new_id := 'PT-' || year_part || '-' || sequence_part;
    END LOOP;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULED CLEANUP (Run this periodically via cron or pg_cron)
-- =====================================================
-- To enable automatic cleanup, install pg_cron extension and run:
-- SELECT cron.schedule('cleanup-tokens', '0 0 * * *', 'SELECT cleanup_expired_tokens()');

-- =====================================================
-- GRANT PERMISSIONS (Adjust based on your Supabase setup)
-- =====================================================
-- These are typically handled by Supabase automatically
-- But included here for reference

-- Grant usage on schema
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- INITIAL DATA VERIFICATION
-- =====================================================
-- Verify roles are inserted
SELECT * FROM roles;

-- =====================================================
-- NOTES FOR PRODUCTION
-- =====================================================
-- 1. Ensure Supabase RLS is enabled in project settings
-- 2. Configure Supabase Storage bucket "medical-records" with private access
-- 3. Set up pg_cron for automatic token cleanup
-- 4. Monitor audit_logs table regularly
-- 5. Implement backup strategy for medical_records and patients tables
-- 6. Consider encryption at rest for sensitive fields
-- 7. Regularly review and update RLS policies
-- 8. Set up monitoring and alerting for failed login attempts
