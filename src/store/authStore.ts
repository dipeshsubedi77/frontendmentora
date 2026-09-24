import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

import { User, Token, UserRole } from "@/types";
import apiClient, { getApiBase } from "@/lib/api";

// ======================================================
// TEST LOGIN
// ======================================================
// Keep this only if your UI still uses test/demo login.
// Remove it later for production.
export const TEST_ACCESS_TOKEN = "test-access-token";

function createTestUser(role: UserRole): User {
  const now = new Date().toISOString();

  return {
    id: role === "admin" ? -2 : -1,
    email:
      role === "admin"
        ? "test-admin@mentora.local"
        : "test-student@mentora.local",
    username: role === "admin" ? "test_admin" : "test_student",
    full_name: role === "admin" ? "Test Admin" : "Test Student",
    role,
    is_active: true,
    is_verified: true,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  };
}

// ======================================================
// ERROR HANDLER
// ======================================================

function getApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return new Error(detail);
    }

    if (Array.isArray(detail)) {
      return new Error(
        detail
          .map((d) => d?.msg ?? JSON.stringify(d))
          .join("; ")
      );
    }

    if (error.response?.status) {
      return new Error(
        `Request failed with status ${error.response.status}`
      );
    }

    if (error.message) {
      return new Error(error.message);
    }
  }

  return error instanceof Error
    ? error
    : new Error("Something went wrong. Please try again.");
}

// ======================================================
// FETCH ERROR HANDLER
// ======================================================

async function getFetchError(response: Response): Promise<Error> {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return new Error(data.detail);
    }

    if (Array.isArray(data?.detail)) {
      return new Error(
        data.detail
          .map((d: any) => d?.msg ?? JSON.stringify(d))
          .join("; ")
      );
    }

    return new Error(
      data?.message ||
        `Request failed with status ${response.status}`
    );
  } catch {
    return new Error(
      `Request failed with status ${response.status}`
    );
  }
}

// ======================================================
// AUTH STATE
// ======================================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: Token | null;

  setUser: (user: User | null) => void;
  setTokens: (tokens: Token) => void;

  login: (
    emailOrUsername: string,
    password: string
  ) => Promise<void>;

  testLogin: (role: UserRole) => void;

  register: (userData: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
  }) => Promise<void>;

  registerAdmin: (userData: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
    admin_secret: string;
  }) => Promise<void>;

  forgotPassword: (email: string) => Promise<void>;

  verifyOtp: (
    email: string,
    otp: string
  ) => Promise<string>;

  resendOtp: (email: string) => Promise<void>;

  resetPassword: (
    token: string,
    password: string
  ) => Promise<void>;

  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;

  verifyEmail: (token: string) => Promise<void>;

  resendVerification: (email: string) => Promise<void>;

  logout: () => void;

  checkAuth: () => Promise<void>;

  updateUser: (data: Partial<User>) => Promise<void>;
}

