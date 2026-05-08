import Expense from '../models/expense.model.js';
import Project from '../models/project.model.js';

export const createExpense = async (expenseData) => {
  const expense = new Expense(expenseData);
  await expense.save();
  
  if (expenseData.status === 'approved') {
    await Project.findByIdAndUpdate(expenseData.project, {
      $inc: { spent: expenseData.amount },
    });
  }
  
  return expense.populate('project task submittedBy approvedBy receipt');
};

export const getExpensesByProject = async (projectId) => {
  return await Expense.find({ project: projectId }).populate('project task submittedBy approvedBy receipt').sort({ createdAt: -1 });
};

export const getExpenseById = async (expenseId) => {
  return await Expense.findById(expenseId).populate('project task submittedBy approvedBy receipt');
};

export const updateExpense = async (expenseId, updateData) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw new Error('Expense not found');
  }
  
  const oldStatus = expense.status;
  const oldAmount = expense.amount;
  
  Object.assign(expense, updateData);
  await expense.save();
  
  if (oldStatus === 'approved' && updateData.status !== 'approved') {
    await Project.findByIdAndUpdate(expense.project, {
      $inc: { spent: -oldAmount },
    });
  } else if (oldStatus !== 'approved' && updateData.status === 'approved') {
    await Project.findByIdAndUpdate(expense.project, {
      $inc: { spent: expense.amount },
    });
  }
  
  return expense.populate('project task submittedBy approvedBy receipt');
};

export const deleteExpense = async (expenseId) => {
  const expense = await Expense.findById(expenseId);
  if (expense && expense.status === 'approved') {
    await Project.findByIdAndUpdate(expense.project, {
      $inc: { spent: -expense.amount },
    });
  }
  return await Expense.findByIdAndDelete(expenseId);
};
