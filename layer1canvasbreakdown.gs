
/**
 * LAYER 1: Canvas Breakdown Scanner (Pure Apps Script / Deterministic Heuristics)
 * Scans Canvas/UCSD calendar events, applies time-estimation rules,
 * checks for existing Google Tasks to prevent duplicates, and prepares task slots.
 */

function runEventPrepScanner() {
  const lookaheadDays = 14;
  const now = new Date();
  const endDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  // 1. Identify target calendars (Canvas, UCSD, or Primary)
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
        startTime: ev.getStartTime(),
        endTime: ev.getEndTime(),
        description: ev.getDescription() || "",
        calendar: cal.getName()
      });
    });
  });

  // 2. Fetch existing Google Tasks to avoid duplicate staging
  let existingTitles = [];
  let targetTaskListId = "@default";

  try {
    const taskLists = Tasks.Tasklists.list().items || [];
    if (taskLists.length > 0) {
      targetTaskListId = taskLists[0].id;
    }
    const existingTasks = Tasks.Tasks.list(targetTaskListId, { showCompleted: false }).items || [];
    existingTitles = existingTasks.map(t => (t.title || "").toLowerCase().trim());
  } catch (err) {
    Logger.log("⚠️ Tasks service warning (check if Advanced Service is enabled): " + err.message);
  }

  Logger.log(`Found ${upcomingEvents.length} events across ${relevantCalendars.length} target calendar(s).`);
  Logger.log(`Cross-referenced with ${existingTitles.length} active tasks.`);

  // 3. Deterministic Workload Heuristic Rules (Hours)
  // Maps keywords in event titles to chunking budgets
  function estimateDurationHours(title) {
    const t = title.toLowerCase();
    if (t.includes("exam") || t.includes("final") || t.includes("midterm")) {
      return 6; // Lighter/staged exam baseline chunk (expandable up to 20-30h across days)
    } else if (t.includes("project") || t.includes("paper") || t.includes("essay") || t.includes("lab report")) {
      return 5; // Intensive project / writing
    } else {
      return 2; // Standard homework assignment default
    }
  }

  // 4. Generate Chunked Subtask Proposals
  const proposedTasks = [];

  upcomingEvents.forEach(ev => {
    const estimatedHours = estimateDurationHours(ev.title);
    const slotDurationHours = 1.5; // Chunk size: 90-minute blocks
    const numSlots = Math.ceil(estimatedHours / slotDurationHours);

    for (let slot = 1; slot <= numSlots; slot++) {
      const taskTitle = `[Prep ${slot}/${numSlots}] ${ev.title}`;
      
      // Duplicate prevention: skip if already present in Google Tasks
      if (!existingTitles.includes(taskTitle.toLowerCase())) {
        proposedTasks.push({
          title: taskTitle,
          parentEvent: ev.title,
          dueDate: ev.startTime,
          estimatedHours: slotDurationHours,
          taskListId: targetTaskListId
        });
      }
    }
  });

  Logger.log(`Generated ${proposedTasks.length} new subtask chunks to stage.`);

  // 5. Execution Status Log Entry (08:15 PST format)
  const timeZone = "America/Los_Angeles";
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  const logEntry = `Complete, ${timeStr} PST, ${dateStr}, Scanned ${upcomingEvents.length} events, Staged ${proposedTasks.length} tasks`;

  Logger.log(`Execution Log Entry: ${logEntry}`);

  return proposedTasks;
}
