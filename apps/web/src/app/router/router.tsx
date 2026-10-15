import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import type { RouteHandle } from '../../shared/accessibility/usePageTitle';
import { DEFAULT_AUTHENTICATED_PATH, routes } from '../../shared/routing/paths';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { StartupFallback } from '../pages/StartupFallback';
import { SiteLayout } from './SiteLayout';

const handle = (screen: string, titleKey: RouteHandle['titleKey']): RouteHandle => ({ screen, titleKey });

/** Wraps a lazily loaded page in ProtectedRoute (loaded in the same chunk as the auth feature). */
const protectedPage = (load: () => Promise<ComponentType>) => async () => {
  const [{ ProtectedRoute }, Page] = await Promise.all([import('../../features/auth'), load()]);
  return {
    Component: () => (
      <ProtectedRoute>
        <Page />
      </ProtectedRoute>
    ),
  };
};

/**
 * Route table. Each page is a lazily loaded chunk, so the first load only downloads the shell and the current page.
 * Public: home, about, help, contact, auth callback. Everything else requires sign-in. There are no login/register pages:
 * sign-in and sign-up happen on the identity provider's hosted pages.
 */
export const appRoutes: RouteObject[] = [
  {
    element: <SiteLayout />,
    errorElement: <RouteErrorPage />,
    // Rendered while the first lazily loaded page is fetched.
    hydrateFallbackElement: <StartupFallback />,
    children: [
      {
        path: routes.home,
        handle: handle('Home', 'pages.home.title'),
        lazy: async () => ({ Component: (await import('../../features/home')).HomePage }),
      },
      {
        path: routes.about,
        handle: handle('About', 'pages.about.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).AboutPage }),
      },
      {
        path: routes.howItWorks,
        handle: handle('HowItWorks', 'pages.howItWorks.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).HowItWorksPage }),
      },
      {
        path: routes.privacy,
        handle: handle('Privacy', 'pages.privacy.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).PrivacyPage }),
      },
      {
        path: routes.terms,
        handle: handle('Terms', 'pages.terms.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).TermsPage }),
      },
      {
        path: routes.disclaimer,
        handle: handle('Disclaimer', 'pages.disclaimer.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).DisclaimerPage }),
      },
      {
        path: routes.cookies,
        handle: handle('Cookies', 'pages.cookies.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).CookiePolicyPage }),
      },
      {
        path: routes.accessibility,
        handle: handle('Accessibility', 'pages.accessibility.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).AccessibilityPage }),
      },
      {
        path: routes.contact,
        handle: handle('Contact', 'pages.contact.title'),
        lazy: async () => ({ Component: (await import('../../features/contact')).ContactPage }),
      },
      {
        path: routes.help,
        handle: handle('Help', 'pages.help.title'),
        lazy: async () => ({ Component: (await import('../../features/content')).HelpPage }),
      },
      {
        path: routes.authCallback,
        handle: handle('AuthCallback', 'pages.authCallback.title'),
        lazy: async () => ({ Component: (await import('../../features/auth')).AuthCallbackPage }),
      },
      {
        // The old Today page: links and bookmarks open Home (the Panchang page).
        path: routes.dashboard,
        element: <Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />,
      },
      {
        path: routes.calendar,
        handle: handle('Calendar', 'nav.calendar'),
        lazy: protectedPage(async () => (await import('../../features/calendar')).CalendarPage),
      },
      {
        // Opened from the account menu; settings ship in Phase 5.
        path: routes.settings,
        handle: handle('Settings', 'nav.settings'),
        lazy: protectedPage(async () => (await import('../../features/settings/SettingsPage')).SettingsPage),
      },
      {
        path: routes.profile,
        handle: handle('Profile', 'nav.profile'),
        lazy: protectedPage(async () => (await import('../../features/profile/ProfilePage')).ProfilePage),
      },
      {
        path: routes.festivals,
        handle: handle('Festivals', 'nav.festivals'),
        lazy: protectedPage(async () => (await import('../../features/festivals')).FestivalsPage),
      },
      {
        path: routes.goodTime,
        handle: handle('GoodTime', 'home.findGoodTime'),
        lazy: protectedPage(async () => (await import('../../features/good-time')).GoodTimePage),
      },
      { path: '*', handle: handle('NotFound', 'pages.notFound.title'), element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
