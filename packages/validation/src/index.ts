import { z } from 'zod';

// Keep Zod CSP-safe (no `new Function`); see docs/security/content-security-policy.md.
z.config({ jitless: true });

export * from './contact';
export * from './identity';
export * from './location';
export * from './preferences';
