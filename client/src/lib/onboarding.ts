import { lsSetString, STORAGE_KEYS } from "./storage";

// Whether the presenter has already seen (or skipped) the controller tutorial.
// Note the asymmetric defaults: an absent flag means "not yet onboarded" (show
// the tutorial), but if localStorage throws entirely we default to `true` so a
// private-mode window is never blocked by it.
export function hasCompletedControllerOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.controllerOnboarded) === "true";
  } catch {
    return true;
  }
}

export function markControllerOnboarded() {
  lsSetString(STORAGE_KEYS.controllerOnboarded, "true");
}
