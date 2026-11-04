import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { MapPlace } from '@/data/journal';
import { ensureAreaLoaded } from '@/features/catalog/ensure-area';
import { addressLine, cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { findPlacesForLink, NEARBY_M, type LinkCandidate } from '@/features/links/match-place';
import { extractUrl, isShortMapLink, parseMapLink } from '@/features/links/parse-map-link';
import { LinkNetworkError, resolveShortLink } from '@/features/links/resolve-short-link';
import { getMapCenter } from '@/features/map/map-center-store';
import { requestMapFocus } from '@/features/map/map-focus-store';
import { SearchResultRow } from '@/features/search/search-result-row';
import { updateMark } from '@/features/wishlist/journal-marks';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';

type Phase =
  | { kind: 'idle' }
  | { kind: 'finding' }
  | { kind: 'error'; message: TranslationKey }
  | { kind: 'many'; candidates: LinkCandidate[] }
  | { kind: 'one'; place: MapPlace; fromList: LinkCandidate[] | null };

/** After saving: which mark the place now has and whether it was already there. */
type Saved = { placeId: string; message: TranslationKey } | null;

/** Paste a Google Maps or Apple Maps link, find the place in our catalog, put it on the wishlist. */
export default function AddFromLinkScreen() {
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const { language, direction } = useLanguage();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [saved, setSaved] = useState<Saved>(null);
  const [saving, setSaving] = useState(false);
  // Only the newest lookup may update the screen.
  const lookup = useRef(0);

  const find = async (input: string) => {
    const id = ++lookup.current;
    const show = (next: Phase) => {
      if (lookup.current === id) setPhase(next);
    };
    Keyboard.dismiss();
    setSaved(null);
    let url = extractUrl(input);
    if (!url) return show({ kind: 'error', message: 'link.invalid' });
    show({ kind: 'finding' });
    if (isShortMapLink(url)) {
      try {
        url = await resolveShortLink(url);
      } catch (error) {
        return show({ kind: 'error', message: error instanceof LinkNetworkError ? 'link.network' : 'link.invalid' });
      }
    }
    const parsed = parseMapLink(url);
    if (!parsed) return show({ kind: 'error', message: isShortMapLink(input) ? 'link.notFound' : 'link.invalid' });
    if (parsed.lat == null && !parsed.name) return show({ kind: 'error', message: 'link.notFound' });
    if (parsed.lat != null && parsed.lon != null) {
      // A link to an area the map never showed: load it first. Offline, match what's cached.
      await ensureAreaLoaded(db, parsed.lat, parsed.lon, NEARBY_M).catch(() => false);
    }
    try {
      const match = await findPlacesForLink(db, parsed, getMapCenter());
      if (match.kind === 'one') show({ kind: 'one', place: match.candidate.place, fromList: null });
      else if (match.kind === 'many') show({ kind: 'many', candidates: match.candidates });
      else show({ kind: 'error', message: 'link.notFound' });
    } catch {
      show({ kind: 'error', message: 'link.notFound' });
    }
  };

  const paste = async () => {
    const pasted = await Clipboard.getStringAsync().catch(() => '');
    if (!pasted.trim()) return;
    setText(pasted.trim());
    find(pasted);
  };

  const add = async (place: MapPlace) => {
    if (saving) return;
    setSaving(true);
    try {
      // A visited place goes on "want to go back"; the wishlist is for places not tried yet.
      const mark = place.status === 'visited' ? 'wantReturn' : 'wishlist';
      if (await updateMark(db, t, mark, place.id, true)) {
        setSaved({ placeId: place.id, message: mark === 'wantReturn' ? 'wantReturn.on' : 'link.added' });
      }
    } finally {
      setSaving(false);
    }
  };

  const openOnMap = (place: MapPlace) => {
    requestMapFocus({ placeId: place.id, latitude: place.lat, longitude: place.lon });
    // Opened from the Wishlist tab: pops back to the existing tabs and selects the Map tab.
    router.dismissTo('/');
  };

  const finding = phase.kind === 'finding';

  let result = null;
  if (phase.kind === 'error') {
    result = (
      <ThemedText themeColor="textSecondary" style={styles.message} accessibilityLiveRegion="polite">
        {t(phase.message)}
      </ThemedText>
    );
  } else if (phase.kind === 'many') {
    result = (
      <View style={styles.list}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('link.pickOne')}
        </ThemedText>
        {phase.candidates.map((candidate) => (
          <SearchResultRow
            key={candidate.place.id}
            place={candidate.place}
            onPress={(place) => {
              setSaved(null);
              setPhase({ kind: 'one', place, fromList: phase.candidates });
            }}
          />
        ))}
      </View>
    );
  } else if (phase.kind === 'one') {
    const { place } = phase;
    const kindLabel = t(KIND_LABEL_KEYS[place.kind]);
    const { primary, secondary } = venueNames(place, language);
    const details = [kindLabel, ...cuisineLabels(place.cuisine, language)].join(' · ');
    const address = addressLine(place);
    const savedHere = saved?.placeId === place.id ? saved.message : null;
    const already: TranslationKey | null =
      place.status === 'wishlist' ? 'link.alreadyOn' : place.status === 'visited' && place.wantReturn ? 'wantReturn.on' : null;
    const note = savedHere ?? already;

    result = (
      <View style={styles.list}>
        <Postcard>
          <ThemedText type="title">{primary ?? kindLabel}</ThemedText>
          {secondary ? <ThemedText themeColor="textSecondary">{secondary}</ThemedText> : null}
          <ThemedText themeColor="textSecondary">{details}</ThemedText>
          {address ? <ThemedText themeColor="textSecondary">{address}</ThemedText> : null}
          {note ? (
            <View style={styles.note} accessibilityLiveRegion="polite">
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={18}
                tintColor={theme.sea}
              />
              <ThemedText type="defaultBold" themeColor="sea">
                {t(note)}
              </ThemedText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving }}
              disabled={saving}
              onPress={() => add(place)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.accent, borderColor: theme.accent },
                (pressed || saving) && styles.pressed,
              ]}>
              <SymbolView
                name={
                  place.status === 'visited'
                    ? { ios: 'arrow.counterclockwise.circle', android: 'replay', web: 'replay' }
                    : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
                }
                size={18}
                tintColor={theme.onAccent}
              />
              <ThemedText type="defaultBold" themeColor="onAccent">
                {t(place.status === 'visited' ? 'wantReturn.add' : 'link.addToWishlist')}
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => openOnMap(place)}
            style={({ pressed }) => [styles.button, { borderColor: theme.accent }, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
              size={18}
              tintColor={theme.accent}
            />
            <ThemedText type="defaultBold" themeColor="accent">
              {t('tonight.go')}
            </ThemedText>
          </Pressable>
        </Postcard>
        {phase.fromList ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setSaved(null);
              setPhase({ kind: 'many', candidates: phase.fromList! });
            }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('link.pickOne')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        placeholder={t('link.placeholder')}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={t('link.title')}
        selectionColor={theme.accent}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="url"
        textContentType="URL"
        clearButtonMode="while-editing"
        returnKeyType="search"
        onSubmitEditing={() => find(text)}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundRaised,
            borderColor: theme.line,
            writingDirection: direction,
          },
        ]}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={paste}
          disabled={finding}
          style={({ pressed }) => [
            styles.button,
            styles.grow,
            { borderColor: theme.accent, backgroundColor: theme.card },
            (pressed || finding) && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'doc.on.clipboard', android: 'content_paste', web: 'content_paste' }}
            size={18}
            tintColor={theme.accent}
          />
          <ThemedText type="defaultBold" themeColor="accent">
            {t('link.paste')}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => find(text)}
          disabled={finding || !text.trim()}
          style={({ pressed }) => [
            styles.button,
            styles.grow,
            { borderColor: theme.accent, backgroundColor: theme.accent },
            (pressed || finding || !text.trim()) && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={theme.onAccent}
          />
          <ThemedText type="defaultBold" themeColor="onAccent">
            {t('link.find')}
          </ThemedText>
        </Pressable>
      </View>

      {finding ? (
        <View style={styles.finding} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.accent} />
          <ThemedText themeColor="textSecondary">{t('link.finding')}</ThemedText>
        </View>
      ) : (
        result
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    textAlign: 'center',
    paddingTop: Spacing.three,
  },
  finding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  back: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
});
