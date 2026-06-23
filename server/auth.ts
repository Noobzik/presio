import type express from "express";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Extract the bearer token from an Authorization header, or "" if absent. */
export function getBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

/** Resolve the owner from an optional bearer token. Anonymous callers are fine —
 *  an absent or invalid token simply yields null. */
export async function resolveOptionalUserId(
  supabase: SupabaseClient,
  req: express.Request
): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id ?? null;
}

/** Require a valid bearer token, returning the authenticated user or null. */
export async function requireUser(
  supabase: SupabaseClient,
  req: express.Request
): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
