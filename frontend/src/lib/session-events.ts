// Session-expiry event plumbing.
//
// The api layer detects authentication loss (401) from any data call and needs
// to notify the auth context so RequireAuth can redirect the user to /login
// (UI/UX spec finding F-09: a 401 error state with "Try again" is a dead end).
// A tiny registry avoids an import cycle between api.ts and auth-context.tsx.

type SessionExpiredHandler = () => void;

const handlers = new Set<SessionExpiredHandler>();

/** Subscribe to session-expiry notifications; returns an unsubscribe function. */
export function onSessionExpired(handler: SessionExpiredHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Called by the api layer when a request comes back 401 Unauthorized. */
export function notifySessionExpired(): void {
  for (const handler of handlers) {
    try {
      handler();
    } catch {
      // A failing handler must never break the failing request path.
    }
  }
}
