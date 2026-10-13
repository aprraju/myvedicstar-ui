import type { MessageKey } from '@myvedicstar/localization';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth, useStartSignIn } from '../../shared/auth';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
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

  if (isAuthenticated) return <Navigate to={routes.dashboard} replace />;

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
