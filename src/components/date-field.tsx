import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/i18n';
import { formatVisitDate, fromPickerDate, todayLocalDate, toPickerDate, type LocalDate } from '@/lib/dates';

type DateFieldProps = {
  label: string;
  value: LocalDate;
  onChange: (value: LocalDate) => void;
  /** Latest selectable date; defaults to today (no visits in the future). */
  maximumDate?: LocalDate;
};

/** A labeled calendar-date picker (iOS compact style). Values are timezone-free `YYYY-MM-DD`. */
export function DateField({ label, value, onChange, maximumDate }: DateFieldProps) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { language } = useLanguage();

  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={toPickerDate(value)}
          mode="date"
          display="compact"
          locale={language === 'he' ? 'he-IL' : 'en-GB'}
          accentColor={theme.accent}
          themeVariant={scheme}
          maximumDate={toPickerDate(maximumDate ?? todayLocalDate())}
          accessibilityLabel={label}
          onChange={(_event, date) => {
            if (date) onChange(fromPickerDate(date));
          }}
        />
      ) : (
        // Web preview / non-iOS: read-only; the app targets iPhone.
        <ThemedText>{formatVisitDate(value, language)}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
});
