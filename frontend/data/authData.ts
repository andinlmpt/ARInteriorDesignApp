/**
 * ⚠️ SECURITY WARNING ⚠️
 * 
 * This file contains MOCK authentication data for DEVELOPMENT/TESTING ONLY.
 * 
 * DO NOT use this in production! Critical security issues:
 * 1. Passwords are stored in PLAIN TEXT (should be hashed with bcrypt/argon2)
 * 2. User data is hardcoded (should use a database)
 * 3. No password strength validation
 * 4. No rate limiting or brute force protection
 * 
 * For production, implement:
 * - Password hashing (bcrypt, argon2, or scrypt)
 * - Database storage (MongoDB, PostgreSQL, etc.)
 * - JWT tokens for session management
 * - Password reset functionality
 * - Email verification
 * - Rate limiting
 * - Account lockout after failed attempts
 */

// TypeScript types for user data
export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // ⚠️ In production, this should be a hashed password
  profilePicture?: string | null; // Base64 data URL or URI
  createdAt?: number;
  updatedAt?: number;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  loginTime: number;
}

// Hardcoded user data for testing ONLY
// ⚠️ REMOVE THIS IN PRODUCTION - Use database instead
export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123', // ⚠️ Plain text - NOT SECURE
    createdAt: Date.now() - 86400000 * 30, // 30 days ago
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123', // ⚠️ Plain text - NOT SECURE
    createdAt: Date.now() - 86400000 * 15, // 15 days ago
  },
  {
    id: '3',
    name: 'Admin User',
    email: 'admin@ardesign.com',
    password: 'admin123', // ⚠️ Plain text - NOT SECURE
    createdAt: Date.now() - 86400000 * 60, // 60 days ago
  },
  {
    id: '4',
    name: 'Test User',
    email: 'test@test.com',
    password: 'test123', // ⚠️ Plain text - NOT SECURE
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
];

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and strength score (0-4)
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; strength: number; message: string } => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, strength: 0, message: 'Password is required' };
  }

  const trimmedPassword = password.trim();
  
  if (trimmedPassword.length < 6) {
    return { isValid: false, strength: 0, message: 'Password must be at least 6 characters' };
  }

  let strength = 1; // Minimum length met
  
  if (trimmedPassword.length >= 8) strength++;
  if (/[A-Z]/.test(trimmedPassword)) strength++;
  if (/[a-z]/.test(trimmedPassword)) strength++;
  if (/\d/.test(trimmedPassword)) strength++;
  if (/[^A-Za-z0-9]/.test(trimmedPassword)) strength++;

  const messages = [
    'Very weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
    'Very strong'
  ];

  return {
    isValid: trimmedPassword.length >= 6,
    strength: Math.min(strength, 5),
    message: messages[Math.min(strength, 5)]
  };
};

/**
 * Function to validate login credentials
 * ⚠️ This is a MOCK implementation - In production, compare hashed passwords
 * 
 * @param email - User email
 * @param password - User password (plain text - should be hashed in production)
 * @returns User object if credentials are valid, null otherwise
 */
export const validateLogin = (email: string, password: string): User | null => {
  // Input validation
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  // Basic validation
  if (!normalizedEmail || !normalizedPassword) {
    return null;
  }

  // Email format validation
  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  // Find user by email and password
  // ⚠️ In production, compare hashed passwords using bcrypt.compare()
  const user = mockUsers.find(
    (u) => u.email.toLowerCase() === normalizedEmail && u.password === normalizedPassword
  );

  // Return user without password (security best practice)
  if (user) {
    // Create a copy without password
    const { password: _, ...userWithoutPassword } = user;
    return user as User; // Return full user for now, but password should never be sent to client
  }

  return null;
};

/**
 * Function to check if email exists
 * @param email - Email address to check
 * @returns true if email exists, false otherwise
 */
export const emailExists = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  // Validate email format
  if (!isValidEmail(normalizedEmail)) {
    return false;
  }

  return mockUsers.some((u) => u.email.toLowerCase() === normalizedEmail);
};

/**
 * Get user by email (without password)
 * @param email - User email
 * @returns User object without password, or null if not found
 */
export const getUserByEmail = (email: string): Omit<User, 'password'> | null => {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  const user = mockUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  return null;
};

/**
 * Get user by ID (without password)
 * @param id - User ID
 * @returns User object without password, or null if not found
 */
export const getUserById = (id: string): Omit<User, 'password'> | null => {
  if (!id || typeof id !== 'string') {
    return null;
  }

  const user = mockUsers.find((u) => u.id === id);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  return null;
};

/**
 * Storage key for authenticated user session
 */
export const AUTH_USER_STORAGE_KEY = 'app.auth.user';

/**
 * Storage key for user preferences
 */
export const USER_PREFERENCES_STORAGE_KEY = 'app.user.preferences';

/**
 * Storage key for onboarding completion status
 */
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

/**
 * Create a new user (for testing/mock purposes only)
 * ⚠️ In production, this should call an API that hashes the password
 * 
 * @param name - User's full name
 * @param email - User's email address
 * @param password - User's password (will be stored as plain text in mock - NOT SECURE)
 * @returns Created user object (without password) or null if email already exists
 */
export const createUser = (
  name: string,
  email: string,
  password: string
): Omit<User, 'password'> | null => {
  // Input validation
  if (!name || !email || !password) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  // Validate inputs
  if (trimmedName.length < 2) {
    return null;
  }

  if (!isValidEmail(trimmedEmail)) {
    return null;
  }

  const passwordValidation = validatePasswordStrength(trimmedPassword);
  if (!passwordValidation.isValid) {
    return null;
  }

  // Check if email already exists
  if (emailExists(trimmedEmail)) {
    return null;
  }

  // Create new user
  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: trimmedName,
    email: trimmedEmail,
    password: trimmedPassword, // ⚠️ Plain text - In production, hash this!
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Add to mock users array (in production, save to database)
  mockUsers.push(newUser);

  // Return user without password
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

