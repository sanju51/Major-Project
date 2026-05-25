import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
const router = Router();

router.get('/get-result', aiController.getResult);
router.post('/generate-subtasks', verifyJWT, aiController.generateSubtasks);
router.post('/suggest-deadline', verifyJWT, aiController.suggestDeadline);
router.post('/summarize-meeting', verifyJWT, aiController.summarizeMeeting);
router.post('/predict-risks', verifyJWT, aiController.predictRisks);
router.post('/divide-tasks', verifyJWT, aiController.divideTasks);

export default router;