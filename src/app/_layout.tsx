// Per-weight imports, so only these six font files are bundled (not every weight and italic).
import { Heebo_400Regular } from '@expo-google-fonts/heebo/400Regular';
import { Heebo_500Medium } from '@expo-google-fonts/heebo/500Medium';
import { Heebo_600SemiBold } from '@expo-google-fonts/heebo/600SemiBold';
import { Heebo_700Bold } from '@expo-google-fonts/heebo/700Bold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, LocaleProvider, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { DATABASE_NAME, initDatabase } from '@/data/database';
import { useResolvedScheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { SettingsProvider, useSettings } from '@/settings/settings-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbError, setDbError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <SettingsProvider>
      {dbError ? (
        <DatabaseError
          onRetry={() => {
            setDbError(false);
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        // Renders its children only after the database is open and migrated.
        <SQLiteProvider
          key={attempt}
          databaseName={DATABASE_NAME}
          onInit={initDatabase}
          // expo-sqlite calls onError while rendering; defer the state change to after that render.
          onError={() => queueMicrotask(() => setDbError(true))}>
          <AppShell />
        </SQLiteProvider>
      )}
    </SettingsProvider>
  );
}

/** Shown if the journal database can't be opened (instead of a splash screen that never ends). */
function DatabaseError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  const theme = Colors[useResolvedScheme()];
  const { direction } = useLanguage();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.root, styles.center, { direction, backgroundColor: theme.background }]}>
      <Text style={[styles.errorTitle, { color: theme.text, writingDirection: direction }]}>{t('app.dbErrorTitle')}</Text>
      <Text style={[styles.errorBody, { color: theme.textSecondary, writingDirection: direction }]}>
        {t('app.dbErrorBody')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={[styles.retry, { backgroundColor: theme.accent }]}>
        <Text style={{ color: theme.onAccent, fontWeight: '700' }}>{t('map.retry')}</Text>
      </Pressable>
    </View>
  );
}

function AppShell() {
  const { ready, language } = useSettings();
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Rubik_700Bold,
    Rubik_800ExtraBold,
  });
  const scheme = useResolvedScheme();
  const theme = Colors[scheme];
  const { direction } = useLanguage();
  const t = useT();
  // A font error falls back to the system font rather than blocking the app.
  const loaded = ready && (fontsLoaded || fontError != null);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accent,
        background: theme.background,
        card: theme.backgroundRaised,
        text: theme.text,
        border: theme.line,
        notification: theme.accent,
      },
      fonts: {
        regular: { fontFamily: Fonts.regular, fontWeight: 'normal' as const },
        medium: { fontFamily: Fonts.medium, fontWeight: 'normal' as const },
        bold: { fontFamily: Fonts.bold, fontWeight: 'normal' as const },
        heavy: { fontFamily: Fonts.displayHeavy, fontWeight: 'normal' as const },
      },
    };
  }, [scheme, theme]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Expo Go ignores native RTL overrides, so direction is applied to the React tree instead. */}
      <LocaleProvider direction={direction}>
        <View style={[styles.root, { direction, backgroundColor: theme.background }]}>
          <Stack
            screenOptions={{
              headerTintColor: theme.accent,
              headerStyle: { backgroundColor: theme.backgroundRaised },
              headerTitleStyle: { fontFamily: Fonts.display, color: theme.text },
              contentStyle: { backgroundColor: theme.background, direction },
            }}>
            <Stack.Protected guard={language !== null}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="settings"
                options={{ presentation: 'modal', title: t('settings.title') }}
              />
              <Stack.Screen
                name="place/[id]"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.6, 1],
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="visit/new"
                options={{ presentation: 'modal', title: t('visit.newTitle') }}
              />
              <Stack.Screen
                name="visit/[id]"
                options={{ presentation: 'modal', title: t('visit.detailTitle') }}
              />
              <Stack.Screen
                name="visit/review"
                options={{ presentation: 'modal', title: t('visit.reviewTitle') }}
              />
              <Stack.Screen name="tags" options={{ presentation: 'modal', title: t('tags.title') }} />
              <Stack.Screen name="search" options={{ presentation: 'modal', title: t('search.title') }} />
              <Stack.Screen name="tonight" options={{ presentation: 'modal', title: t('tonight.title') }} />
              <Stack.Screen name="add-from-link" options={{ presentation: 'modal', title: t('link.title') }} />
              <Stack.Screen name="explorer" options={{ title: t('explorer.title') }} />
              <Stack.Screen
                name="photo/[id]"
                // A regular modal (like the visit forms): a full-screen modal over the place sheet
                // misbehaved. Header hidden up front so the close button never jumps.
                options={{ presentation: 'modal', headerShown: false, title: t('photos.viewerTitle') }}
              />
              <Stack.Screen
                name="map-filters"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.75, 1],
                  sheetGrabberVisible: true,
                  title: t('filters.title'),
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={language === null}>
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </View>
      </LocaleProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 16,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
  },
});
