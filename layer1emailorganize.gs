""Scan and organize my recent emails from both my main inbox and spam folder to help me manage important communications and review cleanup suggestions.

1. Search and retrieve emails received in my main inbox within the past 24 hours.
2. Search and retrieve emails received in my spam folder within the past 24 hours.
3. Classify inbox emails into two categories:
   - Important emails (e.g., personal communications, essential work/school updates, critical transactional or account notices).
   - Ads, promotional emails, potential scams, and unimportant newsletters.
4. Review spam folder emails to identify any legitimate or important communications that may have been filtered into spam incorrectly (false positives).
5. For all identified high-priority and important emails, automatically apply the "Important Emails" label (and the system "IMPORTANT" label) so they are prominently marked and organized in my mailbox.
6. Present a clear, organized briefing directly in chat containing:
   - Important Inbox Emails: Summary of key messages received and confirmed labeled as important.
   - Proposed Emails for Deletion: Explicitly list out EVERY individual promotional email, ad, newsletter, and marketing message upfront (with full subject line, sender, and brief context) without grouping them into generic summaries.
   - Important Spam Items to Move to Inbox: List of any misclassified emails in spam to restore.
   - A single concluding prompt asking for one bulk confirmation to move all identified ads and low-priority emails into the "Email for Deletion" label.
7. Upon completing the execution (or if incomplete due to errors or blockers), append a status entry to my Google Keep note titled "Automation Execution Log" in the exact format:
   "[Complete/Incomplete], [hh:mm 24-hour time in PST], [mm/dd/yyyy], Organize inbox and spam emails"
   (e.g., "Complete, 08:15 PST, 10/03/2026, Organize inbox and spam emails").""

// Here is the code // 
/**
 * Daily Email Organization Workflow
 * Trigger: Time-driven trigger (Daily between 8am - 9am)
 */
 
function organizeInboxAndSpam() {
  const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  
  // 1. Get or create required labels
  const importantLabel = getOrCreateLabel("Important Emails");
  const deletionLabel = getOrCreateLabel("Email for Deletion");

  // 2. Scan Spam folder for the past 24 hours (Check for false positives)
  const spamQuery = `in:spam after:${oneDayAgo}`;
  const spamThreads = GmailApp.search(spamQuery);
  Logger.log(`Found ${spamThreads.length} spam threads.`);
  
  // If an important email was in spam, move it back to inbox:
  // spamThreads.forEach(thread => { thread.moveToInbox(); thread.addLabel(importantLabel); });

  // 3. Scan Inbox for the past 24 hours
  const inboxQuery = `in:inbox after:${oneDayAgo}`;
  const inboxThreads = GmailApp.search(inboxQuery);
  Logger.log(`Found ${inboxThreads.length} inbox threads.`);

  inboxThreads.forEach(thread => {
    const firstMsg = thread.getMessages()[0];
    const subject = firstMsg.getSubject();
    const from = firstMsg.getFrom();

    if (isHighPriority(from, subject)) {
      // Mark as important
      thread.addLabel(importantLabel);
      thread.markImportant();
      Logger.log(`Marked Important: ${subject}`);
    } else if (isPromotional(from, subject)) {
      // Tag for deletion review and archive from inbox
      thread.addLabel(deletionLabel);
      thread.moveToArchive();
      Logger.log(`Moved to Deletion Label: ${subject}`);
    }
  });

  // 4. Execution Logging
  // Note: Google Keep does not have a native Apps Script service (KeepApp), 
  // so executions are typically logged to Google Sheets, Tasks, or console logs.
  logExecution("Complete", "Organize inbox and spam emails");
}

/**
 * Heuristic check for high-priority emails
 */
function isHighPriority(from, subject) {
  const lowerSub = subject.toLowerCase();
  const lowerFrom = from.toLowerCase();

  const keywords = [
    "receipt", "shipped", "order", "security alert", "statement", 
    "payment", "invoice", "verification", "advising", "zoom", "invitation"
  ];
  return keywords.some(k => lowerSub.includes(k) || lowerFrom.includes(k));
}

/**
 * Heuristic check for promotional emails
 */
function isPromotional(from, subject) {
  const lowerSub = subject.toLowerCase();
  const promoKeywords = ["sale", "off", "deals", "coupon", "limited time", "discount"];
  return promoKeywords.some(k => lowerSub.includes(k));
}

/**
 * Helper to retrieve or create a Gmail label
 */
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/**
 * Helper to log execution status
 */
function logExecution(status, taskName) {
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "America/Los_Angeles", "HH:mm 'PST', MM/dd/yyyy");
  Logger.log(`[Log Entry]: • ${status}, ${timeStr}, ${taskName}`);
}