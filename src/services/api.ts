import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT, REACT_APP_API_BASE_URL } from '@env';
import { ApiResponse, PaginatedResponse } from '../types';

// ─── Configuration ──────────────────────────────────────────────────────

const BASE_URL = (API_BASE_URL || REACT_APP_API_BASE_URL || '').trim();
const TIMEOUT = Number(API_TIMEOUT) > 0 ? Number(API_TIMEOUT) : 15000;

// ─── Axios Instance ──────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor – attach auth token ─────────────────────────────────

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove Content-Type header for FormData - let axios handle it
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }

    if (__DEV__) {
      const method = (config.method || 'GET').toUpperCase();
      const reqUrl = `${config.baseURL || ''}${config.url || ''}`;
      // Useful during mobile debugging when DevTools Network tab is empty.
      console.log(`[API] ${method} ${reqUrl}`);
    }
    
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor – handle global errors ─────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    if (__DEV__) {
      const method = (error?.config?.method || 'GET').toUpperCase();
      const reqUrl = `${error?.config?.baseURL || ''}${error?.config?.url || ''}`;
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.log(`[API ERROR] ${method} ${reqUrl} | status=${status || 'N/A'} | ${message}`);
    }

    if (error.response?.status === 401) {
      // Token expired – clear storage (navigation handled by AuthService)
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('current_user');
    }
    return Promise.reject(error);
  },
);

// ─── Generic Helpers ─────────────────────────────────────────────────────────

class ApiService {
  async get<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.get<ApiResponse<T>>(endpoint, config);
    return response.data;
  }

  async getPaginated<T>(
    endpoint: string,
    page = 1,
    limit = 20,
    config?: AxiosRequestConfig,
  ): Promise<PaginatedResponse<T>> {
    const response = await apiClient.get<PaginatedResponse<T>>(endpoint, {
      ...config,
      params: { page, limit, ...config?.params },
    });
    return response.data;
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.post<ApiResponse<T>>(endpoint, body, config);
    return response.data;
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.put<ApiResponse<T>>(endpoint, body, config);
    return response.data;
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.patch<ApiResponse<T>>(endpoint, body, config);
    return response.data;
  }

  async delete<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.delete<ApiResponse<T>>(endpoint, config);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiClient;
