CREATE TABLE IF NOT EXISTS emergency_driver_response_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES emergency_drivers(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    responded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_driver_response_logs_driver_id
    ON emergency_driver_response_logs(driver_id);

CREATE INDEX IF NOT EXISTS idx_emergency_driver_response_logs_responded_at
    ON emergency_driver_response_logs(responded_at DESC);
