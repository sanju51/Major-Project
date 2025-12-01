// backend/controllers/user.controller.js
import { validationResult } from "express-validator";
import User from "../models/user.model.js";
import PendingUser from "../models/pendingUser.model.js";
import { sendOtp } from "../services/mail.service.js";

// STEP 1: start registration, send OTP to email
export const registerStart = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if already fully registered
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json("Email already registered");
    }

    // Hash password using your static method
    const hashedPassword = await User.hashPassword(password);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove old pending entry for this email
    await PendingUser.findOneAndDelete({ email });

    // Save pending registration (10 min expiry)
    await PendingUser.create({
      email,
      password: hashedPassword,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send OTP to real email
    await sendOtp(email, otp);

    return res.status(200).json("OTP sent to your email");
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json("Something went wrong while starting registration");
  }
};

// STEP 2: verify OTP, create real user, return token
export const registerVerify = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp } = req.body;

  try {
    const pending = await PendingUser.findOne({ email });

    if (!pending) {
      return res.status(400).json("No pending registration for this email");
    }

    if (pending.otp !== otp) {
      return res.status(400).json("Invalid OTP");
    }

    if (pending.expiresAt < new Date()) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(400).json("OTP has expired. Please register again.");
    }

    // Create actual user
    const user = await User.create({
      email: pending.email,
      password: pending.password, // already hashed
      isVerified: true,
    });

    // Remove pending record
    await PendingUser.deleteOne({ _id: pending._id });

    const token = user.generateJWT();

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(201).json({ user: userObj, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Failed to verify OTP");
  }
};

// LOGIN: normal email + password (no OTP)
export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Need .select('+password') because in schema password has select:false
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json("Invalid email or password");
    }

    const isValid = await user.isValidPassword(password);
    if (!isValid) {
      return res.status(400).json("Invalid email or password");
    }

    if (!user.isVerified) {
      return res.status(403).json("Please verify your email first");
    }

    const token = user.generateJWT();

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({ user: userObj, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json("Login failed");
  }
};
