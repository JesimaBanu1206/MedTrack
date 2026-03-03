
import dotenv from 'dotenv';
dotenv.config();
import { pool } from './src/config/database.js';

async function check() {
    try {
        console.log('--- Roles ---');
        const roles = await pool.query('SELECT * FROM roles');
        console.table(roles.rows);

        console.log('\n--- Emergency Drivers ---');
        const drivers = await pool.query('SELECT * FROM emergency_drivers');
        console.table(drivers.rows);

        console.log('\n--- Users ---');
        const users = await pool.query('SELECT id, email, phone, role_id FROM users');
        console.table(users.rows);

        console.log('\n--- Drivers with LEFT JOIN Users ---');
        const joined = await pool.query(`
            SELECT ed.id as driver_id, ed.user_id, u.id as user_id_in_table, u.email
            FROM emergency_drivers ed
            LEFT JOIN users u ON u.id = ed.user_id
        `);
        console.table(joined.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
