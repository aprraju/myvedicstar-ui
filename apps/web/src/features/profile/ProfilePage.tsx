import { type ProfileField, profileFields } from '@myvedicstar/contracts';
import { useProfileEditor, useProfileGeography } from '@myvedicstar/query-cache';
import { useId } from 'react';

import { useAuth } from '../../shared/auth';
import { Button } from '../../shared/components/Button';
import { useServices } from '../../shared/services/ServicesContext';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const { user } = useAuth();
  return <ProfileForm key={user?.id} userId={user?.id} />;
}

function ProfileForm({ userId }: { userId: string | undefined }) {
  const { api, config } = useServices();
  const editor = useProfileEditor(api, userId);
  const { query, values, errors, busy } = editor;
  const geo = useProfileGeography(
    api,
    values.country,
    values.state,
    values.city,
    values.postalCode,
    config.locationSearch.enabled,
  );
  const id = useId();
  const lists = { country: geo.countries.data?.results, state: geo.regions.data?.results };
  return (
    <section className={styles.page} aria-labelledby={`${id}-title`}>
      <div className={styles.card}>
        <h1 id={`${id}-title`} className="page-title">
          Profile
        </h1>
        <p>Manage your personal information and address.</p>
        {query.isPending && <p role="status">Loading your profile…</p>}
        {query.isError && (
          <div role="alert">
            <p>Your profile could not be loaded. Please try again.</p>
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            editor.submit();
          }}
          noValidate
        >
          <fieldset disabled={busy || !query.data} className={styles.fields}>
            {(Object.entries(profileFields) as [ProfileField, string][]).map(([field, label]) => (
              <div className={styles.field} key={field}>
                <label htmlFor={`${id}-${field}`}>{label}</label>
                <input
                  id={`${id}-${field}`}
                  value={values[field]}
                  onChange={(event) => editor.change(field, event.target.value)}
                  type={field === 'email' ? 'email' : field === 'phoneNumber' ? 'tel' : 'text'}
                  autoComplete={autoComplete[field]}
                  list={field === 'country' || field === 'state' ? `${id}-${field}-list` : undefined}
                  aria-invalid={!!errors[field]}
                  aria-describedby={errors[field] ? `${id}-${field}-error` : undefined}
                />
                {errors[field] && (
                  <p id={`${id}-${field}-error`} role="alert">
                    {errors[field]}
                  </p>
                )}
                {(field === 'country' || field === 'state') && (
                  <datalist id={`${id}-${field}-list`}>
                    {lists[field]?.map((item) => (
                      <option key={item.code} value={field === 'country' ? item.code : item.name}>
                        {item.name}
                      </option>
                    ))}
                  </datalist>
                )}
                {(field === 'city' || field === 'postalCode') && (
                  <div className={styles.suggestions}>
                    {(field === 'city' ? geo.cities : geo.postal).data?.results.map((place) => (
                      <button type="button" key={place.id} onClick={() => editor.selectPlace(place)}>
                        {[place.postalCode, place.city, place.region, place.country]
                          .filter(Boolean)
                          .join(', ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </fieldset>
          {(geo.countries.isError || geo.regions.isError || geo.cities.isError || geo.postal.isError) && (
            <p role="status">Address suggestions are unavailable. You can enter your address manually.</p>
          )}
          {(editor.save.isError || editor.sync.isError) && (
            <p role="alert">
              Changes could not be completed. Please try again. If the profile changed in another session,
              reload it before saving.
            </p>
          )}
          {editor.save.isSuccess && !query.data?.nameSyncPending && (
            <p role="status">Your profile has been saved.</p>
          )}
          {query.data?.nameSyncPending && (
            <div role="status">
              <p>Your profile is saved. Name synchronization with your sign-in account is pending.</p>
            </div>
          )}
          <Button type="submit" loading={editor.save.isPending} disabled={busy || !query.data}>
            Save
          </Button>
        </form>
      </div>
    </section>
  );
}

const autoComplete: Record<ProfileField, string> = {
  firstName: 'given-name',
  lastName: 'family-name',
  streetAddress: 'address-line1',
  streetAddress2: 'address-line2',
  country: 'country',
  state: 'address-level1',
  city: 'address-level2',
  postalCode: 'postal-code',
  email: 'email',
  phoneNumber: 'tel',
};
