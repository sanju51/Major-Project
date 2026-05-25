// backend/controllers/project.controller.js
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Project from "../models/project.model.js";

export const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, priority, projectType, category, startDate, endDate } = req.body;
    const ownerId = req.user?._id;

    const project = await Project.create({
      name,
      description,
      priority: priority || 'medium',
      projectType: projectType || 'other',
      category: category || 'Software Development',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      owner: ownerId || undefined,
      users: ownerId ? [{ user: ownerId, role: 'owner' }] : [],
      fileTree: {},
    });

    const populated = await Project.findById(project._id)
      .populate("users.user", "email username")
      .populate("owner", "email username");

    return res.status(201).json({
      message: "Project created successfully",
      project: populated,
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json("Project name must be unique");
    }
    return res.status(500).json("Failed to create project");
  }
};

export const getAllProject = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json("Unauthorized");
    }

    // Explicitly check both owner and users array to ensure visibility
    const projects = await Project.find({
      $or: [
        { owner: userId },
        { "users.user": userId }
      ]
    })
      .populate("users.user", "email username")
      .populate("owner", "email username")
      .select("-fileTree") // Optimization: Don't fetch large fileTree in the list view
      .sort({ updatedAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error("Fetch projects error:", err);
    return res.status(500).json("Failed to fetch projects");
  }
};

export const addUserToProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, users } = req.body;

    // Project is already fetched by checkProjectRole middleware if used, 
    // but for safety we check if it's on the request or fetch it.
    const project = req.project || await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json("Project not found");
    }

    // users should be [{ userId, role }] or just [userId] (default to viewer)
    const usersToAdd = users.map(u => {
      if (typeof u === 'string') {
        return { user: u, role: 'viewer' };
      }
      return { user: u.userId || u.user, role: u.role || 'viewer' };
    }).filter(u => mongoose.Types.ObjectId.isValid(u.user));

    // Filter out users already in the project
    const existingUserIds = project.users.map(u => u.user.toString());
    const filteredNewUsers = usersToAdd.filter(u => !existingUserIds.includes(u.user.toString()));

    project.users.push(...filteredNewUsers);
    await project.save();

    const populated = await Project.findById(projectId).populate(
      "users.user",
      "email username"
    );

    return res.json({
      message: "Users added to project successfully",
      project: populated,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Failed to add users to project");
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json("Project ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json("Invalid project ID");
    }

    const project = await Project.findById(projectId)
      .populate("users.user", "email username")
      .populate("owner", "email username");

    if (!project) {
      return res.status(404).json("Project not found");
    }

    return res.json({ project });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Failed to get project");
  }
};

export const updateFileTree = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, fileTree } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json("Invalid project ID");
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json("Project not found");
    }

    project.fileTree = fileTree;
    await project.save();

    return res.json({
      message: "File tree updated successfully",
      project,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Failed to update file tree");
  }
};

export const getGanttData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await mongoose.model('task').find({ project: projectId }).populate('assignee', 'username');
    
    // Format for Gantt (example: frappe-gantt)
    const ganttData = tasks.map(t => ({
      id: t._id,
      name: t.title,
      start: t.startDate || t.createdAt,
      end: t.dueDate || new Date(Date.now() + 86400000), // Default 1 day
      progress: t.status === 'completed' ? 100 : 0,
      dependencies: t.dependencies || [] // if you have dependencies
    }));

    res.json(ganttData);
  } catch (err) {
    console.error(err);
    res.status(500).json("Failed to fetch Gantt data");
  }
};

export const getBudgetData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const expenses = await mongoose.model('expense').find({ project: projectId });
    
    const budgetData = {
      totalBudget: 10000, // example
      spent: expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0),
      remaining: 0
    };
    budgetData.remaining = budgetData.totalBudget - budgetData.spent;

    res.json(budgetData);
  } catch (err) {
    console.error(err);
    res.status(500).json("Failed to fetch budget data");
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json("Invalid project ID");
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json("Project not found");
    }

    // Only owner can delete
    if (project.owner.toString() !== userId.toString()) {
      return res.status(403).json("Only project owner can delete the project");
    }

    // Delete associated data
    await Promise.all([
      mongoose.model('task').deleteMany({ project: projectId }),
      mongoose.model('document').deleteMany({ project: projectId }),
      mongoose.model('activity').deleteMany({ project: projectId }),
      Project.findByIdAndDelete(projectId)
    ]);

    return res.json({ message: "Project and all associated data deleted successfully" });
  } catch (err) {
    console.error("Delete project error:", err);
    return res.status(500).json("Failed to delete project");
  }
};
