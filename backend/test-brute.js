const mysql = require('mysql2/promise');

const host = 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com';
const port = 4000;
const user = 'BN9g9KwP2SU7dzo.root';

// Build a list of candidate passwords based on visual similarity
const bases = ['ffrgxm5qdQRLXzf1'];
const replacements = [
  // replace last char 1/l/I/t/L
  (p) => [p, p.replace(/1$/, 'l'), p.replace(/1$/, 'I'), p.replace(/1$/, 'L'), p.replace(/1$/, 't'), p.slice(0, -1)],
  // replace 5 with S/s
  (p) => [p, p.replace('5', 'S'), p.replace('5', 's')],
  // replace L with 1/l/i
  (p) => [p, p.replace('L', '1'), p.replace('L', 'l'), p.replace('L', 'i')],
  // replace q with g or d with o
  (p) => [p, p.replace('q', 'g'), p.replace('d', 'o')]
];

let candidates = new Set(bases);

for (const fn of replacements) {
  const nextSet = new Set();
  for (const c of candidates) {
    const outputs = fn(c);
    for (const o of outputs) {
      nextSet.add(o);
    }
  }
  candidates = nextSet;
}

const list = Array.from(candidates);
console.log(`Generated ${list.length} candidate passwords to test.`);

async function run() {
  for (let i = 0; i < list.length; i++) {
    const pwd = list[i];
    if (i % 10 === 0) {
      console.log(`Progress: tried ${i}/${list.length}...`);
    }
    try {
      const conn = await mysql.createConnection({
        host,
        port,
        user,
        password: pwd,
        database: 'sys',
        ssl: { rejectUnauthorized: false }
      });
      console.log(`!!! SUCCESS WITH PASSWORD: ${pwd}`);
      await conn.end();
      return;
    } catch (e) {
      // If it's not an access denied error, but some network/SSL error, log it
      if (e.code !== 'ER_ACCESS_DENIED_ERROR') {
        console.log(`Other error for ${pwd}:`, e.message);
      }
    }
  }
  console.log('All candidate passwords failed.');
}

run();
