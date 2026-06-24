import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load User model directly from app to ensure we trigger the pre-save hooks
import User from './src/models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const fixUsers = async () => {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });
    console.log('Connected to MongoDB.');

    const mockUsers = [
      { name: 'John Doe', email: 'john@example.com', password: 'password123' },
      { name: 'Jane Smith', email: 'jane@example.com', password: 'password123' },
      { name: 'Admin User', email: 'admin@ardesign.com', password: 'admin123' },
      { name: 'Test User', email: 'test@test.com', password: 'test123' },
    ];

    // Delete existing users first to ensure we wipe the double-hashed passwords
    for (const u of mockUsers) {
      await User.deleteOne({ email: u.email });
      console.log(`Deleted existing user: ${u.email}`);
    }

    // Re-create users with raw passwords. The pre-save hook in src/models/User.js will hash them correctly.
    for (const u of mockUsers) {
      await User.create({
        name: u.name,
        email: u.email,
        password: u.password // RAW password!
      });
      console.log(`Re-created user correctly: ${u.email}`);
    }

    console.log('Fix complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing users:', error);
    process.exit(1);
  }
};

fixUsers();
