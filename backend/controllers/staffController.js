const db = require('../db');

exports.getStaffDashboardData = async (req, res) => {
  try {
    // Staff details are attached to the request from the auth middleware
    const { category, section, campus } = req.user.profile;

    if (!category || !section || !campus) {
      return res.status(400).json({ message: 'Staff profile is missing teaching assignment fields.' });
    }

    // Handle multi-campus staff: campus may be "CAMPUS_A,CAMPUS_B"
    const campusList = campus.split(',').map(c => c.trim()).filter(Boolean);
    const campusPlaceholders = campusList.map(() => '?').join(',');

    // 1. Fetch student submissions across all the staff's campuses (same category & section)
    const [submissions] = await db.query(
      `SELECT s.id as submission_id, s.score, s.correct_count, s.wrong_count, s.unattempted_count, 
              s.time_spent, s.submitted_at, s.answers_json, s.student_id,
              p.scs_number, p.name as student_name, p.section as student_section, p.campus as student_campus,
              e.id as exam_id, e.name as exam_name, e.test_type
       FROM submissions s
       JOIN student_profiles p ON s.student_id = p.user_id
       JOIN exams e ON s.exam_id = e.id
       WHERE p.category = ? AND p.section = ? AND p.campus IN (${campusPlaceholders})
       ORDER BY s.submitted_at DESC`,
      [category, section, ...campusList]
    );

    // Parse answers JSON for each submission
    const parsedSubmissions = submissions.map(sub => ({
      ...sub,
      answers: JSON.parse(sub.answers_json)
    }));

    // 2. Fetch reattempts for these students
    const [reattempts] = await db.query(
      `SELECT r.id as reattempt_id, r.submission_id, r.q_no, r.reason, r.selected_key, 
              r.is_correct, r.reattempted_at, p.scs_number, p.name as student_name,
              p.section as student_section, p.campus as student_campus,
              e.name as exam_name, q.subject
       FROM reattempts r
       JOIN student_profiles p ON r.student_id = p.user_id
       JOIN exams e ON r.exam_id = e.id
       JOIN questions q ON r.exam_id = q.exam_id AND r.q_no = q.q_no
       WHERE p.category = ? AND p.section = ? AND p.campus IN (${campusPlaceholders})
       ORDER BY r.reattempted_at DESC`,
      [category, section, ...campusList]
    );

    // 3. Fetch list of students registered in this section across all campuses
    const [students] = await db.query(
      `SELECT u.id as user_id, u.status, p.scs_number, p.name, p.parent_mobile, 
              p.section as student_section, p.campus as student_campus
       FROM users u 
       JOIN student_profiles p ON u.id = p.user_id
       WHERE p.category = ? AND p.section = ? AND p.campus IN (${campusPlaceholders})
       ORDER BY p.campus ASC, p.section ASC, p.name ASC`,
      [category, section, ...campusList]
    );

    // 4. Get unique sections and campuses for filter dropdowns
    const uniqueSections = [...new Set(students.map(s => s.student_section).filter(Boolean))].sort();
    const uniqueCampuses = [...new Set(students.map(s => s.student_campus).filter(Boolean))].sort();

    res.json({
      classroom: {
        category,
        section,
        campus,
        campusList,
      },
      students,
      submissions: parsedSubmissions,
      reattempts,
      filterOptions: {
        sections: uniqueSections,
        campuses: uniqueCampuses,
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error retrieving staff analytics data.', error: error.message });
  }
};
