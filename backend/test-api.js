const http = require('http');

const PORT = 5050;
const HOST = 'localhost';

// Helper to make HTTP Requests
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(dataString);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let parsed = responseBody;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => { reject(err); });

    if (body) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING NEET APP INTEGRATION TESTS ===\n');

  let hodToken = '';
  let studentToken = '';
  let staffToken = '';
  let submissionId = null;

  try {
    // 1. Test student lookup
    console.log('1. Testing student SCS ID lookup...');
    const lookupRes = await request('GET', '/api/auth/lookup/SCS1353615');
    console.log('Lookup Result Status:', lookupRes.statusCode);
    console.log('Student Info:', lookupRes.data);
    if (lookupRes.statusCode !== 200) throw new Error('Student lookup failed');

    // 2. Test dropdowns fetch
    console.log('\n2. Testing staff registration dropdown items...');
    const dropdownRes = await request('GET', '/api/auth/dropdowns');
    console.log('Dropdown Status:', dropdownRes.statusCode);
    console.log('Unique Categories count:', dropdownRes.data.categories?.length);
    console.log('Unique Sections count:', dropdownRes.data.sections?.length);
    console.log('Unique Campuses count:', dropdownRes.data.campuses?.length);
    if (dropdownRes.statusCode !== 200) throw new Error('Dropdowns fetch failed');

    // 3. Register student (will be pending)
    console.log('\n3. Registering student SCS1353615...');
    const regStudentRes = await request('POST', '/api/auth/register/student', {
      scsNumber: 'SCS1353615',
      parentMobile: '9988776655',
      password: 'studentpassword'
    });
    console.log('Reg Student Status:', regStudentRes.statusCode);
    console.log('Reg Student Msg:', regStudentRes.data.message);
    // 400 is fine if already registered in a previous run, but 201 is success
    if (regStudentRes.statusCode !== 201 && !regStudentRes.data.message?.includes('already exists')) {
      throw new Error('Student registration failed');
    }

    // 4. Register staff
    console.log('\n4. Registering staff BNG9999...');
    const regStaffRes = await request('POST', '/api/auth/register/staff', {
      bngCode: 'BNG9999',
      name: 'Physics Tutor Anand',
      subject: 'PHYSICS',
      dean: 'Anand Sir',
      category: '11th Class',
      section: 'AMS60 - 11A',
      campuses: ['ECITY_NEET_BOYS'],
      mobile: '8877665544',
      password: 'staffpassword'
    });
    console.log('Reg Staff Status:', regStaffRes.statusCode);
    console.log('Reg Staff Msg:', regStaffRes.data.message);
    if (regStaffRes.statusCode !== 201 && !regStaffRes.data.message?.includes('already exists')) {
      throw new Error('Staff registration failed');
    }

    // 5. HOD Login
    console.log('\n5. Logging in as HOD Admin...');
    const hodLoginRes = await request('POST', '/api/auth/login', {
      username: 'yenjarappa.s@varsitymgmt.com',
      password: 'Neet@123#'
    });
    console.log('HOD Login Status:', hodLoginRes.statusCode);
    if (hodLoginRes.statusCode !== 200) throw new Error('HOD Login failed');
    hodToken = hodLoginRes.data.token;
    console.log('HOD Authenticated.');

    // 6. HOD retrieve pending registrations
    console.log('\n6. Fetching HOD pending approvals list...');
    const pendingRes = await request('GET', '/api/admin/pending', null, hodToken);
    console.log('Pending Students Count:', pendingRes.data.students?.length);
    console.log('Pending Staff Count:', pendingRes.data.staff?.length);

    // 7. HOD approve registrations
    console.log('\n7. Approving student and staff...');
    const pendingStudent = pendingRes.data.students?.find(s => s.scs_number === 'SCS1353615');
    const pendingStaffMember = pendingRes.data.staff?.find(st => st.username === 'BNG9999');

    if (pendingStudent) {
      const appStud = await request('POST', '/api/admin/approve', { userId: pendingStudent.user_id }, hodToken);
      console.log('Approve Student:', appStud.data.message);
    } else {
      console.log('Student already approved or not in pending list.');
    }

    if (pendingStaffMember) {
      const appStaff = await request('POST', '/api/admin/approve', { userId: pendingStaffMember.user_id }, hodToken);
      console.log('Approve Staff:', appStaff.data.message);
    } else {
      console.log('Staff already approved or not in pending list.');
    }

    // 8. HOD Release Exam (Sr Elite (incoming) NEET WET-01 (07-04-25))
    console.log('\n8. Releasing NEET exam paper...');
    // Retrieve exams to get ID
    const examsRes = await request('GET', '/api/exams', null, hodToken);
    const targetExam = examsRes.data.find(e => e.name.includes('Sr Elite (incoming) NEET WET-01'));
    if (!targetExam) throw new Error('Exam folder not found in database scan!');
    console.log('Target Exam ID:', targetExam.id, 'Released?', targetExam.is_released);
    
    if (!targetExam.is_released) {
      const relRes = await request('POST', '/api/admin/release', { examId: targetExam.id }, hodToken);
      console.log('Exam Release Status:', relRes.data.message);
    } else {
      console.log('Exam is already released.');
    }

    // 9. Student Login
    console.log('\n9. Logging in as approved Student (SCS1353615)...');
    const studentLogin = await request('POST', '/api/auth/login', {
      username: 'SCS1353615',
      password: 'studentpassword'
    });
    console.log('Student Login Status:', studentLogin.statusCode);
    if (studentLogin.statusCode !== 200) throw new Error('Student Login failed');
    studentToken = studentLogin.data.token;

    console.log('Student Profile:', studentLogin.data.profile);

    // 10. Student submit exam submission with mock answers
    console.log('\n10. Submitting mock exam responses (180 questions)...');
    // Prepare answers: 180 questions. Let's make 150 correct, 20 incorrect, 10 unattempted
    // Correct keys from WT Key.xlsx are: Q1 -> 4, Q2 -> 3, Q3 -> 1, Q4 -> 2...
    // Let's query the exam details first to check question numbers
    const examDetails = await request('GET', `/api/exams/${targetExam.id}`, null, studentToken);
    console.log('Loaded Exam details: total questions =', examDetails.data.questions?.length);

    // Let's send mock answers: we will mark selected answers
    // Option value format: 1, 2, 3, 4
    const answers = {};
    for (let i = 1; i <= 180; i++) {
      if (i <= 170) {
        // Let's attempt option 3 for all (some will be correct, some incorrect)
        answers[i.toString()] = {
          selected: 3,
          time_spent_sec: 15 // 15 seconds spent per question
        };
      } else {
        // Skipped
        answers[i.toString()] = {
          selected: null,
          time_spent_sec: 2
        };
      }
    }

    const submitRes = await request('POST', '/api/exams/submit', {
      examId: targetExam.id,
      studentId: studentLogin.data.profile.user_id,
      answers: answers
    }, studentToken);

    console.log('Submission Status:', submitRes.statusCode);
    console.log('Submission Scorecard:', submitRes.data);
    if (submitRes.statusCode !== 201) throw new Error('Exam submission failed');
    submissionId = submitRes.data.submissionId;

    // 11. Retrieve Student Report card (Verify Staff Mapped)
    console.log('\n11. Fetching student report card & faculty mapping...');
    const reportRes = await request('GET', `/api/reports/${submissionId}`, null, studentToken);
    console.log('Report Status:', reportRes.statusCode);
    console.log('Report Student:', reportRes.data.submission?.student_name);
    console.log('Mapped Staff for PHYSICS:', reportRes.data.staff?.PHYSICS); // Should show "Physics Tutor Anand" who registered for this section!
    if (reportRes.statusCode !== 200) throw new Error('Report retrieval failed');

    // 12. Test Reattempt (under 500 characters explanation)
    console.log('\n12. Testing reattempt validation (Under 500 chars)...');
    const wrongQ = Object.keys(reportRes.data.submission.answers).find(q => !reportRes.data.submission.answers[q].is_correct && reportRes.data.submission.answers[q].is_attempted);
    console.log('Testing reattempt for wrong Question number:', wrongQ);

    const reattemptFailRes = await request('POST', '/api/exams/reattempt', {
      submissionId: submissionId,
      qNo: parseInt(wrongQ),
      reason: 'This explanation is too short.',
      selectedKey: 1
    }, studentToken);
    console.log('Reattempt Status (under 500 chars):', reattemptFailRes.statusCode);
    console.log('Reattempt Error Message:', reattemptFailRes.data.message);
    if (reattemptFailRes.statusCode !== 400) throw new Error('Reattempt logic allowed short explanation!');

    // 13. Test Reattempt (500+ characters explanation)
    console.log('\n13. Testing reattempt validation (500+ chars)...');
    const longReason = 'This is a very long explanation details '.repeat(20); // 40 chars * 20 = 800 chars
    const reattemptSuccessRes = await request('POST', '/api/exams/reattempt', {
      submissionId: submissionId,
      qNo: parseInt(wrongQ),
      reason: longReason,
      selectedKey: 2
    }, studentToken);
    console.log('Reattempt Status (500+ chars):', reattemptSuccessRes.statusCode);
    console.log('Reattempt Success Msg:', reattemptSuccessRes.data.message);
    console.log('Reattempt Correct?', reattemptSuccessRes.data.isCorrect);
    if (reattemptSuccessRes.statusCode !== 200) throw new Error('Reattempt failed with valid parameters');

    // 14. Staff Login
    console.log('\n14. Logging in as Staff member (BNG9999)...');
    const staffLogin = await request('POST', '/api/auth/login', {
      username: 'BNG9999',
      password: 'staffpassword'
    });
    console.log('Staff Login Status:', staffLogin.statusCode);
    if (staffLogin.statusCode !== 200) throw new Error('Staff Login failed');
    staffToken = staffLogin.data.token;

    // 15. Staff Dashboard retrieval
    console.log('\n15. Fetching staff dashboard analytics...');
    const staffDashRes = await request('GET', '/api/staff/dashboard', null, staffToken);
    console.log('Staff Dashboard Status:', staffDashRes.statusCode);
    console.log('Classroom details:', staffDashRes.data.classroom);
    console.log('Submissions tracked in class:', staffDashRes.data.submissions?.length);
    console.log('Reattempt reasons logged in class:', staffDashRes.data.reattempts?.length);
    console.log('Reattempt Reason text preview:', staffDashRes.data.reattempts?.[0]?.reason.slice(0, 50) + '...');
    if (staffDashRes.statusCode !== 200) throw new Error('Staff dashboard data retrieval failed');

    console.log('\n=== ALL NEET APP INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('\n!!! TEST FAILURE LOG !!!');
    console.error(error.message);
  }
}

runTests();
