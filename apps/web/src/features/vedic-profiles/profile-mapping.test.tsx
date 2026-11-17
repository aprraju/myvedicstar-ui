import type { VedicProfile } from '@myvedicstar/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import {
  birthTimeBody,
  birthTimeFromProfile,
  DEFAULT_GENDER,
  EMPTY_DRAFT,
  type ProfileDraft,
  toDraft,
  toReplaceRequest,
  toRequest,
} from './profile-mapping';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;

const location = {
  id: '143418620',
  label: 'Hyderabad, Telangana, India',
  fullName: 'Hyderabad, Telangana, India',
  latitude: 17.385,
  longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
  source: 'search' as const,
  countryCode: 'IN',
};

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return {
    ...EMPTY_DRAFT,
    name: 'Asha',
    birthDate: '1990-04-12',
    birthTime: { mode: 'known', from: '06:30:00', to: '' },
    birthLocation: location,
    occupation: 'Teacher',
    relationship: 'Self',
    ...overrides,
  };
}

function profile(overrides: Partial<VedicProfile> = {}): VedicProfile {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    revision: 3,
    name: 'Asha',
    dateOfBirth: '1990-04-12',
    birthTimeMode: 'Known',
    birthTime: '06:30:00',
    birthTimeFrom: '06:30:00',
    birthTimeTo: '06:30:00',
    timeAccuracyNote: null,
    locationName: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    timezoneId: location.timeZone,
    gender: 'Female',
    occupation: 'Teacher',
    relationship: 'Self',
    customRelationship: null,
    ...overrides,
  };
}

describe('birthTimeBody — the three states map to the server invariants', () => {
  it('Known sends all three times equal, as the server requires', () => {
    const body = birthTimeBody({ mode: 'known', from: '06:30:00', to: '' });
    expect(body).toEqual({
      birthTimeMode: 'Known',
      birthTime: '06:30:00',
      birthTimeFrom: '06:30:00',
      birthTimeTo: '06:30:00',
    });
  });

  it('Approximate sends both endpoints and no single time', () => {
    const body = birthTimeBody({ mode: 'approximate', from: '06:00:00', to: '08:00:00' });
    expect(body).toEqual({
      birthTimeMode: 'Approximate',
      birthTime: null,
      birthTimeFrom: '06:00:00',
      birthTimeTo: '08:00:00',
    });
  });

  it('Unknown sends all nulls — never a sentinel or an assumed sunrise', () => {
    expect(birthTimeBody({ mode: 'unknown', from: '09:00:00', to: '09:00:00' })).toEqual({
      birthTimeMode: 'Unknown',
      birthTime: null,
      birthTimeFrom: null,
      birthTimeTo: null,
    });
  });
});

describe('birthTimeFromProfile round-trips without reinterpretation', () => {
  it.each([
    ['Known', { mode: 'known', from: '06:30:00', to: '' }],
    ['Approximate', { mode: 'approximate', from: '06:00:00', to: '08:00:00' }],
    ['Unknown', { mode: 'unknown', from: '', to: '' }],
  ] as const)('%s comes back unchanged', (_label, expected) => {
    const wire = birthTimeBody(expected);
    expect(birthTimeFromProfile(wire as VedicProfile)).toEqual(expected);
  });

  it('a stored time is not shifted, even for a non-UTC birth zone', () => {
    const stored = profile({ birthTime: '23:45:00', birthTimeFrom: '23:45:00', birthTimeTo: '23:45:00' });
    expect(birthTimeFromProfile(stored)).toEqual({ mode: 'known', from: '23:45:00', to: '' });
  });
});

describe('toRequest — exact DTO mapping', () => {
  it('carries the picked location label, coordinates and zone', () => {
    const body = toRequest(draft());
    expect(body.locationName).toBe('Hyderabad, Telangana, India');
    expect(body.latitude).toBe(17.385);
    expect(body.longitude).toBe(78.4867);
    expect(body.timezoneId).toBe('Asia/Kolkata');
  });

  it('sends null customRelationship for every relationship except Other', () => {
    expect(
      toRequest(draft({ relationship: 'Son', customRelationship: 'ignored' })).customRelationship,
    ).toBeNull();
    expect(toRequest(draft({ relationship: 'Other', customRelationship: 'Mentor' })).customRelationship).toBe(
      'Mentor',
    );
  });

  it('defaults an unanswered gender rather than sending an empty string', () => {
    const body = toRequest(draft({ gender: '' as never }));
    expect(body.gender).toBe(DEFAULT_GENDER);
  });

  it('never invents a timeAccuracyNote', () => {
    expect(toRequest(draft()).timeAccuracyNote).toBeNull();
  });

  it('trims blank occupation to null instead of an empty string', () => {
    expect(toRequest(draft({ occupation: '   ' })).occupation).toBeNull();
  });
});

describe('toDraft / toReplaceRequest — editing', () => {
  it('reconstructs the location so a save preserves the stored coordinates', () => {
    const round = toDraft(profile());
    expect(round.birthLocation?.latitude).toBe(location.latitude);
    expect(round.birthLocation?.timeZone).toBe(location.timeZone);
    expect(toRequest(round).latitude).toBe(location.latitude);
  });

  it('carries the revision the client last saw', () => {
    expect(toReplaceRequest(toDraft(profile()), 3).revision).toBe(3);
  });

  it('falls back to Other for an unknown relationship rather than dropping the value', () => {
    // An unexpected wire value must not be dropped: it falls back to Other so the user can see and correct it.
    expect(toDraft(profile({ relationship: 'Grandfather' as never })).relationship).toBe('Other');
  });
});

describe('API client contract', () => {
  it('DELETE accepts the 204 No Content the controller returns', async () => {
    server.use(http.delete(api('/vedic-profiles/:id'), () => new HttpResponse(null, { status: 204 })));
    const response = await fetch(api('/vedic-profiles/abc'), { method: 'DELETE' });
    expect(response.status).toBe(204);
  });

  it('a 409 response is what the conflict path keys on', async () => {
    server.use(http.put(api('/vedic-profiles/:id'), () => new HttpResponse(null, { status: 409 })));
    const response = await fetch(api('/vedic-profiles/abc'), { method: 'PUT' });
    expect(response.status).toBe(409);
  });
});
