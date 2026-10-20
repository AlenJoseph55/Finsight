"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserProfile {
  id: number;
  email_hash: string;
  display_name: string;
  auth_method: string;
  role: string;
  is_demo: boolean;
  preferences?: Record<string, any>;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  environment: string;
  isDemoAllowed: boolean;
  isLoading: boolean;
  loginWithGoogle: (idToken: string) => Promise<UserProfile>;
  loginWithDevOAuth: (email: string, displayName?: string, role?: string) => Promise<UserProfile>;
  loginDemo: (email: string) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const INITIAL_ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "production";
const INITIAL_IS_DEMO_ALLOWED = INITIAL_ENVIRONMENT.toLowerCase() !== "production";

function decodeJwtUser(token: string | null): UserProfile | null {
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload || !payload.sub) return null;
    return {
      id: Number(payload.sub),
      email_hash: payload.email_hash || "",
      display_name: payload.display_name || (payload.role === "super_admin" ? "Super Admin" : "Investor"),
      auth_method: payload.auth_method || "jwt",
      role: payload.role || "investor",
      is_demo: false,
    };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string>(INITIAL_ENVIRONMENT);
  const [isDemoAllowed, setIsDemoAllowed] = useState<boolean>(INITIAL_IS_DEMO_ALLOWED);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to persist or clear token in both localStorage and cookie
  const saveToken = (newToken: string | null) => {
    setToken(newToken);
    if (typeof window !== "undefined") {
      if (newToken) {
        localStorage.setItem("finsight_token", newToken);
        document.cookie = `finsight_token=${newToken}; path=/; SameSite=Strict; Max-Age=${60 * 60 * 24};`;
      } else {
        localStorage.removeItem("finsight_token");
        document.cookie = "finsight_token=; path=/; SameSite=Strict; Max-Age=0;";
      }
    }
  };

  const fetchProfile = async (currentToken: string | null) => {
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`,
      };

      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token invalid or expired
          setUser(null);
          saveToken(null);
        }
        return;
      }

      const json = await res.json();
      if (json && json.data && json.data.user) {
        setUser(json.data.user);
        if (json.data.environment) {
          setEnvironment(json.data.environment);
        }
        if (typeof json.data.is_demo_allowed === "boolean") {
          setIsDemoAllowed(json.data.is_demo_allowed);
        }
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const storedToken = typeof window !== "undefined" ? localStorage.getItem("finsight_token") : null;
    if (storedToken) {
      setToken(storedToken);
      document.cookie = `finsight_token=${storedToken}; path=/; SameSite=Strict; Max-Age=${60 * 60 * 24};`;
      const quickUser = decodeJwtUser(storedToken);
      if (quickUser) {
        setUser(quickUser);
      }
      fetchProfile(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = async (idToken: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || json?.error?.message || "Google authentication failed");
      }

      const accessToken = json.access_token;
      saveToken(accessToken);
      const profile = json.user;
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithDevOAuth = async (
    email: string,
    displayName?: string,
    role?: string
  ): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/dev-oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, display_name: displayName, role }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || json?.error?.message || "Dev OAuth login failed");
      }

      const accessToken = json.access_token;
      saveToken(accessToken);
      const profile = json.user;
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async (email: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || json?.error?.message || "Demo login failed");
      }

      const accessToken = json.access_token;
      saveToken(accessToken);
      const profile = json.user;
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };


  const logout = () => {
    saveToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const refreshUser = async () => {
    await fetchProfile(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        environment,
        isDemoAllowed,
        isLoading,
        loginWithGoogle,
        loginWithDevOAuth,
        loginDemo,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
