CREATE TABLE IF NOT EXISTS emergency_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    district VARCHAR(120) NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    unit_number VARCHAR(50),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    reject_reason TEXT,
    duty_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    sos_note TEXT,
    last_location_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_drivers_user_id ON emergency_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_drivers_district ON emergency_drivers(district);
CREATE INDEX IF NOT EXISTS idx_emergency_drivers_status ON emergency_drivers(approval_status);
CREATE INDEX IF NOT EXISTS idx_emergency_drivers_unit_number ON emergency_drivers(unit_number);

CREATE TABLE IF NOT EXISTS emergency_driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES emergency_drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy_meters DECIMAL(10, 2),
    source VARCHAR(20) DEFAULT 'GPS',
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_driver_locations_driver_id ON emergency_driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_emergency_driver_locations_recorded_at ON emergency_driver_locations(recorded_at DESC);
