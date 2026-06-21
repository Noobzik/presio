const ONBOARDED_KEY = "presio_controller_onboarded";

// Whether the presenter has already seen (or skipped) the controller tutorial.
// Defaults to `true` if localStorage is unavailable so we never block the UI.
export function hasCompletedControllerOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return true;
  }
}

export function markControllerOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, "true");
  } catch {
    /* ignore */
  }
}
