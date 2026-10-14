import type { IdentityProvider } from '@myvedicstar/config';
import { useSyncExternalStore } from 'react';

import { useServices } from '../services/ServicesContext';
import type { AuthClient, AuthState, AuthUser, SignInRequest } from './auth-client';

interface UseAuthResult {
  enabled: boolean;
  /** True while a stored session is being restored; do not redirect yet. */
  loading: boolean;
  user: AuthUser | null;
  isAuthenticated: boolean;
  signInError: AuthState['signInError'];
  providers: readonly IdentityProvider[];
  signIn(request: SignInRequest): Promise<void>;
  signOut(): Promise<void>;
  client: AuthClient;
}

export function useAuth(): UseAuthResult {
  const { auth } = useServices();
  const state = useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
  return {
    enabled: auth.enabled,
    loading: state.status === 'loading',
    user: state.user,
    isAuthenticated: state.user !== null,
    signInError: state.signInError,
    providers: auth.providers,
    signIn: (request) => auth.signIn(request),
    signOut: () => auth.signOut(),
    client: auth,
  };
}
