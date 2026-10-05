/**
 * LAYER 1 / SUPPORTING AUTOMATION 2: Canvas Pacing & Task Breakdown via Gemini
 * Runs daily at 8:15 AM (Scheduled or manual trigger)
 * 1. Ingests Canvas/UCSD calendar events over next 14 days.
 * 2. Cross-references active Google Tasks to prevent duplication.
 * 3. Sends context to Gemini Flash with workload heuristics.
 * 4. Stages chunked subtask proposals with Human-in-the-Loop review.
 */

const GEMINI_API_KEY = "PASTE_YOUR_AI_STUDIO_KEY_HERE";
const MODEL_NAME = "gemini-2.5-flash"; // Free tier

function runEventPrepScannerAI() {
  const lookaheadDays = 14;
  const now = new Date();
  const endDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  // 1. Ingest target calendars (Canvas, UCSD, Primary)
  const calendars = CalendarApp.getAllCalendars();
  const relevantCalendars = calendars.filter(cal => {
    const name = cal.getName().toLowerCase();
    return name.includes("canvas") || name.includes("ucsd") || cal.isMyPrimaryCalendar();
  });

  const upcomingEvents = [];
  relevantCalendars.forEach(cal => {
    const events = cal.getEvents(now, endDate);
    events.forEach(ev => {
      upcomingEvents.push({
        title: ev.getTitle().trim(),
        startTime: ev.getStartTime().toISOString(),
        endTime: ev.getEndTime().toISOString(),
        description: ev.getDescription() ? ev.getDescription().slice(0, 300) : "",
        calendar: cal.getName()
      });
    });
  });

  if (upcomingEvents.length === 0) {
    Logger.log("No upcoming Canvas or UCSD events found in the next 14 days.");
    return [];
  }

  // 2. Fetch existing Google Tasks across the primary list to prevent duplicate staging
  let existingTitles = [];
  let targetTaskListId = "@default";

  try {
    const taskLists = Tasks.Tasklists.list().items || [];
    if (taskLists.length > 0) {
      targetTaskListId = taskLists[0].id;
    }
    const existingTasks = Tasks.Tasks.list(targetTaskListId, { showCompleted: false }).items || [];
    existingTitles = existingTasks.map(t => (t.title || "").trim());
  } catch (err) {
    Logger.log("⚠️ Tasks service warning: " + err.message);
  }

  Logger.log(`Found ${upcomingEvents.length} events across ${relevantCalendars.length} calendars.`);
  Logger.log(`Cross-referencing with ${existingTitles.length} active Google Tasks.`);

  // 3. Build Prompt for Gemini with strict Workload Evaluation Rules
  const prompt = `
You are the Academic Task Breakdown & Pacing Engine for a university student.

[UPCOMING CALENDAR EVENTS (NEXT 14 DAYS)]:
${JSON.stringify(upcomingEvents, null, 2)}

[ALREADY SCHEDULED ACTIVE GOOGLE TASKS]:
${existingTitles.length > 0 ? existingTitles.map(t => `- ${t}`).join("\n") : "None"}

[WORKLOAD EVALUATION HEURISTICS]:
- Standard Homework / Problem Sets: ~2 Hours total (split into 1-2 chunks)
- Projects, Lab Reports, & Writing Intensive Assignments: ~5 Hours total (split into 2-4 chunks)
- Lighter Midterms / Quizzes: 5–7 Hours staged across several days
- Larger / Major Exams & Finals: 20–30 Hours staged across multiple days
- Standard chunk size: 60 to 90 minutes per session block.

[INSTRUCTIONS]:
1. Evaluate each event's title and description to determine its actual workload category.
2. Check the [ALREADY SCHEDULED ACTIVE GOOGLE TASKS]. DO NOT generate a prep task if a subtask or prep slot for that event has already been created.
3. Divide eligible assignments into sequential chunked deliverables (e.g., "[Prep 1/3] CSE 100 PA4: Baseline & Setup", "[Prep 2/3] CSE 100 PA4: Core Implementation").
4. Assign each chunk a proposed completion target date before the actual deadline.
5. Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown quotes or commentary.

{
  "summary": "1-sentence briefing on workload distribution",
  "proposedTasks": [
    {
      "title": "[Prep X/Y] Assignment Name: Milestone",
      "dueDate": "YYYY-MM-DD",
      "estimatedHours": 1.5,
      "notes": "Estimated 90 min deep work block | Due before event deadline"
    }
  ]
}
`;

  Logger.log("🧠 Calling Gemini Flash for intelligent cognitive breakdown...");
  const rawResponse = callGeminiApiDirect(prompt);

  // Clean markdown delimiters if returned
  const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (e) {
    Logger.log("JSON Parse Error. Raw output was:\n" + rawResponse);
    throw new Error("Could not parse Gemini JSON response.");
  }

  // 4. Log Staged Results for Review (Human-in-the-Loop)
  Logger.log("================ 📚 CANVAS AI BREAKDOWN PROPOSAL ================");
  Logger.log("Summary: " + parsed.summary);
  parsed.proposedTasks.forEach((t, i) => {
    Logger.log(`  [${i + 1}] ${t.title} | Target Date: ${t.dueDate} (${t.estimatedHours} hrs)`);
  });
  Logger.log("================================================================");

  // 5. Execution Status Log Entry (08:15 PST format)
  const timeZone = "America/Los_Angeles";
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  const logEntry = `• Staged, ${timeStr} PST, ${dateStr}, Proposed ${parsed.proposedTasks.length} task blocks via AI`;
  Logger.log(`Execution Log Entry: ${logEntry}`);

  // Returns staged proposals to be approved before insertion
  return parsed.proposedTasks;
}

/**
 * HUMAN-IN-THE-LOOP COMMIT GATE
 * Run this function with the returned array from runEventPrepScannerAI() to write to Tasks.
 */
function commitApprovedTasks(stagedTasks) {
  if (!stagedTasks || stagedTasks.length === 0) {
    Logger.log("No tasks provided to commit.");
    return;
  }

  const targetTaskListId = "@default";
  let count = 0;

  stagedTasks.forEach(task => {
    Tasks.Tasks.insert({
      title: task.title,
      notes: task.notes || `Estimated ${task.estimatedHours}h`,
      due: task.dueDate ? new Date(task.dueDate).toISOString() : null
    }, targetTaskListId);
    count++;
  });

  Logger.log(`✅ Successfully inserted ${count} tasks into Google Tasks.`);
}

/**
 * Native UrlFetchApp wrapper for Gemini API
 */
function callGeminiApiDirect(promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2 // Low temperature for deterministic adherence to rules
    }
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
    throw new Error(`Gemini API Error (HTTP ${responseCode}): ` + (json.error ? json.error.message : responseText));
  }

  return json.candidates[0].content.parts[0].text;
}

  return proposedTasks;
}
