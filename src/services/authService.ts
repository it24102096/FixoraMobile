import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import { AuthCredentials, RegistrationCredentials, User } from '../types';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  CURRENT_USER: 'current_user',
} as const;

class AuthService {
  // ─── Login ────────────────────────────────────────────────────────────────

  async login(credentials: AuthCredentials): Promise<User> {
    const response = await apiService.post<User>('/auth/login', credentials);
    const user = response.data;

    if (user.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, user.token);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

    return user;
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(credentials: RegistrationCredentials): Promise<User> {
    const response = await apiService.post<User>('/auth/register', credentials);
    const user = response.data;

    if (user.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, user.token);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

    return user;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch {
      // Silently fail – still clear local storage
    } finally {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // ─── Session ──────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<User | null> {
    const userJson = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return userJson ? (JSON.parse(userJson) as User) : null;
  }

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  // ─── Password ─────────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    await apiService.post('/auth/password-reset', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiService.post('/auth/password-reset/confirm', {
      token,
      newPassword,
    });
  }
}

export const authService = new AuthService();
export default authService;
