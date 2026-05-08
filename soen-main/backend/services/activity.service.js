import Activity from '../models/activity.model.js';

export const createActivity = async (activityData) => {
  const activity = new Activity(activityData);
  await activity.save();
  return activity.populate('user project task');
};

export const getActivitiesByProject = async (projectId) => {
  return await Activity.find({ project: projectId }).populate('user project task').sort({ createdAt: -1 });
};

export const getActivitiesByUser = async (userId) => {
  return await Activity.find({ user: userId }).populate('user project task').sort({ createdAt: -1 });
};
