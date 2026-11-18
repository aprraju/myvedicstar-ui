import type { ChartHouse, ChartPrecision, ChartStyle } from '@myvedicstar/contracts';
import { type DivisionalChartResponse, isChartDrawable } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { cellsWithHouses } from './chartLayout';
import styles from './Charts.module.css';

/**
 * Renders one divisional chart, or refuses to.
 *
 * The refusal is structural: `isChartDrawable` is checked before any <svg> is created, so an unavailable chart cannot
 * produce an empty diamond that would read as a rendering bug. The unavailable state names the reason per chart.
 *
 * Below the drawing there is always a text equivalent - a table of the same placements - because a chart that is
 * readable only as an image is not accessible, and because screen-reader users need the same facts.
 */
/** Every reason the API can send, mapped to its catalog key. */
type ChartReason = 'engine-unavailable' | 'birth-time-unknown' | 'birth-time-approximate' | 'not-implemented';

const REASON_MESSAGE_KEYS: Record<ChartReason, `kundali.charts.reason.${ChartReason}`> = {
  'engine-unavailable': 'kundali.charts.reason.engine-unavailable',
  'birth-time-unknown': 'kundali.charts.reason.birth-time-unknown',
  'birth-time-approximate': 'kundali.charts.reason.birth-time-approximate',
  'not-implemented': 'kundali.charts.reason.not-implemented',
};

/**
 * Narrows the contract's free-form reason to the ones we can explain.
 *
 * The wire type is `string`, so an unknown value is possible. Falling back to the generic reason keeps the UI honest:
 * better to say "not calculated" than to render a raw server code into the page.
 */
const asChartReason = (reason: string): ChartReason =>
  reason in REASON_MESSAGE_KEYS ? (reason as ChartReason) : 'engine-unavailable';

export function ChartView({
  response,
  style,
  title,
}: {
  response: DivisionalChartResponse | undefined;
  style: ChartStyle;
  title: string;
}) {
  const { t } = useTranslation();

  if (!isChartDrawable(response) || !response) {
    const precision: ChartPrecision | undefined = response?.precision;
    return (
      <section className={styles.unavailable} aria-labelledby={`chart-${title}`}>
        <h3 className={styles.unavailableTitle} id={`chart-${title}`}>
          {title}
        </h3>
        <p className={styles.unavailableBody}>{t('kundali.charts.notDrawn')}</p>
        {precision?.status === 'unvalidated-reference' && (
          <p className={styles.caveat}>{t('kundali.charts.unvalidated')}</p>
        )}
        {precision?.reason && (
          // Explicit map, not a template literal: the translator takes a typed MessageKey, and building a key from a
          // string erases that safety. Listing them keeps a new reason a compile error rather than a blank paragraph.
          <p className={styles.reason}>{t(REASON_MESSAGE_KEYS[asChartReason(precision.reason)])}</p>
        )}
      </section>
    );
  }

  const cells = cellsWithHouses(style, response.houses);

  return (
    <section className={styles.chart} aria-labelledby={`chart-${title}`}>
      <h3 className={styles.chartTitle} id={`chart-${title}`}>
        {title}
      </h3>
      {response.precision.status === 'unvalidated-reference' && (
        <p className={styles.caveat}>{t('kundali.charts.unvalidated')}</p>
      )}
      {/* Decorative: the table below carries the same information for assistive tech. */}
      <svg
        className={styles.svg}
        viewBox="0 0 100 100"
        role="img"
        aria-hidden="true"
        data-style={style}
        data-testid={`chart-svg-${style}`}
      >
        <rect x="0" y="0" width="100" height="100" className={styles.frame} />
        {cells.map(({ cell, house }) => (
          <g key={cell.house}>
            <polygon points={cell.points} className={styles.cell} />
            <text x={cell.x} y={cell.y} className={styles.cellText} textAnchor="middle">
              {house.sign}
            </text>
            <text x={cell.x} y={cell.y + 4} className={styles.cellPlanets} textAnchor="middle">
              {house.placements.map((placement) => placement.planet).join(', ')}
            </text>
          </g>
        ))}
      </svg>
      <PlacementsTable houses={response.houses} title={title} />
    </section>
  );
}

/** The accessible equivalent of the drawing: identical facts, no image required. */
function PlacementsTable({ houses, title }: { houses: readonly ChartHouse[]; title: string }) {
  const { t } = useTranslation();
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{t('kundali.charts.tableCaption', { chart: title })}</caption>
      <thead>
        <tr>
          <th scope="col">{t('kundali.charts.house')}</th>
          <th scope="col">{t('kundali.charts.sign')}</th>
          <th scope="col">{t('kundali.charts.placements')}</th>
        </tr>
      </thead>
      <tbody>
        {houses.map((house, index) => (
          <tr key={index}>
            <th scope="row">{index + 1}</th>
            <td>{house.sign}</td>
            <td>
              {house.placements.length === 0
                ? t('kundali.charts.empty')
                : house.placements
                    .map((placement) =>
                      t('kundali.charts.placement', {
                        planet: placement.planet,
                        degree: placement.degree,
                      }),
                    )
                    .join('; ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
