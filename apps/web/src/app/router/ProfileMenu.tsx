import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { displayNameOf, useAuth, useUserInfo } from '../../shared/auth';
import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './ProfileMenu.module.css';

/**
 * Account menu for signed-in users: a profile icon that opens the user's name and email (from the Authorize API's
 * `userinfo`), Settings and Log out. A disclosure (button + panel), not an ARIA menu: Tab moves through the options;
 * Escape, an outside click or choosing an option closes it and returns focus to the button.
 */
export function ProfileMenu() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { name, email } = useAccountIdentity();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) buttonRef.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close(true);
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={t('profile.open')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Icon name="user" size={22} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.identity}>
          <span className="visually-hidden">{t('profile.signedInAs')} </span>
          {name && <p className={styles.name}>{name}</p>}
          {email && <p className={name ? styles.email : styles.name}>{email}</p>}
        </div>
        <ul className={styles.options}>
          <li>
            <Link to={routes.profile} className={styles.option} onClick={() => setOpen(false)}>
              <Icon name="user" size={18} />
              {t('nav.profile')}
            </Link>
          </li>
          <li>
            <Link to={routes.settings} className={styles.option} onClick={() => setOpen(false)}>
              <Icon name="settings" size={18} />
              {t('profile.settings')}
            </Link>
          </li>
          <li>
            <button
              type="button"
              className={styles.option}
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <Icon name="logout" size={18} />
              {t('profile.logout')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * The signed-in user's name and email for account menus: from `userinfo`, falling back to the sign-in token. A
 * placeholder name ("Unknown", "Your account" or the email itself) is left out.
 */
export function useAccountIdentity() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userInfo } = useUserInfo();
  const candidate = displayNameOf(userInfo, userInfo ? undefined : user?.displayName);
  const email = userInfo?.email?.trim() || user?.email?.trim() || undefined;
  const name =
    candidate &&
    !['unknown', t('profile.unknownName').toLowerCase(), email?.toLowerCase()].includes(
      candidate.toLowerCase(),
    )
      ? candidate
      : undefined;
  return { name, email };
}
