import type { Venue, VenueKind } from '@/features/catalog/types';
import type { TranslationKey } from '@/i18n/en';
import type { Language } from '@/settings/settings-provider';

export const KIND_LABEL_KEYS: Record<VenueKind, TranslationKey> = {
  restaurant: 'kind.restaurant',
  cafe: 'kind.cafe',
  fast_food: 'kind.fast_food',
  bar: 'kind.bar',
  pub: 'kind.pub',
  ice_cream: 'kind.ice_cream',
};

/** Common OSM `cuisine` values with English and Hebrew labels. Unknown values are humanized. */
const CUISINES: Record<string, readonly [en: string, he: string]> = {
  american: ['American', 'אמריקאי'],
  asian: ['Asian', 'אסייתי'],
  bagel: ['Bagels', 'בייגל'],
  bakery: ['Bakery', 'מאפייה'],
  breakfast: ['Breakfast', 'ארוחת בוקר'],
  brunch: ['Brunch', 'בראנץ׳'],
  burger: ['Burgers', 'המבורגר'],
  cake: ['Cakes', 'עוגות'],
  chicken: ['Chicken', 'עוף'],
  chinese: ['Chinese', 'סיני'],
  coffee_shop: ['Coffee', 'קפה'],
  dessert: ['Desserts', 'קינוחים'],
  donut: ['Donuts', 'סופגניות'],
  ethiopian: ['Ethiopian', 'אתיופי'],
  falafel: ['Falafel', 'פלאפל'],
  fish: ['Fish', 'דגים'],
  french: ['French', 'צרפתי'],
  frozen_yogurt: ['Frozen yogurt', 'פרוזן יוגורט'],
  georgian: ['Georgian', 'גאורגי'],
  greek: ['Greek', 'יווני'],
  hummus: ['Hummus', 'חומוס'],
  ice_cream: ['Ice cream', 'גלידה'],
  indian: ['Indian', 'הודי'],
  international: ['International', 'בינלאומי'],
  israeli: ['Israeli', 'ישראלי'],
  italian: ['Italian', 'איטלקי'],
  japanese: ['Japanese', 'יפני'],
  jewish: ['Jewish', 'יהודי'],
  juice: ['Juice', 'מיצים'],
  kebab: ['Kebab', 'קבב'],
  korean: ['Korean', 'קוריאני'],
  kosher: ['Kosher', 'כשר'],
  lebanese: ['Lebanese', 'לבנוני'],
  meat: ['Meat', 'בשרים'],
  mediterranean: ['Mediterranean', 'ים תיכוני'],
  mexican: ['Mexican', 'מקסיקני'],
  middle_eastern: ['Middle Eastern', 'מזרח תיכוני'],
  noodle: ['Noodles', 'נודלס'],
  pasta: ['Pasta', 'פסטה'],
  pizza: ['Pizza', 'פיצה'],
  ramen: ['Ramen', 'ראמן'],
  regional: ['Local', 'מקומי'],
  salad: ['Salads', 'סלטים'],
  sandwich: ['Sandwiches', 'כריכים'],
  seafood: ['Seafood', 'פירות ים'],
  shawarma: ['Shawarma', 'שווארמה'],
  steak_house: ['Steakhouse', 'סטייקיה'],
  sushi: ['Sushi', 'סושי'],
  thai: ['Thai', 'תאילנדי'],
  turkish: ['Turkish', 'טורקי'],
  vegan: ['Vegan', 'טבעוני'],
  vegetarian: ['Vegetarian', 'צמחוני'],
  vietnamese: ['Vietnamese', 'וייטנאמי'],
  yemeni: ['Yemeni', 'תימני'],
};

function humanize(value: string) {
  const text = value.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function cuisineLabels(cuisine: string | null, language: Language) {
  if (!cuisine) return [];
  return cuisine
    .split(';')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => {
      const known = CUISINES[part];
      if (!known) return humanize(part);
      return language === 'he' ? known[1] : known[0];
    });
}

/** The name to show first in the current language, plus the other-language name if different. */
export function venueNames(venue: Venue, language: Language) {
  const preferred = language === 'he' ? venue.nameHe : venue.nameEn;
  const other = language === 'he' ? venue.nameEn : venue.nameHe;
  const primary = preferred ?? venue.name ?? other;
  const secondary = [other, venue.name].find((name) => name && name !== primary) ?? null;
  return { primary, secondary };
}

export function addressLine(venue: Venue) {
  const street = [venue.street, venue.housenumber].filter(Boolean).join(' ');
  return [street, venue.city].filter(Boolean).join(', ') || null;
}
