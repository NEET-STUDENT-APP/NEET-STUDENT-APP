const mysql = require('mysql2/promise');

const host = 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com';
const port = 4000;
const user = 'BN9g9KwP2SU7dzo.root';
const pwd = 'ffrgxm5qdQRLXzf1';

const dbs = ['test', 'sys', 'mysql', ''];

async function run() {
  for (const db of dbs) {
    console.log(`Connecting with database: "${db}"`);
    try {
      const connConfig = {
        host,
        port,
        user,
        password: pwd,
        ssl: { rejectUnauthorized: false }
      };
      if (db) {
        connConfig.database = db;
      }
      const conn = await mysql.createConnection(connConfig);
      console.log(`SUCCESS! Connected with database "${db}"`);
      const [rows] = await conn.query('SHOW DATABASES');
      console.log('Available databases:', rows.map(r => r.Database));
      await conn.end();
      return;
    } catch (e) {
      console.log(`Failed for database "${db}": ${e.message}`);
    }
  }
}

run();
