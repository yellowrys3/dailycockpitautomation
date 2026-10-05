/**
 * LAYER 1 / SUPPORTING AUTOMATION 2: Canvas Pacing & Task Breakdown via Gemini
 * Runs daily at 8:15 AM (Scheduled cron or manual trigger)
 * 1. Ingests Canvas/UCSD calendar events over the next 14 days.
 * 2. Cross-references active Google Tasks to prevent duplicate prep blocks.
 * 3. Sends context to Gemini Flash with workload heuristics.
 * 4. Stores proposals in UserProperties buffer for zero-argument human approval.
 */

function runEventPrepScannerAI() {
  // Directly accessible because Config.gs is in the same project!
  Logger.log("Using model: " + MODEL_NAME); 
  const rawResponse = callGeminiApiDirect(promptText);
  // ...
}

  const lookaheadDays = 14;
  const now = new Date();
  const endDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  // 1. Ingest target calendars (Canvas, UCSD, Primary)[cite: 1, 4]
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
    return;
  }

  // 2. Fetch existing Google Tasks to avoid duplicate staging[cite: 1, 4]
  let existingTitles = [];
  try {
    const existing = Tasks.Tasks.list("@default", { showCompleted: false }).items || [];
    existingTitles = existing.map(t => (t.title || "").trim());
  } catch (err) {
    Logger.log("⚠️ Tasks service warning (ensure Advanced Service is added): " + err.message);
  }

  Logger.log(`Found ${upcomingEvents.length} events across ${relevantCalendars.length} target calendar(s).`);
  Logger.log(`Cross-referencing with ${existingTitles.length} active Google Tasks.`);

  // 3. Construct Gemini Prompt with Workload Heuristics[cite: 1, 4]
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
1. Evaluate each event's scope and break it down into sequential chunked deliverables (e.g., "[Prep 1/3] CSE 100 PA4: Baseline & Setup").
2. Check existing scheduled tasks to avoid duplicating assignments already chunked.
3. Return ONLY a valid JSON object matching the schema below. No markdown fences or commentary.

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
  const rawResponse = callGeminiApiDirect(prompt, apiKey, modelName);

  // Clean markdown delimiters if returned
  const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (e) {
    Logger.log("JSON Parse Error. Raw output was:\n" + rawResponse);
    throw new Error("Could not parse Gemini JSON response.");
  }

  // 4. Staging Buffer: Save in PropertiesService for human approval[cite: 1, 4]
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("STAGED_CANVAS_TASKS", JSON.stringify(parsed.proposedTasks || []));

  // 5. Output Staged Briefing for Human Review[cite: 1, 4]
  Logger.log("================ 📚 CANVAS AI BREAKDOWN PROPOSAL ================");
  Logger.log("Summary: " + parsed.summary);
  (parsed.proposedTasks || []).forEach((t, i) => {
    Logger.log(`  [${i + 1}] ${t.title} | Target Date: ${t.dueDate} (${t.estimatedHours} hrs)`);
  });
  Logger.log("================================================================");
  Logger.log("👉 NEXT STEP TO APPROVE: Select 'approveAndCommitCanvasTasks' in the function dropdown and click Run.\n");

  // 6. Execution Status Log Entry (08:15 PST format)[cite: 1, 4]
  const timeZone = "America/Los_Angeles";
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  Logger.log(`Execution Log Entry: • Staged, ${timeStr} PST, ${dateStr}, Proposed ${(parsed.proposedTasks || []).length} task blocks via AI`);
}

/**
 * HUMAN-IN-THE-LOOP COMMIT GATE (Zero-argument execution)[cite: 1, 4]
 * Run this function from the dropdown to write staged tasks to Google Tasks.
 */
function approveAndCommitCanvasTasks() {
  const userProperties = PropertiesService.getUserProperties();
  const rawData = userProperties.getProperty("STAGED_CANVAS_TASKS");

  if (!rawData) {
    Logger.log("⚠️ No staged tasks found to commit. Run 'runEventPrepScannerAI' first.");
    return;
  }

  const stagedTasks = JSON.parse(rawData);
  if (stagedTasks.length === 0) {
    Logger.log("Staged tasks buffer is empty.");
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

  // Clear buffer upon successful commit[cite: 1, 4]
  userProperties.deleteProperty("STAGED_CANVAS_TASKS");
  Logger.log(`✅ Successfully inserted ${count} tasks into Google Tasks.`);
}

/**
 * Gemini API Request Wrapper[cite: 1, 2]
 */
function callGeminiApiDirect(promptText, key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2
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
