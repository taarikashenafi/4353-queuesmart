import { Router } from 'express';
import { getProfile, updateProfile } from '../services/profileService.js';
import { requireAuth, requireSelfOrAdminParam } from '../middleware/auth.js';

// User profile module (owner: Armaan)
// Routes are thin HTTP adapters — business rules live in services/profileService.js.
//
// A profile holds personal contact details, so both routes require a session
// and only expose the caller's own record (administrators may reach anyone's).

const router = Router();

const ownerOnly = [requireAuth, requireSelfOrAdminParam('userId')];

router.get('/:userId', ownerOnly, (req, res) => {
  res.json(getProfile(req.params.userId));
});

router.put('/:userId', ownerOnly, (req, res) => {
  res.json(updateProfile(req.params.userId, req.body));
});

export default router;
