import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

/** Web variant of the tab bar (development preview only; the app targets iPhone). */
export default function AppTabs() {
  const t = useT();
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={styles.listContainer}>
          <View style={[styles.list, { backgroundColor: theme.backgroundRaised, borderColor: theme.line }]}>
            <TabTrigger name="index" href="/(tabs)/index" asChild>
              <TabButton>{t('tabs.map')}</TabButton>
            </TabTrigger>
            <TabTrigger name="timeline" href="/timeline" asChild>
              <TabButton>{t('tabs.timeline')}</TabButton>
            </TabTrigger>
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    // TabTriggerSlotProps carries a View-typed ref that Pressable's ref type rejects.
    <Pressable
      {...(props as PressableProps)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={{ color: isFocused ? theme.accent : theme.textSecondary }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    alignItems: 'center',
  },
  list: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingVertical: Spacing.two,
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
