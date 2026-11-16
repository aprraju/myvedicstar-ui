import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../shared/auth';
import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './MobileAccountMenu.module.css';
import { useAccountIdentity } from './ProfileMenu';

/**
 * Phones: the account icon at the top right of the header opens "Your Account" as a bottom sheet — Profile,
 * Settings and Log out. Built on the native modal <dialog> (top layer, inert page, Escape to close, focus kept inside);
 * the page behind does not scroll while it is open and focus returns to the icon. Hidden on wide windows by the
 * header's CSS (`className`), where the header's ProfileMenu is used.
 */
export function MobileAccountMenu({ className }: Readonly<{ className: string }>) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { name, email } = useAccountIdentity();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const button = buttonRef.current;
    if (!dialog || !open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      button?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${className} ${styles.trigger}`}
        aria-label={t('profile.mobile.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="user" size={20} />
      </button>
      {/* A tap on the scrim (the <dialog> itself) closes; keyboard users close with Escape or the Close button. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        className={styles.sheet}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {open && (
          <div className={styles.panel}>
            <span className={styles.handle} aria-hidden="true" />
            <div className={styles.header}>
              <span className={styles.avatar} aria-hidden="true">
                <Icon name="user" size={26} />
              </span>
              <div className={styles.heading}>
                <h2 id={titleId}>{t('profile.mobile.title')}</h2>
                <p>{t('profile.mobile.subtitle')}</p>
                {(name || email) && (
                  <p className={styles.identity}>
                    <span className="visually-hidden">{t('profile.signedInAs')} </span>
                    {[name, email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button type="button" className={styles.close} aria-label={t('a11y.close')} onClick={close}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <ul className={styles.options}>
              <li>
                <Link to={routes.profile} className={styles.option} onClick={close}>
                  <Icon name="user" size={22} />
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{t('nav.profile')}</span>
                    <span className={styles.optionHint}>{t('profile.mobile.profileHint')}</span>
                  </span>
                  <Icon name="chevronRight" size={20} />
                </Link>
              </li>
              <li>
                <Link to={routes.vedicProfiles} className={styles.option} onClick={close}>
                  <Icon name="user" size={22} />
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{t('nav.vedicProfiles')}</span>
                    <span className={styles.optionHint}>{t('profile.mobile.vedicProfilesHint')}</span>
                  </span>
                  <Icon name="chevronRight" size={20} />
                </Link>
              </li>
              <li>
                <Link to={routes.settings} className={styles.option} onClick={close}>
                  <Icon name="settings" size={22} />
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{t('profile.settings')}</span>
                    <span className={styles.optionHint}>{t('profile.mobile.settingsHint')}</span>
                  </span>
                  <Icon name="chevronRight" size={20} />
                </Link>
              </li>
            </ul>
            <button
              type="button"
              className={styles.logout}
              onClick={() => {
                close();
                void signOut();
              }}
            >
              <Icon name="logout" size={22} />
              {t('profile.logout')}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
