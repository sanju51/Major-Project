import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const verifyJWT = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json("Authorization token missing");

    const token = header.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) return res.status(401).json("Invalid token");

    const user = await User.findOne({ email: decoded.email }).select("_id email username role");
    if (!user) return res.status(401).json("User not found");

    req.user = user;
    next();
  } catch (err) {
    console.error("auth error:", err);
    res.status(401).json("Unauthorized");
  }
};

// Backward compatibility
export const authUser = verifyJWT;

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

export const checkProjectRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId || req.body.project;
      if (!projectId) {
        return res.status(400).json("Project ID is required");
      }

      const Project = (await import("../models/project.model.js")).default;
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json("Project not found");
      }

      const userInProject = project.users.find(
        (u) => u.user.toString() === req.user._id.toString()
      );

      if (!userInProject) {
        return res.status(403).json("You are not a member of this project");
      }

      if (!allowedRoles.includes(userInProject.role)) {
        return res.status(403).json(`Insufficient permissions. Required one of: ${allowedRoles.join(", ")}`);
      }

      req.project = project; // Attach project to request for later use
      next();
    } catch (err) {
      console.error("RBAC error:", err);
      res.status(500).json("Internal server error during role check");
    }
  };
};
