import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import { Token } from "@/types";

// ============================================
// API CONFIGURATION
// ============================================

export const DEFAULT_API_URL =
  "https://mentora-backend-9.onrender.com";

export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:8000";
  }

  return DEFAULT_API_URL;
}

// ============================================
// API CLIENT
// ============================================

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getApiBase(),
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  // ============================================
  // INTERCEPTORS
  // ============================================

  private setupInterceptors() {
    // REQUEST INTERCEPTOR
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();

        // Only send Authorization when a real token exists
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // RESPONSE INTERCEPTOR
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },

      async (error) => {
        const originalRequest = error.config;

        // If unauthorized, try refreshing the token
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          const refreshToken = this.getRefreshToken();

          if (refreshToken) {
            try {
              const response = await this.client.post<Token>(
                "/api/v1/auth/refresh",
                {
                  refresh_token: refreshToken,
                }
              );

              this.setTokens(response.data);

              originalRequest.headers.Authorization =
                `Bearer ${response.data.access_token}`;

              return this.client(originalRequest);
            } catch (refreshError) {
              this.clearTokens();

              if (typeof window !== "undefined") {
                window.location.href = "/login";
              }

              return Promise.reject(refreshError);
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // ACCESS TOKEN
  // ============================================

  private getAccessToken(): string | null {
    const tokens = localStorage.getItem("mentora_tokens");

    if (tokens) {
      try {
        const parsed = JSON.parse(tokens);

        if (parsed?.access_token) {
          return parsed.access_token;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    const auth = localStorage.getItem("mentora_auth");

    if (auth) {
      try {
        const parsed = JSON.parse(auth);

        if (parsed?.state?.tokens?.access_token) {
          return parsed.state.tokens.access_token;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    // IMPORTANT:
    // Never return a fake token.
    return null;
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================

  private getRefreshToken(): string | null {
    const tokens = localStorage.getItem("mentora_tokens");

    if (tokens) {
      try {
        const parsed = JSON.parse(tokens);

        if (parsed?.refresh_token) {
          return parsed.refresh_token;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    const auth = localStorage.getItem("mentora_auth");

    if (auth) {
      try {
        const parsed = JSON.parse(auth);

        if (parsed?.state?.tokens?.refresh_token) {
          return parsed.state.tokens.refresh_token;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    return null;
  }

  // ============================================
  // TOKEN STORAGE
  // ============================================

  private setTokens(tokens: Token) {
    localStorage.setItem(
      "mentora_tokens",
      JSON.stringify(tokens)
    );
  }

  private clearTokens() {
    localStorage.removeItem("mentora_tokens");
    localStorage.removeItem("mentora_auth");
  }

  setTokensOnLogin(tokens: Token) {
    this.setTokens(tokens);
  }

  clearTokensOnLogout() {
    this.clearTokens();
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  get<T = any>(
    url: string,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  post<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  put<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  delete<T = any>(
    url: string,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  patch<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }
}

// ============================================
// EXPORT
// ============================================

export const apiClient = new ApiClient();

export default apiClient;