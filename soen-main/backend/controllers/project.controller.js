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

    const { name } = req.body;
    const ownerId = req.user?._id;

    const project = await Project.create({
      name,
      owner: ownerId || undefined,
      users: ownerId ? [ownerId] : [],
      fileTree: {},
    });

    const populated = await Project.findById(project._id)
      .populate("users", "email username")
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

    const projects = await Project.find(
      userId ? { users: userId } : {}
    )
      .populate("users", "email username")
      .populate("owner", "email username")
      .sort({ createdAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error(err);
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

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json("Invalid project ID");
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json("Project not found");
    }

    const newUserIds = users.filter(id =>
      mongoose.Types.ObjectId.isValid(id)
    );

    const mergedUserIds = [
      ...new Set([
        ...project.users.map(id => id.toString()),
        ...newUserIds,
      ]),
    ];

    project.users = mergedUserIds;
    await project.save();

    const populated = await Project.findById(projectId).populate(
      "users",
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
      .populate("users", "email username")
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

    const project = await Project.findByIdAndUpdate(
      projectId,
      { fileTree },
      { new: true }
    ).populate("users", "email username");

    if (!project) {
      return res.status(404).json("Project not found");
    }

    return res.json({
      message: "File tree updated successfully",
      project,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Failed to update file tree");
  }
};
