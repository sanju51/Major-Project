import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [6, "Email must be at least 6 characters long"],
      maxlength: [50, "Email must not be longer than 50 characters"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      select: false,
      required: true,
    },
  },
  { timestamps: true }
);

// hash password
userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 10);
};

// validate password
userSchema.methods.isValidPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// JWT
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

// ✅ VERY IMPORTANT: model name is **'user'**, lowercase
const User = mongoose.model("user", userSchema);

export default User;
