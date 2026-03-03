import supabase from './src/config/supabase.js';
import bcrypt from 'bcryptjs';

async function seedSuperAdmin() {
    const adminEmail = 'admin@tnhealth.gov.in';
    const adminPassword = 'SuperSecurePassword@2026'; // Change this in production
    const adminUsername = 'superadmin';
    const adminPhone = '0000000000'; // Dummy phone for admin

    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', adminEmail)
        .single();

    if (existingUser) {
        console.log('Super Admin already exists.');
        return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
            email: adminEmail,
            phone: adminPhone,
            username: adminUsername, // Migration added this column
            password_hash: passwordHash,
            role_id: 6, // SUPER_ADMIN
            is_verified: true,
            is_active: true
        })
        .select()
        .single();

    if (createError) {
        console.error('Error creating super admin:', createError);
        return;
    }

    console.log('✅ Super Admin created successfully:', newUser.id);
}

seedSuperAdmin();
