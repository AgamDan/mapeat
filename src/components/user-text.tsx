import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useLanguage } from '@/i18n/i18n';
import { directionOf } from '@/lib/text-direction';

/**
 * `ThemedText` for text the couple wrote (dish and tag names, notes): its writing direction comes
 * from the text itself, so Hebrew reads right-to-left in the English UI and vice versa.
 */
export function UserText({ children, style, ...rest }: ThemedTextProps & { children: string }) {
  const { direction } = useLanguage();
  return (
    <ThemedText style={[style, { writingDirection: directionOf(children, direction) }]} {...rest}>
      {children}
    </ThemedText>
  );
}
