const mysql = require('mysql2/promise');

const host = 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com';
const port = 4000;

// Username variations
const usernames = [
  'BN9g9KwP2SU7dzo.root',
  'BN9g9KwP2SU7dzo.root'.replace('2', 'Z'),
  'BN9g9KwP2SU7dzo.root'.replace('2', 'z'),
  'BN9g9KwP2SU7dzo.root'.replace('7', 'T'),
  'BN9g9KwP2SU7dzo.root'.replace('o', '0'),
  'BN9g9KwP2SU7dzo.root'.replace('o', 'O'),
  'BN9g9KwP2SU7dzo.root'.replace('2SU7', '2sU7'),
  'BN9g9KwP2SU7dzo.root'.replace('2SU7', '2Su7'),
  'BN9g9KwP2SU7dzo.root'.replace('KwP', 'Kwp'),
];

// Password variations
const passwords = [
  'ffrgxm5qdQRLXzf1',
  'ffrgxm5qdQRLXzfl',
  'ffrgxm5qdQRLXzfI',
  'ffrgxm5qdQRLXzfL',
  'ffrgxm5qdQRLXzf',
  'ffrgxm5qdQRLXzft',
  'ffrgxm5qdQRLXzfl1',
  'ffrgxm5qdQRLXzf11',
  'ffrgxm5qdQRLXzflI',
  'ffrgxm5qdQRLXzfI1',
];

const uniqueUsers = Array.from(new Set(usernames));
const uniquePwds = Array.from(new Set(passwords));

console.log(`Testing ${uniqueUsers.length} username variants and ${uniquePwds.length} password variants. Total: ${uniqueUsers.length * uniquePwds.length} combinations.`);

async function run() {
  for (const user of uniqueUsers) {
    for (const pwd of uniquePwds) {
      try {
        const conn = await mysql.createConnection({
          host,
          port,
          user,
          password: pwd,
          database: 'sys',
          ssl: { rejectUnauthorized: false }
        });
        console.log(`\n!!! SUCCESS !!!`);
        console.log(`Username: ${user}`);
        console.log(`Password: ${pwd}`);
        const [rows] = await conn.query('SHOW DATABASES');
        console.log('Databases:', rows.map(r => r.Database));
        await conn.end();
        return;
      } catch (e) {
        if (e.code !== 'ER_ACCESS_DENIED_ERROR') {
          console.log(`Other error for ${user} / ${pwd}: ${e.message}`);
        }
      }
    }
  }
  console.log('All combinations failed.');
}

run();
