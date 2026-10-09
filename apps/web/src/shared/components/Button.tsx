import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { useTranslation } from '../i18n/I18nProvider';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Shows a busy state and blocks repeat activation (prevents duplicate submissions). */
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      {...rest}
      type={type}
      className={[styles.button, styles[variant], fullWidth ? styles.fullWidth : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
      {loading && <span className="visually-hidden">{t('states.loading')}</span>}
    </button>
  );
}
