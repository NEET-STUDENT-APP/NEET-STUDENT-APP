require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkQuestions() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    });

    const [exams] = await connection.query('SELECT id, name, is_released FROM exams');
    console.log('--- EXAMS ---');
    console.log(exams);

    for (const exam of exams) {
      const [questions] = await connection.query('SELECT COUNT(*) as count FROM questions WHERE exam_id = ?', [exam.id]);
      console.log(`Exam ${exam.id} (${exam.name}) has ${questions[0].count} questions.`);
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkQuestions();
