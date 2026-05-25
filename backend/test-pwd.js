require('dotenv').config();
const mysql = require('mysql2/promise');

const variants = [
  'ffrgxm5qdQRLXzf1', // original
  'ffrgxm5qdQRLXzfl', // lowercase L
  'ffrgxm5qdQRLXzfI', // uppercase I
];

async function testAll() {
  for (const pwd of variants) {
    console.log(`Trying password: ${pwd}`);
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: pwd,
        database: 'sys',
        ssl: {
          rejectUnauthorized: false
        }
      });
      console.log(`SUCCESS with password: ${pwd}`);
      const [rows] = await connection.query('SHOW DATABASES');
      console.log('Databases:', rows.map(r => r.Database));
      await connection.end();
      return;
    } catch (e) {
      console.log(`Failed for ${pwd}: ${e.message}`);
    }
  }
}

testAll();
