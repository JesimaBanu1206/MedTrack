
import dotenv from 'dotenv';
dotenv.config();
import { pool } from './src/config/database.js';


async function check() {
    try {
        console.log('--- Emergency Drivers ---');
        const drivers = await pool.query('SELECT * FROM emergency_drivers');
        console.table(drivers.rows);

        console.log('\n--- Users linked to Drivers ---');
        const users = await pool.query(`
            SELECT u.id, u.email, u.phone, u.role_id, ed.driver_name
            FROM users u
            JOIN emergency_drivers ed ON ed.user_id = u.id
        `);
        console.table(users.rows);

        console.log('\n--- All Users ---');
        const allUsers = await pool.query('SELECT id, email, phone, role_id FROM users LIMIT 10');
        console.table(allUsers.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
