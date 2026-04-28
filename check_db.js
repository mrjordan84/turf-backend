require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function checkDb() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables in database:", res.rows.map(r => r.table_name));
    
    const bookings = await pool.query("SELECT * FROM bookings");
    console.log("\nRecent Bookings Count:", bookings.rows.length);
    console.log("Latest Booking:", bookings.rows[bookings.rows.length - 1]);
  } catch (err) {
    console.error("Database check failed:", err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
