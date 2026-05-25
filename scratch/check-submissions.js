require('dotenv').config({ path: '../backend/.env' });
const db = require('../backend/db');

async function checkSubmissions() {
  try {
    await db.initDatabase();
    const [rows] = await db.query('SELECT s.*, p.name FROM submissions s JOIN student_profiles p ON s.student_id = p.user_id ORDER BY s.submitted_at DESC LIMIT 5');
    console.log('Latest Submissions:', JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSubmissions();
