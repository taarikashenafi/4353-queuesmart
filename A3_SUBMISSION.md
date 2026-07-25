# QueueSmart — Backend & API Submission

COSC 4353 Summer 2026, Group 16

**Repo:** https://github.com/taarikashenafi/4353-queuesmart

## Backend Technologies

- **Node.js + Express** — we already write the front end in JavaScript with React/Vite, so keeping the backend in the same language meant everyone could move between the front and back end without switching gears.
- **Vitest** — it's the test runner that comes with Vite, so it fit naturally into our existing setup instead of bringing in a second testing tool.
- **Supertest** — lets us test the API directly over HTTP (status codes, error messages) without spinning up a real server, keeping tests fast and reliable.
- **In-memory storage** — all data (users, services, queues, notifications, history) lives in plain JS objects in `server/store.js`. `resetStore()` clears everything between tests so they don't interfere with each other.

## Test Coverage

Run with `npm run test:coverage`.

| Metric | Result |
|---|---|
| Statements | 98.56% (137/139) |
| Branches | 91.37% (53/58) |
| Functions | 100% (42/42) |
| Lines | 98.5% (132/134) |

52 tests across 4 suites cover registration/login, service CRUD and validation, wait-time estimation, notifications, and history/stats aggregation.

## Contribution Table

| Group Member | Contribution | Discussion Notes |
|---|---|---|
| Armaan Amatya | Backend scaffolding (Express app, in-memory store, validation helpers, error middleware), Authentication module + unit tests, Login/Register API integration | |
| Taarik Ashenafi | Service Management module + unit tests, shared frontend API client, ServiceManagement/AdminDashboard integration | |
| Surafel Kafel | Queue Management module (join/leave/serve, priority + arrival ordering) + unit tests | |
| Uchenna Okoronkwo | Wait-time estimation, Notifications + History/Stats modules + unit tests, Dashboard/History integration, coverage report, submission document | |
