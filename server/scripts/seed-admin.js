import '../src/utils/dnsOptimizer.js';
import bcrypt from 'bcryptjs';
import supabase from '../src/config/supabase.js';

const adminData = {
    username: 'superadmin',
    email: 'admin@tnhealth.gov.in',
    phone: '9999999999',
    password: 'Password@123',
    role_id: 6, // SUPER_ADMIN
    is_verified: true,
    is_active: true
};

async function seedAdmin() {
    console.log('🚀 Starting Super Admin seeding...');

    try {
        console.log('1. Hashing password...');
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(adminData.password, salt);
        console.log('2. Password hashed.');

        console.log('3. Checking role...');
        const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('id', 6)
            .single();
        console.log('4. Role check complete.', roleError ? 'Error: ' + roleError.message : 'Success');

        if (!role) {
            console.log('⚠️ Role ID 6 not found, creating SUPER_ADMIN role...');
            await supabase.from('roles').upsert({ id: 6, name: 'SUPER_ADMIN' });
        }

        console.log('5. Attempting upsert with username...');
        let { data: user, error } = await supabase
            .from('users')
            .upsert({
                username: adminData.username,
                email: adminData.email,
                phone: adminData.phone,
                password_hash: passwordHash,
                role_id: adminData.role_id,
                is_verified: adminData.is_verified,
                is_active: adminData.is_active
            }, { onConflict: 'email' })
            .select()
            .single();
        console.log('6. Upsert with username complete.', error ? 'Error: ' + error.message : 'Success');

        if (error) {
            if (error.message?.includes('username') && (error.message?.includes('not exist') || error.message?.includes('schema cache'))) {
                console.warn('⚠️ Username column missing from database/cache, seeding with email/phone only...');
                const fallback = await supabase
                    .from('users')
                    .upsert({
                        email: adminData.email,
                        phone: adminData.phone,
                        password_hash: passwordHash,
                        role_id: adminData.role_id,
                        is_verified: adminData.is_verified,
                        is_active: adminData.is_active
                    }, { onConflict: 'email' })
                    .select()
                    .single();
                error = fallback.error;
                console.log('7. Fallback upsert complete.', error ? 'Error: ' + error.message : 'Success');
            }
        }

        if (error) {
            throw error;
        }

        console.log('✅ Super Admin seeded successfully!');
        console.log('Username:', adminData.username);
        console.log('Password:', adminData.password);

    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        if (err.details) console.error('Details:', err.details);
    }
}

seedAdmin();
