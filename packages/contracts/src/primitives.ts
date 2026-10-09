import { z } from 'zod';

/**
 * Zod 4 compiles object parsers with `new Function` unless told not to. That would violate a strict
 * Content-Security-Policy (no `unsafe-eval`), so every schema in the app is used in jitless mode.
 * See docs/security/content-security-policy.md.
 */
z.config({ jitless: true });

/** ISO 8601 instant with an explicit UTC offset, e.g. `2026-09-29T07:23:20-05:00`. */
export const isoInstant = z.iso.datetime({ offset: true });

/** ISO 8601 calendar date, e.g. `2026-09-29`. */
export const isoDate = z.iso.date();
