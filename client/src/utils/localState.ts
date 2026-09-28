/** Local state recovery — caches current question index and answers locally
 *  so that a page refresh doesn't lose position. Server-side auto-save
 *  remains the source of truth; this is a supplementary UX layer. */

const PREFIX = "hsk_attempt_";

export function saveLocalState(attemptId: string, data: {
  currentIndex: number;
  answers: Record<string, unknown>;
}): void {
  try {
    localStorage.setItem(PREFIX + attemptId, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadLocalState(attemptId: string): {
  currentIndex: number;
  answers: Record<string, unknown>;
} | null {
  try {
    const raw = localStorage.getItem(PREFIX + attemptId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalState(attemptId: string): void {
  try {
    localStorage.removeItem(PREFIX + attemptId);
  } catch {
    // ignore
  }
}
