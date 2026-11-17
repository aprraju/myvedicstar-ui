import type { VedicProfile, VedicProfileSummary } from '@myvedicstar/contracts';
import type { MessageKey, MessageParams } from '@myvedicstar/localization';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUserInfo } from '../../shared/auth';
import { Button } from '../../shared/components/Button';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { LocationSelector } from '../location';
import { BirthTimeField } from './BirthTimeField';
import { toFriendlyKey } from './error-key';
import {
  accountDisplayName,
  EMPTY_DRAFT,
  GENDER_LABEL_KEYS,
  GENDER_VALUES,
  type GenderValue,
  type ProfileDraft,
  RELATIONSHIP_VALUES,
  type RelationshipValue,
  toDraft,
  toReplaceRequest,
  toRequest,
} from './profile-mapping';
import { useVedicProfiles } from './useVedicProfiles';
import styles from './VedicProfilesPage.module.css';

/** Birth time is required to be a real value for the chart, so Save stays blocked until the draft is usable. */
function isDraftComplete(draft: ProfileDraft): boolean {
  if (!draft.name.trim() || !draft.birthDate || !draft.birthLocation) return false;
  if (draft.birthTime.mode === 'known') return draft.birthTime.from.length > 0;
  if (draft.birthTime.mode === 'approximate') {
    return (
      draft.birthTime.from.length > 0 &&
      draft.birthTime.to.length > 0 &&
      draft.birthTime.to >= draft.birthTime.from
    );
  }
  return true;
}

/** Display label for a saved profile: its name, with the relationship as the secondary line. */
type Translate = (key: MessageKey, params?: MessageParams) => string;

function relationshipLabel(t: Translate, summary: VedicProfileSummary): string {
  if (summary.relationship === 'Other' && summary.customRelationship) return summary.customRelationship;
  return t(toFriendlyKey('vedicProfiles.relationship', summary.relationship));
}

