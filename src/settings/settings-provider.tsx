import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

export type Language = 'he' | 'en';
export type Appearance = 'system' | 'light' | 'dark';

type StoredSettings = {
  /** `null` until the user picks a language on first launch. */
  language: Language | null;
  appearance: Appearance;
};

type SettingsContextValue = StoredSettings & {
  ready: boolean;
  setLanguage: (language: Language) => void;
  setAppearance: (appearance: Appearance) => void;
};

const STORAGE_KEY = 'mapeat.settings.v1';
const DEFAULTS: StoredSettings = { language: null, appearance: 'system' };

const SettingsContext = createContext<SettingsContextValue | null>(null);

function parse(raw: string | null): StoredSettings {
  if (!raw) return DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      language: value.language === 'he' || value.language === 'en' ? value.language : null,
      appearance:
        value.appearance === 'light' || value.appearance === 'dark' ? value.appearance : 'system',
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        setSettings(parse(raw));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<StoredSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      // A failed write only loses the preference for the next launch; the UI keeps working.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      ready,
      setLanguage: (language) => update({ language }),
      setAppearance: (appearance) => update({ appearance }),
    }),
    [settings, ready, update],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings() {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
