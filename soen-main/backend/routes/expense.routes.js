import express from 'express';
import {
  createExpense,
  getExpensesByProject,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from '../controllers/expense.controller.js';
import { verifyJWT, authorizeRoles, checkProjectRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);

router.post('/', checkProjectRole(['owner', 'admin']), createExpense);
router.get('/project/:projectId', checkProjectRole(['owner', 'admin']), getExpensesByProject);
router.get('/:expenseId', getExpenseById);
router.put('/:expenseId', updateExpense);
router.delete('/:expenseId', deleteExpense);

export default router;
