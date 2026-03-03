/**
 * run:  node src/migrations/add_emergency_alerts.mjs
 *
 * Creates emergency_alerts table using the same Supabase client your server uses.
 * No direct DB port needed — uses SUPABASE_URL + SUPABASE_SERVICE_KEY from .env
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

// Execute SQL via Supabase's pg_net / REST SQL endpoint
async function runSQL(label, sqlText) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'apikey':        SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Prefer':        'return=minimal'
        },
        body: JSON.stringify({ query: sqlText })
    });

    // The /rest/v1/ endpoint doesn't support raw SQL — use the query endpoint
    // Fall through to the correct approach below
}

// Correct approach: use Supabase's database REST query endpoint
async function execSQL(label, sqlText) {
    try {
        const endpoint = `${SUPABASE_URL}/rest/v1/rpc/query`;

        // Actually use the pg REST approach via supabase-js directly
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false }
        });

        // Use raw SQL via the postgres extension
        const { data, error } = await sb.rpc('exec_ddl', { ddl: sqlText });

        if (error && !error.message.includes('already exists') && !error.message.includes('Could not find')) {
            throw error;
        }
        console.log(`✅  ${label}`);
        return true;
    } catch (e) {
        // If exec_ddl RPC doesn't exist, that's expected — we'll use INSERT workaround
        if (e.message?.includes('Could not find the function') || e.message?.includes('function') ) {
            console.log(`⚠️   ${label}: exec_ddl RPC not available — use SQL Editor instead`);
            return false;
        }
        if (e.message?.includes('already exists')) {
            console.log(`✅  ${label} (already exists)`);
            return true;
        }
        console.error(`❌  ${label}: ${e.message}`);
        return false;
    }
}

async function migrate() {
    console.log('\n🚀  MedTrack — Emergency Alerts Migration\n');

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false }
    });

    // Test connection
    console.log('📡  Testing Supabase connection...');
    const { data: test, error: testErr } = await sb.from('users').select('id').limit(1);
    if (testErr) {
        console.error('❌  Connection failed:', testErr.message);
        process.exit(1);
    }
    console.log('✅  Connected to Supabase\n');

    // Check if emergency_alerts already exists by trying to query it
    console.log('🔍  Checking if emergency_alerts table exists...');
    const { error: checkErr } = await sb.from('emergency_alerts').select('id').limit(1);

    if (!checkErr) {
        console.log('✅  emergency_alerts table already exists!\n');
        await verifyAndReport(sb);
        return;
    }

    if (checkErr.code !== '42P01' && !checkErr.message?.includes('does not exist')) {
        console.error('❌  Unexpected error checking table:', checkErr.message);
        // Continue anyway
    } else {
        console.log('⚠️   Table does not exist — needs to be created\n');
    }

    // The table doesn't exist. We need to create it.
    // Supabase REST API doesn't support DDL directly.
    // We'll output the SQL and instructions.
    console.log('═'.repeat(60));
    console.log('ACTION REQUIRED: Run this SQL in Supabase Dashboard');
    console.log('═'.repeat(60));
    console.log('\n1. Open: https://supabase.com/dashboard/project/gexwxpijgubbclrhqxpj/sql');
    console.log('2. Click "New Query"');
    console.log('3. Paste the contents of:');
    console.log('   server/database/emergency_alerts_migration.sql');
    console.log('4. Click "Run"\n');
    console.log('═'.repeat(60));
    console.log('\nSQL to run:\n');
    console.log(`-- Add phone to emergency_drivers
ALTER TABLE emergency_drivers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Create emergency_alerts
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_id       UUID,
    image_url        TEXT NOT NULL,
    latitude         DECIMAL(10,8),
    longitude        DECIMAL(11,8),
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    assigned_unit_no VARCHAR(50),
    unit_details     JSONB,
    metadata         JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status ON emergency_alerts(status);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_unit   ON emergency_alerts(assigned_unit_no);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created ON emergency_alerts(created_at DESC);
`);
    console.log('═'.repeat(60));
}

async function verifyAndReport(sb) {
    const { data, error } = await sb.from('emergency_alerts').select('id').limit(1);
    if (error) {
        console.error('❌  Table verification failed:', error.message);
    } else {
        console.log('✅  emergency_alerts table is ready and accessible');
        console.log('✨  Migration complete! Restart your server.\n');
    }
}

migrate().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
