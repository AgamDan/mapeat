export const en = {
  appName: 'MapEat',
  'welcome.tagline': 'Our places, our visits, our postcards.',
  'welcome.choose': 'Choose a language',
  'welcome.later': 'You can change this anytime in settings.',
  'tabs.map': 'Map',
  'tabs.timeline': 'Timeline',
  'map.title': 'Map',
  'map.comingTitle': 'The map is on its way',
  'map.comingBody': 'Next step: real restaurants, cafés and bars from OpenStreetMap, right here.',
  'timeline.title': 'Timeline',
  'timeline.emptyTitle': 'No visits yet',
  'timeline.emptyBody': 'Every place you visit together will appear here as a postcard, newest first.',
  'settings.title': 'Settings',
  'settings.open': 'Open settings',
  'settings.language': 'Language',
  'settings.appearance': 'Appearance',
  'settings.appearance.system': 'Like the phone',
  'settings.appearance.light': 'Light',
  'settings.appearance.dark': 'Dark',
  'settings.done': 'Done',
  'language.he': 'עברית',
  'language.en': 'English',
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;
