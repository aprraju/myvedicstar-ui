import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './LocationSelector.module.css';
import { useLocationState } from './LocationStateProvider';

/** Header control showing the selected location; opens the location dialog. */
export function LocationSelector() {
  const { t } = useTranslation();
  const { location, detecting, openDialog } = useLocationState();
  const text = detecting && !location ? t('location.locating') : (location?.label ?? t('location.choose'));
  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={openDialog}
      aria-haspopup="dialog"
      aria-label={location ? t('location.change', { location: location.label }) : t('location.choose')}
    >
      <Icon name={location?.source === 'current' ? 'locate' : 'pin'} size={18} />
      <span className={styles.text}>{text}</span>
      <Icon name="chevronDown" size={16} />
    </button>
  );
}
