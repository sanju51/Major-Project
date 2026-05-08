import Task from '../models/task.model.js';

export const createTask = async (taskData) => {
  const task = new Task(taskData);
  await task.save();
  return task.populate('assignee createdBy');
};

export const getTasksByProject = async (projectId) => {
  return await Task.find({ project: projectId }).populate('assignee createdBy comments.user');
};

export const getTaskById = async (taskId) => {
  return await Task.findById(taskId).populate('assignee createdBy comments.user');
};

export const updateTask = async (taskId, updateData) => {
  return await Task.findByIdAndUpdate(taskId, updateData, { new: true }).populate('assignee createdBy comments.user');
};

export const deleteTask = async (taskId) => {
  return await Task.findByIdAndDelete(taskId);
};

export const addComment = async (taskId, commentData) => {
  return await Task.findByIdAndUpdate(
    taskId,
    { $push: { comments: commentData } },
    { new: true }
  ).populate('assignee createdBy comments.user');
};
