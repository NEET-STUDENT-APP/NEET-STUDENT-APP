const mysql = require('mysql2/promise');

const host = 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com';
const port = 4000;
const user = 'BN9g9KwP2SU7dzo.root';
const pwd = 'ffrgxm5qdQRLXzf1';

async function run() {
  console.log('Connecting without SSL...');
  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password: pwd,
      database: 'sys',
      ssl: false
    });
    console.log('SUCCESS! Connected without SSL!');
    await conn.end();
  } catch (e) {
    console.log('Error without SSL:', e.message);
  }
}

run();
