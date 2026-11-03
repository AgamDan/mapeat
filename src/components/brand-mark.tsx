import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** The MapEat mark: a map pin with a plate inside, drawn with plain views. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const theme = useTheme();
  const pin = size * 0.74;
  const plate = pin * 0.46;

  return (
    <View style={[styles.box, { width: size, height: size }]} accessible={false}>
      <View
        style={[
          styles.pin,
          {
            width: pin,
            height: pin,
            borderRadius: pin / 2,
            // Square one corner, then turn 45° so that corner becomes the pin's point.
            borderBottomRightRadius: 0,
            backgroundColor: theme.accent,
            top: size * 0.02,
          },
        ]}>
        <View
          style={[
            styles.plate,
            {
              width: plate,
              height: plate,
              borderRadius: plate / 2,
              borderWidth: Math.max(1.5, plate * 0.14),
              borderColor: theme.onAccent,
            },
          ]}>
          <View
            style={{ width: plate * 0.28, height: plate * 0.28, borderRadius: plate, backgroundColor: theme.onAccent }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
