import { z } from 'zod';

/**
 * Zod decides whether to compile object parsers with `new Function` when each `z.object()` is created, probing with a
 * caught `new Function("")` unless jitless mode is already on. The CSP has no `unsafe-eval`, so that probe is reported
 * as a violation even though it is caught. vite.config.ts bundles this module into the Zod chunk, so it runs as soon as
 * Zod loads and before any schema module in any other chunk. See docs/security/content-security-policy.md.
 */
z.config({ jitless: true });
