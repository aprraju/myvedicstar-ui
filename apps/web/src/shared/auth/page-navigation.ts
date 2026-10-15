/** Replaces the current page (no history entry, so Back cannot return to a signed-in page). Separate for tests. */
export function replacePage(url: string): void {
  window.location.replace(url);
}