export function VedicProfilesPage() {
  const { t } = useTranslation();
  const {
    summaries,
    listStatus,
    listError,
    mutation,
    create,
    update,
    remove,
    clearMutation,
    refreshAfterConflict,
  } = useVedicProfiles();

  const { userInfo } = useUserInfo();
  /** The first profile is the account owner, so its name defaults to the login profile. */
  const newDraft = useCallback(
    (): ProfileDraft => ({
      ...EMPTY_DRAFT,
      name: accountDisplayName(userInfo?.firstName, userInfo?.lastName),
    }),
    [userInfo?.firstName, userInfo?.lastName],
  );

  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<VedicProfile | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VedicProfileSummary | null>(null);
  const [loaded, setLoaded] = useState<VedicProfile | null>(null);

  /**
   * The login profile arrives after the first render, so the name cannot be seeded in the initial state. A ref keeps
   * this one-shot: a late userInfo fills a name the user has not typed, and never overwrites one they have.
   */
  const nameSeeded = useRef(false);
  useEffect(() => {
    if (nameSeeded.current || editing) return;
    const name = accountDisplayName(userInfo?.firstName, userInfo?.lastName);
    if (!name) return;
    nameSeeded.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the name comes from an async cache, not a render derivation.
    setDraft((current) => (current.name.trim() ? current : { ...current, name }));
  }, [userInfo?.firstName, userInfo?.lastName, editing]);

  const savable = isDraftComplete(draft);
  const busy = mutation.status === 'saving';

  /**
   * Editing after a conflict or an error means the user has decided what to do, so the stale prompt goes away.
   * This runs in the event handler rather than an effect: clearing from an effect keyed on the mutation state would
   * flip it back to idle on every render and re-trigger the effect, which is an infinite loop.
   */
  const update$ = useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      if (mutation.status === 'conflict' || mutation.status === 'error') clearMutation();
    },
    [mutation.status, clearMutation],
  );

  const startNew = useCallback(() => {
    setEditing(null);
    setDraft(newDraft());
    nameSeeded.current = false;
    clearMutation();
  }, [clearMutation, newDraft]);

  // Selecting a saved row loads its full record so edits carry the current revision.
  const selectSummary = useCallback(
    async (summary: VedicProfileSummary) => {
      clearMutation();
      const loadedProfile = await refreshAfterConflict(summary.id);
      if (!loadedProfile) return;
      setEditing(loadedProfile);
      setDraft(toDraft(loadedProfile));
    },
    [clearMutation, refreshAfterConflict],
  );

  /**
   * The revision baseline comes from the last profile the server confirmed, so a save or a conflict updates it
   * without touching the user's draft. Derived during render from the mutation rather than synced in an effect:
   * `mutation` is a fresh object on every state change, so an effect on it would set state and re-run forever.
   */
  const revisionBaseline =
    mutation.status === 'saved' || mutation.status === 'conflict' ? mutation.profile : loaded;

  const onSubmit = async () => {
    if (!savable || busy) return;
    const request = toRequest(draft);
    const result = editing
      ? await update(editing.id, toReplaceRequest(draft, revisionBaseline?.revision ?? editing.revision))
      : await create(request);
    if (result) {
      setEditing(result);
      setLoaded(result);
      setDraft(toDraft(result));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const ok = await remove(pendingDelete.id);
    if (ok) {
      setPendingDelete(null);
      if (editing?.id === pendingDelete.id) startNew();
    }
  };

  const statusMessage = useMemo(() => {
    switch (mutation.status) {
      case 'saved':
        return { tone: 'success' as const, text: t('vedicProfiles.status.saved') };
      case 'deleted':
        return { tone: 'success' as const, text: t('vedicProfiles.status.deleted') };
      case 'conflict':
        return { tone: 'error' as const, text: t('errors.conflict') };
      case 'error':
        return { tone: 'error' as const, text: t(toFriendlyKey('errors', mutation.kind)) };
      default:
        return null;
    }
  }, [mutation, t]);

  return (
    <section className={styles.page} aria-labelledby="vedic-profiles-title">
      <header className={styles.header}>
        <h1 id="vedic-profiles-title" className={styles.title}>
          {t('vedicProfiles.title')}
        </h1>
        <p className={styles.subtitle}>{t('vedicProfiles.subtitle')}</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.listPane} aria-labelledby="vedic-profiles-list-title">
          <h2 id="vedic-profiles-list-title" className={styles.paneTitle}>
            {t('vedicProfiles.savedTitle')}
          </h2>

          {listStatus === 'loading' && <p className={styles.muted}>{t('vedicProfiles.list.loading')}</p>}
          {listStatus === 'error' && (
            <p className={styles.errorText} role="alert">
              {t(toFriendlyKey('errors', listError ?? 'unknown'))}
            </p>
          )}
          {listStatus === 'ready' && summaries.length === 0 && (
            <p className={styles.muted}>{t('vedicProfiles.list.empty')}</p>
          )}

          <ul className={styles.cards}>
            {summaries.map((summary) => (
              <li key={summary.id}>
                <button
                  type="button"
                  className={styles.card}
                  aria-current={editing?.id === summary.id}
                  onClick={() => void selectSummary(summary)}
                >
                  <span className={styles.cardName}>{summary.name}</span>
                  <span className={styles.cardRelationship}>{relationshipLabel(t, summary)}</span>
                </button>
                <Button
                  variant="secondary"
                  onClick={() => setPendingDelete(summary)}
                  aria-label={t('vedicProfiles.deleteNamed', { name: summary.name })}
                >
                  {t('vedicProfiles.delete')}
                </Button>
              </li>
            ))}
          </ul>

          <Button variant="secondary" fullWidth onClick={startNew}>
            {t('vedicProfiles.add')}
          </Button>
        </section>

        <section className={styles.formPane} aria-labelledby="vedic-profiles-form-title">
          <h2 id="vedic-profiles-form-title" className={styles.paneTitle}>
            {editing ? t('vedicProfiles.editTitle') : t('vedicProfiles.formTitle')}
          </h2>

          {/* Errors and confirmations are announced; nothing claims success before the server answered. */}
          <div role="status" aria-live="polite" className={styles.liveRegion}>
            {statusMessage && (
              <p className={statusMessage.tone === 'error' ? styles.errorText : styles.successText}>
                {statusMessage.text}
                {mutation.status === 'conflict' && (
                  <Button
                    variant="secondary"
                    onClick={() => void selectSummary(editing ?? (mutation.profile as VedicProfileSummary))}
                  >
                    {t('vedicProfiles.conflictRefresh')}
                  </Button>
                )}
              </p>
            )}
          </div>

          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.name')}</span>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(event) => update$('name', event.target.value)}
                autoComplete="name"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.birthDate')}</span>
              <input
                className={styles.input}
                type="date"
                value={draft.birthDate}
                onChange={(event) => update$('birthDate', event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>

            <BirthTimeField value={draft.birthTime} onChange={(next) => update$('birthTime', next)} />

            <div className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.birthLocation')}</span>
              {/* The one shared selector, in controlled mode: its pick becomes this profile's birth location. */}
              <LocationSelector
                value={draft.birthLocation}
                onChange={(location) => update$('birthLocation', location)}
              />
              {draft.birthLocation && (
                <p className={styles.hint}>{draft.birthLocation.fullName ?? draft.birthLocation.label}</p>
              )}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.gender')}</span>
              <select
                className={styles.input}
                value={draft.gender}
                onChange={(event) => update$('gender', event.target.value as GenderValue)}
              >
                {GENDER_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(GENDER_LABEL_KEYS[value] as MessageKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.occupation')}</span>
              <input
                className={styles.input}
                value={draft.occupation}
                onChange={(event) => update$('occupation', event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.relationship')}</span>
              <select
                className={styles.input}
                value={draft.relationship}
                onChange={(event) => update$('relationship', event.target.value as RelationshipValue)}
              >
                {RELATIONSHIP_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`vedicProfiles.relationship.${value}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>

            {draft.relationship === 'Other' && (
              <label className={styles.field}>
                <span className={styles.label}>{t('vedicProfiles.form.customRelationship')}</span>
                <input
                  className={styles.input}
                  value={draft.customRelationship}
                  onChange={(event) => update$('customRelationship', event.target.value)}
                  required
                />
              </label>
            )}

            <div className={styles.actions}>
              <Button type="submit" disabled={!savable || busy}>
                {busy ? t('vedicProfiles.saving') : t('vedicProfiles.save')}
              </Button>
              <Button variant="secondary" onClick={startNew} disabled={busy}>
                {t('vedicProfiles.cancel')}
              </Button>
            </div>
          </form>

          {pendingDelete && (
            <div role="alertdialog" aria-labelledby="vedic-profiles-delete-title" className={styles.confirm}>
              <p id="vedic-profiles-delete-title">
                {t('vedicProfiles.confirmDelete', { name: pendingDelete.name })}
              </p>
              <div className={styles.actions}>
                <Button onClick={() => void confirmDelete()} disabled={busy}>
                  {t('vedicProfiles.delete')}
                </Button>
                <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
                  {t('vedicProfiles.cancel')}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
