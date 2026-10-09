import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'mvs.';

/**
 * Non-sensitive preferences (location, recent locations, tradition, permission memory) in AsyncStorage.
 * Values are parsed by the caller's validator because device storage is user-controlled input.
 * Tokens NEVER go here — they use expo-secure-store (Keychain / Keystore).
 */
export const preferenceStorage = {
  async read<T>(key: string, parse: (value: unknown) => T | undefined): Promise<T | undefined> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw === null ? undefined : parse(JSON.parse(raw));
    } catch {
      return undefined;
    }
  },
  async write(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Preferences are a convenience; failing to persist must not break the app.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  },
};
