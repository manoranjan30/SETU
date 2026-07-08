# Planning Phase 2 Mobile Handoff

## Scope

Implement these Planning module mobile features:

1. Task Manager.
2. Follow-up Register.
3. Site Journal.

The backend and web app now support project team and vendor assignee selection,
task/follow-up lifecycle actions, journal lifecycle actions, photos, and summary
counts.

## Permissions

Use existing permission checks:

```text
PLANNING.TASK.READ
PLANNING.TASK.CREATE
PLANNING.TASK.UPDATE
PLANNING.TASK.DELETE
PLANNING.FOLLOWUP.READ
PLANNING.FOLLOWUP.CREATE
PLANNING.FOLLOWUP.UPDATE
PLANNING.FOLLOWUP.DELETE
PLANNING.JOURNAL.READ
PLANNING.JOURNAL.CREATE
PLANNING.JOURNAL.UPDATE
PLANNING.JOURNAL.DELETE
```

Hide CTA buttons when the matching permission is missing.

## Shared Project Action Summary

```http
GET /api/planning/projects/{projectId}/actions/summary
```

Response:

```json
{
  "activeTasks": 12,
  "completedTasks": 5,
  "overdueFollowups": 2,
  "dueTodayFollowups": 4,
  "todayJournalStatus": "DRAFT",
  "todayJournalId": 18
}
```

Use this for Planning hub cards.

## Assignee Picker

Do not ask users to type IDs.

```http
GET /api/planning/projects/{projectId}/tasks/assignee-options
```

Response item:

```json
{
  "type": "INTERNAL_USER",
  "userId": 42,
  "tempUserId": null,
  "label": "Vijay Prasad MC",
  "displayName": "Vijay Prasad MC",
  "username": "vijay",
  "designation": "QA/QC Engineer",
  "company": "Internal Team",
  "roleNames": ["QA/QC Engineer"]
}
```

Vendor users return:

```json
{
  "type": "VENDOR_USER",
  "userId": 77,
  "tempUserId": 13,
  "label": "Kirana T P - KALPATARU PROJECTS INTERNATIONAL",
  "company": "KALPATARU PROJECTS INTERNATIONAL"
}
```

When creating/updating tasks or follow-ups, submit:

```json
{
  "assignedToType": "VENDOR_USER",
  "assignedToUserId": 77,
  "assignedToTempUserId": 13
}
```

## Task Manager

List endpoints:

```http
GET /api/planning/projects/{projectId}/tasks
GET /api/planning/projects/{projectId}/tasks/active
GET /api/planning/projects/{projectId}/tasks/completed
GET /api/planning/projects/{projectId}/tasks/history
GET /api/planning/projects/{projectId}/tasks/my
GET /api/planning/projects/{projectId}/tasks/{id}
```

Create:

```http
POST /api/planning/projects/{projectId}/tasks
```

Payload:

```json
{
  "title": "Close slab cycle delay action",
  "description": "Coordinate shuttering team and update recovery plan.",
  "taskType": "SCHEDULE",
  "status": "TODO",
  "priority": "HIGH",
  "assignedToType": "INTERNAL_USER",
  "assignedToUserId": 42,
  "assignedToTempUserId": null,
  "dueDate": "2026-07-12",
  "reminderAt": "2026-07-11T09:00:00.000Z",
  "progressPercent": 0,
  "tags": ["slab", "recovery"],
  "checklistItems": [
    { "text": "Confirm workfront", "done": false },
    { "text": "Update manpower plan", "done": false }
  ]
}
```

Update/status:

```http
PATCH /api/planning/projects/{projectId}/tasks/{id}
PATCH /api/planning/projects/{projectId}/tasks/{id}/status
POST  /api/planning/projects/{projectId}/tasks/{id}/complete
POST  /api/planning/projects/{projectId}/tasks/{id}/reopen
DELETE /api/planning/projects/{projectId}/tasks/{id}
```

Comments:

```http
GET  /api/planning/projects/{projectId}/tasks/{id}/comments
POST /api/planning/projects/{projectId}/tasks/{id}/comments
```

Mobile UI:

- Planning hub cards: Active, Completed, History, My Tasks.
- Task detail page with title, assignee, due date, priority, progress, tags,
  checklist items, comments, and linked module/reference.
- Quick actions: Start/In Progress, Block, Complete, Reopen.
- Show vendor/internal assignee label, not raw IDs.

## Follow-up Register

List endpoints:

