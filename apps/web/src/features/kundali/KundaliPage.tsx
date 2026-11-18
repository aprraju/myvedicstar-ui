import { type DashaSystem, dashaSystemValues } from '@myvedicstar/contracts';
import { useSearchParams } from 'react-router';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DashasSection } from './dashas/DashasSection';
import { EmptyProfiles } from './EmptyProfiles';
import styles from './Kundali.module.css';
import { KundaliSections } from './KundaliSections';
import { ProfileSelector } from './ProfileSelector';
import { useKundaliProfile } from './useKundaliProfile';

/** Query parameter carrying the selected profile. Selection is client state held in the URL, never persisted server-side. */
export const PROFILE_PARAM = 'profile';
/** Query parameter carrying the dasha system being read. Presentation-level choice, validated against the contract. */
const SYSTEM_PARAM = 'system';
export const KUNDALI_PATH = '/kundali';

/**
 * Kundali route shell (KUN-01 / KUN-02).
 *
 * Responsibilities stop at choosing which owned Astro Profile the chart is for: it reads the caller's profile list and
 * renders a selector, an error state, or the zero-profile prompt. It never computes astrological values and never calls
 * the calculation engine — that happens in later stories, once a section is opened.
 *
 * A `profile` id that is not in the caller's own list renders the unavailable state rather than an error carrying the
 * id, so a foreign or deleted id discloses nothing.
 */
export function KundaliPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedId = searchParams.get(PROFILE_PARAM);
  const requestedSystem = searchParams.get(SYSTEM_PARAM);
  // An unknown or absent system resolves to Vimshottari, which is also the API's default. Anything else would send the
  // server a value it must reject, turning a bad link into an error page instead of the default reading.
  const system: DashaSystem = dashaSystemValues.find((value) => value === requestedSystem) ?? 'vimshottari';
  const { status, summaries, reload } = useKundaliProfile();
  // Only consulted once the list resolved, so there is no flash of "unavailable" while the request is in flight.
  const selected = status === 'ready' ? (summaries.find((row) => row.id === requestedId) ?? null) : null;
  const isForeignId = requestedId !== null && status === 'ready' && selected === null;

  const chooseSystem = (next: DashaSystem) => {
    setSearchParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        // Vimshottari is the default: keep the URL clean rather than encoding the default.
        if (next === 'vimshottari') updated.delete(SYSTEM_PARAM);
        else updated.set(SYSTEM_PARAM, next);
        return updated;
      },
      { replace: true },
    );
  };

  const choose = (id: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set(PROFILE_PARAM, id);
        else next.delete(PROFILE_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('kundali.title')}</h1>
        <p className={styles.subtitle}>{t('kundali.subtitle')}</p>
      </header>

      {summaries.length > 0 && (
        <ProfileSelector
          options={summaries.map((row) => ({ id: row.id, name: row.name }))}
          value={selected?.id ?? null}
          onChange={choose}
        />
      )}

      {/* One polite live region for state changes. Errors and prompts are already headings in the DOM, so they are
          announced when they appear; this carries the transient "loading" message without competing with them. */}
      {/* One polite live region for transient state changes, so a screen-reader user hears loading finish or a
          cancellation without the page needing focus. The prompts themselves are headings in the DOM. */}
      <div role="status" aria-live="polite" className={styles.liveRegion}>
        {status === 'loading' ? t('kundali.loading') : ''}
      </div>

      {status === 'error' && (
        <section className={styles.alert} aria-labelledby="kundali-error-title">
          <h2 className={styles.alertTitle} id="kundali-error-title">
            {t('kundali.loadFailedTitle')}
          </h2>
          <p className={styles.alertBody}>{t('kundali.loadFailedBody')}</p>
          <button type="button" className={styles.button} onClick={() => void reload()}>
            {t('kundali.retry')}
          </button>
        </section>
      )}

      {status === 'empty' && <EmptyProfiles returnTo={KUNDALI_PATH} />}

      {isForeignId && (
        <section className={styles.alert} aria-labelledby="kundali-unavailable-title">
          <h2 className={styles.alertTitle} id="kundali-unavailable-title">
            {t('kundali.unavailableTitle')}
          </h2>
          <p className={styles.alertBody}>{t('kundali.unavailableBody')}</p>
          <button type="button" className={styles.button} onClick={() => choose(summaries[0]?.id ?? '')}>
            {t('kundali.unavailableBack')}
          </button>
        </section>
      )}

      {status === 'ready' && selected && (
        <section className={styles.selected} aria-labelledby="kundali-selected-title">
          <h2 className={styles.selectedTitle} id="kundali-selected-title">
            {t('kundali.selected.title', { name: selected.name })}
          </h2>
          <p className={styles.selectedBody}>{t('kundali.selected.pendingBody')}</p>
          {/*
            KUN-10 and KUN-11. The profile summary carries no timezone, so the sections render transit instants in UTC
            and label them as such rather than guessing a zone from the browser. No calculation input comes from here.
          */}
          <KundaliSections profileId={selected.id} timeZoneId="UTC" />
        </section>
      )}

      {/* KUN-09: the dasha timeline for the selected profile. One section, one system; the choice lives in the URL so a
          link can point at a system and a reload keeps the one being read. */}
      {status === 'ready' && selected && (
        <DashasSection
          profileId={selected.id}
          system={system}
          onSystemChange={(next) => chooseSystem(next)}
        />
      )}

      {status === 'ready' && !selected && !isForeignId && summaries.length > 0 && (
        <p className={styles.muted}>{t('kundali.profileSelectHint')}</p>
      )}
    </div>
  );
}
