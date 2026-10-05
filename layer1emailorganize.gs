
/**
 * SUPPORTING AUTOMATION 1: Smart Gmail & Spam Triage (Deterministic Layer)
 * Scans Inbox and Spam for the last 24 hours, identifies critical vs. promotional threads,
 * and stages proposals for user approval.
 */
function runSmartGmailTriage() {
  const timeZone = "America/Los_Angeles";
  
  // 1. Search Spam (Past 24 Hours) for False Positives
  const spamThreads = GmailApp.search("in:spam newer_than:1d");
  const falsePositivesToRestore = [];

  spamThreads.forEach(thread => {
    const firstMsg = thread.getMessages()[0];
    const subject = firstMsg.getSubject();
    const from = firstMsg.getFrom();

    if (isHighPriority(from, subject)) {
      falsePositivesToRestore.push({
        id: thread.getId(),
        subject: subject,
        from: from
      });
    }
  });

  // 2. Search Primary Inbox (Past 24 Hours)
  const inboxThreads = GmailApp.search("in:inbox newer_than:1d");
  const importantToLabel = [];
  const proposedForDeletion = [];

  inboxThreads.forEach(thread => {
    const firstMsg = thread.getMessages()[0];
    const subject = firstMsg.getSubject();
    const from = firstMsg.getFrom();

    if (isHighPriority(from, subject)) {
      importantToLabel.push({
        id: thread.getId(),
        subject: subject,
        from: from
      });
    } else if (isPromotional(from, subject)) {
      proposedForDeletion.push({
        id: thread.getId(),
        subject: subject,
        from: from
      });
    }
  });

  // 3. Execution Summary Briefing (Staged for Review)
  Logger.log("================ 📬 EMAIL TRIAGE PROPOSAL ================");
  Logger.log(`🚨 False Positives in Spam to Restore (${falsePositivesToRestore.length}):`);
  falsePositivesToRestore.forEach(t => Logger.log(`   • [RESTORE] "${t.subject}" from ${t.from}`));

  Logger.log(`\n⭐ Important Inbox Emails to Flag (${importantToLabel.length}):`);
  importantToLabel.forEach(t => Logger.log(`   • [IMPORTANT] "${t.subject}" from ${t.from}`));

  Logger.log(`\n🗑️ Proposed for Deletion Label / Archive (${proposedForDeletion.length}):`);
  proposedForDeletion.forEach(t => Logger.log(`   • [CLEANUP] "${t.subject}" from ${t.from}`));
  Logger.log("==========================================================");

  // 4. Execution Logging (08:00 PST format)
  const timeStr = Utilities.formatDate(new Date(), timeZone, "HH:mm");
  const dateStr = Utilities.formatDate(new Date(), timeZone, "MM/dd/yyyy");
  Logger.log(`Execution Log Entry: • Staged, ${timeStr} PST, ${dateStr}, Gmail Triage Proposal Ready`);

  // Return staged manifest for user approval
  return {
    restoreSpamIds: falsePositivesToRestore.map(t => t.id),
    importantIds: importantToLabel.map(t => t.id),
    deletionIds: proposedForDeletion.map(t => t.id)
  };
}

/**
 * Executes the bulk updates ONLY after human confirmation
 */
function applyApprovedTriage(stagedManifest) {
  const importantLabel = getOrCreateLabel("Important Emails");
  const deletionLabel = getOrCreateLabel("Email for Deletion");

  // Restore false positives from spam
  stagedManifest.restoreSpamIds.forEach(id => {
    const thread = GmailApp.getThreadById(id);
    thread.moveToInbox();
    thread.addLabel(importantLabel);
    thread.markImportant();
  });

  // Label important inbox threads
  stagedManifest.importantIds.forEach(id => {
    const thread = GmailApp.getThreadById(id);
    thread.addLabel(importantLabel);
    thread.markImportant();
  });

  // Archive and label deletion candidates
  stagedManifest.deletionIds.forEach(id => {
    const thread = GmailApp.getThreadById(id);
    thread.addLabel(deletionLabel);
    thread.moveToArchive();
  });

  Logger.log("✅ Successfully committed approved email updates.");
}

/**
 * Heuristics for high-priority emails
 */
function isHighPriority(from, subject) {
  const text = (subject + " " + from).toLowerCase();
  const keywords = [
    "security alert", "verification", "advising", "zoom", "invitation", 
    "payment", "invoice", "receipt", "shipped", "tritonlink", "ucsd"
  ];
  return keywords.some(k => text.includes(k));
}

/**
 * Heuristics for promotional / low-priority emails
 */
function isPromotional(from, subject) {
  const text = subject.toLowerCase();
  const promoKeywords = [
    "sale", "off", "deals", "coupon", "limited time", "discount", 
    "clearance", "exclusive offer", "newsletter", "unsubscribe"
  ];
  return promoKeywords.some(k => text.includes(k));
}

/**
 * Helper to get or create label
 */
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
