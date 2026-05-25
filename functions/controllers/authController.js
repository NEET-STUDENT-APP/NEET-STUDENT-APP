const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const path = require('path');

// Cache student data in memory for fast lookup
let studentLookupMap = {};
let uniqueCategories = [];
let uniqueSections = [];
let uniqueCampuses = [];

// Campuses that are NOT part of this NEET app — excluded from all dropdowns and lookups
const EXCLUDED_CAMPUSES = ['ECITY_SCHOOL', 'ECITY_ENGG_GIRLS_RESIDENTIAL'];

function loadStudentExcelData() {
  const filePath = process.env.STUDENT_DATA_EXCEL || path.resolve(__dirname, '..', 'student_data - 2026.xlsx');
  console.log('Caching student excel data from:', filePath);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    const catSet = new Set();
    const secSet = new Set();
    const camSet = new Set();
    
    data.forEach(row => {
      const scs = row['SCS Number'];
      const campus = (row['Campus'] || '').trim();

      // Skip students belonging to excluded campuses
      if (!scs || EXCLUDED_CAMPUSES.includes(campus)) return;

      studentLookupMap[scs.trim().toUpperCase()] = {
        name: row['Student Name'] || '',
        category: row['Category'] || '',
        section: row['Section'] || '',
        campus
      };
      if (row['Category']) catSet.add(row['Category']);
      if (row['Section']) secSet.add(row['Section']);
      camSet.add(campus);
    });
    
    uniqueCategories = Array.from(catSet).sort();
    uniqueSections = Array.from(secSet).sort();
    // Filter out excluded campuses from the dropdown list
    uniqueCampuses = Array.from(camSet)
      .filter(c => !EXCLUDED_CAMPUSES.includes(c))
      .sort();
    
    console.log(`Successfully cached ${Object.keys(studentLookupMap).length} NEET-app students (excluded: ${EXCLUDED_CAMPUSES.join(', ')}).`);
  } catch (error) {
    console.error('Error loading student excel file:', error.message);
  }
}

// Load data immediately
loadStudentExcelData();

