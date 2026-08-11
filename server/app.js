import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import servicesRouter from './routes/services.js';
import queuesRouter from './routes/queues.js';
import notificationsRouter from './routes/notifications.js';
import historyRouter from './routes/history.js';

// The app is exported without .listen() so unit tests can drive it
// directly with Supertest.
const app = express();

// Content-Disposition is not a CORS-safelisted response header, so without
// this the frontend (vite on :5173, API on :3000) cannot read the filename the
// report routes attach to a download — response.headers.get() just returns
// null. Everything else about the default CORS config is unchanged.
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/services', servicesRouter);
app.use('/api/queues', queuesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', historyRouter); // /api/history/:userId and /api/stats

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.status ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;
