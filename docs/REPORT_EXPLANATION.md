# Sample report: Queue Usage Statistics

File: [`sample-report-usage-statistics.csv`](./sample-report-usage-statistics.csv)

## How it was generated

Nothing in this file was written by hand. On the **Admin Reports page**
(`/admin/reports`), picking "Usage Statistics," a date range, "All
services," and "Download CSV" sends exactly this request, which is what
I ran directly against a running server to produce this file:

```
GET /api/reports/summary?from=2026-07-30&to=2026-08-13&format=csv
Authorization: Bearer <admin session token>
```

- **Endpoint:** `GET /api/reports/summary`, handled in `server/routes/reports.js`
- **Query logic:** `usageStatisticsReport()` in `server/services/reportService.js`
- **CSV rendering:** `toCsv()` in `server/services/reportExport.js`, built on
  the `csv-writer` package

Worth being upfront about: `seed.js` doesn't generate bulk historical
queue activity on its own yet (Surafel's `served_at` migration and Smart
Wait Engine are merged into `main`, the seeded-history piece is still
open). So instead of inventing data, I seeded a fresh database the
normal way (`npm run db:seed`), then drove real activity through the
actual app: registered real student accounts, had them join real
queues, and served them as the admin through `POST /api/queues/:id/serve`.
Every timestamp below is genuine, from a real action in that session.
Wait times are short because it all happened in one sitting (a couple
round to 0), a report pulled after real usage over hours or days would
show larger numbers from the exact same code.

## What's in it, column by column

| Column | Meaning | Where it comes from |
|---|---|---|
| Service | Service name | `services.name` |
| Served | Count of entries with `status = 'served'` for that service, inside the date range | `COUNT(CASE WHEN qe.status = 'served' ...)` over `queue_entries` joined through `queues` to `services` |
| Avg wait (min) | Mean of `served_at - joined_at` in minutes, across that service's served entries in range | Computed in SQL with `julianday(served_at) - julianday(joined_at)`, not the `(position - 1) * expected_duration` estimate `/api/stats` uses, since that one is a projection made when someone joined, not a measurement of what actually happened |
| Busiest hour (UTC) | The hour of day (0-23, UTC, since that's how every timestamp in this app is stored) with the most `joined_at` entries for that service | `strftime('%H', qe.joined_at)`, grouped and maxed in `busiestHours()` |

The footer block (blank line, then label/value pairs) rolls the same
three figures up across every service in range: total served, overall
average wait (measured across every served entry, not an average of the
per-service averages, so a busy service isn't diluted by a quiet one),
and the single busiest hour system-wide.

`from`/`to`/`serviceId` are all optional and compose; this export used a
date range and no service filter, so it covers every service.

## Who can access it

Administrators only. Every report route is wrapped in `adminOnly` (a
chain of `requireAuth` then `requireAdmin`, defined in
`server/middleware/auth.js`):

1. `requireAuth` reads the `Authorization: Bearer <token>` header, looks
   the token up in the live session map, and loads the user's row
   (including `role`) fresh from `user_credentials` in the database. No
   token, or a token that doesn't resolve to a real session, gets a `401`.
2. `requireAdmin` then checks that loaded `role` is `'admin'`. A
   successfully authenticated user whose role isn't admin gets a `403`,
   different from the `401` an unauthenticated caller gets, so the
   frontend can tell "you need to log in" apart from "you're logged in
   but not allowed here."

I checked all three cases against the running server before generating
this file:

| Caller | Result |
|---|---|
| No token | `401 { "error": "Authentication required" }` |
| Logged-in student (role `user`) | `403 { "error": "Administrator access required" }` |
| Logged-in admin (role `admin`) | `200`, the report body |

Because the role check reads from the database on every request instead
of trusting anything client-side, promoting or demoting a user takes
effect on their very next request, no re-login required.
