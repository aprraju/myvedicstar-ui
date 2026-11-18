import type { KundaliPlanets } from '@myvedicstar/contracts';
import type { MessageKey } from '@myvedicstar/localization';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { MethodNotice, ReasonText } from './MethodNotice';
import { PlanetRow } from './PlanetRow';
import styles from './Planets.module.css';

/** The columns of the detail table, in reading order. Kept in one place so the header and rows cannot drift apart. */
const COLUMNS = [
  'planet',
  'sign',
  'degree',
  'nakshatra',
  'house',
  'dignity',
  'retrograde',
  'combust',
  'relationships',
  'aspects',
] as const;

/**
 * Columns that stay in the scrollable table on a narrow screen. Planet is the row header and always visible; the rest
 * scroll horizontally inside their own container, so the page itself never scrolls sideways.
 */
function PlanetTable({ section }: { section: KundaliPlanets }) {
  const { t } = useTranslation();
  const hasAnyRow = section.planets.length > 0;

  if (!hasAnyRow) {
    // An empty list is not an empty table with a header and no rows: that reads as "there are no planets", which is
    // false. It is stated as a section-level unavailable, and the method line above it still names the conventions the
    // (empty) result was produced under.
    return (
      <p className={styles.emptySection} data-testid="planets-empty">
        {t('kundali.planets.noneEmpty')}
        <ReasonText reason="engine-unavailable" />
      </p>
    );
  }

  return (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={t('kundali.planets.tableLabel')}>
      <table className={styles.table} data-testid="planets-table">
        <caption className="visually-hidden">{t('kundali.planets.tableCaption')}</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={styles.columnHeader}>
                {t(`kundali.planets.column.${column}` as MessageKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.planets.map((planet) => (
            <PlanetRow key={planet.planet} planet={planet} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * KUN-08: planetary detail, dignity and aspects.
 *
 * Pure presentation, exactly like the KUN-05 overview: the payload is a prop, nothing is fetched, computed or repaired
 * here. The section is built so that the unsupported path is the primary path — with an engine that returns positions
 * for the Sun and Moon only, the remaining seven rows still appear, and every fact they lack is shown as an explained
 * unavailable cell rather than a dash, an empty cell or a fabricated value.
 *
 * Deliberately absent: any chart artwork. A South/North Indian chart drawn without positions would be a picture of data
 * that does not exist, so there is no SVG, canvas or image here until the engine supplies the positions to place.
 */
export function PlanetsSection({ section }: { section: KundaliPlanets }) {
  const { t } = useTranslation();

  return (
    <section className={styles.section} aria-labelledby="kundali-planets-heading">
      <h2 className={styles.sectionTitle} id="kundali-planets-heading">
        {t('kundali.planets.title')}
      </h2>
      <p className={styles.lede}>{t('kundali.planets.subtitle')}</p>

      <MethodNotice section={section} />
      <PlanetTable section={section} />

      <p className={styles.note} data-testid="planets-note">
        {t('kundali.planets.unavailableNote')}
      </p>
    </section>
  );
}
