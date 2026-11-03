import { NativeTabs } from 'expo-router/native-tabs';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

export default function AppTabs() {
  const theme = useTheme();
  const t = useT();

  return (
    <NativeTabs
      backgroundColor={theme.backgroundRaised}
      tintColor={theme.accent}
      iconColor={{ default: theme.textSecondary, selected: theme.accent }}
      labelStyle={{
        default: { color: theme.textSecondary, fontFamily: Fonts.medium },
        selected: { color: theme.accent, fontFamily: Fonts.bold },
      }}>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: theme.background }}>
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="timeline" contentStyle={{ backgroundColor: theme.background }}>
        <NativeTabs.Trigger.Label>{t('tabs.timeline')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'book.closed', selected: 'book.closed.fill' }}
          md="menu_book"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="wishlist" contentStyle={{ backgroundColor: theme.background }}>
        <NativeTabs.Trigger.Label>{t('tabs.wishlist')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
