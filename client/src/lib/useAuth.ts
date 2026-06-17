import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGitHub: (redirectTo?: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// Cached session for synchronous callers (e.g. the upload branch in Home).
let cachedSession: Session | null = null;

export function setCachedSession(s: Session | null): void {
  cachedSession = s;
}

export function isLoggedIn(): boolean {
  return cachedSession !== null;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
