/**
 * User Model
 * Mongoose schema for user authentication
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String, // URL to avatar image
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    notifications: { type: Boolean, default: true },
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness when present
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  collection: 'users', // Explicitly set collection name
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt before saving
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate API key
userSchema.methods.generateApiKey = function () {
  const crypto = require('crypto');
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
