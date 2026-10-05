/**
 * LAYER 1 / SUPPORTING AUTOMATION 1: Smart Gmail & Spam Triage via Gemini AI
 * Runs daily at 8:00 AM (Scheduled cron or manual trigger)
 * 1. Pulls emails received in Inbox and Spam in the past 24 hours.
 * 2. Extracts compact metadata (Sender, Subject, 150-char snippet).
 * 3. Sends context to Gemini Flash for intelligent priority/spam classification[cite: 1, 2].
 * 4. Buffers plan in PropertiesService for zero-argument human approval[cite: 1, 2, 4].
 */

function runSmartGmailTriageAI() {
  // Directly accessible because Config.gs is in the same project!
  Logger.log("Using model: " + MODEL_NAME); 
  const rawResponse = callGeminiApiDirect(promptText);
  // ...
}

  // 1. Ingest Inbox Emails (Past 24 Hours)[cite: 1, 2, 4]
  const inboxThreads = GmailApp.search("in:inbox newer_than:1d", 0, 20);
  const inboxPayload = inboxThreads.map(thread => {
    const firstMsg = thread.getMessages()[0];
    const snippet = firstMsg 
      ? firstMsg.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, 150)
      : "";
    return {
      threadId: thread.getId(),
      from: firstMsg ? firstMsg.getFrom() : "Unknown",
      subject: firstMsg ? firstMsg.getSubject() : "No Subject",
      snippet: snippet
    };
  });

  // 2. Ingest Spam Emails (Past 24 Hours) to detect false positives[cite: 1, 2, 4]
  const spamThreads = GmailApp.search("in:spam newer_than:1d", 0, 15);
  const spamPayload = spamThreads.map(thread => {
    const firstMsg = thread.getMessages()[0];
    const snippet = firstMsg 
      ? firstMsg.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, 150)
      : "";
    return {
      threadId: thread.getId(),
      from: firstMsg ? firstMsg.getFrom() : "Unknown",
      subject: firstMsg ? firstMsg.getSubject() : "No Subject",
      snippet: snippet
    };
  });

  if (inboxPayload.length === 0 && spamPayload.length === 0) {
    Logger.log("No new inbox or spam emails detected over the past 24 hours.");
    return null;
  }

  Logger.log(`Ingested ${inboxPayload.length} inbox threads and ${spamPayload.length} spam threads.`);

  // 3. Construct Gemini Prompt for Triage[cite: 1, 2, 4]
  const prompt = `
You are the Smart Gmail Triage Engine for a university student.

[INBOX EMAILS (PAST 24H)]:
${JSON.stringify(inboxPayload, null, 2)}

[SPAM EMAILS (PAST 24H)]:
${JSON.stringify(spamPayload, null, 2)}

[TRIAGE CLASSIFICATION CRITERIA]:
1. "important": High priority, personal correspondence, professors, academic advisors, UCSD notifications, security alerts, invoices/receipts, bills, or shipping updates.
2. "deletion": Low priority, promotional newsletters, discount/sale ads, automated marketing, or junk.
3. "restoreFromSpam": Any email currently in SPAM that is actually legitimate/critical and was filtered incorrectly (false positive).

[INSTRUCTIONS]:
- Evaluate the subject, sender, and snippet of each email.
- Classify each thread ID into the correct action bucket.
- Output ONLY valid raw JSON conforming strictly to the schema below. Do not wrap in markdown or include extra commentary.

{
  "summary": "1-sentence summary of today's email triage",
  "importantThreadIds": ["id1", "id2"],
  "deletionThreadIds": ["id3", "id4"],
  "restoreSpamThreadIds": ["id5"]
}
`;

  Logger.log("🧠 Calling Gemini Flash for semantic email classification...");
  const rawResponse = callGeminiApiDirect(prompt, apiKey, modelName);

  // Clean markdown delimiters if present
  const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (e) {
    Logger.log("JSON Parse Error. Raw response was:\n" + rawResponse);
    throw new Error("Could not parse Gemini JSON response.");
  }

  // 4. Staging Buffer: Save in PropertiesService for human approval[cite: 1, 2, 4]
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("STAGED_GMAIL_PLAN", JSON.stringify(parsed));

  // 5. Output Staged Briefing for Human Review[cite: 1, 2, 4]
  Logger.log("\n================ 📬 GMAIL AI TRIAGE PROPOSAL ================");
  Logger.log("Summary: " + parsed.summary);
  Logger.log(`🚨 False Positives to Restore from Spam (${(parsed.restoreSpamThreadIds || []).length}): ` + (parsed.restoreSpamThreadIds || []).join(", "));
  Logger.log(`⭐ Important Emails to Flag (${(parsed.importantThreadIds || []).length}): ` + (parsed.importantThreadIds || []).join(", "));
  Logger.log(`🗑️ Promotional Emails to Move to Deletion (${(parsed.deletionThreadIds || []).length}): ` + (parsed.deletionThreadIds || []).join(", "));
  Logger.log("============================================================");
  Logger.log("👉 NEXT STEP TO APPROVE: Select 'approveAndCommitGmailTriage' in the function dropdown and click Run.\n");

  // 6. Execution Status Log Entry (08:00 PST format)[cite: 1, 2, 4]
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  Logger.log(`[Activity Log]: • Staged, ${timeStr} PST, ${dateStr}, Gmail Triage Proposal Staged via AI`);
}

