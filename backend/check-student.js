require('dotenv').config();
const db = require('./db');

async function main() {
  await db.initDatabase();
  const [users] = await db.query('SELECT * FROM users WHERE username = ?', ['SCS1353615']);
  console.log('Users found for SCS1353615:', users);

  if (users.length > 0) {
    const [studentProfiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [users[0].id]);
    console.log('Student Profiles found for user ID:', users[0].id, ':', studentProfiles);
    
    const [staffProfiles] = await db.query('SELECT * FROM staff_profiles WHERE user_id = ?', [users[0].id]);
    console.log('Staff Profiles found for user ID:', users[0].id, ':', staffProfiles);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
