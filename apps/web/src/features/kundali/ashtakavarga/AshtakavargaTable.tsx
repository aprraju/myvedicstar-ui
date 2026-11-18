import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Ashtakavarga.module.css';
import { type AshtakavargaValues, bhinnaRows, sarvaRow } from './values';

/**
 * The authoritative rendering of Ashtakavarga: a real <table> with row and column headers.
 *
 * The heat map is a visual convenience layered on top of this; this table is what a screen reader reads and what a
 * narrow screen can be measured against. Every number shown in the heat map appears here and vice versa, from the same
 * source array - there is no second copy of the data that could drift.
 *
 * The first cell of each row is a <th scope="row">, so a screen reader announces "Sun, Aries, 3" rather than a bare 3.
 */
export function AshtakavargaTable({ values }: { values: AshtakavargaValues }) {
  const { t } = useTranslation();
  const sarva = sarvaRow(values);
  const rows = bhinnaRows(values);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>{t('kundali.ashtakavarga.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.cornerHeader}>
              {t('kundali.ashtakavarga.planetHeader')}
            </th>
            {values.signs.map((sign) => (
              <th key={sign} scope="col" className={styles.columnHeader}>
                {t(`kundali.ashtakavarga.sign.${sign}`)}
                <span className={styles.signAbbr} aria-hidden="true">
                  {t(`kundali.ashtakavarga.signAbbr.${sign}`)}
                </span>
              </th>
            ))}
            <th scope="col" className={styles.totalHeader}>
              {t('kundali.ashtakavarga.totalHeader')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.planet}>
              <th scope="row" className={styles.rowHeader}>
                {t(`kundali.ashtakavarga.planet.${row.planet}`)}
              </th>
              {row.bindus.map((bindus, index) => (
                // The sign name is in the column header, so the cell only needs the number; the data-label keeps the
                // value self-describing when the table is reflowed into stacked cards at 320px.
                <td key={values.signs[index]} className={styles.cell}>
                  {bindus}
                </td>
              ))}
              <td className={styles.totalCell} data-label={t('kundali.ashtakavarga.totalHeader')}>
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={styles.sarvaRow}>
            <th scope="row" className={styles.rowHeader}>
              {t('kundali.ashtakavarga.sarva')}
            </th>
            {sarva.map((bindus, index) => (
              <td key={values.signs[index]} className={styles.cell}>
                {bindus}
              </td>
            ))}
            <td className={styles.totalCell} data-label={t('kundali.ashtakavarga.totalHeader')}>
              {values.grandTotal}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
