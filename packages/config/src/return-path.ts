/**
 * Open-redirect protection for "return to where I was" after login/registration.
 * Only same-application relative paths are accepted; anything else falls back to a safe default.
 */
export function isSafeReturnPath(value: string | null | undefined): value is string {
  if (!value || value.length > 2048) return false;
  if (!value.startsWith('/')) return false; // absolute URLs, javascript:, data:, relative tricks
  if (value.startsWith('//') || value.startsWith('/\\')) return false; // protocol-relative → other origin
  if (hasControlCharOrBackslash(value)) return false; // these normalize unpredictably in URL parsers
  try {
    // Resolve against a dummy origin: the result must stay on that origin.
    const resolved = new URL(value, 'https://return-path.invalid');
    return resolved.origin === 'https://return-path.invalid';
  } catch {
    return false;
  }
}

function hasControlCharOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

export function sanitizeReturnPath(value: string | null | undefined, fallback = '/dashboard'): string {
  return isSafeReturnPath(value) ? value : fallback;
}
