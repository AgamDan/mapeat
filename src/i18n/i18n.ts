import { getLocales } from 'expo-localization';
import { useCallback } from 'react';

import { en, type TranslationKey } from './en';
import { he } from './he';

import { useSettings, type Language } from '@/settings/settings-provider';

export type Direction = 'ltr' | 'rtl';

const dictionaries = { en, he } as const;

/** The phone's preferred language if we support it; used only before the user chooses. */
export function getDeviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'he' || code === 'iw' ? 'he' : 'en';
}

export function directionOf(language: Language): Direction {
  return language === 'he' ? 'rtl' : 'ltr';
}

/** Current language (the user's choice, or the phone's language before the first choice). */
export function useLanguage() {
  const { language } = useSettings();
  const current = language ?? getDeviceLanguage();
  const direction = directionOf(current);
  return { language: current, direction, isRTL: direction === 'rtl' };
}

export function useT() {
  const { language } = useLanguage();
  return useCallback((key: TranslationKey) => dictionaries[language][key], [language]);
}

export function translate(language: Language, key: TranslationKey) {
  return dictionaries[language][key];
}
