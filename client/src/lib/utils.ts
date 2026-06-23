import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { lsGet, lsSet, sessionKey } from "./storage"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface SessionAuth {
  controllerToken?: string;
  passphrase?: string;
}

export function getSessionAuth(id: string): SessionAuth {
  return lsGet<SessionAuth>(sessionKey(id), {});
}

export function setSessionAuth(id: string, auth: SessionAuth) {
  lsSet(sessionKey(id), auth);
}

// Ends (deletes) a synced presentation. The server requires the controller
// token, so send the one stored for this session.
export function endSession(id: string): Promise<Response> {
  const { controllerToken } = getSessionAuth(id);
  return fetch(`/api/sessions/${id}`, {
    method: "DELETE",
    headers: controllerToken ? { "x-controller-token": controllerToken } : {},
  });
}
