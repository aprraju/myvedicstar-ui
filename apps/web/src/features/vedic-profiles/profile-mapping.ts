import type { ReplaceVedicProfileRequest, VedicProfile, VedicProfileRequest } from '@myvedicstar/contracts';
import type { SelectedLocation } from '@myvedicstar/domain-models';

import type { BirthTimeValue } from './BirthTimeField';

/** Gender options are UI wording only; the wire field is free text pending owner-approved values. */
export const GENDER_VALUES = ['Female', 'Male', 'Non-binary', 'Prefer not to say'] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];
/** The DTO requires a gender string, so an unanswered field still sends a neutral value rather than ''. */
export const DEFAULT_GENDER: GenderValue = 'Prefer not to say';

export const RELATIONSHIP_VALUES = [
  'Self',
  'Father',
  'Mother',
  'Wife',
  'Husband',
  'Son',
  'Daughter',
  'Other',
] as const;
export type RelationshipValue = (typeof RELATIONSHIP_VALUES)[number];

/** Editable form state, using the same shapes the controls produce. */
export interface ProfileDraft {
  name: string;
  /** yyyy-MM-dd (an <input type="date"> value). */
  birthDate: string;
  birthTime: BirthTimeValue;
  birthLocation: SelectedLocation | null;
  /** Human-readable place for the DTO's LocationName (the selector's label). */
  gender: GenderValue;
  occupation: string;
  relationship: RelationshipValue;
  customRelationship: string;
}

export const EMPTY_DRAFT: ProfileDraft = {
  name: '',
  birthDate: '',
  birthTime: { mode: 'known', from: '', to: '' },
  birthLocation: null,
  gender: DEFAULT_GENDER,
  occupation: '',
  relationship: 'Self',
  customRelationship: '',
};

/**
 * Times are wall-clock strings sent verbatim; nothing is converted or defaulted.
 * Known carries all three equal values (the server's invariant); Approximate carries both endpoints and no single
 * time; Unknown carries all nulls.
 */
export function birthTimeBody(
  birthTime: BirthTimeValue,
): Pick<VedicProfileRequest, 'birthTimeMode' | 'birthTime' | 'birthTimeFrom' | 'birthTimeTo'> {
  const from = birthTime.from || null;
  const to = birthTime.to || null;
  if (birthTime.mode === 'known') {
    return { birthTimeMode: 'Known', birthTime: from, birthTimeFrom: from, birthTimeTo: from };
  }
  if (birthTime.mode === 'approximate') {
    return { birthTimeMode: 'Approximate', birthTime: null, birthTimeFrom: from, birthTimeTo: to };
  }
  return { birthTimeMode: 'Unknown', birthTime: null, birthTimeFrom: null, birthTimeTo: null };
}

/** Reverses {@link birthTimeBody}: the three states come back exactly as stored. */
export function birthTimeFromProfile(
  profile: Pick<VedicProfile, 'birthTimeMode' | 'birthTime' | 'birthTimeFrom' | 'birthTimeTo'>,
): BirthTimeValue {
  if (profile.birthTimeMode === 'Known') {
    return { mode: 'known', from: profile.birthTime ?? '', to: '' };
  }
  if (profile.birthTimeMode === 'Approximate') {
    return { mode: 'approximate', from: profile.birthTimeFrom ?? '', to: profile.birthTimeTo ?? '' };
  }
  return { mode: 'unknown', from: '', to: '' };
}

/** Custom relationship is meaningful only for Other; every other value must send null. */
function customRelationshipFor(draft: ProfileDraft): string | null {
  return draft.relationship === 'Other' ? draft.customRelationship.trim() || null : null;
}

/**
 * Form → wire. The location contributes its label plus the coordinates and zone of the user's actual pick, so a
 * profile's timezone never depends on the device.
 */
export function toRequest(draft: ProfileDraft): VedicProfileRequest {
  const location = draft.birthLocation;
  return {
    name: draft.name.trim(),
    dateOfBirth: draft.birthDate,
    ...birthTimeBody(draft.birthTime),
    timeAccuracyNote: null,
    locationName: location?.label ?? '',
    latitude: location?.latitude ?? 0,
    longitude: location?.longitude ?? 0,
    timezoneId: location?.timeZone ?? '',
    gender: draft.gender || DEFAULT_GENDER,
    occupation: draft.occupation.trim() || null,
    relationship: draft.relationship,
    customRelationship: customRelationshipFor(draft),
  };
}

/** Wire → form, for editing an existing profile and for refreshing after a 409. */
export function toDraft(profile: VedicProfile): ProfileDraft {
  const relationship = (RELATIONSHIP_VALUES as readonly string[]).includes(profile.relationship)
    ? (profile.relationship as RelationshipValue)
    : 'Other';
  const gender = (GENDER_VALUES as readonly string[]).includes(profile.gender)
    ? (profile.gender as GenderValue)
    : DEFAULT_GENDER;
  return {
    name: profile.name,
    birthDate: profile.dateOfBirth,
    birthTime: birthTimeFromProfile(profile),
    birthLocation: {
      id: 'profile',
      label: profile.locationName,
      latitude: profile.latitude,
      longitude: profile.longitude,
      timeZone: profile.timezoneId,
      source: 'search',
      fullName: profile.locationName,
      countryCode: '',
    },
    gender,
    occupation: profile.occupation ?? '',
    relationship,
    customRelationship: profile.customRelationship ?? '',
  };
}

/** The request body plus the revision the client last saw, for PUT. */
export function toReplaceRequest(draft: ProfileDraft, revision: number): ReplaceVedicProfileRequest {
  return { ...toRequest(draft), revision };
}
