import express from 'express';
import { getProjectAnalytics, getDashboardStats } from '../controllers/analytics.controller.js';
import { verifyJWT, checkProjectRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);

router.get('/dashboard', getDashboardStats);
router.get('/project/:projectId', checkProjectRole(['owner', 'admin']), getProjectAnalytics);

export default router;
