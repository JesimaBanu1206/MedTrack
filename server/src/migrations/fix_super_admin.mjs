
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
    }
});

async function migrate() {
    console.log('🚀 Starting Super Admin Schema Fix...');
    try {
        // 1. Create hospitals table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hospitals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                district VARCHAR(100) NOT NULL,
                total_beds INTEGER DEFAULT 0,
                available_beds INTEGER DEFAULT 0,
                icu_beds INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Hospitals table verified');

        // 2. Add some mock hospitals if empty (to avoid empty dashboard)
        const hospitalCheck = await pool.query('SELECT COUNT(*) FROM hospitals');
        if (parseInt(hospitalCheck.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO hospitals (name, district, total_beds, available_beds, icu_beds)
                VALUES 
                ('Madras Medical College', 'Chennai', 500, 120, 45),
                ('Rajaji Govt Hospital', 'Madurai', 400, 80, 30),
                ('Stanley Medical College', 'Chennai', 450, 95, 35),
                ('Coimbatore Medical College', 'Coimbatore', 350, 60, 25);
            `);
            console.log('✅ Mock hospital data added');
        }

        // 3. Create patients table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Patients table verified');

        // 4. Create appointments table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hospital_id UUID REFERENCES hospitals(id),
                appointment_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Appointments table verified');

        // 5. Update emergency_drivers table
        await pool.query(`
            ALTER TABLE emergency_drivers 
            ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING',
            ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS reject_reason TEXT,
            ADD COLUMN IF NOT EXISTS duty_status VARCHAR(20) DEFAULT 'OFFLINE',
            ADD COLUMN IF NOT EXISTS sos_note TEXT,
            ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ Emergency Drivers table columns updated');

        // 6. Create emergency_driver_locations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS emergency_driver_locations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES emergency_drivers(id),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Emergency Driver Locations table verified');

        // 7. Create emergency_driver_response_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS emergency_driver_response_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id UUID REFERENCES emergency_drivers(id),
                responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Emergency Driver Response Logs table verified');

        console.log('✨ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration Error:', err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

migrate();
