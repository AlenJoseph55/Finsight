// frontend/lib/visitor.ts

const VISITOR_KEY = "finsight_vid";   // localStorage — permanent per browser
const SESSION_KEY = "finsight_sid";   // sessionStorage — per tab session

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  // Fallback for old environments / browsers without crypto.randomUUID
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + "_" + rand.slice(0, 24);
}

/**
 * Returns a stable visitor UUID for this browser.
 * Created on first visit, persisted in localStorage forever (until user clears storage).
 * Contains zero PII — just a random string like "vid_a1b2c3d4e5f6..."
 * DPDP & GDPR compliant.
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
      vid = generateId("vid");
      localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
  } catch {
    // If storage is blocked (e.g. strict private window)
    return generateId("vid");
  }
}

/**
 * Returns a session ID scoped to the current browser tab.
 * sessionStorage is cleared when the tab is closed.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateId("sid");
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return generateId("sid");
  }
}
