const db = require('../db');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Utility to parse date from exam folder name (e.g. "Sr Elite (incoming) NEET WET-01 (07-04-25)")
function parseExamDate(folderName) {
  const match = folderName.match(/\((\d{2})[-/](\d{2})[-/](\d{2,4})\)/);
  if (match) {
    let day = match[1];
    let month = match[2];
    let year = match[3];
    if (year.length === 2) {
      year = '20' + year; // Convert 25 to 2025
    }
    return `${year}-${month}-${day}`; // ISO format for MySQL
  }
  return null;
}

// 1. Scan and auto-ingest exams from the local folder
exports.scanAndIngestExams = async (req, res) => {
  const examsDir = process.env.EXAMS_DIR || path.resolve(__dirname, '..', 'Exams');
  console.log('Scanning Exams directory:', examsDir);
  
  try {
    if (!fs.existsSync(examsDir)) {
      return res.status(404).json({ message: `Exams directory not found at: ${examsDir}` });
    }

    const testTypes = fs.readdirSync(examsDir).filter(f => fs.statSync(path.join(examsDir, f)).isDirectory());
    const ingested = [];
    const skipped = [];
    const errors = [];

    for (const testType of testTypes) {
      const typePath = path.join(examsDir, testType);
      const examFolders = fs.readdirSync(typePath).filter(f => fs.statSync(path.join(typePath, f)).isDirectory());

      for (const examFolder of examFolders) {
        const examPath = path.join(typePath, examFolder);
        const keyFilePath = path.join(examPath, 'Key.xlsx');

        if (!fs.existsSync(keyFilePath)) {
          skipped.push({ name: examFolder, reason: 'Key.xlsx not found' });
          continue;
        }

        // Check if exam already exists in database
        const [existing] = await db.query('SELECT * FROM exams WHERE name = ?', [examFolder]);
        if (existing.length > 0) {
          skipped.push({ name: examFolder, reason: 'Already ingested' });
          continue;
        }

        // Begin ingestion of this exam
        console.log(`Ingesting new exam: ${examFolder}`);
        const examDate = parseExamDate(examFolder);
        const connection = await db.getPool().getConnection();
        
        try {
          await connection.beginTransaction();

          // A. Insert exam
          const [examResult] = await connection.query(
            `INSERT INTO exams (name, test_type, exam_date, folder_path) VALUES (?, ?, ?, ?)`,
            [examFolder, testType.toUpperCase(), examDate, examPath]
          );
          
          const examId = examResult.insertId;

          // B. Parse Key.xlsx
          const workbook = xlsx.readFile(keyFilePath);
          const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'key');
          if (!sheetName) {
            throw new Error(`Sheet named "Key" not found in Key.xlsx of ${examFolder}`);
          }
          const sheet = workbook.Sheets[sheetName];
          const rows = xlsx.utils.sheet_to_json(sheet); // Columns: SUBJECT, Q_No, Key

          // C. Insert questions
          for (const row of rows) {
            const subject = (row['SUBJECT'] || '').trim().toUpperCase();
            const qNo = parseInt(row['Q_No']);
            const keyVal = parseInt(row['Key']);

            if (!subject || isNaN(qNo) || isNaN(keyVal)) {
              throw new Error(`Invalid row in key file: ${JSON.stringify(row)}`);
            }

            let imageUrl = null;
            const imagePath = path.join(examPath, `Q${qNo}.png`);
            if (fs.existsSync(imagePath) && process.env.IMGBB_API_KEY) {
              try {
                const base64Image = fs.readFileSync(imagePath).toString('base64');
                const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({ 
                    image: base64Image,
                    name: `${examFolder}_Q${qNo}`
                  })
                });
                const uploadData = await uploadRes.json();
                if (uploadData && uploadData.data && uploadData.data.url) {
                  imageUrl = uploadData.data.url;
                  console.log(`Uploaded Q${qNo}.png successfully to imgbb: ${imageUrl}`);
                } else {
                  console.error(`Failed to upload Q${qNo}.png to imgbb:`, JSON.stringify(uploadData));
                }
              } catch (uploadErr) {
                console.error(`Error uploading Q${qNo}.png to imgbb:`, uploadErr.message);
              }
            }

            await connection.query(
              `INSERT INTO questions (exam_id, q_no, subject, correct_key, image_url) VALUES (?, ?, ?, ?, ?)`,
              [examId, qNo, subject, keyVal, imageUrl]
            );
          }

          await connection.commit();
          ingested.push({ name: examFolder, questionsCount: rows.length });
          console.log(`Ingested successfully: ${examFolder}`);
        } catch (err) {
          await connection.rollback();
          console.error(`Failed to ingest ${examFolder}:`, err.message);
          errors.push({ name: examFolder, error: err.message });
        } finally {
          connection.release();
        }
      }
    }

    res.json({
      message: 'Exam scanning completed.',
      ingested,
      skipped,
      errors
    });

  } catch (error) {
    res.status(500).json({ message: 'Error scanning exams folder.', error: error.message });
  }
};

