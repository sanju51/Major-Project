import Project from '../models/project.model.js';
import Task from '../models/task.model.js';
import User from '../models/user.model.js';
import Activity from '../models/activity.model.js';
import mongoose from 'mongoose';

export const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ project: projectId });
    const project = await Project.findById(projectId);

    // 1. Burn-down Data (Tasks remaining over time)
    // We'll simulate this based on task completion dates or just current status for now
    const burnDownData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // In a real app, you'd check how many tasks were NOT completed by this date
      // For this demo, we'll randomize a bit or use activity logs if they were dense
      const remaining = tasks.filter(t => !t.status === 'completed' || (t.updatedAt > date)).length;
      burnDownData.push({ date: dateStr, remaining });
    }

    // 2. Velocity Tracking (Completed tasks per week/sprint)
    const velocityData = [
      { sprint: 'Sprint 1', completed: Math.floor(Math.random() * 10) },
      { sprint: 'Sprint 2', completed: Math.floor(Math.random() * 15) },
      { sprint: 'Sprint 3', completed: tasks.filter(t => t.status === 'completed').length },
    ];

    res.status(200).json({
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      todoTasks: tasks.filter(t => t.status === 'todo').length,
      completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
      budget: project?.budget || 0,
      spent: project?.spent || 0,
      burnDownData,
      velocityData,
      projectCompletion: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
      bandwidth: {
        total: tasks.length,
        assigned: tasks.filter(t => t.assignee).length,
        unassigned: tasks.filter(t => !t.assignee).length,
        capacity: 100, // Simulated total capacity percentage
        load: tasks.length > 0 ? Math.round((tasks.filter(t => t.assignee).length / tasks.length) * 100) : 0
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({ 
      $or: [
        { owner: userId },
        { 'users.user': userId }
      ]
    });

    const projectIds = projects.map(p => p._id);
    const tasks = await Task.find({ project: { $in: projectIds } });

    // 3. Employee Productivity Heatmap simulation
    // Count tasks completed by each user in the projects the current user is part of
    const productivityHeatmap = await Task.aggregate([
      { $match: { project: { $in: projectIds }, status: 'completed' } },
      { $group: { _id: '$assignee', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.username', value: '$count' } }
    ]);

    // 4. Revenue Forecasting (based on project budgets vs spent)
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
    const revenueForecast = [
      { month: 'May', actual: totalSpent, forecast: totalSpent * 1.1 },
      { month: 'Jun', forecast: totalSpent * 1.3 },
      { month: 'Jul', forecast: totalSpent * 1.5 },
    ];

    res.status(200).json({
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      productivityHeatmap,
      revenueForecast,
      totalBudget,
      totalSpent
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
