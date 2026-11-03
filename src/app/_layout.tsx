import {
  FrankRuhlLibre_400Regular,
  FrankRuhlLibre_500Medium,
  FrankRuhlLibre_700Bold,
  FrankRuhlLibre_900Black,
  useFonts,
} from '@expo-google-fonts/frank-ruhl-libre';
import { DarkTheme, DefaultTheme, LocaleProvider, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { DATABASE_NAME, initDatabase } from '@/data/database';
import { useResolvedScheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { SettingsProvider, useSettings } from '@/settings/settings-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SettingsProvider>
      {/* Renders its children only after the database is open and migrated. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
        <AppShell />
      </SQLiteProvider>
    </SettingsProvider>
  );
}

function AppShell() {
  const { ready, language } = useSettings();
  const [fontsLoaded, fontError] = useFonts({
    FrankRuhlLibre_400Regular,
    FrankRuhlLibre_500Medium,
    FrankRuhlLibre_700Bold,
    FrankRuhlLibre_900Black,
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
        heavy: { fontFamily: Fonts.black, fontWeight: 'normal' as const },
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
              headerTitleStyle: { fontFamily: Fonts.bold, color: theme.text },
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
});