// 2. Retrieve all released exams (for students)
exports.getReleasedExams = async (req, res) => {
  try {
    const [exams] = await db.query(
      'SELECT id, name, test_type, exam_date, released_at FROM exams WHERE is_released = TRUE ORDER BY exam_date DESC, id DESC'
    );
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching released exams.', error: error.message });
  }
};

// 3. Retrieve all exams (for HOD / Staff)
exports.getAllExams = async (req, res) => {
  try {
    const [exams] = await db.query(
      'SELECT id, name, test_type, exam_date, is_released, released_at FROM exams ORDER BY exam_date DESC, id DESC'
    );
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching exams.', error: error.message });
  }
};

// 4. HOD: Release an exam
exports.releaseExam = async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId) {
      return res.status(400).json({ message: 'Exam ID is required.' });
    }

    await db.query(
      'UPDATE exams SET is_released = TRUE, released_at = NOW() WHERE id = ?',
      [examId]
    );

    res.json({ message: 'Exam released successfully. Staff can now notify students.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to release exam.', error: error.message });
  }
};

// 5. Get exam metadata & question headers (Without correct key answers for security)
exports.getExamDetails = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Check if exam is released
    const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
    if (exams.length === 0) {
      return res.status(404).json({ message: 'Exam not found.' });
    }
    
    const exam = exams[0];
    
    // Get question headers (Saves subject mapping and image URLs)
    const [questions] = await db.query(
      'SELECT q_no, subject, image_url FROM questions WHERE exam_id = ? ORDER BY q_no ASC',
      [examId]
    );

    res.json({
      exam: {
        id: exam.id,
        name: exam.name,
        test_type: exam.test_type,
        exam_date: exam.exam_date
      },
      questions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching exam details.', error: error.message });
  }
};

// 6. Serve question image dynamically
exports.serveQuestionImage = async (req, res) => {
  try {
    const { examId, qNo } = req.params;
    
    const [exams] = await db.query('SELECT folder_path FROM exams WHERE id = ?', [examId]);
    if (exams.length === 0) {
      return res.status(404).json({ message: 'Exam not found.' });
    }
    
    const folderPath = exams[0].folder_path;
    const imagePath = path.join(folderPath, `Q${qNo}.png`);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: `Image for Question ${qNo} not found.` });
    }

    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching question image.', error: error.message });
  }
};

