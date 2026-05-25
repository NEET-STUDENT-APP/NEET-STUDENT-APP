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

function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
  
  doc.setFontSize(10);
  doc.text(`Report Generated: ${formatDate(new Date())} | Exam Date: ${formatDate(submission.exam_date)}`, 45, 32);

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

// Helper to fetch question images with Auth token header
async function getBase64ImageFromUrlWithAuth(imageUrl, token) {
  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(imageUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.addEventListener('error', () => reject(reader.error), false);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to load image:', imageUrl, e);
    return null;
  }
}

// Helper to determine natural dimensions of a base64 image
function getImageSize(base64Str) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 200 }); // fallback default aspect ratio
    };
    img.src = base64Str;
  });
}

// Generate the 180 questions detailed booklet PDF with questions images
export async function generateStudentDetailedRevisionPDF(reportData, token, apiBase, onProgress) {
  const { submission, staff, reattempts } = reportData;
  const doc = new jsPDF();
  
  const primaryColor = [15, 23, 42]; // Slate 900
  const secondaryColor = [59, 130, 246]; // Blue 500
  
  // 1. Draw Cover Page Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 45, 'F');
  
  // Logo
  const logoBase64 = await getBase64ImageFromUrl('/logo.png');
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 12, 6, 30, 30);
    } catch (e) {
      console.warn('Failed to embed logo:', e);
    }
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SRI CHAITANYA EDUCATIONAL INSTITUTIONS', 46, 18);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('NEET Prep App - Mock Test Detailed Revision Booklet', 46, 26);
  
  doc.setFontSize(10);
  doc.text(`Generated: ${formatDate(new Date())} | Exam: ${submission.exam_name}`, 46, 33);
  
  // Cover page - Student Information
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont('Helvetica', 'bold');
  doc.text('STUDENT REGISTRATION DETAILS', 14, 56);
  
  const totalMins = Math.floor(submission.time_spent / 60);
  const totalSecs = submission.time_spent % 60;
  const totalTimeSpentText = `${totalMins}m ${totalSecs}s`;
  
  const studentInfoData = [
    ['Student Name:', submission.student_name, 'SCS Number:', submission.scs_number],
    ['Category / Class:', submission.category, 'Section Name:', submission.section],
    ['Campus Name:', submission.campus, 'Total Time Spent:', totalTimeSpentText],
    ['Exam Attempt Date:', formatDate(submission.submitted_at), 'Exam Category:', submission.test_type]
  ];
  
  doc.autoTable({
    startY: 59,
    body: studentInfoData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 38 },
      1: { width: 62 },
      2: { fontStyle: 'bold', width: 38 },
      3: { width: 62 }
    }
  });
  
  // Scorecard
  const scorecardY = doc.lastAutoTable.finalY + 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PERFORMANCE SCORECARD SUMMARY', 14, scorecardY);
  
  doc.setFillColor(245, 247, 250);
  doc.rect(14, scorecardY + 3, 182, 22, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246);
  doc.text('TOTAL SCORE', 20, scorecardY + 10);
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.score} / 720`, 20, scorecardY + 18);
  
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text('CORRECT (+4)', 70, scorecardY + 10);
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.correct_count}`, 70, scorecardY + 18);
  
  doc.setFontSize(9);
  doc.setTextColor(244, 63, 94);
  doc.text('INCORRECT (-1)', 115, scorecardY + 10);
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.wrong_count}`, 115, scorecardY + 18);
  
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text('SKIPPED (0)', 160, scorecardY + 10);
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`${submission.unattempted_count}`, 160, scorecardY + 18);
  
  // Faculty members Table
  const facultyY = scorecardY + 32;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text('MAPPED CLASS ACADEMIC FACULTY', 14, facultyY);
  
  const staffRows = [
    ['BOTANY', staff.BOTANY.join(', ') || 'Not Assigned'],
    ['ZOOLOGY', staff.ZOOLOGY.join(', ') || 'Not Assigned'],
    ['PHYSICS', staff.PHYSICS.join(', ') || 'Not Assigned'],
    ['CHEMISTRY', staff.CHEMISTRY.join(', ') || 'Not Assigned']
  ];
  
  doc.autoTable({
    startY: facultyY + 3,
    head: [['Subject', 'Faculty Member']],
    body: staffRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3.5 }
  });
  
  // Booklet Guidance description
  const descY = doc.lastAutoTable.finalY + 10;
  doc.setFillColor(240, 244, 248);
  doc.rect(14, descY, 182, 22, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('IMPORTANT GUIDANCE FOR REVISION:', 18, descY + 6);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const infoText = 'This booklet lists all 180 questions with details of your selection, time spent, and correctness. For incorrect and skipped questions, use the reattempt tool in the web application to log reasons for mistake and reattempt the question. Review this file for future examination preparation.';
  const splitInfo = doc.splitTextToSize(infoText, 174);
  doc.text(splitInfo, 18, descY + 11);
  
  // Questions start on page 2.
  doc.addPage();
  
  let currentY = 15;
  const questionsList = Object.keys(submission.answers).sort((a, b) => parseInt(a) - parseInt(b));
  const totalQuestions = questionsList.length;
  
  if (onProgress) onProgress(0, totalQuestions);
  
  // Process questions in batches of 10 for concurrent loading
  const batchSize = 10;
  for (let b = 0; b < totalQuestions; b += batchSize) {
    const batch = questionsList.slice(b, b + batchSize);
    
    // Concurrent fetch images and details
    const loadedBatchData = await Promise.all(batch.map(async (qNoStr) => {
      const ans = submission.answers[qNoStr];
      const imageUrl = ans.image_url || `${apiBase}/api/exams/${submission.exam_id}/questions/${qNoStr}/image?token=${token}`;
      const imgBase64 = await getBase64ImageFromUrlWithAuth(imageUrl, token);
      
      let imgW = 0;
      let imgH = 0;
      if (imgBase64) {
        const size = await getImageSize(imgBase64);
        const maxW = 170;
        const maxH = 80;
        const ratio = size.width / size.height;
        imgW = size.width;
        imgH = size.height;
        if (imgW > maxW) {
          imgW = maxW;
          imgH = imgW / ratio;
        }
        if (imgH > maxH) {
          imgH = maxH;
          imgW = imgH * ratio;
        }
      }
      
      return { qNoStr, ans, imgBase64, imgW, imgH };
    }));
    
    // Render the fetched questions sequentially in the PDF
    for (let idx = 0; idx < loadedBatchData.length; idx++) {
      const { qNoStr, ans, imgBase64, imgW, imgH } = loadedBatchData[idx];
      const reattempt = reattempts ? reattempts.find(r => r.q_no.toString() === qNoStr) : null;
      
      let reattemptOffset = reattempt ? 10 : 0;
      const cardW = 182;
      const padding = 5;
      const textSectionH = 14 + reattemptOffset;
      const imageSectionH = imgBase64 ? imgH + 4 : 15; // 15 for placeholder if no image
      const cardH = textSectionH + imageSectionH + padding * 2;
      
      // Page break check
      if (currentY + cardH > 280) {
        doc.addPage();
        currentY = 15;
      }
      
      const startY = currentY;
      
      // Draw card box
      doc.setFillColor(252, 253, 255);
      doc.setDrawColor(218, 226, 236);
      doc.roundedRect(14, startY, cardW, cardH, 2, 2, 'FD');
      
      // Draw top accent line on card
      doc.setFillColor(...primaryColor);
      doc.rect(14, startY, cardW, 1.2, 'F');
      
      // Title header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`QUESTION ${qNoStr}   |   SUBJECT: ${ans.subject || '-'}`, 18, startY + 6);
      
      // Status badge
      let statusText = 'Skipped';
      let statusColor = [245, 158, 11]; // Orange
      if (ans.is_attempted) {
        statusText = ans.is_correct ? 'Correct (+4)' : 'Incorrect (-1)';
        statusColor = ans.is_correct ? [16, 185, 129] : [244, 63, 94]; // Green or Red
      }
      doc.setFillColor(...statusColor);
      doc.roundedRect(155, startY + 2.5, 35, 4.5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'bold');
      doc.text(statusText, 172.5, startY + 5.7, { align: 'center' });
      
      // Attempt Info
      doc.setFontSize(8.5);
      doc.setTextColor(70, 80, 95);
      doc.setFont('Helvetica', 'normal');
      
      const optionMap = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
      const optionText = ans.selected ? `Option ${ans.selected} (${optionMap[ans.selected] || ''})` : 'Unattempted';
      
      const minutes = Math.floor(ans.time_spent_sec / 60);
      const seconds = ans.time_spent_sec % 60;
      const timeText = ans.time_spent_sec >= 60 
        ? `${ans.time_spent_sec}s (${minutes}m ${seconds}s)` 
        : `${ans.time_spent_sec}s`;
        
      doc.text('Attempted Key:', 18, startY + 12);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(optionText, 41, startY + 12);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(70, 80, 95);
      doc.text('Time Spent:', 100, startY + 12);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(timeText, 118, startY + 12);
      
      // Reattempt Details
      if (reattempt) {
        doc.setDrawColor(235, 240, 245);
        doc.line(18, startY + 15, 192, startY + 15);
        
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(70, 80, 95);
        doc.text('Reattempt Key:', 18, startY + 19);
        
        const rText = reattempt.is_correct ? 'Correct' : 'Incorrect';
        const rColor = reattempt.is_correct ? [16, 185, 129] : [244, 63, 94];
        
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...rColor);
        doc.text(`${rText} (Option ${reattempt.selected_key})`, 41, startY + 19);
        
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(70, 80, 95);
        doc.text('Mistake Reason:', 100, startY + 19);
        doc.setFont('Helvetica', 'italic');
        doc.setTextColor(100, 110, 125);
        let rReason = reattempt.reason || '-';
        if (rReason.length > 55) {
          rReason = rReason.substring(0, 52) + '...';
        }
        doc.text(rReason, 123, startY + 19);
      }
      
      // Draw question image or placeholder
      const imageY = startY + 14 + reattemptOffset + padding;
      if (imgBase64) {
        try {
          doc.addImage(imgBase64, 'PNG', 14 + (cardW - imgW) / 2, imageY, imgW, imgH);
        } catch (e) {
          console.error('Failed to embed question image:', e);
          doc.setDrawColor(244, 63, 94);
          doc.rect(18, imageY, cardW - 8, 12);
          doc.setTextColor(244, 63, 94);
          doc.setFont('Helvetica', 'bold');
          doc.text('Failed to render question image in PDF.', 24, imageY + 7);
        }
      } else {
        // Placeholder
        doc.setDrawColor(230, 235, 242);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(18, imageY, cardW - 8, 12, 1, 1, 'FD');
        doc.setTextColor(150, 160, 170);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Question image not available (missing local png or not found)', 24, imageY + 7);
      }
      
      currentY = startY + cardH + 5;
    }
    
    const processedCount = Math.min(b + batchSize, totalQuestions);
    if (onProgress) onProgress(processedCount, totalQuestions);
  }
  
  // 3. Second pass to add headers and footers with total page count
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    if (i > 1) {
      // Page Header
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.setFont('Helvetica', 'normal');
      doc.text(`NEET Mock Practice Revision booklet  |  Exam: ${submission.exam_name}`, 14, 10);
      doc.text(`Page ${i} of ${pageCount}`, 182, 10);
      doc.setDrawColor(230, 235, 240);
      doc.line(14, 12, 196, 12);
    }
    
    // Page Footer
    doc.setDrawColor(230, 235, 240);
    doc.line(14, 286, 196, 286);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.setFont('Helvetica', 'normal');
    doc.text('Sri Chaitanya Educational Institutions  ·  NEET Student Prep App', 14, 290);
    doc.text(`SCS: ${submission.scs_number} - ${submission.student_name}`, 145, 290);
  }
  
  const filename = `${submission.scs_number}_Revision_Booklet_${submission.exam_name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

