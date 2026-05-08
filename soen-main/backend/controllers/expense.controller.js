import * as expenseService from '../services/expense.service.js';

export const createExpense = async (req, res) => {
  try {
    const expenseData = { ...req.body, submittedBy: req.user._id };
    const expense = await expenseService.createExpense(expenseData);
    res.status(201).json({ expense });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getExpensesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const expenses = await expenseService.getExpensesByProject(projectId);
    res.status(200).json({ expenses });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const expense = await expenseService.getExpenseById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.status(200).json({ expense });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const expense = await expenseService.updateExpense(expenseId, req.body);
    res.status(200).json({ expense });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    await expenseService.deleteExpense(expenseId);
    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
