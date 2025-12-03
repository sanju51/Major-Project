// backend/routes/user.routes.js
import { Router } from "express";
import { body } from "express-validator";
import {
  registerStart,
  registerVerify,
  login,
  setUsername,
} from "../controllers/user.controller.js";
import User from "../models/user.model.js";
import * as authMiddleWare from "../middleware/auth.middleware.js";

const router = Router();

// Registration Step 1: send OTP
router.post(
  "/register-start",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  registerStart
);

// Registration Step 2: verify OTP
router.post(
  "/register-verify",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("otp")
      .isLength({ min: 4, max: 6 })
      .withMessage("OTP must be 4–6 digits"),
  ],
  registerVerify
);

// Normal login (no OTP)
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login
);

// ✅ New: Get all users for collaborators
router.get("/all", authMiddleWare.authUser, async (req, res) => {
  try {
    const loggedInEmail = req.user?.email

    const users = await User.find(
      loggedInEmail ? { email: { $ne: loggedInEmail } } : {}
    ).select("_id email username")

    res.json({ users })
  } catch (err) {
    console.error(err)
    res.status(500).json("Failed to fetch users")
  }
});

router.post(
  "/set-username",
  [
    body("username")
      .isString()
      .isLength({ min: 2, max: 30 })
      .withMessage("Username must be 2-30 characters long"),
  ],
  authMiddleWare.authUser,
  setUsername
);

export default router;
