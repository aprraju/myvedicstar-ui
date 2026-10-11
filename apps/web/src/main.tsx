// Configures Zod before any schema is created (CSP, no `unsafe-eval`); bundled into the Zod chunk by vite.config.ts.
import './zod-config';
import './styles/global.css';

import { bootstrap } from './app/bootstrap';

const container = document.getElementById('root');
if (container) void bootstrap(container);
