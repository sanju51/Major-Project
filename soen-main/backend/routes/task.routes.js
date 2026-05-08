import express from 'express';
import {
  createTask,
  getTasksByProject,
  getTaskById,
  updateTask,
  deleteTask,
  addComment,
} from '../controllers/task.controller.js';
import { verifyJWT, checkProjectRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);

router.post('/', checkProjectRole(['owner', 'admin', 'developer']), createTask);
router.get('/project/:projectId', checkProjectRole(['owner', 'admin', 'developer', 'tester', 'viewer']), getTasksByProject);
router.get('/:taskId', getTaskById);
router.put('/:taskId', updateTask); // For taskId based routes, we might need a different middleware to find project from task
router.delete('/:taskId', deleteTask);
router.post('/:taskId/comments', addComment);

export default router;
