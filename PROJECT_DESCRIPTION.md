Reentry — Product Requirements Document
A personal restart assistant that captures your working context and gives you a briefing when you come back.
1. Problem
When people step away from complex work for a day or more, they lose their intent and progress state. Reconstructing context means mentally retracing steps — costing 15–20 minutes per re-entry, 2–3x daily. The friction causes avoidance, guilt, and duplicated work.
This is not a productivity problem. It's a cognitive re-entry problem.
What Gets Lost (by pain level)
Layer
Description
Pain
Intent
What you were trying to accomplish and why
🔴 Critical
Next Action
The smallest concrete next step
🔴 Critical
Open Loops
Unresolved questions or blockers
🟡 High
State
Where things currently stand
🟡 Medium
Decisions
Choices already made and rationale
🟢 Low

Key insight: People don't forget what a project is. They forget where they were in the sequence and what they were trying to do next. This is a workflow memory problem, not a knowledge management problem.
Core Tension
The work that most needs context preservation (exploratory, mid-flight, "thinking work") is the hardest to document. If preserving context feels like extra work, people won't do it — even when they know it helps.

2. Interruption Model
The product must NOT assume clean session boundaries. Work is a continuous stream with unpredictable gaps.
Scenario
User State
Product Response
Planned exit
Intentionally stopping. Has 30–60 sec.
Prompt for quick capture: voice or 1–2 sentences
Abrupt interruption
Pulled away with zero notice
Passive capture / ambient signals reconstruct context
Forgot to capture
Left without logging. Realizes next day.
Retroactive reconstruction: AI helps piece it together

Design principle: The system must never depend on the user having time to document. Planned capture is the ideal path; passive reconstruction is the required fallback.

3. Job to Be Done
When I return to a project after a gap, I want to instantly remember what I was doing, where I left off, and what matters next — so I can start making progress in under 2 minutes instead of flailing for 20.

4. Target User
Primary: Ambitious students and early-career professionals (20–24) juggling internships, coursework, and side projects. High-achieving, tool-savvy, but mentally scattered across too many streams. Uses voice memos and journaling more naturally than structured note-taking.
Secondary: Knowledge workers, PMs, engineers, creatives — anyone doing multi-project deep work with gaps between sessions.

5. Design Principles
Near-zero capture effort — If it feels like documentation, people won't do it. Voice-first, passive-first.
Restart briefing, not dashboard — A short, opinionated summary: here's where you were, here's what matters, here's your next move.
Intent over tasks — Preserve why you're doing something, not just what. Direction > checklist.
Session-based, not project-based — The unit of work is a session. The product bridges the gaps.
Graceful degradation — Works best with intentional capture, works acceptably with zero user input.

6. Core Output: The Restart Briefing
When the user returns to a project, they see a restart card:
Field
Description
Example
Intent
What you were trying to accomplish
"Refactoring the auth module to support OAuth"
Where You Left Off
Last action taken or step completed
"Finished the token refresh flow, untested"
Open Loops
Unresolved questions or blockers
"Waiting on API docs from backend team"
Next Action
The smallest concrete next step
"Write unit tests for token refresh"
Time Away
How long since last session
"2 days ago, Thursday afternoon"


7. MVP Features
7.1 Quick Capture
Trigger: User initiates (hotkey, button, or voice) or system detects session end
Input: Voice memo or text answering: What were you working on? What's unresolved? What's next?
Processing: AI structures raw input into a context snapshot
Goal: Under 30 seconds. Feels like talking to yourself, not filling out a form.
7.2 Interrupt-Speed Capture
Trigger: User has 5–10 seconds before an unplanned context switch
Input: Single text field or voice button. One sentence is enough.
Processing: AI extracts whatever signal it can. Partial context is valuable.
Goal: Accessible in under 2 seconds. Always visible or one hotkey away.
7.3 Restart Briefing
Trigger: User opens the app or selects a project
Output: Restart card with intent, progress state, open loops, and next action
Organization: Cards sorted by recency. Most relevant project surfaces first.
Goal: User goes from "what was I doing?" to "right, got it" in under 60 seconds.
7.4 Retroactive Reconstruction (V1.1)
Trigger: User returns with no capture from last session
Input: System prompts with smart questions based on available signals
Processing: Guided reconstruction — AI helps rebuild context from memory
Goal: Reduces re-entry from 20 minutes to 5.

8. Explicitly Out of Scope (MVP)
Task management or to-do lists
Calendar integration or time blocking
Team collaboration or shared projects
Passive/ambient capture from OS activity (future)
Integrations with Jira, Notion, Slack, GitHub (future)
Analytics or productivity metrics

9. Success Metrics
North Star: Time to meaningful work after re-entry. Target: under 2 minutes (down from 15–20).
Supporting:
Capture rate: % of sessions ending with a context snapshot
Restart briefing usage: % of sessions beginning with a restart card view
Perceived accuracy: user thumbs up/down on briefing helpfulness
Return avoidance reduction: self-reported decrease in dread before restarting
Retention: weekly active usage over 4+ weeks

10. Risks
Risk
Impact
Mitigation
Capture habit doesn't stick
No data, product useless
Design for zero-input fallback
AI briefings feel inaccurate
Users lose trust
Let users edit/correct; train on corrections
Scope creep toward task manager
Loses differentiation
Ruthlessly maintain "re-entry" framing
Privacy concerns with ambient capture
Users won't enable
Start explicit-only; ambient is opt-in, local-first
Problem is real but niche
Low growth ceiling
Validate with PMs, engineers early


11. Roadmap
Phase
Features
Validation Goal
MVP
Quick capture, restart briefing, project list, interrupt-speed capture
Does capture → briefing reduce re-entry time?
V1.1
Retroactive reconstruction, guided questions, capture streaks
Handle "forgot to capture" case
V2
Ambient capture, smart nudges, weekly summaries
Reduce reliance on user input
V3
Integrations (GitHub, Notion, Slack), team context, API
Expand to professional workflows