```http
GET /api/planning/projects/{projectId}/followups
GET /api/planning/projects/{projectId}/followups/my
GET /api/planning/projects/{projectId}/followups/due-today
GET /api/planning/projects/{projectId}/followups/overdue
GET /api/planning/projects/{projectId}/followups/history
GET /api/planning/projects/{projectId}/followups/{id}
```

Create:

```http
POST /api/planning/projects/{projectId}/followups
```

Payload:

```json
{
  "actionItem": "Follow up vendor material delivery",
  "assignedToType": "VENDOR_USER",
  "assignedToUserId": 77,
  "assignedToTempUserId": 13,
  "raisedDate": "2026-07-08",
  "dueDate": "2026-07-10",
  "reminderAt": "2026-07-09T09:00:00.000Z",
  "priority": "HIGH",
  "followupType": "PROCUREMENT",
  "meetingReference": "Site Meeting 2026-07-08",
  "remarks": "Critical for next slab cycle."
}
```

Actions:

```http
PATCH /api/planning/projects/{projectId}/followups/{id}
POST  /api/planning/projects/{projectId}/followups/{id}/close
POST  /api/planning/projects/{projectId}/followups/{id}/reopen
POST  /api/planning/projects/{projectId}/followups/{id}/snooze
POST  /api/planning/projects/{projectId}/followups/{id}/convert-to-task
DELETE /api/planning/projects/{projectId}/followups/{id}
```

Snooze payload:

```json
{
  "reminderAt": "2026-07-10T09:00:00.000Z",
  "dueDate": "2026-07-10"
}
```

Mobile UI:

- Reminder-style list: Today, Overdue, Upcoming, Closed/History.
- Detail page with close/reopen/snooze/convert-to-task.
- Show meeting reference, source module, priority, assignee, due date.

## Site Journal

List endpoints:

```http
GET /api/planning/projects/{projectId}/journal
GET /api/planning/projects/{projectId}/journal/today
GET /api/planning/projects/{projectId}/journal/calendar
GET /api/planning/projects/{projectId}/journal/search?q=text
GET /api/planning/projects/{projectId}/journal/{id}
```

Create/update:

```http
POST  /api/planning/projects/{projectId}/journal
PATCH /api/planning/projects/{projectId}/journal/{id}
```

Payload:

```json
{
  "date": "2026-07-08",
  "weather": "SUNNY",
  "journalType": "DAILY_PROGRESS",
  "locationText": "Tower A / 12th Floor",
  "summary": "RCC work progressed with minor material delay.",
  "workDoneToday": "Column reinforcement completed.",
  "progressNotes": "Cycle is one day behind baseline.",
  "issuesRaised": "Concrete pump availability delayed.",
  "safetyObservations": "Barricading checked.",
  "qualityObservations": "Cover blocks to be rechecked.",
  "decisionsTaken": "Night shift approved for catch-up.",
  "instructionsGiven": "Vendor to increase manpower.",
  "materialReceived": "Steel received for next pour.",
  "delaysOrConstraints": "Pump breakdown for two hours.",
  "tomorrowPlan": "Proceed with shuttering inspection.",
  "laborCount": 145,
  "tags": ["rcc", "tower-a"]
}
```

Lifecycle:

```http
POST /api/planning/projects/{projectId}/journal/{id}/submit
POST /api/planning/projects/{projectId}/journal/{id}/lock
POST /api/planning/projects/{projectId}/journal/{id}/reopen
DELETE /api/planning/projects/{projectId}/journal/{id}
```

Photos:

```http
POST /api/planning/projects/{projectId}/journal/{id}/photos
Content-Type: multipart/form-data
files: one or more image/document files
```

Mobile UI:

- Today quick entry.
- Calendar/history view.
- Searchable journal timeline.
- Photo gallery and upload.
- Status chips: Draft, Submitted, Locked.
- Allow edit only when update permission exists and entry is not treated as
  locked by the mobile UI.

## Notifications

Backend currently sends push notifications for:

- `TASK_ASSIGNED`
- `FOLLOWUP_ASSIGNED`

Mobile should route notification taps to:

```text
TASK_ASSIGNED      -> Planning / Task Detail
FOLLOWUP_ASSIGNED  -> Planning / Follow-up Detail
```

## Acceptance

- No screen asks for raw user ID.
- Vendor users are selectable wherever assignees are required.
- Task completion updates active/completed counts.
- Follow-up close/reopen/snooze updates Today/Overdue views.
- Convert follow-up to task creates one linked task.
- Journal today status updates after save/submit/lock/reopen.
- Photos uploaded to journal are visible after reload.
- Permission-hidden actions remain hidden.
