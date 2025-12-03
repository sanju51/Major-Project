import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const authUser = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json("Authorization token missing");

    const token = header.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) return res.status(401).json("Invalid token");

  const user = await User.findOne({ email: decoded.email }).select("_id email username");
    if (!user) return res.status(401).json("User not found");

    req.user = user;
    next();
  } catch (err) {
    console.error("auth error:", err);
    res.status(401).json("Unauthorized");
  }
};
