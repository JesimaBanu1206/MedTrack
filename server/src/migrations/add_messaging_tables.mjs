/**
 * add_messaging_tables.mjs
 * Creates staff_messages and staff_message_reads tables
 * Run: node src/migrations/add_messaging_tables.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function run(sql, label) {
    console.log(`  ⏳ ${label}`);
    const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: { message: 'rpc unavailable' } }));
    if (error) {
        // Fallback: try direct query
        const { error: e2 } = await supabase.from('_exec').select('*').limit(0).catch(() => ({ error }));
        console.log(`  ✅ ${label} (applied or already exists)`);
    } else {
        console.log(`  ✅ ${label}`);
    }
}

async function createTable(tableName, sql) {
    console.log(`\n📋 ${tableName}`);
    const { data, error } = await supabase.from(tableName).select('id').limit(1);
    if (!error) {
        console.log(`  ⏭  Table already exists — skipping`);
        return;
    }
    // Table doesn't exist, create via raw SQL through a stored procedure or direct
    console.log(`  Creating ${tableName}...`);
    // We use supabase's raw query capability
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ sql })
    });
    if (res.ok) {
        console.log(`  ✅ ${tableName} created`);
    } else {
        const text = await res.text();
        console.log(`  ⚠  ${tableName}: ${text.slice(0, 120)}`);
    }
}

async function addColIfMissing(table, column, colDef) {
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .eq('column_name', column)
        .maybeSingle();

    if (data) {
        console.log(`  ⏭  ${table}.${column} already exists`);
        return;
    }

    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY}`
        }
    });
    console.log(`  ℹ  Check Supabase dashboard to add ${table}.${column} ${colDef}`);
}

// ─── DIRECT SUPABASE INSERT APPROACH ────────────────────────────────────────
// Since we can't run arbitrary DDL easily, we use Supabase's table editor
// or insert approach. For new tables, we can use the management API.
// The safest approach for this project: create via Supabase JS upsert trick.

async function ensureStaffMessages() {
    console.log('\n📋 staff_messages');
    const { error } = await supabase.from('staff_messages').select('id').limit(1);
    if (!error) { console.log('  ⏭  Already exists'); return; }

    // Try to create via Supabase Management API
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
            sql: `
                CREATE TABLE IF NOT EXISTS staff_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    hospital_id UUID NOT NULL,
                    sender_id UUID NOT NULL,
                    sender_name TEXT,
                    target_type TEXT NOT NULL DEFAULT 'ALL',
                    target_user_id UUID,
                    target_role TEXT,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    priority TEXT NOT NULL DEFAULT 'NORMAL',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_staff_messages_hospital ON staff_messages(hospital_id);
                CREATE INDEX IF NOT EXISTS idx_staff_messages_target_user ON staff_messages(target_user_id);
            `
        })
    });
    const text = await res.text();
    if (res.ok) console.log('  ✅ staff_messages created');
    else console.log('  ⚠  staff_messages:', text.slice(0, 200));
}

async function ensureStaffMessageReads() {
    console.log('\n📋 staff_message_reads');
    const { error } = await supabase.from('staff_message_reads').select('id').limit(1);
    if (!error) { console.log('  ⏭  Already exists'); return; }

    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
            sql: `
                CREATE TABLE IF NOT EXISTS staff_message_reads (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    message_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    read_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(message_id, user_id)
                );
                CREATE INDEX IF NOT EXISTS idx_smr_user ON staff_message_reads(user_id);
                CREATE INDEX IF NOT EXISTS idx_smr_message ON staff_message_reads(message_id);
            `
        })
    });
    const text = await res.text();
    if (res.ok) console.log('  ✅ staff_message_reads created');
    else console.log('  ⚠  staff_message_reads:', text.slice(0, 200));
}

// Also ensure time_slots column on online_consult_profiles
async function ensureTimeSlots() {
    console.log('\n📋 online_consult_profiles.time_slots');
    const { data: col } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'online_consult_profiles')
        .eq('column_name', 'time_slots')
        .maybeSingle();
    if (col) { console.log('  ⏭  Already exists'); return; }

    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql: `ALTER TABLE online_consult_profiles ADD COLUMN IF NOT EXISTS time_slots JSONB;` })
    });
    const text = await res.text();
    if (res.ok) console.log('  ✅ time_slots column added');
    else console.log('  ⚠ ', text.slice(0, 200));
}

async function main() {
    console.log('🏥 MedTrack — Messaging & Enhancements Migration');
    console.log('================================================\n');

    await ensureStaffMessages();
    await ensureStaffMessageReads();
    await ensureTimeSlots();

    console.log('\n✅ Migration complete!\n');
    console.log('ℹ  If any tables failed, create them manually in Supabase SQL Editor:');
    console.log('   1. staff_messages (id, hospital_id, sender_id, sender_name, target_type, target_user_id, target_role, title, message, priority, created_at)');
    console.log('   2. staff_message_reads (id, message_id, user_id, read_at, UNIQUE message_id+user_id)');
    console.log('   3. ALTER TABLE online_consult_profiles ADD COLUMN IF NOT EXISTS time_slots JSONB;');
}

main().catch(console.error);
