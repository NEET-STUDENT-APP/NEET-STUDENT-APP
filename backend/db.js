const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let pool = null;

async function initDatabase() {
  console.log('Initializing database connection to host:', process.env.DB_HOST);
  
  // 1. Establish connection to create DB if it doesn't exist
  const initConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await initConnection.end();

  // 2. Create the connection pool using the created/verified database
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // 3. Initialize tables
  const conn = await pool.getConnection();
  try {
    console.log('Creating database tables if not exist...');
    
    // Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Student profiles
    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        scs_number VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL,
        section VARCHAR(100) NOT NULL,
        campus VARCHAR(100) NOT NULL,
        parent_mobile VARCHAR(20) NOT NULL,
        approved_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Staff profiles
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        bng_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        subject VARCHAR(50) NOT NULL,
        dean VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        section VARCHAR(100) NOT NULL,
        campus VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        approved_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Exams
    await conn.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        test_type VARCHAR(20) NOT NULL,
        exam_date DATE NULL,
        folder_path VARCHAR(255) NOT NULL,
        is_released BOOLEAN DEFAULT FALSE,
        released_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Questions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        q_no INT NOT NULL,
        subject VARCHAR(50) NOT NULL,
        correct_key INT NOT NULL,
        image_url VARCHAR(255) DEFAULT NULL,
        UNIQUE KEY uq_exam_q (exam_id, q_no),
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Alter table migration for image_url if already exists
    try {
      await conn.query(`ALTER TABLE questions ADD COLUMN image_url VARCHAR(255) DEFAULT NULL`);
      console.log('Successfully altered questions table: Added column "image_url".');
    } catch (e) {
      // Column already exists, ignore
    }

    // Submissions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        exam_id INT NOT NULL,
        score INT NOT NULL,
        correct_count INT NOT NULL,
        wrong_count INT NOT NULL,
        unattempted_count INT NOT NULL,
        time_spent INT NOT NULL,
        answers_json LONGTEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Reattempts
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reattempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id INT NOT NULL,
        student_id INT NOT NULL,
        exam_id INT NOT NULL,
        q_no INT NOT NULL,
        reason TEXT NOT NULL,
        selected_key INT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        reattempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // WhatsApp logs
    await conn.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_mobile VARCHAR(20) NOT NULL,
        message_text TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'logged',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables verified/created successfully.');

    // Seed default HOD Admin
    const adminEmail = 'yenjarappa.s@varsitymgmt.com';
    const [existingAdmin] = await conn.query('SELECT * FROM users WHERE username = ?', [adminEmail]);
    if (existingAdmin.length === 0) {
      console.log('Seeding default HOD Admin account...');
      const hashedPassword = await bcrypt.hash('Neet@123#', 10);
      const [res] = await conn.query(
        'INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
        [adminEmail, hashedPassword, 'hod', 'approved']
      );
      console.log('Default HOD Admin created with user ID:', res.insertId);
    } else {
      console.log('Default HOD Admin account already exists.');
    }

  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  } finally {
    conn.release();
  }
}

function query(sql, params) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool.query(sql, params);
}

function getPool() {
  return pool;
}

module.exports = {
  initDatabase,
  query,
  getPool
};