// 7. Student: Submit exam answers and score immediately
exports.submitExam = async (req, res) => {
  try {
    const { examId, studentId, answers } = req.body; // answers: { "1": { selected: 2, time_spent_sec: 12 }, ... }
    
    if (!examId || !studentId || !answers) {
      return res.status(400).json({ message: 'Exam ID, Student ID, and Answers are required.' });
    }

    // 1. Fetch correct answers from DB
    const [questions] = await db.query(
      'SELECT q_no, subject, correct_key FROM questions WHERE exam_id = ?',
      [examId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Questions not found for this exam.' });
    }

    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;
    let totalTimeSpent = 0;

    const scoredAnswers = {};

    questions.forEach(q => {
      const qNo = q.q_no;
      const correctKey = q.correct_key;
      const clientAns = answers[qNo.toString()];

      let selected = null;
      let timeSpent = 0;

      if (clientAns) {
        selected = clientAns.selected;
        timeSpent = clientAns.time_spent_sec || 0;
        totalTimeSpent += timeSpent;
      }

      if (selected === null || selected === undefined || selected === 0) {
        unattemptedCount++;
        scoredAnswers[qNo] = {
          selected: null,
          time_spent_sec: timeSpent,
          is_correct: false,
          is_attempted: false
        };
      } else {
        const isCorrect = (parseInt(selected) === correctKey);
        if (isCorrect) {
          correctCount++;
        } else {
          wrongCount++;
        }
        scoredAnswers[qNo] = {
          selected: parseInt(selected),
          time_spent_sec: timeSpent,
          is_correct: isCorrect,
          is_attempted: true
        };
      }
    });

    // Score: correct (+4), incorrect (-1), unattempted (0)
    const score = (correctCount * 4) - wrongCount;

    // Save submission to database
    const [result] = await db.query(
      `INSERT INTO submissions (student_id, exam_id, score, correct_count, wrong_count, unattempted_count, time_spent, answers_json) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, examId, score, correctCount, wrongCount, unattemptedCount, totalTimeSpent, JSON.stringify(scoredAnswers)]
    );

    res.status(201).json({
      message: 'Exam submitted successfully.',
      submissionId: result.insertId,
      score,
      correctCount,
      wrongCount,
      unattemptedCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Exam submission failed.', error: error.message });
  }
};

// 8. Get specific student report for an exam submission
exports.getReport = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    // Get submission
    const [submissions] = await db.query(
      `SELECT s.*, e.name as exam_name, e.test_type, e.exam_date, p.name as student_name, p.scs_number, p.category, p.section, p.campus 
       FROM submissions s 
       JOIN exams e ON s.exam_id = e.id 
       JOIN student_profiles p ON s.student_id = p.user_id 
       WHERE s.id = ?`,
      [submissionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Report/Submission not found.' });
    }

    const sub = submissions[0];

    // Fetch matching staff based on section, category, campus
    const [staffList] = await db.query(
      `SELECT name, subject, mobile 
       FROM staff_profiles 
       WHERE category = ? AND section = ? AND campus = ?`,
      [sub.category, sub.section, sub.campus]
    );

    // Map staff to subjects
    const subjectStaff = {
      BOTANY: [],
      ZOOLOGY: [],
      PHYSICS: [],
      CHEMISTRY: [],
      BIOLOGY: []
    };

    staffList.forEach(st => {
      if (subjectStaff[st.subject]) {
        subjectStaff[st.subject].push(st.name);
      }
    });

    // Check for reattempts already completed for this submission
    const [reattempts] = await db.query(
      `SELECT q_no, reason, selected_key, is_correct, reattempted_at FROM reattempts WHERE submission_id = ? ORDER BY id DESC`,
      [submissionId]
    );

    // Fetch questions to merge image_url and subject
    const [questionsList] = await db.query(
      'SELECT q_no, subject, image_url FROM questions WHERE exam_id = ?',
      [sub.exam_id]
    );
    const questionMeta = {};
    questionsList.forEach(q => {
      questionMeta[q.q_no] = {
        subject: q.subject,
        image_url: q.image_url
      };
    });

    const parsedAnswers = JSON.parse(sub.answers_json);
    Object.keys(parsedAnswers).forEach(qNo => {
      const meta = questionMeta[qNo] || {};
      parsedAnswers[qNo].subject = meta.subject || '';
      parsedAnswers[qNo].image_url = meta.image_url || null;
    });

    res.json({
      submission: {
        id: sub.id,
        exam_id: sub.exam_id,
        exam_name: sub.exam_name,
        test_type: sub.test_type,
        exam_date: sub.exam_date,
        student_id: sub.student_id,
        student_name: sub.student_name,
        scs_number: sub.scs_number,
        category: sub.category,
        section: sub.section,
        campus: sub.campus,
        score: sub.score,
        correct_count: sub.correct_count,
        wrong_count: sub.wrong_count,
        unattempted_count: sub.unattempted_count,
        time_spent: sub.time_spent,
        submitted_at: sub.submitted_at,
        answers: parsedAnswers // Details of selected answers, correctness, times (no key answers)
      },
      staff: subjectStaff,
      reattempts
    });

  } catch (error) {
    res.status(500).json({ message: 'Error retrieving report.', error: error.message });
  }
};

function validateReason(text) {
  const reason = text.trim();
  if (reason.length < 15) {
    return { isValid: false, message: 'Explanation must be at least 15 characters.' };
  }

  if (/(.)\1{4,}/i.test(reason)) {
    return { isValid: false, message: 'Explanation contains too many repeated characters.' };
  }

  const cleanText = reason.replace(/[^a-zA-Z\s]/g, '');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  
  for (const word of words) {
    if (word.length >= 6) {
      if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/.test(word)) {
        return { isValid: false, message: 'Explanation contains invalid gibberish words.' };
      }
    }
  }

  const lettersOnly = cleanText.replace(/\s/g, '');
  if (lettersOnly.length > 0) {
    const vowels = lettersOnly.match(/[aeiouyAEIOUY]/g);
    const vowelCount = vowels ? vowels.length : 0;
    const vowelRatio = vowelCount / lettersOnly.length;
    if (vowelRatio < 0.15) {
      return { isValid: false, message: 'Explanation must contain real words.' };
    }
  }

  if (/[a-zA-Z]+\d+[a-zA-Z]+/i.test(reason) || /\b[a-zA-Z]{2,}\d{2,}\b/i.test(reason)) {
    return { isValid: false, message: 'Explanation cannot contain random mixed numbers.' };
  }

  return { isValid: true };
}

// 9. Reattempt a wrong or unattempted question (Requires a meaningful reason)
exports.submitReattempt = async (req, res) => {
  try {
    const { submissionId, qNo, reason, selectedKey } = req.body;

    if (!submissionId || !qNo || !reason || !selectedKey) {
      return res.status(400).json({ message: 'Submission ID, Question Number, Reason, and Selected Key are required.' });
    }

    const validation = validateReason(reason);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    // Get submission details to verify student ownership
    const [submissions] = await db.query('SELECT * FROM submissions WHERE id = ?', [submissionId]);
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Submission record not found.' });
    }

    const sub = submissions[0];

    // Fetch the correct key from questions database
    const [questions] = await db.query(
      'SELECT correct_key, subject FROM questions WHERE exam_id = ? AND q_no = ?',
      [sub.exam_id, qNo]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found in database.' });
    }

    const correctKey = questions[0].correct_key;
    const isCorrect = (parseInt(selectedKey) === correctKey);

    // Save reattempt record
    await db.query(
      `INSERT INTO reattempts (submission_id, student_id, exam_id, q_no, reason, selected_key, is_correct) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [submissionId, sub.student_id, sub.exam_id, qNo, reason.trim(), parseInt(selectedKey), isCorrect]
    );

    res.json({
      message: 'Reattempt submitted successfully.',
      isCorrect,
      correctKey: isCorrect ? correctKey : null
    });

  } catch (error) {
    res.status(500).json({ message: 'Reattempt failed.', error: error.message });
  }
};

// 10. Get all test submissions for the logged in student
exports.getSubmissionsForStudent = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const [reports] = await db.query(
      `SELECT s.id, s.score, s.correct_count, s.wrong_count, s.unattempted_count, 
              s.time_spent, s.submitted_at, s.exam_id, e.name as exam_name
       FROM submissions s
       JOIN exams e ON s.exam_id = e.id
       WHERE s.student_id = ?
       ORDER BY s.submitted_at DESC`,
      [studentId]
    );
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions.', error: error.message });
  }
};

