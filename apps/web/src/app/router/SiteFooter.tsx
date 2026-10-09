import type { MessageKey } from '@myvedicstar/localization';
import { Link } from 'react-router';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './SiteFooter.module.css';

interface FooterLink {
  label: MessageKey;
  /** Omitted for features that are not available yet ("Coming soon"). */
  to?: string;
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
      { label: 'footer.links.contact', to: routes.contact },
      { label: 'footer.links.helpFaq', to: routes.help },
      { label: 'footer.links.reportIssue', to: `${routes.contact}?reason=technical` },
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

/** Site footer: link columns (Explore for signed-in users only), copyright and the informational-use notice. */
export function SiteFooter() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const columns = COLUMNS.filter((column) => !column.signedInOnly || isAuthenticated);

  return (
    <footer className={styles.footer}>
      <nav aria-label={t('footer.navigation')} className={styles.columns}>
        {columns.map((column) => (
          <section key={column.id} aria-labelledby={`footer-${column.id}`} className={styles.column}>
            <h2 id={`footer-${column.id}`} className={styles.heading}>
              {t(column.title)}
            </h2>
            <ul className={styles.links}>
              {column.links.map(({ label, to }) => (
                <li key={label}>
                  {to ? (
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
