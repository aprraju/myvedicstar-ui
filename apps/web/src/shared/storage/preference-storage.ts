import type { ZodType } from 'zod';

const PREFIX = 'mvs.';

/**
 * Non-sensitive user preferences (appearance, recent locations, tradition). Values are validated on read because
 * storage is user-controlled input. Tokens and other secrets must never be stored here.
 * All access is guarded: storage can be unavailable (private mode, disabled cookies, quota).
 */
export const preferenceStorage = {
  read<T>(key: string, schema: ZodType<T>): T | undefined {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw === null) return undefined;
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  },
  write<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Preferences are a convenience; failing to persist must not break the app.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  },
};
