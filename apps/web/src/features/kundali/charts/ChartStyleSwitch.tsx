import type { ChartStyle } from '@myvedicstar/contracts';
import { chartStyleValues } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Charts.module.css';

/**
 * Switches the drawing style only.
 *
 * This component is deliberately given no data props: it cannot refetch, re-request or recalculate, because it has no
 * access to the payload or the API. Changing style re-renders the same numbers through different geometry, which is
 * what "presentation-only" means here - it is enforced by the component's shape, not by discipline.
 */
export function ChartStyleSwitch({
  style,
  onChange,
}: {
  style: ChartStyle;
  onChange: (next: ChartStyle) => void;
}) {
  const { t } = useTranslation();

  return (
    <fieldset className={styles.switcher}>
      <legend className={styles.switcherLegend}>{t('kundali.charts.styleLegend')}</legend>
      {chartStyleValues.map((option) => (
        <label key={option} className={styles.switcherOption}>
          <input
            type="radio"
            name="chart-style"
            value={option}
            checked={style === option}
            onChange={() => onChange(option)}
          />
          <span>{t(`kundali.charts.style.${option}`)}</span>
        </label>
      ))}
    </fieldset>
  );
}
