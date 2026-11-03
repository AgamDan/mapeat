import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PostcardProps = ViewProps & {
  /** Short text on the stamp in the top end corner, e.g. a city code. */
  stamp?: string;
};

/** The app's signature surface: a cream card with a perforated sea-blue stamp. */
export function Postcard({ stamp, style, children, ...rest }: PostcardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.line },
        stamp ? styles.withStamp : null,
        style,
      ]}
      {...rest}>
      {stamp ? (
        <View style={[styles.perforation, { borderColor: theme.card, backgroundColor: theme.sea }]}>
          <ThemedText style={[styles.stampText, { color: theme.card }]}>{stamp}</ThemedText>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#503214',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  withStamp: {
    paddingEnd: 72,
  },
  perforation: {
    position: 'absolute',
    top: -12,
    end: Spacing.three,
    width: 44,
    height: 52,
    borderWidth: 3,
    borderStyle: 'dotted',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
  },
  stampText: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
  },
});
