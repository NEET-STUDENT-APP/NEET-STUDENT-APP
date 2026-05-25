const xlsx = require('xlsx');
const path = require('path');

function testXlsx() {
  const filePath = path.resolve('F:/Projects/NEET STUDENT APP/student_data - 2026.xlsx');
  console.log('Loading file:', filePath);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log('Sheet names:', workbook.SheetNames);
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log('Total rows loaded:', data.length);
    console.log('First 3 records:');
    console.log(data.slice(0, 3));
    
    // Test index lookup
    const lookupMap = {};
    data.forEach(row => {
      const scs = row['SCS Number'];
      if (scs) {
        lookupMap[scs.trim()] = {
          name: row['Student Name'],
          category: row['Category'],
          section: row['Section'],
          campus: row['Campus']
        };
      }
    });

    console.log('Lookup test for SCS1353615:', lookupMap['SCS1353615']);
  } catch (error) {
    console.error('Error reading xlsx:', error);
  }
}

testXlsx();
