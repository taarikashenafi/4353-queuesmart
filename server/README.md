# QueueSmart Backend

Express backend with persistent SQLite storage. Run with `npm run db:seed`
once to add the sample services and administrator account, then start the API
with `npm run server` (port 3000). Tests: `npm run test`.

## Architecture

The backend uses a simple layered design so each module stays testable and
no layer reaches around another:

```
HTTP request
   │
   ▼
routes/        thin HTTP adapters: parse the request, call a service,
   │           send the JSON response. No business rules here.
   ▼
services/      business logic per module: validation, rules, and all
   │           reads/writes against SQLite.
   ▼
db/            SQLite connection, relational schema, and seed data.
```

Cross-cutting pieces:

- `validators.js` — shared validation helpers. Throw `ApiError(status, message)`
  and the global error middleware in `app.js` turns it into a JSON
  `{ "error": message }` response with the right status code.
- `app.js` — builds the Express app (CORS, JSON parsing, routers, 404 + error
  middleware) and exports it **without** calling `.listen()`, so tests can
  drive it directly with Supertest. `index.js` is the only file that listens.

## Adding your module

1. Put business logic in `services/<module>Service.js` — plain functions that
   take input, validate with the helpers in `validators.js`, access the
   database, and return plain objects.
2. Keep your router in `routes/<module>.js` to one or two lines per endpoint:
   call the service, send the response.
3. Write tests in `tests/<module>.test.js`. Call `resetAppDb()` in a
   `beforeEach` so tests stay independent. Test through the HTTP layer with
   Supertest (validates status codes and error shapes) and hit every
   validation branch.

## Conventions

- Validation errors → 400, bad credentials → 401, unknown resource → 404.
  Every error body is `{ "error": "human-readable message" }`.
- Emails are stored trimmed and lowercased.
- Never store or return plain-text passwords; only `passwordHash` is kept,
  and API responses expose `{ id, email, role }` only.
