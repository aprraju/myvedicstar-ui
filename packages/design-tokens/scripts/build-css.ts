import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTokensCss } from '../src/css';

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../css/tokens.css');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, generateTokensCss());
console.log(`Wrote ${target}`);
