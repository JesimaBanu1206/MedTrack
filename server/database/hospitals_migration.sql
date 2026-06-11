-- ============================================================
-- MedTrack: Hospitals, Hospital Admin & Staff Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. HOSPITALS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_name   VARCHAR(255) NOT NULL,
    hospital_code   VARCHAR(50)  UNIQUE NOT NULL,  -- immutable after creation
    type            VARCHAR(50)  NOT NULL CHECK (type IN ('GH','PHC','PRIVATE','CLINIC')),
    address         TEXT,
    district        VARCHAR(120),
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE,
    is_deleted      BOOLEAN DEFAULT FALSE,          -- soft-delete flag
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. EXTEND users TABLE ───────────────────────────────────
-- Add hospital_id FK (nullable for super-admin, patients etc.)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS full_name   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE;

-- ── 3. STAFF PROFILES TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hospital_id  UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    full_name    VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    department   VARCHAR(120),
    staff_role   VARCHAR(50)  NOT NULL CHECK (
                    staff_role IN ('DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF')
                 ),
    is_active    BOOLEAN DEFAULT TRUE,
    is_deleted   BOOLEAN DEFAULT FALSE,
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. ACTIVITY LOGS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id  UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    user_id      UUID REFERENCES users(id)     ON DELETE SET NULL,
    action       VARCHAR(120) NOT NULL,
    entity_type  VARCHAR(60),
    entity_id    UUID,
    ip_address   VARCHAR(45),
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. AI DOCUMENT ANALYSIS TABLE ───────────────────────────
CREATE TABLE IF NOT EXISTS ai_document_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
    hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    uploaded_by     UUID REFERENCES users(id),
    document_type   VARCHAR(50) DEFAULT 'PRESCRIPTION'
                        CHECK (document_type IN ('PRESCRIPTION','LAB_REPORT','TEST_REPORT')),
    original_file_url TEXT,
    original_file_name VARCHAR(255),
    ocr_raw_text    TEXT,
    parsed_data     JSONB DEFAULT '{}',
    expiry_date     DATE,                           -- prescription valid 1yr from issue
    ai_status       VARCHAR(30) DEFAULT 'PENDING'
                        CHECK (ai_status IN ('PENDING','PROCESSING','DONE','FAILED')),
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. PASSWORD RESET TOKENS TABLE ──────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. INSERT NEW ROLES (safe upsert) ───────────────────────
INSERT INTO roles (name) VALUES
    ('SUPER_ADMIN'),
    ('HOSPITAL_ADMIN'),
    ('DOCTOR'),
    ('NURSE'),
    ('PHARMACIST'),
    ('LAB_TECHNICIAN'),
    ('RECEPTIONIST'),
    ('OTHER_STAFF'),
    ('PATIENT')
ON CONFLICT (name) DO NOTHING;

-- ── 8. INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hospitals_code        ON hospitals(hospital_code);
CREATE INDEX IF NOT EXISTS idx_hospitals_district    ON hospitals(district);
CREATE INDEX IF NOT EXISTS idx_hospitals_active      ON hospitals(is_active) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_hospital        ON users(hospital_id);
CREATE INDEX IF NOT EXISTS idx_staff_hospital        ON staff_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_staff_user            ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_hospital     ON activity_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_activity_user         ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_docs_patient       ON ai_document_analyses(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_docs_hospital      ON ai_document_analyses(hospital_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user     ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token    ON password_reset_tokens(token);
