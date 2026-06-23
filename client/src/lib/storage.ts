// Typed, failure-tolerant wrappers around localStorage.
//
// Every read/write is guarded: private/incognito windows throw on access, and a
// corrupt value should never crash the UI. JSON helpers fall back to a default;
// string helpers fall back to a provided default. This replaces the
// hand-rolled `try { JSON.parse(localStorage.getItem(...)) } catch {}` dance
// that was duplicated across the app.

/** Static localStorage keys. Per-session keys (timer, session auth) are built
 *  from an id, so they're kept as factory functions rather than constants. */
export const STORAGE_KEYS = {
  keymap: "presio_keymap",
  controllerLayout: "presio_controller_layout",
  controllerCards: "presio_controller_cards",
  preferredLayout: "presio_preferred_layout",
  preferredCards: "presio_preferred_cards",
  controllerOnboarded: "presio_controller_onboarded",
} as const;

export const timerKey = (id: string) => `presio_timer_${id}`;
export const sessionKey = (id: string) => `session_${id}`;

/** Read and JSON-parse a value, returning `fallback` if absent or malformed. */
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** JSON-stringify and store a value. Swallows storage errors. */
export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

/** Read a raw string value, returning `fallback` if absent or unavailable. */
export function lsGetString(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Store a raw string value. Swallows storage errors. */
export function lsSetString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Remove a key. Swallows storage errors. */
export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
