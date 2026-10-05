
/**
 * GDG UCSD - Daily Cockpit Apps Script Fallback
 * Ingests Calendar & Gmail data, calls Gemini API via UrlFetchApp, and logs the synthesized brief.
 */

const GEMINI_API_KEY = "[GEMINI API KEY GOES HERE]";
const MODEL_NAME = "gemini-3.8-flash"; 

function generateDailyCockpitFallback() {
  const today = new Date();

    // 1. Calendar Ingestion
  const events = CalendarApp.getDefaultCalendar().getEventsForDay(today);
  const eventList = events.map(e => `${e.getTitle()} (${e.getStartTime().toLocaleTimeString()} - ${e.getEndTime().toLocaleTimeString()})`).join("\n") || "No calendar events scheduled (Open for deep work).";

  // 2. Gmail Ingestion
  const threads = GmailApp.search("label:important newer_than:1d", 0, 10);
  const emailList = threads.map(t => {
    const msgs = t.getMessages();
    const firstMsg = msgs[0];
    const preview = firstMsg ? firstMsg.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, 150) + "..." : "No preview available";
    return `- Subject: ${t.getFirstMessageSubject()} (Snippet: ${preview})`;
  }).join("\n") || "No urgent emails found.";

  // 3. Google Tasks 
  const tasksList = getPendingTasks();

  // 4. Compose the synthesis prompt
  const prompt = `
You are the Daily Cockpit Executive Assistant.

=== TODAY'S INPUT SIGNALS ===
[GOOGLE CALENDAR COMMITMENTS]
${eventList}

[PENDING GOOGLE TASKS]
${tasksList}

[URGENT EMAILS (PAST 24H)]
${emailList}

=== INSTRUCTIONS ===
1. Index tasks sequentially under uppercase prefixes:
   - List A = Academic/Admin
   - List B = Study/FMVA
   - List C = Personal/Daily
   - List D = Content/Social Media
2. Flag Critical and High priority focus deliverables first.
3. Outline an elastic execution flow balancing fixed commitments and focus blocks.
4. Keep it punchy, structured, and ready to review.
`;

  // 5 Send payload to Gemini API via UrlFetchApp
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  const json = JSON.parse(responseText);

  if (responseCode !== 200 || !json.candidates || json.candidates.length === 0) {
    Logger.log("❌ API Call Failed! HTTP Code: " + responseCode);
    Logger.log("Full Response: " + responseText);
    throw new Error("Gemini API error: " + (json.error ? json.error.message : responseText));
  }

  const brief = json.candidates[0].content.parts[0].text;

  Logger.log("--- 📌 DAILY COCKPIT SYNTHESIS ---");
  Logger.log(brief);


  // 6. Output Target: Since KeepApp does not exist in standard Apps Script,
  // we push the brief to a pinned Google Doc or Google Tasks
  saveBriefToDoc(brief);
}

function saveBriefToDoc(briefText) {
  const docName = "📌 Daily Cockpit - Live Brief";
  const files = DriveApp.getFilesByName(docName);
  let doc;
  
  if (files.hasNext()) {
    doc = DocumentApp.openById(files.next().getId());
    doc.getBody().clear(); // Overwrite with fresh morning brief
  } else {
    doc = DocumentApp.create(docName);
  }
  
  doc.getBody().setText(briefText);
  Logger.log("✅ Brief saved to Google Doc: " + doc.getUrl());
}

/**
 * Ingests all pending tasks across all user task lists.
 */
function getPendingTasks() {
  try {
    const taskLists = Tasks.Tasklists.list().items || [];
    let allTasks = [];

    taskLists.forEach(list => {
      const tasks = Tasks.Tasks.list(list.id, {
        showCompleted: false,
        showHidden: false
      }).items || [];

      tasks.forEach(t => {
        const dueStr = t.due ? ` (Due: ${t.due.slice(0, 10)})` : " (No date)";
        allTasks.push(`- [${list.title}] ${t.title}${dueStr}`);
      });
    });

    return allTasks.join("\n") || "No pending Google Tasks.";
  } catch (err) {
    Logger.log("⚠️ Could not fetch Google Tasks: " + err.message);
    return "Google Tasks not enabled or unavailable.";
  }
}
