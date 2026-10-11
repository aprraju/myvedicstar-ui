import { removeUserCache } from '@myvedicstar/query-cache';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';

/** Native lifecycle bridge; the shared date hook observes these same TanStack managers. */
export function CacheLifecycle() {
  const client = useQueryClient();
  const { user, loading } = useAuth();
  const previous = useRef<string | null | undefined>(undefined);
  const userId = user?.id ?? null;
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const state = AppState.addEventListener('change', (value) => focusManager.setFocused(value === 'active'));
    const network = NetInfo.addEventListener((value) => {
      if (value.isConnected !== null) onlineManager.setOnline(value.isConnected && value.isInternetReachable !== false);
    });
    return () => { state.remove(); network(); focusManager.setFocused(undefined); };
  }, []);
  useEffect(() => {
    if (loading) return;
    if (previous.current && previous.current !== userId) void removeUserCache(client, previous.current);
    previous.current = userId;
  }, [client, loading, userId]);
  return null;
}
