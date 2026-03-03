import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

if (!config.database.supabaseUrl || !config.database.supabaseKey) {
    console.error('Missing Supabase URL or Key in environment variables');
    process.exit(1);
}

// Create a single supabase client for interacting with your database
const supabase = createClient(config.database.supabaseUrl, config.database.supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default supabase;