// Student lookup by SCS ID
exports.lookupStudent = async (req, res) => {
  try {
    const { scsNumber } = req.params;
    if (!scsNumber) {
      return res.status(400).json({ message: 'SCS Number is required.' });
    }
    const cleanScs = scsNumber.trim().toUpperCase();
    const student = studentLookupMap[cleanScs];
    if (!student) {
      return res.status(404).json({ message: 'Student SCS ID not found in the official database.' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Error checking student ID.', error: error.message });
  }
};

// Get dropdown values for staff registration
exports.getDropdownData = async (req, res) => {
  try {
    res.json({
      categories: uniqueCategories,
      sections: uniqueSections,
      campuses: uniqueCampuses
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dropdown data.', error: error.message });
  }
};

// Student Registration
exports.studentRegister = async (req, res) => {
  try {
    const { scsNumber, parentMobile, password } = req.body;
    
    if (!scsNumber || !parentMobile || !password) {
      return res.status(400).json({ message: 'SCS Number, Parent WhatsApp, and Password are required.' });
    }

    const cleanScs = scsNumber.trim().toUpperCase();
    
    // 1. Verify SCS prefix and digit length (SCS followed by 7 or 8 digits)
    const scsRegex = /^SCS\d{7,8}$/;
    if (!scsRegex.test(cleanScs)) {
      return res.status(400).json({ message: 'SCS Number must start with "SCS" and be followed by 7 or 8 digits.' });
    }

    // 2. Lookup student in Excel list
    const excelStudent = studentLookupMap[cleanScs];
    if (!excelStudent) {
      return res.status(400).json({ message: 'Invalid SCS Number: Not found in student database.' });
    }

    // 3. Check if user already exists
    const [existingUser] = await db.query('SELECT * FROM users WHERE username = ?', [cleanScs]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'A user with this SCS number already exists.' });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Save to database (Status pending)
    const [userResult] = await db.query(
      'INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      [cleanScs, hashedPassword, 'student', 'pending']
    );

    const userId = userResult.insertId;

    await db.query(
      `INSERT INTO student_profiles (user_id, scs_number, name, category, section, campus, parent_mobile) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanScs, excelStudent.name, excelStudent.category, excelStudent.section, excelStudent.campus, parentMobile.trim()]
    );

    res.status(201).json({ message: 'Registration submitted successfully. Please wait for HOD Admin approval.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
};

// Staff Registration
exports.staffRegister = async (req, res) => {
  try {
    const { bngCode, name, subject, dean, category, section, campuses, mobile, password } = req.body;
    
    // campus can be an array (multi-select) or single string
    const campusValue = Array.isArray(campuses)
      ? campuses.map(c => c.trim()).filter(Boolean).join(',')
      : (campuses || '').trim();

    if (!bngCode || !name || !subject || !dean || !category || !section || !campusValue || !mobile || !password) {
      return res.status(400).json({ message: 'All registration fields are required. Please select at least one campus.' });
    }

    const cleanBng = bngCode.trim().toUpperCase();

    // Check if user already exists
    const [existingUser] = await db.query('SELECT * FROM users WHERE username = ?', [cleanBng]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'A user with this Staff BNG Code already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const [userResult] = await db.query(
      'INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      [cleanBng, hashedPassword, 'staff', 'pending']
    );

    const userId = userResult.insertId;

    await db.query(
      `INSERT INTO staff_profiles (user_id, bng_code, name, subject, dean, category, section, campus, mobile) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanBng, name.trim(), subject, dean, category, section, campusValue, mobile.trim()]
    );

    res.status(201).json({ message: 'Staff registration submitted successfully. Please wait for HOD Admin approval.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
};

// Login Route (Student, Staff, HOD)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    const cleanUsername = username.trim();

    // Retrieve user
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [cleanUsername]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = users[0];

    // Check status
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending HOD approval. Please try again later.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your registration was rejected by the administrator.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Load profile details based on role
    let profile = {};
    if (user.role === 'student') {
      const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);
      if (profiles.length > 0) profile = profiles[0];
    } else if (user.role === 'staff') {
      const [profiles] = await db.query('SELECT * FROM staff_profiles WHERE user_id = ?', [user.id]);
      if (profiles.length > 0) profile = profiles[0];
    } else if (user.role === 'hod') {
      profile = { name: 'HOD Admin', email: user.username };
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, profile },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, role: user.role, profile });
  } catch (error) {
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
};

// HOD: Get pending user registrations
exports.getPendingUsers = async (req, res) => {
  try {
    const [students] = await db.query(`
      SELECT u.id as user_id, u.username, u.role, u.status, s.scs_number, s.name, s.category, s.section, s.campus, s.parent_mobile 
      FROM users u JOIN student_profiles s ON u.id = s.user_id 
      WHERE u.status = 'pending'
    `);

    const [staff] = await db.query(`
      SELECT u.id as user_id, u.username, u.role, u.status, st.name, st.subject, st.dean, st.category, st.section, st.campus, st.mobile 
      FROM users u JOIN staff_profiles st ON u.id = st.user_id 
      WHERE u.status = 'pending'
    `);

    res.json({ students, staff });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending users.', error: error.message });
  }
};

// HOD: Approve User Registration
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    // Check user role & retrieve mobile info
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];
    let recipientMobile = '';
    let messageText = '';

    if (user.role === 'student') {
      const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [userId]);
      if (profiles.length > 0) {
        recipientMobile = profiles[0].parent_mobile;
        const studentName = profiles[0].name.trim();
        const scsNo = profiles[0].scs_number.trim();
        messageText = `*SRI CHAITANYA EDUCATIONAL INSTITUTIONS*\n\nDear Parent,\nWe are pleased to inform you that your ward, *${studentName}* (SCS ID: *${scsNo}*), has been successfully *APPROVED* to access the *NEET Student App*.\n\nYour ward can now log in to practice previous NEET exam papers, view mapped faculty, download report cards, and track their detailed performance analysis.\n\n*App URL:* http://localhost:5174/\n*Login Credentials:*\n- *SCS ID:* ${scsNo}\n- *Password:* (Use the password created during registration)\n\nRegards,\n*Sri Chaitanya Administration*`;
      }
    } else if (user.role === 'staff') {
      const [profiles] = await db.query('SELECT * FROM staff_profiles WHERE user_id = ?', [userId]);
      if (profiles.length > 0) {
        recipientMobile = profiles[0].mobile;
        const staffName = profiles[0].name.trim();
        const bngCode = profiles[0].bng_code.trim();
        messageText = `*SRI CHAITANYA EDUCATIONAL INSTITUTIONS*\n\nDear Faculty,\nWe are pleased to inform you that your registration for *${staffName}* (BNG Code: *${bngCode}*) has been successfully *APPROVED*.\n\nYou can now log in to the *NEET Student App* to monitor student analytics, review focus timings, view explanation reports, and coordinate WhatsApp notifications.\n\n*App URL:* http://localhost:5174/\n*Login Credentials:*\n- *BNG Code:* ${bngCode}\n- *Password:* (Use the password created during registration)\n\nRegards,\n*Sri Chaitanya Administration*`;
      }
    }

    // Update status
    await db.query("UPDATE users SET status = 'approved' WHERE id = ?", [userId]);
    if (user.role === 'student') {
      await db.query("UPDATE student_profiles SET approved_at = NOW() WHERE user_id = ?", [userId]);
    } else if (user.role === 'staff') {
      await db.query("UPDATE staff_profiles SET approved_at = NOW() WHERE user_id = ?", [userId]);
    }

    // Log WhatsApp Message (Simulated WhatsApp gateway logging)
    if (recipientMobile && messageText) {
      await db.query(
        'INSERT INTO whatsapp_logs (recipient_mobile, message_text, status) VALUES (?, ?, ?)',
        [recipientMobile, messageText, 'sent_simulation']
      );
    }

    res.json({ 
      message: 'User approved successfully.', 
      whatsapp: {
        phone: recipientMobile,
        text: messageText
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Approval failed.', error: error.message });
  }
};

// HOD: Reject User Registration
exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }
    await db.query("UPDATE users SET status = 'rejected' WHERE id = ?", [userId]);
    res.json({ message: 'User registration rejected.' });
  } catch (error) {
    res.status(500).json({ message: 'Rejection failed.', error: error.message });
  }
};
