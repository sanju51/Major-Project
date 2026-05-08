import express from 'express';
import { getActivitiesByProject, getActivitiesByUser } from '../controllers/activity.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);

router.get('/project/:projectId', getActivitiesByProject);
router.get('/user', getActivitiesByUser);

export default router;
