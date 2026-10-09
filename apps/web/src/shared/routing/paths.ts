/**
 * Route paths in one place. Routes for later phases are listed so links and deep links stay consistent;
 * they are registered in the router as each feature is delivered.
 */
export const routes = {
  home: '/',
  authCallback: '/auth/callback',
  about: '/about',
  help: '/help',
  howItWorks: '/how-it-works',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  disclaimer: '/disclaimer',
  cookies: '/cookies',
  accessibility: '/accessibility',
  dashboard: '/dashboard',
  today: '/today',
  calendar: '/calendar',
  calendarDate: '/calendar/:date',
  goodTime: '/good-time',
  festivals: '/festivals',
  festival: '/festivals/:id',
  panchangDate: '/panchang/:date',
  locations: '/locations',
  settings: '/settings',
  profile: '/profile',
} as const;

export const DEFAULT_AUTHENTICATED_PATH = routes.dashboard;

type SignInErrorReason = 'cancelled' | 'network' | 'failed';
export const SIGN_IN_ERROR_PARAM = 'signin_error';

export const paths = {
  /**
   * The callback route shows sign-in errors (codes only, never provider text) with "Try again". Uses its own parameter,
   * not OAuth's `error`, so a provider error response (`?error=access_denied&state=…`) is still processed.
   */
  signInError: (reason: SignInErrorReason, returnTo: string) =>
    `${routes.authCallback}?${new URLSearchParams({ [SIGN_IN_ERROR_PARAM]: reason, returnTo }).toString()}`,
};
