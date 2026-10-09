/// <reference types="vite/client" />

/** Application version from package.json, injected at build time. */
declare const __APP_VERSION__: string;
/** CI build identifier (commit SHA or pipeline run), injected at build time. */
declare const __BUILD_ID__: string;