// ======================================================
// AUTH STORE
// ======================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ==================================================
      // INITIAL STATE
      // ==================================================

      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,

      // ==================================================
      // BASIC SETTERS
      // ==================================================

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setTokens: (tokens) =>
        set({
          tokens,
        }),

      // ==================================================
      // LOGIN
      // ==================================================

      login: async (emailOrUsername, password) => {
        set({ isLoading: true });

        try {
          const apiUrl = getApiBase();

          console.log(
            "Mentora API:",
            `${apiUrl}/api/v1/auth/login`
          );

          // FastAPI OAuth2PasswordRequestForm expects:
          // application/x-www-form-urlencoded
          const formData = new URLSearchParams();

          formData.append("username", emailOrUsername);
          formData.append("password", password);

          const response = await fetch(
            `${apiUrl}/api/v1/auth/login`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },

              body: formData.toString(),
            }
          );

          if (!response.ok) {
            throw await getFetchError(response);
          }

          const tokens: Token = await response.json();

          if (!tokens?.access_token) {
            throw new Error(
              "Login succeeded but no access token was returned."
            );
          }

          // Save tokens
          apiClient.setTokensOnLogin(tokens);

          set({
            tokens,
          });

          // ==============================================
          // GET CURRENT USER
          // ==============================================

          const userResponse = await fetch(
            `${apiUrl}/api/v1/auth/me`,
            {
              method: "GET",

              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
              },
            }
          );

          if (!userResponse.ok) {
            throw await getFetchError(userResponse);
          }

          const user: User = await userResponse.json();

          set({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error("Login error:", error);

          apiClient.clearTokensOnLogout();

          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
          });

          throw error instanceof Error
            ? error
            : new Error("Login failed");
        }
      },

      // ==================================================
      // TEST LOGIN
      // ==================================================

      testLogin: (role) => {
        const tokens: Token = {
          access_token: TEST_ACCESS_TOKEN,
          refresh_token: TEST_ACCESS_TOKEN,
          token_type: "bearer",
        };

        set({
          user: createTestUser(role),
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      // ==================================================
      // REGISTER
      // ==================================================

      register: async (userData) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/register",
            userData
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // REGISTER ADMIN
      // ==================================================

      registerAdmin: async (userData) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/register-admin",
            userData
          );

          // Try automatic login
          try {
            await get().login(
              userData.email,
              userData.password
            );
          } catch {
            // Account created successfully.
            // User can login manually.
          }
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // LOGOUT
      // ==================================================

      logout: () => {
        apiClient.clearTokensOnLogout();

        set({
          user: null,
          isAuthenticated: false,
          tokens: null,
          isLoading: false,
        });

        window.location.href = "/login";
      },

      // ==================================================
      // CHECK AUTH
      // ==================================================

      checkAuth: async () => {
        const tokens = get().tokens;

        if (!tokens?.access_token) {
          set({
            isAuthenticated: false,
            user: null,
          });

          return;
        }

        // Test session
        if (
          tokens.access_token === TEST_ACCESS_TOKEN
        ) {
          set({
            isAuthenticated: true,
          });

          return;
        }

        try {
          const apiUrl = getApiBase();

          const response = await fetch(
            `${apiUrl}/api/v1/auth/me`,
            {
              method: "GET",

              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
              },
            }
          );

          if (!response.ok) {
            throw new Error("Authentication expired");
          }

          const user: User = await response.json();

          set({
            user,
            tokens,
            isAuthenticated: true,
          });
        } catch {
          apiClient.clearTokensOnLogout();

          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
          });
        }
      },

      // ==================================================
      // UPDATE USER
      // ==================================================

      updateUser: async (data) => {
        const tokens = get().tokens;

        if (!tokens?.access_token) {
          throw new Error("Not authenticated");
        }

        try {
          const response = await apiClient.put(
            "/api/v1/users/me",
            data
          );

          set({
            user: response.data,
          });
        } catch (error) {
          throw getApiError(error);
        }
      },

      // ==================================================
      // FORGOT PASSWORD
      // ==================================================

      forgotPassword: async (email) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/forgot-password",
            { email }
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // VERIFY OTP
      // ==================================================

      verifyOtp: async (email, otp) => {
        set({ isLoading: true });

        try {
          const response = await apiClient.post(
            "/api/v1/auth/verify-otp",
            {
              email,
              otp,
            }
          );

          return response.data.reset_token as string;
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // RESEND OTP
      // ==================================================

      resendOtp: async (email) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/resend-otp",
            { email }
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // RESET PASSWORD
      // ==================================================

      resetPassword: async (token, password) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/reset-password",
            {
              token,
              password,
            }
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // CHANGE PASSWORD
      // ==================================================

      changePassword: async (
        currentPassword,
        newPassword
      ) => {
        set({ isLoading: true });

        try {
          const tokens = get().tokens;

          if (!tokens?.access_token) {
            throw new Error("Not authenticated");
          }

          await apiClient.post(
            "/api/v1/auth/change-password",
            {
              current_password: currentPassword,
              new_password: newPassword,
            }
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // VERIFY EMAIL
      // ==================================================

      verifyEmail: async (token) => {
        set({ isLoading: true });

        try {
          const apiUrl = getApiBase();

          const response = await fetch(
            `${apiUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(
              token
            )}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );

          if (!response.ok) {
            throw await getFetchError(response);
          }
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("Failed to verify email");
        } finally {
          set({ isLoading: false });
        }
      },

      // ==================================================
      // RESEND VERIFICATION
      // ==================================================

      resendVerification: async (email) => {
        set({ isLoading: true });

        try {
          await apiClient.post(
            "/api/v1/auth/resend-verification",
            { email }
          );
        } catch (error) {
          throw getApiError(error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),

    // ====================================================
    // ZUSTAND PERSIST
    // ====================================================

    {
      name: "mentora_auth",

      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        tokens: state.tokens,
      }),
    }
  )
);

export default useAuthStore;