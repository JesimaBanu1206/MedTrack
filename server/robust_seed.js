import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing environment variables. Make sure server/.env exists.');
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function seed() {
    console.log('Seeding Super Admin...');
    const adminEmail = 'admin@tnhealth.gov.in';
    const adminPassword = 'Password@123';

    // Check if role exists
    const { data: role } = await supabase.from('roles').select('id').eq('name', 'SUPER_ADMIN').single();
    if (!role) {
        console.error('SUPER_ADMIN role not found');
        return;
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(adminPassword, salt);

    const { data: user, error } = await supabase.from('users').upsert({
        email: adminEmail,
        phone: '0000000000',
        password_hash: hash,
        role_id: role.id,
        is_verified: true,
        is_active: true
    }, { onConflict: 'email' }).select().single();

    if (error) {
        console.error('Error seeding admin:', error);
    } else {
        console.log('✅ Super Admin seeded:', user.email);
        console.log('Login: admin@tnhealth.gov.in / Password@123');
    }
}

seed();
