import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import servicesRouter from './routes/services.js';
import queuesRouter from './routes/queues.js';
import notificationsRouter from './routes/notifications.js';
import historyRouter from './routes/history.js';

// The app is exported without .listen() so unit tests can drive it
// directly with Supertest.
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
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
