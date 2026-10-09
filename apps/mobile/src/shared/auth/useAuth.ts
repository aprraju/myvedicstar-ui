import { useSyncExternalStore } from 'react';

import { useServices } from '../services';
import type { AuthClient, AuthUser, SignInRequest } from './auth-client';

export interface UseAuthResult {
  enabled: boolean;
  loading: boolean;
  user: AuthUser | null;
  isAuthenticated: boolean;
  providers: AuthClient['providers'];
  signIn(request: SignInRequest): Promise<void>;
  signOut(): Promise<void>;
}

export function useAuth(): UseAuthResult {
  const { auth } = useServices();
  const state = useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
  return {
    enabled: auth.enabled,
    loading: state.status === 'loading',
    user: state.user,
    isAuthenticated: state.user !== null,
    providers: auth.providers,
    signIn: (request) => auth.signIn(request),
    signOut: () => auth.signOut(),
  };
}
