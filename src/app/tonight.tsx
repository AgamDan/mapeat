import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { EmptyState } from '@/features/empty/empty-state';
import { FilterChip } from '@/features/map/filter-chip';
import { requestMapFocus } from '@/features/map/map-focus-store';
import {
  candidatesWithin,
  DEFAULT_TONIGHT_DISTANCE,
  EMPTY_HISTORY,
  pickNext,
  TONIGHT_DISTANCES,
  type PickHistory,
  type RankedCandidate,
  type TonightDistance,
} from '@/features/tonight/picker';
import { TonightCard } from '@/features/tonight/tonight-card';
import { useTonightCandidates, useTonightOrigin } from '@/features/tonight/use-tonight';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** Names flashing by before the pick lands. */
const ROLL_TICKS = 7;
const ROLL_TICK_MS = 75;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** "Where tonight?": a random wishlist or want-to-go-back place, optionally within a distance. */
export default function TonightScreen() {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const { candidates, error } = useTonightCandidates();
  const origin = useTonightOrigin();
  const [distance, setDistance] = useState<TonightDistance>(DEFAULT_TONIGHT_DISTANCE);
  const [history, setHistory] = useState<PickHistory>(EMPTY_HISTORY);
  const [rollingName, setRollingName] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const [seed] = useState(() => Math.random());
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const ready = candidates !== null && origin !== undefined;
  const pool: RankedCandidate[] = ready ? candidatesWithin(candidates, origin, distance) : [];
  const poolIds = pool.map((place) => place.id);
  // Until "Pick another" is used (or when a distance chip leaves the shown place out), the pick
  // is derived from a random number chosen once, so rendering stays pure.
  const shownHistory = poolIds.includes(history.last ?? '')
    ? history
    : (pickNext(poolIds, history, () => seed)?.history ?? history);
  const current = pool.find((place) => place.id === shownHistory.last) ?? null;
  const rolling = rollingName !== null;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (rollTimer.current) clearInterval(rollTimer.current);
    },
    [],
  );

  const nameOf = (place: RankedCandidate) => venueNames(place, language).primary ?? t(KIND_LABEL_KEYS[place.kind]);
  const randomName = () => nameOf(pool[Math.floor(Math.random() * pool.length)]);

  const pickAnother = () => {
    if (rolling) return;
    const next = pickNext(poolIds, shownHistory);
    if (!next) return;
    shake.setValue(0);
    Animated.timing(shake, {
      toValue: 1,
      duration: reduceMotion ? 1 : ROLL_TICKS * ROLL_TICK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (reduceMotion || pool.length < 2) {
      setHistory(next.history);
      return;
    }
    let ticks = 0;
    setRollingName(randomName());
    rollTimer.current = setInterval(() => {
      ticks++;
      if (ticks < ROLL_TICKS) {
        setRollingName(randomName());
        return;
      }
      if (rollTimer.current) clearInterval(rollTimer.current);
      rollTimer.current = null;
      setRollingName(null);
      setHistory(next.history);
    }, ROLL_TICK_MS);
  };

  const openPlace = (place: RankedCandidate) => {
    requestMapFocus({ placeId: place.id, latitude: place.lat, longitude: place.lon });
    close();
  };

  const rotate = shake.interpolate({
    inputRange: [0, 0.2, 0.45, 0.7, 1],
    outputRange: ['0deg', '-5deg', '4deg', '-2deg', '0deg'],
  });
  const scale = shake.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0.94, 1] });

  if (!ready) {
    return (
      <View style={styles.center}>
        {error ? (
          <ThemedText themeColor="textSecondary">{t('wishlist.loadFailed')}</ThemedText>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          symbol={{ ios: 'dice', android: 'casino', web: 'casino' }}
          title={t('tonight.title')}
          body={t('tonight.empty')}
          action={{
            label: t('empty.goToMap'),
            symbol: { ios: 'map', android: 'map', web: 'map' },
            onPress: close,
          }}
        />
      </ScrollView>
    );
  }

  let body;
  if (current) {
    body = (
      <>
        <Animated.View style={{ transform: [{ rotate }, { scale }] }}>
          <TonightCard place={current} rollingName={rollingName} />
        </Animated.View>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: rolling }}
            disabled={rolling}
            onPress={pickAnother}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.accent, backgroundColor: theme.card },
              (pressed || rolling) && styles.pressed,
            ]}>
            <SymbolView name={{ ios: 'dice', android: 'casino', web: 'casino' }} size={18} tintColor={theme.accent} />
            <ThemedText type="defaultBold" themeColor="accent">
              {t('tonight.again')}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={rolling}
            onPress={() => openPlace(current)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.accent, backgroundColor: theme.accent },
              (pressed || rolling) && styles.pressed,
            ]}>
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
              size={18}
              tintColor={theme.onAccent}
            />
            <ThemedText type="defaultBold" themeColor="onAccent">
              {t('tonight.go')}
            </ThemedText>
          </Pressable>
        </View>
      </>
    );
  } else if (pool.length === 0) {
    body = (
      <View style={styles.message}>
        <SymbolView
          name={{ ios: 'location.slash', android: 'location_off', web: 'location_off' }}
          size={34}
          tintColor={theme.textSecondary}
        />
        <ThemedText themeColor="textSecondary" style={styles.messageText}>
          {t('tonight.noneNearby', { km: distance ?? '' })}
        </ThemedText>
      </View>
    );
  } else {
    body = (
      <View style={styles.message}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {origin ? (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {TONIGHT_DISTANCES.map((km) => (
            <FilterChip
              key={km ?? 'anywhere'}
              role="radio"
              label={km == null ? t('tonight.anywhere') : t('tonight.within', { km })}
              selected={distance === km}
              onPress={() => setDistance(km)}
            />
          ))}
        </View>
      ) : null}
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  message: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.five,
  },
  messageText: {
    textAlign: 'center',
  },
});
