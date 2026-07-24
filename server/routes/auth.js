import { Router } from 'express';
import { registerUser, loginUser } from '../services/authService.js';

// Authentication module (owner: Armaan)
// Routes are thin HTTP adapters — business rules live in services/authService.js.

const router = Router();

router.post('/register', (req, res) => {
  const user = registerUser(req.body);
  res.status(201).json(user);
});

router.post('/login', (req, res) => {
  const session = loginUser(req.body);
  res.json(session);
});

export default router;
