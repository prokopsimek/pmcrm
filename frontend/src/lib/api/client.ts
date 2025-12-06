import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_CONFIG } from './config';
import type { ApiError, ApiResponse } from '@/types';

/**
 * Axios instance with interceptors for authentication and error handling
 *
 * Uses better-auth session cookies for authentication.
 * Cookies are automatically sent with requests via withCredentials: true
 */
class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: `${API_CONFIG.baseURL}/${API_CONFIG.version}`,
      timeout: API_CONFIG.timeout,
      headers: API_CONFIG.headers,
      withCredentials: true, // Required for better-auth session cookies
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Response interceptor - Handle errors
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        // Just normalize and propagate errors
        // Auth state is managed by better-auth useSession hook
        // which will detect 401 and update isAuthenticated state
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private normalizeError(error: AxiosError<ApiError>): ApiError {
    if (error.response?.data) {
      return error.response.data;
    }
    return {
      message: error.message || 'An unexpected error occurred',
      code: error.code,
    };
  }

  // HTTP Methods
  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