// Background migrator to upload existing local images to imgbb
exports.migrateImagesToImgbb = async () => {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.log('[Imgbb Migrator] IMGBB_API_KEY is not set. Skipping background image migration.');
    return;
  }

  console.log('[Imgbb Migrator] Checking for questions missing ImgBB URLs...');
  try {
    const [questions] = await db.query(
      `SELECT q.id, q.q_no, q.exam_id, e.name as exam_name, e.folder_path 
       FROM questions q 
       JOIN exams e ON q.exam_id = e.id 
       WHERE q.image_url IS NULL OR q.image_url = ''`
    );

    if (questions.length === 0) {
      console.log('[Imgbb Migrator] All questions have ImgBB URLs. Nothing to migrate.');
      return;
    }

    console.log(`[Imgbb Migrator] Found ${questions.length} questions missing ImgBB URLs. Starting background upload...`);

    let successCount = 0;
    let failCount = 0;
    let consecutiveFails = 0;

    for (const q of questions) {
      const imagePath = path.join(q.folder_path, `Q${q.q_no}.png`);

      if (!fs.existsSync(imagePath)) {
        continue;
      }

      try {
        const base64Image = fs.readFileSync(imagePath).toString('base64');
        const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 
            image: base64Image,
            name: `${q.exam_name}_Q${q.q_no}`
          })
        });

        const uploadData = await uploadRes.json();

        if (uploadData && uploadData.success && uploadData.data && uploadData.data.url) {
          const imageUrl = uploadData.data.url;
          await db.query('UPDATE questions SET image_url = ? WHERE id = ?', [imageUrl, q.id]);
          successCount++;
          consecutiveFails = 0;
          console.log(`[Imgbb Migrator] Uploaded Q${q.q_no} for "${q.exam_name}" successfully -> ${imageUrl}`);
        } else {
          failCount++;
          consecutiveFails++;
          console.error(`[Imgbb Migrator] Failed to upload Q${q.q_no} for "${q.exam_name}":`, JSON.stringify(uploadData));
        }
      } catch (uploadErr) {
        failCount++;
        consecutiveFails++;
        console.error(`[Imgbb Migrator] Error uploading Q${q.q_no} for "${q.exam_name}":`, uploadErr.message);
      }

      if (consecutiveFails >= 5) {
        console.error('[Imgbb Migrator] Too many consecutive failures. Aborting background migration.');
        break;
      }

      // Sleep for 500ms to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[Imgbb Migrator] Background migration complete. Uploaded: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error('[Imgbb Migrator] Critical error in background migration:', error.message);
  }
};
