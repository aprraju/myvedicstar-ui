import type { CSSProperties } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Ashtakavarga.module.css';
import { type AshtakavargaValues, bhinnaRows } from './values';

/**
 * A sign-wise intensity grid for the per-planet bindus.
 *
 * Deliberate choices:
 *  - It is NOT an <svg> chart with positioned marks. The engine does not supply geometry, and a chart with invented
 *    positions would imply a spatial reading that is not in the data. This is a grid of cells keyed by sign and planet.
 *  - It is not the only way to read the data: {@link AshtakavargaTable} carries the same numbers as a real table, and
 *    the heat map is marked aria-hidden so a screen reader is never given a second, less complete rendering.
 *  - Intensity is expressed with the theme's surface tokens stepped by an opacity multiplier, not with new literal
 *    colours. The number is always printed in the cell, so intensity is never the only carrier of meaning.
 */
export function AshtakavargaHeatMap({ values }: { values: AshtakavargaValues }) {
  const { t } = useTranslation();
  const rows = bhinnaRows(values);

  // 0 bindus is the faintest step, the payload's maximum the strongest. A flat payload (all zero) yields 0.2, not NaN.
  const intensity = (bindus: number) =>
    values.maxBindu === 0 ? 0.2 : 0.2 + (bindus / values.maxBindu) * 0.8;

  return (
    <figure className={styles.heatFigure}>
      <figcaption className={styles.heatCaption}>{t('kundali.ashtakavarga.heatCaption')}</figcaption>
      <div className={styles.heatGrid} aria-hidden="true">
        <div className={styles.heatHeader}>
          <span />
          {values.signs.map((sign) => (
            <span key={sign} className={styles.heatSign}>
              {t(`kundali.ashtakavarga.signAbbr.${sign}`)}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.planet} className={styles.heatRow}>
            <span className={styles.heatPlanet}>{t(`kundali.ashtakavarga.planet.${row.planet}`)}</span>
            {row.bindus.map((bindus, index) => (
              <span
                key={values.signs[index]}
                className={styles.heatCell}
                style={{ '--heat': intensity(bindus) } as CSSProperties}
              >
                {bindus}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.heatLegend}>{t('kundali.ashtakavarga.heatLegend')}</p>
    </figure>
  );
}
