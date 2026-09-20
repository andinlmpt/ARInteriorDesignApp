import { callApi, ApiError } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isDataUrl,
  reclaimProfilePictureStorage,
  saveProfilePictureLocally,
} from '@/utils/profilePictureStorage';

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
          if (cached && !isDataUrl(cached)) {
            user = { ...user, profilePicture: cached };
          }
        }

        await this.persistSession(response.token, user);
        return { ...response, user };
      }

      return response;
    } catch (error) {
      // Wrong email/password is an expected user outcome — don't dump a stack trace.
      if (error instanceof ApiError && error.status === 401) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[AuthService] Login failed:', message);
      throw error;
    }
  },

  /**
   * Persist user session to storage.
   * Large base64 photos are written to disk; AsyncStorage only keeps a short URI.
   */
  async persistSession(token: string, user: User): Promise<void> {
    try {
      let picture = user.profilePicture ?? null;
      if (picture && user.id && isDataUrl(picture)) {
        try {
          picture = await saveProfilePictureLocally(user.id, picture);
        } catch (err) {
          console.warn('[AuthService] Could not migrate profile picture to disk:', err);
          await reclaimProfilePictureStorage(user.id);
          picture = null;
        }
      }

      const slimUser: User = {
        ...user,
        profilePicture: picture,
        loginTime: Date.now(),
      };

      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      try {
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(slimUser));
      } catch (storageError) {
        console.warn('[AuthService] AsyncStorage full — reclaiming profile cache:', storageError);
        await reclaimProfilePictureStorage(user.id);
        await AsyncStorage.setItem(
          AUTH_USER_KEY,
          JSON.stringify({
            ...slimUser,
            profilePicture: picture && !isDataUrl(picture) ? picture : null,
          })
        );
      }
      await AsyncStorage.setItem('onboarding_completed', 'true');

      if (user.id && picture && !isDataUrl(picture)) {
        try {
          await AsyncStorage.setItem(profilePictureCacheKey(user.id), picture);
        } catch {
          // Short paths should fit; ignore if storage is still constrained.
        }
      }
    } catch (error) {
      console.error('[AuthService] Failed to persist session:', error);
      throw error;
    }
  },

  /**
   * Save profile picture so it survives logout / session clears.
   * Base64 is stored on disk; AsyncStorage only keeps the file URI.
   */
  async cacheProfilePicture(userId: string, profilePicture: string | null): Promise<void> {
    const key = profilePictureCacheKey(userId);
    if (!profilePicture) {
      await AsyncStorage.removeItem(key);
      return;
    }

    let ref = profilePicture;
    if (isDataUrl(profilePicture)) {
      ref = await saveProfilePictureLocally(userId, profilePicture);
    }

    try {
      await AsyncStorage.setItem(key, ref);
    } catch (error) {
      await reclaimProfilePictureStorage(userId);
      try {
        await AsyncStorage.setItem(key, ref);
      } catch (retryError) {
        console.warn('[AuthService] cacheProfilePicture failed after reclaim:', retryError);
      }
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
