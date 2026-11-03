import { View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { useT } from '@/i18n/i18n';

/** Contract stub — replaced by the wishlist agent. */
export default function WishlistScreen() {
  const t = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t('wishlist.title')} />
    </View>
  );
}
