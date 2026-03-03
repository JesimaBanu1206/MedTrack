import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000 // Increased for slower networks
});

pool.on('connect', () => {
    console.log('✅ Database connection established');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err.message);
    // Do NOT exit the process, let the pool handle reconnection
});

// Test connection
export const testConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('📊 Database time:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};
