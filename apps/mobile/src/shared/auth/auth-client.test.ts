import {
  createAuthClient,
  createDisabledAuthClient,
  createInMemoryAuthClient,
  userFromIdToken,
} from './auth-client';

const base64url = (value: object) =>
  globalThis.btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('mobile auth clients', () => {
  it('disabled client is signed out and never returns a token', async () => {
    const client = createDisabledAuthClient();
    expect(client.enabled).toBe(false);
    expect(client.getState()).toEqual({ status: 'ready', user: null });
    expect(await client.getAccessToken()).toBeNull();
  });

  it('mock mode signs in instantly for local development and tests', async () => {
    const client = createAuthClient({ mode: 'mock', providers: ['email'] });
    await client.signIn({ intent: 'login', provider: 'email' });
    expect(client.getState().user?.id).toBe('mock-user');
    await client.signOut();
    expect(client.getState().user).toBeNull();
  });

  it('notifies subscribers and forgets the session on 401', async () => {
    const client = createInMemoryAuthClient({ user: { id: 'u' } });
    const listener = jest.fn();
    client.subscribe(listener);
    client.handleUnauthorized();
    expect(listener).toHaveBeenCalled();
    expect(await client.getAccessToken()).toBeNull();
  });
});

describe('userFromIdToken', () => {
  it('reads only the subject and display name', () => {
    const token = `x.${base64url({ sub: 'user-1', name: 'Asha', email: 'a@b.co' })}.sig`;
    expect(userFromIdToken(token)).toEqual({ id: 'user-1', displayName: 'Asha' });
  });

  it('rejects malformed tokens', () => {
    expect(userFromIdToken('not-a-jwt')).toBeNull();
    expect(userFromIdToken(undefined)).toBeNull();
  });
});
