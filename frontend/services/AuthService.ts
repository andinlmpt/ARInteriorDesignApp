import { callApi } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKEN_KEY = 'runtime_backend_api_key';
export const AUTH_USER_KEY = 'app.auth.user';

export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    loginTime?: number;
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
     * Login an existing user
     */
    async login(email: string, password: string): Promise<AuthResponse> {
        try {
            const response = await callApi<AuthResponse>('/users/login', {
                method: 'POST',
                body: { email, password },
            });

            if (response && response.token) {
                await this.persistSession(response.token, response.user);
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
            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({
                ...user,
                loginTime: Date.now()
            }));
            await AsyncStorage.setItem('onboarding_completed', 'true');
        } catch (error) {
            console.error('[AuthService] Failed to persist session:', error);
            throw error;
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
     * Logout user and clear session
     */
    async logout(): Promise<void> {
        try {
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            await AsyncStorage.removeItem(AUTH_USER_KEY);
        } catch (error) {
            console.error('[AuthService] Logout failed:', error);
            throw error;
        }
    }
};

export default AuthService;
