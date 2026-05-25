import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
applyPlugin(jsPDF);

// Helper to convert logo to base64
async function getBase64ImageFromUrl(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.addEventListener('error', () => reject(reader.error), false);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to load logo image:', e);
    return null;
  }
}

export async function generateStudentPDFReport(reportData) {
  const { submission, staff } = reportData;
  const doc = new jsPDF();
  
  // Try fetching logo
  const logoBase64 = await getBase64ImageFromUrl('/logo.png');

  // Colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const secondaryColor = [59, 130, 246]; // Blue 500

  // 1. Draw Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  // Add Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 12, 5, 28, 28);
    } catch (e) {
      console.warn('Failed to embed image in PDF:', e);
    }
  }

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SRI CHAITANYA EDUCATIONAL INSTITUTIONS', 45, 17);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('NEET Student Prep App - Official Exam Report Card', 45, 25);
  
  const dateStr = new Date(submission.submitted_at).toLocaleDateString();
  doc.setFontSize(10);
  doc.text(`Report Generated: ${new Date().toLocaleDateString()} | Exam Date: ${new Date(submission.exam_date).toLocaleDateString()}`, 45, 32);

  // 2. Student Information Table
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont('Helvetica', 'bold');
  doc.text('STUDENT INFORMATION', 14, 48);

  const totalMins = Math.floor(submission.time_spent / 60);
  const totalSecs = submission.time_spent % 60;
  const totalTimeSpentText = `${totalMins}m ${totalSecs}s`;

  const studentInfoData = [
    ['Student Name:', submission.student_name, 'SCS Number:', submission.scs_number],
    ['Category / Class:', submission.category, 'Section Name:', submission.section],
    ['Campus Name:', submission.campus, 'Total Time Spent:', totalTimeSpentText]
  ];

  doc.autoTable({
    startY: 51,
    body: studentInfoData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 35 },
      1: { width: 65 },
      2: { fontStyle: 'bold', width: 35 },
      3: { width: 65 }
    }
  });

  // 3. Performance Summary
  const lastY = doc.lastAutoTable.finalY;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PERFORMANCE SCORECARD', 14, lastY + 12);

  // Stats boxes background
  doc.setFillColor(245, 247, 250);
  doc.rect(14, lastY + 15, 182, 22, 'F');

  // Draw Stats Text
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('TOTAL SCORE', 20, lastY + 22);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.score} / 720`, 20, lastY + 31);

  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('CORRECT (+4)', 70, lastY + 22);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.correct_count}`, 70, lastY + 31);

  doc.setFontSize(10);
  doc.setTextColor(244, 63, 94);
  doc.text('INCORRECT (-1)', 115, lastY + 22);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.wrong_count}`, 115, lastY + 31);

  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11);
  doc.text('SKIPPED (0)', 160, lastY + 22);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.unattempted_count}`, 160, lastY + 31);

  // 4. Mapped Academic Faculty
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CLASS SUBJECT FACULTY', 14, lastY + 47);

  const staffRows = [
    ['BOTANY', staff.BOTANY.join(', ') || 'Not Assigned'],
    ['ZOOLOGY', staff.ZOOLOGY.join(', ') || 'Not Assigned'],
    ['PHYSICS', staff.PHYSICS.join(', ') || 'Not Assigned'],
    ['CHEMISTRY', staff.CHEMISTRY.join(', ') || 'Not Assigned']
  ];

  doc.autoTable({
    startY: lastY + 50,
    head: [['Subject', 'Faculty Member']],
    body: staffRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // 5. Section Breakdown
  const finalY2 = doc.lastAutoTable.finalY;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DETAILED QUESTION RESPONSE BREAKDOWN', 14, finalY2 + 12);

  // Generate rows for questions
  const questionRows = [];
  const totalQ = Object.keys(submission.answers).length;

  for (let i = 1; i <= totalQ; i++) {
    const ans = submission.answers[i.toString()];
    if (ans) {
      let statusText = 'Skipped';
      let statusColor = 'Skipped';
      if (ans.is_attempted) {
        statusText = ans.is_correct ? 'Correct' : 'Incorrect';
        statusColor = ans.is_correct ? 'Correct' : 'Wrong';
      }

      // Convert option selected
      let optionText = '-';
      if (ans.selected !== null && ans.selected !== undefined) {
        // Map 1,2,3,4 to A,B,C,D
        const optionMap = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
        optionText = `${ans.selected} (${optionMap[ans.selected] || ''})`;
      }

      // Format time
      const minutes = Math.floor(ans.time_spent_sec / 60);
      const seconds = ans.time_spent_sec % 60;
      const timeText = ans.time_spent_sec >= 60 
        ? `${ans.time_spent_sec}s (${minutes}m ${seconds}s)` 
        : `${ans.time_spent_sec}s`;

      questionRows.push([
        `Q${i}`,
        ans.subject || '-',
        optionText,
        statusText,
        timeText
      ]);
    }
  }

  // Draw 2 column-based grid tables for space-saving if questions count is high
  // Let's create a beautiful structured report
  doc.autoTable({
    startY: finalY2 + 15,
    head: [['Q.No', 'Subject', 'Selected Option', 'Result Status', 'Time Spent']],
    body: questionRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 15 },
      1: { width: 40 },
      2: { width: 35 },
      3: { fontStyle: 'bold', width: 50 },
      4: { width: 40 }
    },
    didParseCell: function(data) {
      if (data.column.index === 3 && data.cell.section === 'body') {
        const text = data.cell.text[0];
        if (text === 'Correct') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (text === 'Incorrect') {
          data.cell.styles.textColor = [244, 63, 94];
        } else {
          data.cell.styles.textColor = [245, 158, 11];
        }
      }
    }
  });

  // Save the PDF
  const filename = `${submission.scs_number}_Report_${submission.exam_name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
