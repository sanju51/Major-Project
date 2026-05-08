import * as taskService from '../services/task.service.js';

export const createTask = async (req, res) => {
  try {
    const taskData = { ...req.body, createdBy: req.user._id };
    const task = await taskService.createTask(taskData);
    res.status(201).json({ task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await taskService.getTasksByProject(projectId);
    res.status(200).json({ tasks });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskService.updateTask(taskId, req.body);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskService.deleteTask(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const commentData = { ...req.body, user: req.user._id };
    const task = await taskService.addComment(taskId, commentData);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
