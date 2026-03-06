/**
 * Google Apps Script for Vision to Action
 * 
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code
 * 4. Deploy > New Deployment > Web App
 * 5. Execute as: Me
 * 6. Who has access: Anyone
 * 7. Copy the Web App URL and set it as VITE_SHEET_API_URL in your environment
 */

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("과제리뷰");
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet '과제리뷰' not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(function(row) {
    // 빈 행 제외: A열(본부) 또는 C열(기대영역) 중 하나라도 있으면 포함
    var hasDept = row[0] !== undefined && String(row[0]).trim() !== "";
    var hasArea = row[2] !== undefined && String(row[2]).trim() !== "";
    return hasDept || hasArea;
  });
  
  const result = rows.map((row, index) => {
    const obj = { 
      id: `TASK-${index + 1}`,
      department: row[0] || "",
      priority: row[1] || "",
      expectedArea: row[2] || "",
      reason: row[3] || "",
      expectedChange: row[4] || "",
      executingOrg: row[5] || "",
      considerations: row[6] || "",
      oneLineSummary: row[7] || "",
      workflow: row[8] || "",
      leaderKeyPoints: row[9] || "",
      explorationQuestions: row[10] || "",
      implementationScope: row[11] || "",
      preReviewItems: row[12] || "",
      successDefinition: row[13] || "",
      coreData: {},
      interpretationData: {},
      allData: {}
    };
    
    headers.forEach((header, i) => {
      const value = row[i];
      obj.allData[header] = value;
      
      // Column C-G: Core Data (AI 적용 기대영역 ~ 구현 간 고려사항)
      if (i >= 2 && i <= 6) obj.coreData[header] = value;
      // Column H-N: Interpretation Data (핵심 한 줄 요약 ~ 성공의 정의)
      if (i >= 7 && i <= 13) obj.interpretationData[header] = value;
    });
    
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST: 웹 서비스에서 작성한 내용을 "작성내용" 시트에 추가
 * Body (JSON): { taskId, department, expectedArea, concretize: { q1, q2, q3, q4, q5, q6 } }
 */
function doPost(e) {
  try {
    const payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("작성내용");

    if (!sheet) {
      sheet = ss.insertSheet("작성내용");
      sheet.appendRow([
        "일시", "과제ID", "본부", "과제명",
        "Q1_대상과업_현재수행방식_워크플로우",
        "Q2_현상과_RootCause_도출정의",
        "Q3_RootCause해소_무엇을바꿔야하는가",
        "Q4_AI기반_해소된모습",
        "Q5_솔루션_핵심포함요소",
        "Q6_구현시_고려예상어려움"
      ]);
      sheet.getRange("1:1").setFontWeight("bold");
    }

    const c = payload.concretize || {};
    const row = [
      new Date(),
      payload.taskId || "",
      payload.department || "",
      payload.expectedArea || "",
      c.q1 || "",
      c.q2 || "",
      c.q3 || "",
      c.q4 || "",
      c.q5 || "",
      c.q6 || ""
    ];
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
