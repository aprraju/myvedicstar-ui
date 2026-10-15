import type { MessageKey } from '@myvedicstar/localization';
import { Link } from 'react-router';

import { useAuth } from '../../shared/auth';
import { CONTACT_EMAIL } from '../../shared/components/GuestMenu';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './SiteFooter.module.css';

interface FooterLink {
  label: MessageKey;
  /** Omitted for features that are not available yet ("Coming soon"). */
  to?: string;
  /** An external link (e.g. `mailto:`) instead of an in-app route. */
  href?: string;
  /** Signed-out visitors only (signed-in users have the Contact button above the menu). */
  signedOutOnly?: boolean;
}

interface FooterColumn {
  id: string;
  title: MessageKey;
  links: FooterLink[];
  /** Explore is shown to signed-in users only. */
  signedInOnly?: boolean;
}

const COLUMNS: FooterColumn[] = [
  {
    id: 'company',
    title: 'footer.columns.company',
    links: [
      { label: 'footer.links.about', to: routes.about },
      { label: 'footer.links.howItWorks', to: routes.howItWorks },
    ],
  },
  {
    id: 'explore',
    title: 'footer.columns.explore',
    signedInOnly: true,
    links: [
      { label: 'footer.links.todaysPanchang', to: routes.dashboard },
      { label: 'footer.links.findGoodTime', to: routes.goodTime },
      { label: 'footer.links.calendar', to: routes.calendar },
      { label: 'footer.links.compatibility' },
      { label: 'footer.links.matrimony' },
    ],
  },
  {
    id: 'help',
    title: 'footer.columns.help',
    links: [
      { label: 'footer.links.helpFaq', to: routes.help },
      { label: 'footer.links.contact', href: `mailto:${CONTACT_EMAIL}`, signedOutOnly: true },
    ],
  },
  {
    id: 'legal',
    title: 'footer.columns.legal',
    links: [
      { label: 'footer.links.privacy', to: routes.privacy },
      { label: 'footer.links.terms', to: routes.terms },
      { label: 'footer.links.disclaimer', to: routes.disclaimer },
      { label: 'footer.links.cookies', to: routes.cookies },
      { label: 'footer.links.accessibility', to: routes.accessibility },
    ],
  },
];

/** Signed-in users: Beta Feedback, Report an Issue and Contact open the contact form with the matching reason. */
const ACTIONS: { kind: 'feedback' | 'issue' | 'contact'; to: string; icon: IconName }[] = [
  { kind: 'feedback', to: `${routes.contact}?reason=feedback`, icon: 'sparkle' },
  { kind: 'issue', to: `${routes.contact}?reason=technical`, icon: 'alert' },
  { kind: 'contact', to: routes.contact, icon: 'mail' },
];

/**
 * Site footer: for signed-in users, Beta Feedback / Report an Issue / Contact buttons (on phones too, where the link
 * columns are hidden); link columns (Explore for signed-in users only), copyright and the informational-use notice.
 */
export function SiteFooter() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const columns = COLUMNS.filter((column) => !column.signedInOnly || isAuthenticated);

  return (
    <footer className={styles.footer}>
      {isAuthenticated && (
        <div className={styles.actions} role="group" aria-label={t('footer.actions.label')}>
          {ACTIONS.map(({ kind, to, icon }) => (
            <Link
              key={kind}
              to={to}
              className={styles.action}
              data-kind={kind}
              aria-label={t(`footer.actions.${kind}.label`)}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                <Icon name={icon} size={20} />
              </span>
              <span className={styles.actionText} aria-hidden="true">
                <span className={styles.actionLabel}>{t(`footer.actions.${kind}.label`)}</span>
                {/* Phones: a short one-line label. */}
                <span className={styles.actionShort}>{t(`footer.actions.${kind}.short`)}</span>
                <span className={styles.actionHint}>{t(`footer.actions.${kind}.hint`)}</span>
              </span>
              <Icon name="chevronRight" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      <nav aria-label={t('footer.navigation')} className={styles.columns}>
        {columns.map((column) => (
          <section key={column.id} aria-labelledby={`footer-${column.id}`} className={styles.column}>
            <h2 id={`footer-${column.id}`} className={styles.heading}>
              {t(column.title)}
            </h2>
            <ul className={styles.links}>
              {column.links
                .filter((link) => !link.signedOutOnly || !isAuthenticated)
                .map(({ label, to, href }) => (
                  <li key={label}>
                    {href ? (
                      <a href={href} className={styles.link}>
                        {t(label)}
                      </a>
                    ) : to ? (
                      <Link to={to} className={styles.link}>
                        {t(label)}
                      </Link>
                    ) : (
                      <span className={styles.future}>
                        {t(label)} <span className={styles.badge}>{t('footer.future')}</span>
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className={styles.bottom}>
        <p>{t('footer.rights', { year: String(new Date().getFullYear()) })}</p>
        <p>{t('footer.informational')}</p>
        <p>{t('footer.decisions')}</p>
      </div>
    </footer>
  );
}
