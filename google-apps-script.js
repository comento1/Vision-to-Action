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

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  var type = (e && e.parameter && e.parameter.type) ? String(e.parameter.type) : "";
  if (type === "written") {
    return handleGetWritten_(ss, e);
  }

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

function handleGetWritten_(ss, e) {
  const sheet = ss.getSheetByName("작성내용");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ items: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ items: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = data[0].map(function(h) { return String(h || "").trim(); });
  const rows = data.slice(1);

  var userKeyParam = (e && e.parameter && e.parameter.userKey) ? String(e.parameter.userKey) : "";
  var taskIdParam = (e && e.parameter && e.parameter.taskId) ? String(e.parameter.taskId) : "";

  var idxUserKey = headers.indexOf("사용자키");
  var idxTaskId = headers.indexOf("과제ID");

  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rowUserKey = idxUserKey >= 0 ? String(r[idxUserKey] || "") : "";
    var rowTaskId = idxTaskId >= 0 ? String(r[idxTaskId] || "") : "";

    if (userKeyParam && rowUserKey !== userKeyParam) continue;
    if (taskIdParam && rowTaskId !== taskIdParam) continue;

    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c] || ("col" + c)] = r[c];
    }

    items.push({
      timestamp: String(obj["일시"] || ""),
      userKey: String(obj["사용자키"] || ""),
      userOrg: String(obj["소속본부"] || ""),
      userName: String(obj["이름"] || ""),
      userTitle: String(obj["직급"] || ""),
      taskId: String(obj["과제ID"] || ""),
      taskDepartment: String(obj["본부"] || ""),
      expectedArea: String(obj["과제명"] || ""),
      concretize: {
        q1: String(obj["Q1_대상과업_현재수행방식_워크플로우"] || ""),
        q2: String(obj["Q2_현상과_RootCause_도출정의"] || ""),
        q3: String(obj["Q3_RootCause해소_무엇을바꿔야하는가"] || ""),
        q4: String(obj["Q4_AI기반_해소된모습"] || ""),
        q5: String(obj["Q5_솔루션_핵심포함요소"] || ""),
        q6: String(obj["Q6_구현시_고려예상어려움"] || "")
      }
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ items: items }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST: 웹 서비스에서 작성한 내용을 "작성내용" 시트에 추가
 * Body (JSON): { user: { org, name, title }, taskId, department, expectedArea, concretize: { q1, q2, q3, q4, q5, q6 } }
 */
function doPost(e) {
  try {
    const payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("작성내용");

    if (!sheet) {
      sheet = ss.insertSheet("작성내용");
      sheet.appendRow([
        "일시", "사용자키", "소속본부", "이름", "직급", "과제ID", "본부", "과제명",
        "Q1_대상과업_현재수행방식_워크플로우",
        "Q2_현상과_RootCause_도출정의",
        "Q3_RootCause해소_무엇을바꿔야하는가",
        "Q4_AI기반_해소된모습",
        "Q5_솔루션_핵심포함요소",
        "Q6_구현시_고려예상어려움"
      ]);
      sheet.getRange("1:1").setFontWeight("bold");
    }

    // 기존 시트에 헤더가 구버전이면 필요한 컬럼을 뒤에 추가
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var headers = headerRow.map(function(h) { return String(h || "").trim(); });
    var required = ["일시", "사용자키", "소속본부", "이름", "직급", "과제ID", "본부", "과제명",
      "Q1_대상과업_현재수행방식_워크플로우",
      "Q2_현상과_RootCause_도출정의",
      "Q3_RootCause해소_무엇을바꿔야하는가",
      "Q4_AI기반_해소된모습",
      "Q5_솔루션_핵심포함요소",
      "Q6_구현시_고려예상어려움"
    ];
    for (var ri = 0; ri < required.length; ri++) {
      if (headers.indexOf(required[ri]) === -1) {
        headers.push(required[ri]);
      }
    }
    if (headers.length > headerRow.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange("1:1").setFontWeight("bold");
    }

    var colIndex = {};
    for (var ci = 0; ci < headers.length; ci++) colIndex[headers[ci]] = ci + 1; // 1-based

    var user = payload.user || {};
    var userOrg = String(user.org || "");
    var userName = String(user.name || "");
    var userTitle = String(user.title || "");
    var userKey = (userOrg + "|" + userName + "|" + userTitle).trim();

    var taskId = String(payload.taskId || "");
    var taskDept = String(payload.department || "");
    var expectedArea = String(payload.expectedArea || "");
    var c = payload.concretize || {};

    // upsert: 사용자키 + 과제ID가 같으면 마지막 행을 업데이트, 없으면 append
    var lastRow = sheet.getLastRow();
    var targetRow = -1;
    if (lastRow >= 2 && userKey && taskId && colIndex["사용자키"] && colIndex["과제ID"]) {
      for (var r = 2; r <= lastRow; r++) {
        var rUserKey = String(sheet.getRange(r, colIndex["사용자키"]).getValue() || "");
        var rTaskId = String(sheet.getRange(r, colIndex["과제ID"]).getValue() || "");
        if (rUserKey === userKey && rTaskId === taskId) {
          targetRow = r; // 마지막 매칭으로 덮어쓰기
        }
      }
    }

    if (targetRow === -1) targetRow = lastRow + 1;

    sheet.getRange(targetRow, colIndex["일시"]).setValue(new Date());
    if (colIndex["사용자키"]) sheet.getRange(targetRow, colIndex["사용자키"]).setValue(userKey);
    if (colIndex["소속본부"]) sheet.getRange(targetRow, colIndex["소속본부"]).setValue(userOrg);
    if (colIndex["이름"]) sheet.getRange(targetRow, colIndex["이름"]).setValue(userName);
    if (colIndex["직급"]) sheet.getRange(targetRow, colIndex["직급"]).setValue(userTitle);
    if (colIndex["과제ID"]) sheet.getRange(targetRow, colIndex["과제ID"]).setValue(taskId);
    if (colIndex["본부"]) sheet.getRange(targetRow, colIndex["본부"]).setValue(taskDept);
    if (colIndex["과제명"]) sheet.getRange(targetRow, colIndex["과제명"]).setValue(expectedArea);

    if (colIndex["Q1_대상과업_현재수행방식_워크플로우"]) sheet.getRange(targetRow, colIndex["Q1_대상과업_현재수행방식_워크플로우"]).setValue(c.q1 || "");
    if (colIndex["Q2_현상과_RootCause_도출정의"]) sheet.getRange(targetRow, colIndex["Q2_현상과_RootCause_도출정의"]).setValue(c.q2 || "");
    if (colIndex["Q3_RootCause해소_무엇을바꿔야하는가"]) sheet.getRange(targetRow, colIndex["Q3_RootCause해소_무엇을바꿔야하는가"]).setValue(c.q3 || "");
    if (colIndex["Q4_AI기반_해소된모습"]) sheet.getRange(targetRow, colIndex["Q4_AI기반_해소된모습"]).setValue(c.q4 || "");
    if (colIndex["Q5_솔루션_핵심포함요소"]) sheet.getRange(targetRow, colIndex["Q5_솔루션_핵심포함요소"]).setValue(c.q5 || "");
    if (colIndex["Q6_구현시_고려예상어려움"]) sheet.getRange(targetRow, colIndex["Q6_구현시_고려예상어려움"]).setValue(c.q6 || "");

    return ContentService.createTextOutput(JSON.stringify({ success: true, updated: targetRow <= lastRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
