require('dotenv').config();
const db = require('./db');

async function main() {
  await db.initDatabase();
  console.log('Cleaning up test users...');
  
  const [delUsers] = await db.query(
    "DELETE FROM users WHERE username IN ('SCS1353615', 'BNG9999')"
  );
  console.log('Deleted users:', delUsers.affectedRows);
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
