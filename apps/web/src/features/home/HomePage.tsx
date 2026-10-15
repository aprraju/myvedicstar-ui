import type { MessageKey } from '@myvedicstar/localization';
import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth, useStartSignIn } from '../../shared/auth';
import { GuestMenu } from '../../shared/components/GuestMenu';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DEFAULT_AUTHENTICATED_PATH } from '../../shared/routing/paths';
import styles from './HomePage.module.css';

/** Hero highlights; markers alternate as in the myvedicstar-default theme. */
const HERO_POINTS: { id: string; marker: 'diamond' | 'half' }[] = [
  { id: 'today', marker: 'diamond' },
  { id: 'goodTimes', marker: 'half' },
  { id: 'festivals', marker: 'diamond' },
  { id: 'anywhere', marker: 'half' },
];

/** Informational feature cards — configuration, not logic. Accents follow the myvedicstar-default theme. */
const FEATURES: { id: string; icon: IconName; accent: 'orange' | 'teal' | 'pink' | 'blue' }[] = [
  { id: 'today', icon: 'calendar', accent: 'orange' },
  { id: 'goodTime', icon: 'star', accent: 'orange' },
  { id: 'calendar', icon: 'calendar', accent: 'teal' },
  { id: 'festivals', icon: 'bell', accent: 'pink' },
  { id: 'locations', icon: 'pin', accent: 'blue' },
  { id: 'traditions', icon: 'sun', accent: 'orange' },
];

const BENEFITS = ['registration', 'locations', 'personalized', 'reminders', 'devices'] as const;

/** Phones and small tablets get the mockup layout (same breakpoint as the mobile header). */
const MOBILE_MAX_WIDTH = 1024;

function subscribeWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/**
 * Public home: intentionally simple — a hero and a short explanation
 * of what the app offers. The full dashboard stays behind sign-in.
 * Signed-in users are taken to their dashboard: for them, Home is the dashboard.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { enabled, isAuthenticated } = useAuth();
  const { start, pending } = useStartSignIn();
  useScrollToHash();
  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < MOBILE_MAX_WIDTH,
    () => false,
  );

  if (isAuthenticated) return <Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />;
  if (mobile) return <MobileHome />;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <HeroIntro />
      </section>

      <section id="features" className={styles.features} aria-labelledby="features-title" tabIndex={-1}>
        <div className={styles.featuresHeading}>
          <h2 id="features-title" className={styles.featuresTitle}>
            {t('home.featuresTitle')}
          </h2>
          <p className={styles.featuresSubtitle}>{t('home.featuresSubtitle')}</p>
        </div>
        <ul className={styles.featureList}>
          {FEATURES.map(({ id, icon, accent }) => (
            <li key={id} className={styles.feature} data-accent={accent}>
              <span className={styles.featureIcon}>
                <Icon name={icon} size={22} />
              </span>
              <h3 className={styles.featureTitle}>{t(`home.features.${id}.title` as MessageKey)}</h3>
              <p className={styles.featureBody}>{t(`home.features.${id}.body` as MessageKey)}</p>
            </li>
          ))}
        </ul>

        {enabled && !isAuthenticated && (
          <section className={styles.getStarted} aria-labelledby="get-started-title">
            <div className={styles.getStartedText}>
              <h3 id="get-started-title" className={styles.getStartedTitle}>
                {t('home.getStarted.title')}
              </h3>
              <p className={styles.getStartedBody}>{t('home.getStarted.body')}</p>
              <div className={styles.getStartedActions}>
                <button
                  type="button"
                  className={styles.outlineLink}
                  aria-busy={pending === 'login' || undefined}
                  onClick={() => void start('login')}
                >
                  {t('auth.login')}
                </button>
              </div>
            </div>
            <ul className={styles.benefits}>
              {BENEFITS.map((id) => (
                <li key={id} className={styles.benefit}>
                  <span className={styles.check} aria-hidden="true">
                    <Icon name="check" size={12} strokeWidth={3} />
                  </span>
                  {t(`home.getStarted.benefits.${id}`)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}

/**
 * Phones: hero image, heading, one-line intro, Login / Sign Up, the three features and a short footer — as in the
 * home mockup. Colors stay the app's own.
 */
function MobileHome() {
  const { t } = useTranslation();
  const { enabled } = useAuth();
  const { start, pending } = useStartSignIn();
  return (
    <div className={styles.mobileHome}>
      <div className={styles.mobileHero} aria-hidden="true" />
      <h1 id="home-title" className={styles.mobileTitle}>
        {t('home.heroTitle')}
      </h1>
      <p className={styles.mobileBody}>{t('home.mobile.body')}</p>
      {enabled && (
        <>
          <button
            type="button"
            className={styles.mobileCta}
            aria-busy={pending === 'login' || undefined}
            onClick={() => void start('login')}
          >
            <Icon name="login" size={20} />
            {t('home.mobile.cta')}
            <Icon name="arrowRight" size={20} />
          </button>
          <p className={styles.mobileFree}>
            <Icon name="shieldCheck" size={18} />
            {t('home.mobile.free')}
          </p>
        </>
      )}
      <div className={styles.mobileMenu}>
        <GuestMenu />
      </div>
    </div>
  );
}

/** Page heading, intro and highlights (highlights are hidden on phones by CSS). */
function HeroIntro() {
  const { t } = useTranslation();
  return (
    <div className={styles.heroText}>
      <h1 id="home-title" className={styles.title}>
        {t('home.heroTitle')}
      </h1>
      <p className={styles.body}>{t('home.heroBody')}</p>
      <ul className={styles.heroPoints}>
        {HERO_POINTS.map(({ id, marker }) => (
          <li key={id} className={styles.heroPoint}>
            <span className={styles.marker} data-marker={marker} aria-hidden="true" />
            {t(`home.heroPoints.${id}` as MessageKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Supports `/#features` links from the header. */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }, [hash]);
}
