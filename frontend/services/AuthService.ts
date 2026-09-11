import { callApi } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKEN_KEY = 'runtime_backend_api_key';
export const AUTH_USER_KEY = 'app.auth.user';

/** Survives logout so a photo still restores if /me is slow or unavailable. */
export function profilePictureCacheKey(userId: string): string {
  return `app.user.profilePicture.${userId}`;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  loginTime?: number;
  profilePicture?: string | null;
  bio?: string;
  phoneNumber?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

/**
 * Service for authentication related operations
 */
export const AuthService = {
  /**
   * Register a new user and log them in automatically
   */
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await callApi<AuthResponse>('/users/signup', {
        method: 'POST',
        body: { email, password, name },
      });

      if (response && response.token) {
        await this.persistSession(response.token, response.user);
      }

      return response;
    } catch (error) {
      console.error('[AuthService] Signup failed:', error);
      throw error;
    }
  },

  /**
   * Login an existing user and restore profile picture from the server (or local cache).
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await callApi<AuthResponse>('/users/login', {
        method: 'POST',
        body: { email, password },
        timeoutMs: 20000,
      });

      if (response && response.token) {
        // Persist token first so /users/me is authorized
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

        let user: User = { ...response.user };

        // Prefer full profile from /me (includes profilePicture when stored in MongoDB)
        try {
          const me = await callApi<User>('/users/me', { timeoutMs: 20000 });
          if (me && (me.id || user.id)) {
            user = {
              ...user,
              ...me,
              id: me.id || user.id,
            };
          }
        } catch (meError) {
          console.warn('[AuthService] Could not hydrate /users/me after login:', meError);
        }

        // Fallback: durable local cache from last successful edit-profile save
        if (!user.profilePicture && user.id) {
          const cached = await AsyncStorage.getItem(profilePictureCacheKey(user.id));
          if (cached) {
            user = { ...user, profilePicture: cached };
          }
        }

        await this.persistSession(response.token, user);
        return { ...response, user };
      }

      return response;
    } catch (error) {
      console.error('[AuthService] Login failed:', error);
      throw error;
    }
  },

  /**
   * Persist user session to storage
   */
  async persistSession(token: string, user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(
        AUTH_USER_KEY,
        JSON.stringify({
          ...user,
          loginTime: Date.now(),
        })
      );
      await AsyncStorage.setItem('onboarding_completed', 'true');

      if (user.id && user.profilePicture) {
        await AsyncStorage.setItem(profilePictureCacheKey(user.id), user.profilePicture);
      }
    } catch (error) {
      console.error('[AuthService] Failed to persist session:', error);
      throw error;
    }
  },

  /**
   * Save profile picture so it survives logout / session clears.
   */
  async cacheProfilePicture(userId: string, profilePicture: string | null): Promise<void> {
    const key = profilePictureCacheKey(userId);
    if (profilePicture) {
      await AsyncStorage.setItem(key, profilePicture);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
  },

  /**
   * Logout user and clear session (keeps durable profile-picture cache).
   */
  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(AUTH_USER_KEY);
    } catch (error) {
      console.error('[AuthService] Logout failed:', error);
      throw error;
    }
  },
};

export default AuthService;
