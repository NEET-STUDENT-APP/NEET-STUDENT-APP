require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const authController = require('./controllers/authController');
const examController = require('./controllers/examController');
const staffController = require('./controllers/staffController');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// --- PUBLIC ROUTES ---
app.get('/api/auth/lookup/:scsNumber', authController.lookupStudent);
app.get('/api/auth/dropdowns', authController.getDropdownData);
app.post('/api/auth/register/student', authController.studentRegister);
app.post('/api/auth/register/staff', authController.staffRegister);
app.post('/api/auth/login', authController.login);

// --- PROTECTED ROUTES ---

// Exams retrieval: Role-based filtering inside controller
app.get('/api/exams', authMiddleware(['hod', 'staff', 'student']), async (req, res) => {
  if (req.user.role === 'student') {
    return examController.getReleasedExams(req, res);
  } else {
    return examController.getAllExams(req, res);
  }
});
app.get('/api/exams/:examId', authMiddleware(['hod', 'staff', 'student']), examController.getExamDetails);
app.get('/api/exams/:examId/questions/:qNo/image', authMiddleware(['hod', 'staff', 'student']), examController.serveQuestionImage);

// Exam testing operations
app.post('/api/exams/submit', authMiddleware('student'), examController.submitExam);
app.get('/api/reports', authMiddleware('student'), examController.getSubmissionsForStudent);
app.get('/api/reports/:submissionId', authMiddleware(['hod', 'staff', 'student']), examController.getReport);
app.post('/api/exams/reattempt', authMiddleware('student'), examController.submitReattempt);

// Staff dashboard
app.get('/api/staff/dashboard', authMiddleware('staff'), staffController.getStaffDashboardData);

// Admin dashboard actions
app.get('/api/admin/pending', authMiddleware('hod'), authController.getPendingUsers);
app.post('/api/admin/approve', authMiddleware('hod'), authController.approveUser);
app.post('/api/admin/reject', authMiddleware('hod'), authController.rejectUser);
app.post('/api/admin/scan', authMiddleware('hod'), examController.scanAndIngestExams);
app.post('/api/admin/release', authMiddleware('hod'), examController.releaseExam);

// Root path heartbeat
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

const PORT = process.env.PORT || 5000;

// Start Server & Database
async function startServer() {
  try {
    // 1. Initialize Database
    await db.initDatabase();
    
    // 2. Start Express app
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // 3. Trigger initial exam folder scan
      console.log('Running automatic startup scan of exam directories...');
      const mockReq = {};
      const mockRes = {
        status: () => mockRes,
        json: (data) => {
          console.log('Startup Ingestion Scan Result:', JSON.stringify(data, null, 2));
          // Once ingestion finishes, trigger migration
          examController.migrateImagesToImgbb();
        }
      };
      examController.scanAndIngestExams(mockReq, mockRes);
    });
  } catch (error) {
    console.error('Critical Server Startup Error:', error);
    process.exit(1);
  }
}

startServer();
// Trigger restart for env variables
