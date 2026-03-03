
import supabase from './src/config/supabase.js';
import { pool } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

const districts = ['Chennai', 'Madurai', 'Coimbatore', 'Tiruchirappalli', 'Salem'];

async function seedData() {
    try {
        console.log('Seeding hospitals...');
        for (let i = 0; i < 10; i++) {
            const district = districts[Math.floor(Math.random() * districts.length)];
            const totalBeds = Math.floor(Math.random() * 500) + 100;
            const availableBeds = Math.floor(Math.random() * totalBeds);
            const icuBeds = Math.floor(Math.random() * 50);

            await pool.query(`
                INSERT INTO hospitals (name, hospital_code, district, city, total_beds, available_beds, icu_beds)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (hospital_code) DO NOTHING
            `, [
                `Govt General Hospital ${i + 1}`,
                `GH${100 + i}`,
                district,
                district,
                totalBeds,
                availableBeds,
                icuBeds
            ]);
        }

        console.log('Seeding some appointments for trends...');
        // Get some patient IDs (assuming robust_seed might have created a super admin, but no patients)
        // Let's create a few dummy patients first
        const { data: roleData } = await supabase.from('roles').select('id').eq('name', 'PATIENT').single();
        const patientRoleId = roleData?.id || 1;

        for (let i = 0; i < 10; i++) {
            const phone = `900000000${i}`;
            const email = `patient${i}@example.com`;

            // Create user
            const { data: user, error: userError } = await supabase.from('users').insert({
                email,
                phone,
                password_hash: 'dummy',
                role_id: patientRoleId,
                is_verified: true
            }).select('id').single();

            if (user) {
                await supabase.from('patients').insert({
                    user_id: user.id,
                    patient_id: `PT${1000 + i}`,
                    full_name: `Patient ${i + 1}`,
                    dob: '1990-01-01',
                    gender: 'Male'
                });
            }
        }

        console.log('Data seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedData();
