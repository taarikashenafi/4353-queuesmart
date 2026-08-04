import { Router } from 'express';
import { getProfile, updateProfile } from '../services/profileService.js';

// User profile module (owner: Armaan)
// Routes are thin HTTP adapters — business rules live in services/profileService.js.

const router = Router();

router.get('/:userId', (req, res) => {
  res.json(getProfile(req.params.userId));
});

router.put('/:userId', (req, res) => {
  res.json(updateProfile(req.params.userId, req.body));
});

export default router;
