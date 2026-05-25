require('dotenv').config();
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const authController = require('./controllers/authController');
const examController = require('./controllers/examController');
const staffController = require('./controllers/staffController');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize DB on first request (lazy init for Cloud Functions cold start)
let dbInitialized = false;
app.use(async (req, res, next) => {
  try {
    if (!dbInitialized) {
      await db.initDatabase();
      dbInitialized = true;
      console.log('Database initialized successfully for Cloud Function.');
    }
    next();
  } catch (error) {
    console.error('DB initialization error:', error);
    res.status(500).json({ message: 'Server initialization error.' });
  }
});

// --- PUBLIC ROUTES ---
app.get('/api/auth/lookup/:scsNumber', authController.lookupStudent);
app.get('/api/auth/dropdowns', authController.getDropdownData);
app.post('/api/auth/register/student', authController.studentRegister);
app.post('/api/auth/register/staff', authController.staffRegister);
app.post('/api/auth/login', authController.login);

// --- PROTECTED ROUTES ---
app.get('/api/exams', authMiddleware(['hod', 'staff', 'student']), async (req, res) => {
  if (req.user.role === 'student') {
    return examController.getReleasedExams(req, res);
  } else {
    return examController.getAllExams(req, res);
  }
});
app.get('/api/exams/:examId', authMiddleware(['hod', 'staff', 'student']), examController.getExamDetails);
app.get('/api/exams/:examId/questions/:qNo/image', authMiddleware(['hod', 'staff', 'student']), examController.serveQuestionImage);

app.post('/api/exams/submit', authMiddleware('student'), examController.submitExam);
app.get('/api/reports', authMiddleware('student'), examController.getSubmissionsForStudent);
app.get('/api/reports/:submissionId', authMiddleware(['hod', 'staff', 'student']), examController.getReport);
app.post('/api/exams/reattempt', authMiddleware('student'), examController.submitReattempt);

app.get('/api/staff/dashboard', authMiddleware('staff'), staffController.getStaffDashboardData);

app.get('/api/admin/pending', authMiddleware('hod'), authController.getPendingUsers);
app.post('/api/admin/approve', authMiddleware('hod'), authController.approveUser);
app.post('/api/admin/reject', authMiddleware('hod'), authController.rejectUser);
app.post('/api/admin/scan', authMiddleware('hod'), examController.scanAndIngestExams);
app.post('/api/admin/release', authMiddleware('hod'), examController.releaseExam);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Export the Cloud Function
exports.api = onRequest(
  { 
    region: 'asia-south1',
    timeoutSeconds: 120,
    memory: '512MiB',
    minInstances: 0,
    maxInstances: 10
  },
  app
);
