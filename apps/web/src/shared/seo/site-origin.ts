/**
 * The public origin of the deployment, used for canonical URLs, Open Graph URLs and absolute links.
 *
 * `AppConfig` carries no separate site URL. The sign-in redirect URI is registered per environment on the identity app
 * and always lives on the site's own origin (production: `https://www.myvedicstar.com/auth/callback`), so it is derived
 * from that instead of a second value that could drift to an apex origin.
 *
 * When the configured provider keeps no absolute redirect URI, or sign-in is disabled, the browser's own origin is the
 * site origin.
 */
import type { AppConfig } from '@myvedicstar/config';

export function siteOrigin(config: AppConfig, fallbackOrigin: string = window.location.origin): string {
  const redirectUri = 'redirectUri' in config.auth ? config.auth.redirectUri : undefined;
  return redirectUri ? new URL(redirectUri).origin : fallbackOrigin;
}
