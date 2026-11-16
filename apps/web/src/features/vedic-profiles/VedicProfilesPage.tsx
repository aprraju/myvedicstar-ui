import { useState } from 'react';

import { Button } from '../../shared/components/Button';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { LocationSelector } from '../location';
import { BirthTimeField, type BirthTimeValue, EMPTY_BIRTH_TIME, isDraftSavable } from './BirthTimeField';
import styles from './VedicProfilesPage.module.css';

/**
 * Vedic Profiles — layout scaffolding only.
 *
 * Deliberately NOT wired to an API: the field names and endpoint shape are still being agreed with the backend
 * (apraju/myvedicstar#9, tracked here as #28). Everything below is presentation and local form state so the layout,
 * the three-state birth time control and the mandatory-field behaviour can be built and tested without guessing the
 * contract. When the contract lands, the save call replaces the `onSave` placeholder and nothing else moves.
 */
export interface VedicProfileDraft {
  name: string;
  /** DD/MM/YYYY, as displayed. */
  birthDate: string;
  birthTime: BirthTimeValue;
  birthLocationLabel: string;
  gender: string;
  occupation: string;
  relationship: string;
  customRelationship: string;
}

const EMPTY_DRAFT: VedicProfileDraft = {
  name: '',
  birthDate: '',
  birthTime: EMPTY_BIRTH_TIME,
  birthLocationLabel: '',
  gender: '',
  occupation: '',
  relationship: '',
  customRelationship: '',
};

/** Placeholder list until persistence exists. Never presented as real data. */
const SCAFFOLD_PROFILES = [{ id: 'self', name: 'Self', relationship: 'Self', isSelf: true }];

export function VedicProfilesPage() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<VedicProfileDraft>(EMPTY_DRAFT);
  const [selectedId, setSelectedId] = useState('self');
  const savable = isDraftSavable(draft);

  const update = <K extends keyof VedicProfileDraft>(key: K, value: VedicProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

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
          <ul className={styles.cards}>
            {SCAFFOLD_PROFILES.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={styles.card}
                  aria-current={selectedId === profile.id}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <span className={styles.cardName}>{profile.name}</span>
                  <span className={styles.cardRelationship}>{profile.relationship}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" fullWidth onClick={() => setDraft(EMPTY_DRAFT)}>
            {t('vedicProfiles.add')}
          </Button>
        </section>

        <section className={styles.formPane} aria-labelledby="vedic-profiles-form-title">
          <h2 id="vedic-profiles-form-title" className={styles.paneTitle}>
            {t('vedicProfiles.formTitle')}
          </h2>

          <form
            className={styles.form}
            onSubmit={(event) => {
              // No mutation yet: the save contract is not defined (#28). This keeps the button honest.
              event.preventDefault();
            }}
          >
            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.name')}</span>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
                autoComplete="name"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.birthDate')}</span>
              <input
                className={styles.input}
                type="date"
                value={draft.birthDate}
                onChange={(event) => update('birthDate', event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>

            <BirthTimeField value={draft.birthTime} onChange={(next) => update('birthTime', next)} />

            <div className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.birthLocation')}</span>
              {/* Reuses the app's single location selector; a second one would be a duplicate implementation. */}
              <LocationSelector />
            </div>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.gender')}</span>
              <select
                className={styles.input}
                value={draft.gender}
                onChange={(event) => update('gender', event.target.value)}
              >
                <option value="">{t('vedicProfiles.form.choose')}</option>
                <option value="female">{t('vedicProfiles.gender.female')}</option>
                <option value="male">{t('vedicProfiles.gender.male')}</option>
                <option value="other">{t('vedicProfiles.gender.other')}</option>
                <option value="undisclosed">{t('vedicProfiles.gender.undisclosed')}</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                {t('vedicProfiles.form.occupation')}
                <span className={styles.required} aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
              <input
                className={styles.input}
                value={draft.occupation}
                onChange={(event) => update('occupation', event.target.value)}
                required
                aria-required="true"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('vedicProfiles.form.relationship')}</span>
              <select
                className={styles.input}
                value={draft.relationship}
                onChange={(event) => update('relationship', event.target.value)}
              >
                <option value="">{t('vedicProfiles.form.choose')}</option>
                <option value="self">{t('vedicProfiles.relationship.self')}</option>
                <option value="spouse">{t('vedicProfiles.relationship.spouse')}</option>
                <option value="child">{t('vedicProfiles.relationship.child')}</option>
                <option value="parent">{t('vedicProfiles.relationship.parent')}</option>
                <option value="other">{t('vedicProfiles.relationship.other')}</option>
              </select>
            </label>

            {draft.relationship === 'other' && (
              <label className={styles.field}>
                <span className={styles.label}>{t('vedicProfiles.form.customRelationship')}</span>
                <input
                  className={styles.input}
                  value={draft.customRelationship}
                  onChange={(event) => update('customRelationship', event.target.value)}
                  required
                />
              </label>
            )}

            <div className={styles.actions}>
              <Button type="submit" disabled={!savable}>
                {t('vedicProfiles.save')}
              </Button>
              <Button variant="secondary" onClick={() => setDraft(EMPTY_DRAFT)}>
                {t('vedicProfiles.cancel')}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
