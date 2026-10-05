# ⚡ Automate Your Life with Gemini: Daily Cockpit System

> **Presented by Google Developer Groups (GDG) on Campus @ UC San Diego**  
> *Speaker & Architect: Kyle Zheng*

An autonomous, multi-source personal operating pipeline that aggregates Canvas LMS deadlines, Gmail communications, and Google Calendar events into an elastic, prioritized daily action plan.

---

## 🎯 The Problem

Students spend 30+ minutes every morning dealing with **academic context switching** and decision fatigue across fragmented platforms (Canvas, Gmail, Calendar, TritonLink)[cite: 1, 2]. 

This project implements an automated, human-in-the-loop pipeline: **AI and scripts propose, humans commit**[cite: 1, 2].

---

## 🏗️ Architecture Overview

The system operates across a three-layer decoupled architecture:
[ Ingestion Layer ]        Canvas iCal Feed | Gmail (Past 24h) | Google Calendar
│
▼
[ Transformation Engine ]  Gemini Flash: Duration Heuristics & Cognitive Breakdown
│
▼
[ Human Approval Gate ]    Interrupt & Resume: Human confirms staged JSON proposals
│
▼
[ Output & Presentation ]  Google Tasks (Pacing) | Google Keep (📌 Daily Cockpit)

### The Morning Automation Routine
* **08:00 AM — Supporting Automation 1 (Smart Gmail Triage):** Ingests inbox and spam over the past 24 hours, differentiates high-priority correspondence from marketing clutter, checks spam for false positives, and stages batch deletions[cite: 1, 2, 4].
* **08:15 AM — Supporting Automation 2 (Canvas Pacing Breakdown):** Scans the next 14 days of academic deadlines, estimates duration based on workload heuristics, and breaks assignments into bite-sized task chunks[cite: 1, 4].
* **09:00 AM — Primary Automation (The Daily Cockpit Synthesis):** Synthesizes open calendar windows, active tasks, and urgent emails into an elastic daily timeline inside a pinned Google Keep brief[cite: 1, 2, 4].

---

## 🛡️ Guardrails & Safety Design

* **Human-in-the-Loop Gate:** Destructive actions (archiving/labeling emails) and task creations stage proposals first and wait for explicit approval[cite: 1, 2, 4].
* **Post-Commit Verification:** An independent background auditor checks committed schedules for circular dependencies, deadline inversions (scheduling study blocks after a due date), and calendar overlaps[cite: 1, 2, 3].
* **Token Optimization:** Uses concise 150-character previews and metadata filters to maintain high reliability while consuming under ~10% of daily free-tier quota limits[cite: 2, 3].

---

## 🚀 Quickstart Guides

Choose the deployment track that fits your technical comfort level:

### Track A: Zero-Code / Prompt-Native (Gemini Spark)
*Best for general students — no coding or terminal required.*

1. **Link Canvas to Google Calendar:**
   * Go to **Canvas** → **Calendar** → Click **Calendar Feed** in the lower-right corner[cite: 1, 4].
   * Copy the `.ics` link, open **Google Calendar**, click the `+` next to *Other calendars*, select **From URL**, and paste it[cite: 1].
2. **Open Gemini Spark / Gemini Web:**
   * Open the prompt templates located in `/prompts`[cite: 1].
   * Run **Prompt 01 (Gmail Triage)** at 8:00 AM, inspect the staged review, and reply `yes` to confirm[cite: 1, 2, 4].
   * Run **Prompt 02 (Canvas Pacing)** at 8:15 AM to chunk your assignments into Google Tasks[cite: 1, 4].
   * Run **Prompt 03 (Daily Cockpit)** at 9:00 AM to generate your daily brief and update your pinned Google Keep note[cite: 1, 2, 4].

---

### Track B: Google Apps Script (Automated API Pipeline)
*Best for developers wanting scheduled cron triggers and headless runs.*

1. **Open Google Apps Script:**
   * Navigate to [script.google.com](https://script.google.com) and create a **New project**.
2. **Enable Google Tasks API:**
   * In the left sidebar, click the `+` next to **Services**.
   * Select **Google Tasks API**, keep the identifier as `Tasks`, and click **Add**[cite: 1].
3. **Configure API Credentials:**
   * Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com)[cite: 1].
   * Create a `Config.gs` file and paste your credentials:
     ```javascript
     const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
     const MODEL_NAME = "gemini-2.5-flash";
     ```
4. **Copy the Source Scripts:**
   * Copy `s1code.gs` for Smart Gmail Triage.
   * Copy `s2code.gs` for Canvas Calendar Pacing & Google Tasks generation.
5. **Set Morning Clock Triggers:**
   * In Apps Script, go to **Triggers** (clock icon on the left) → **Add Trigger**.
   * Bind `runSmartGmailTriageAI` to a time-driven trigger for **8:00 AM to 9:00 AM**[cite: 1, 2].
   * Bind `runEventPrepScannerAI` to a time-driven trigger for **8:00 AM to 9:00 AM**[cite: 1, 2].

---

## ⚙️ Workload Duration Heuristics

Customize these default estimates inside the prompts or code to fit your study habits[cite: 2, 4]:

| Deliverable Type | Total Workload Estimate | Chunking Strategy |
| :--- | :--- | :--- |
| **Standard Homework / Problem Sets** | ~2 Hours | 1–2 focus slots (60–90 mins)[cite: 1, 4] |
| **Projects & Writing Intensive Papers** | ~5 Hours | 2–4 sequential milestones[cite: 1, 4] |
| **Quizzes & Lighter Midterms** | 5–7 Hours | Staged across multiple days[cite: 1, 4] |
| **Major Exams & Finals** | 20–30 Hours | Distributed preparation intervals[cite: 1, 4] |

---

## 📂 Repository Structure

├── prompts/
│   ├── 01_gmail_triage.txt       # System prompt for morning email sweep
│   ├── 02_canvas_pacing.txt       # System prompt for assignment chunking
│   └── 03_daily_cockpit.txt       # Synthesis prompt for Google Keep brief
└── README.md

---

## 📜 License & Acknowledgments

Built for the **Google Developer Groups (GDG) on Campus @ UC San Diego** workshop: *Automate Your Life with Gemini: AI Fundamentals to Daily Cockpit System*[cite: 2].
