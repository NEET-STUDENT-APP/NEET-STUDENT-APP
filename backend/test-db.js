require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Connecting to TiDB Host:', process.env.DB_HOST);
  try {
    // 1. Connect without database first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'sys',
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('Successfully connected to TiDB!');
    
    // Check databases
    const [rows] = await connection.query('SHOW DATABASES');
    console.log('Databases available:', rows.map(r => r.Database));

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    console.log(`Database '${process.env.DB_NAME}' verified/created.`);

    await connection.end();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error connecting to TiDB:', error);
  }
}

testConnection();