/**
 * HUMAN-IN-THE-LOOP COMMIT GATE (Zero-argument execution)[cite: 1, 2, 4]
 * Run this function from the dropdown to execute approved email updates.
 */
function approveAndCommitGmailTriage() {
  const userProperties = PropertiesService.getUserProperties();
  const rawData = userProperties.getProperty("STAGED_GMAIL_PLAN");

  if (!rawData) {
    Logger.log("⚠️ No staged email actions found. Run 'runSmartGmailTriageAI' first.");
    return;
  }

  const stagedPlan = JSON.parse(rawData);
  const importantLabel = getOrCreateLabel("Important Emails");
  const deletionLabel = getOrCreateLabel("Email for Deletion");

  // 1. Restore false positives from spam -> inbox + Important[cite: 1, 2, 4]
  (stagedPlan.restoreSpamThreadIds || []).forEach(id => {
    try {
      const thread = GmailApp.getThreadById(id);
      thread.moveToInbox();
      thread.addLabel(importantLabel);
      thread.markImportant();
    } catch (e) {
      Logger.log(`Could not restore spam thread ${id}: ` + e.message);
    }
  });

  // 2. Mark important inbox threads[cite: 1, 2, 4]
  (stagedPlan.importantThreadIds || []).forEach(id => {
    try {
      const thread = GmailApp.getThreadById(id);
      thread.addLabel(importantLabel);
      thread.markImportant();
    } catch (e) {
      Logger.log(`Could not label thread ${id} as important: ` + e.message);
    }
  });

  // 3. Label deletion candidates & archive from inbox[cite: 1, 2, 4]
  (stagedPlan.deletionThreadIds || []).forEach(id => {
    try {
      const thread = GmailApp.getThreadById(id);
      thread.addLabel(deletionLabel);
      thread.moveToArchive();
    } catch (e) {
      Logger.log(`Could not move thread ${id} to deletion: ` + e.message);
    }
  });

  // Clear buffer on success[cite: 1, 4]
  userProperties.deleteProperty("STAGED_GMAIL_PLAN");
  Logger.log("✅ Successfully executed approved Gmail label updates and cleanups.");
}

/**
 * Gemini API Request Wrapper[cite: 1]
 */
function callGeminiApiDirect(promptText, key, model) {
  const url = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${key}`;
  
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1 // Low temperature for deterministic classification
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

/**
 * Helper to fetch or create label
 */
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
