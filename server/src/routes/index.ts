import { Router } from 'express';

const router = Router();

// API route handlers will be added here
router.get('/', (req, res) => {
  res.json({ message: 'ProcuroApp API v1' });
});

export default router;





