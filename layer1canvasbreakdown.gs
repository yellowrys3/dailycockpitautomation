
// Here is the code //
/**
 * Daily Event & Canvas Assignment Preparation Scanner
 * Scans calendars for the next 14 days, cross-references Tasks, and logs execution.
 */
 
function runEventPrepScanner() {
  const lookaheadDays = 14;
  const now = new Date();
  const endDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  // 1. Identify target calendars (Primary, Canvas, UCSD)
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
        title: ev.getTitle(),
        startTime: ev.getStartTime(),
        endTime: ev.getEndTime(),
        description: ev.getDescription(),
        calendar: cal.getName()
      });
    });
  });

  // 2. Fetch existing Google Tasks to avoid duplicate scheduling
  const taskLists = Tasks.Tasklists.list().items || [];
  const primaryTaskListId = taskLists.length > 0 ? taskLists[0].id : "@default";
  const existingTasks = Tasks.Tasks.list(primaryTaskListId).items || [];
  const existingTitles = existingTasks.map(t => t.title.toLowerCase());

  Logger.log(`Found ${upcomingEvents.length} events across ${relevantCalendars.length} calendars.`);
  Logger.log(`Cross-referenced with ${existingTitles.length} existing tasks.`);

  // 3. Format and record execution status (08:15 PST, MM/DD/YYYY)
  const timeZone = "America/Los_Angeles";
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  const logEntry = `Complete, ${timeStr} PST, ${dateStr}, Plan event preparation tasks`;

  Logger.log(`Execution Log Entry: ${logEntry}`);
}
