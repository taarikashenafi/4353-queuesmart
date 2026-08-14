# QueueSmart: Final Project Submission

COSC 4353 Summer 2026, Group 16

## 1. GitHub Repository

https://github.com/taarikashenafi/4353-queuesmart

React + Vite frontend, Express 5 backend, SQLite via `better-sqlite3`,
bcrypt password hashing. Commit history shows contributions from all
four members across the assignment 3 and final project branches.

## 2. Test Coverage

Run with `npm run test:coverage`.

| Metric | Result |
|---|---|
| Statements | 91.65% (549/599) |
| Branches | 85.37% (251/294) |
| Functions | 99.24% (131/132) |
| Lines | 91.24% (521/571) |

199 tests across 11 suites, all passing: auth and route guards, service
and queue management, notifications, history and stats, the report data
layer, CSV and PDF export, and the Smart Wait Engine. We were at 88% after
assignment 3 and kept it above the 70-80% bar while adding the reporting
module and the Smart Wait Engine on top.

## 3. Demo Plan

Each member presents the part they built.

| # | Presenter | Shows | Covers |
|---|---|---|---|
| 1 | Armaan Amatya | Register and log in, then a signed-in student blocked from `/admin` in the UI and 403'd by the API | Login and access control |
| 2 | Taarik Ashenafi | Admin creates/edits a service, closes and reopens a queue, removes a waiting user, serves the next person | Admin managing services and queues |
| 3 | Surafel Kafel | Student joins a queue, shows the smart wait estimate and its provenance line, admin serves a few people, estimate updates from real data | Queue interaction and the smart feature |
| 4 | Uchenna Okoronkwo | Reports page: filter by date and service, preview, download CSV, open the file, restart the server mid-demo and show the data survived | Reporting and persistence |

## 4. Contribution Table

| Group Member | Contribution | Discussion Notes |
|---|---|---|
| Armaan Amatya | Authentication middleware (bearer-token verification, database-backed admin role checks) securing all administrator routes, IDOR fixes on profile/history/notifications, frontend token handling and admin route guard, report API routes, CSV export layer, authenticated download helper, auth and report route tests | |
| Taarik Ashenafi | Admin Reports page (report-type, date-range, and service filters, preview table, CSV and PDF download), AdminDashboard rebuilt on live usage statistics, admin navigation, admin-side integration pass | |
| Surafel Kafel | `served_at` schema migration, Smart Wait Engine (observed service-rate estimation with idle-gap filtering and confidence blending), integration into queue estimates, wait provenance in the user-facing screens, engine tests | |
| Uchenna Okoronkwo | Report data layer (participation history, service activity, usage statistics with composable date/service filters), report and coverage tests, a foreign-key bug fix in the Smart Wait Engine tests, coverage report, sample report and explanation, submission document | |

## 5. Sample Report

Report type: Queue Usage Statistics, CSV. Pulled through the real
endpoint as an authenticated admin, not written by hand:

```
GET /api/reports/summary?from=2026-07-30&to=2026-08-13&format=csv
Authorization: Bearer <admin session token>
```

That's the same request the Reports page's "Usage Statistics" type
with a date range and "Download CSV" sends. The data behind it is real
too: a freshly seeded database, then real student accounts registered,
joined real queues, and got served by an admin through the app, so
every timestamp is genuine, nothing backdated. The file, in full:

| Service | Served | Avg wait (min) | Busiest hour |
|---|---|---|---|
| Academic Advising | 3 | 1 | 20:00 |
| Career Services | 2 | 1 | 20:00 |
| Financial Aid | 1 | 0 | 20:00 |
| Tech Support Desk | 2 | 0 | 20:00 |

| Summary | Value |
|---|---|
| Total served | 8 |
| Average wait (min) | 1 |
| Busiest hour | 20:00 |

(Wait times are small since this was generated in one sitting; real
usage over hours or days would spread these out more, same code path.)

**Columns:** Service (`services.name`); Served (count of `status =
'served'` entries in range); Avg wait (min) (mean of `served_at -
joined_at` in minutes, an actual measurement, not the `(position - 1) ×
expected_duration` guess `/api/stats` makes); Busiest hour (the UTC hour
with the most `joined_at` entries).

**How it's generated:** `GET /api/reports/summary`
(`server/routes/reports.js`) calls `usageStatisticsReport()`
(`server/services/reportService.js`), rendered to CSV by `toCsv()`
(`server/services/reportExport.js`) on top of `csv-writer`.

**Who can access it:** Administrators only, `requireAuth` then
`requireAdmin` (`server/middleware/auth.js`). No token gets a `401`, a
logged-in student gets a `403`, an admin gets `200`. Verified live
against the running server. The role check reads from the database on
every request, so a promotion or demotion takes effect immediately, no
re-login needed.

## 6. The Smart Feature: the Smart Wait Engine

Assignment 3 and 4 estimated wait as `people_ahead × expected_duration`,
a number an admin typed in once that never changed no matter how the
line actually moved.

The Smart Wait Engine (`server/services/smartWait.js`) measures it
instead. It pulls every `served_at` timestamp for a service's completed
entries, in order, and diffs consecutive ones to get the actual pace the
line is moving at. Gaps over two hours get dropped before averaging,
those are the line being closed overnight, not people being served
slowly. That observed pace gets blended with the service's configured
`expected_duration`, weighted by how much real data exists (`weight =
min(sample size, 10) / 10`): no history and it's just the configured
number, more completions and it shifts toward what's actually being
observed, capping out at 10 data points. The result carries a confidence
label along with it, `default`, `blended`, or `observed`.

Why it's worth doing: a service configured at 15 minutes that's really
averaging 6 keeps over-quoting its users forever under the old static
formula, with nothing to notice or correct it. This one corrects itself
as evidence comes in, no retraining, no ML dependency, no admin having
to remember to go update a number.

It's additive, not a replacement. `GET /api/queues/:serviceId` keeps its
`estimatedWait` field exactly where the frontend expects it, just
computed from the engine now, and adds a `waitModel` object
(`minutesPerPerson`, `sampleSize`, `source`) next to it. JoinQueue and
QueueStatus show that as a line under the estimate, "based on 34 recent
visits" versus "using scheduled duration," so you can see how confident
the number actually is, not just the number.
