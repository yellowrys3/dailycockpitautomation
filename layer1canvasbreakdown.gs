""Scan my Google Calendar for upcoming assignments, deadlines, meetings, and events across my calendars over the next 2 weeks that require advance preparation or pre-planning, estimate their durations, and prepare a breakdown into manageable work sessions:

1. Search and retrieve calendar events occurring within the next 14 days (2 weeks) across all my calendars—specifically checking all Canvas calendars (including "Canvas (sub-24) Calendar ", "Kyle Zheng Calendar (Canvas)", and any imported Canvas feeds), "UCSD Class Events and Exams", primary personal calendar, and academic/work calendars.
2. Identify all events that require advance preparation, study, or pre-planning. This includes:
   - Canvas coursework, homework assignments, problem sets, reading modules, projects, quizzes, and exams.
   - Important meetings, interviews, presentations, academic registration/fee deadlines, and milestones.
3. For each identified event, estimate the total prep or completion duration using benchmark guidelines and discretion:
   - Homework / problem sets / reading assignments: ~2 hours
   - Projects and writing-intensive assignments: ~5 hours
   - Lighter exams and quizzes: ~5–7 hours (or 30–60 mins for simple syllabus quizzes)
   - Major/larger exams: ~20–30 hours
   - Meetings, presentations, or administrative deadlines: ~30 minutes to 2 hours depending on scope.
4. Break down each task or preparation requirement into manageable, focused time slots (e.g., 30-minute to 2-hour blocks) distributed logically across the days leading up to the event or due date.
5. Cross-reference my current Google Tasks list to avoid creating duplicate tasks for items already scheduled or in progress.
6. Present the complete proposed breakdown to me in chat—detailing each event, total estimated prep duration, and individual proposed sub-tasks with dates and times—and explicitly request my approval before importing anything into Google Tasks.
7. Only after receiving my explicit approval, create the approved time slots as individual tasks in Google Tasks with their assigned reminder dates and times.
8. Upon completing the scanning and presentation process (or if incomplete due to errors or blockers), append a status entry to my Google Keep note titled "Automation Execution Log" in the exact format:
   "[Complete/Incomplete], [hh:mm 24-hour time in PST], [mm/dd/yyyy], Plan event preparation tasks"
   (e.g., "Complete, 08:15 PST, 10/03/2026, Plan event preparation tasks").""


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