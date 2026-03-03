import supabase from './src/config/supabase.js';

async function checkRoles() {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) {
        console.error('Error fetching roles:', error);
        return;
    }
    console.log('Roles:', data);
}

checkRoles();
