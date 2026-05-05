require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Request logging - MOVE TO TOP
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
console.log('Connecting to database host:', process.env.DB_HOST || 'localhost');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'galaxy_turf',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

// Initialize Database Table
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        booking_date DATE NOT NULL,
        booked_hours INT[] NOT NULL,
        total_amount INT NOT NULL,
        advance_paid INT NOT NULL,
        payment_utr VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
initDb();

// Routes
// 1. Get booked hours for a specific date
app.get('/api/bookings/hours', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const result = await pool.query(
      "SELECT booked_hours FROM bookings WHERE booking_date = $1 AND status != 'cancelled'",
      [date]
    );

    // Flatten array of arrays
    let allBookedHours = [];
    result.rows.forEach(row => {
      if (row.booked_hours) {
        allBookedHours.push(...row.booked_hours);
      }
    });

    res.json({ bookedHours: allBookedHours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Create a new booking
app.post('/api/bookings', async (req, res) => {
  console.log('Received booking request:', req.body);
  const { customer_name, customer_phone, booking_date, booked_hours, total_amount, advance_paid, payment_utr } = req.body;

  try {
    // Check for double booking
    const existing = await pool.query(
      "SELECT booked_hours FROM bookings WHERE booking_date = $1 AND status != 'cancelled'",
      [booking_date]
    );
    let allBookedHours = [];
    existing.rows.forEach(row => {
      if (row.booked_hours) allBookedHours.push(...row.booked_hours);
    });

    const isDoubleBooked = booked_hours.some(h => allBookedHours.includes(h));
    if (isDoubleBooked) {
      return res.status(400).json({ error: 'One or more selected slots are already booked. Please refresh and try again.' });
    }

    const newBooking = await pool.query(
      `INSERT INTO bookings 
      (customer_name, customer_phone, booking_date, booked_hours, total_amount, advance_paid, payment_utr, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked') RETURNING *`,
      [customer_name, customer_phone, booking_date, booked_hours, total_amount, advance_paid, payment_utr]
    );
    res.status(201).json(newBooking.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
