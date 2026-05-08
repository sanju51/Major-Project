import * as activityService from '../services/activity.service.js';

export const getActivitiesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const activities = await activityService.getActivitiesByProject(projectId);
    res.status(200).json({ activities });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getActivitiesByUser = async (req, res) => {
  try {
    const activities = await activityService.getActivitiesByUser(req.user._id);
    res.status(200).json({ activities });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
