# MapEat implementation plan

Status: approved direction as of November 2, 2026. Product rules live in [design-spec.md](./design-spec.md) (see "Decisions confirmed November 2, 2026"). This file covers how the app is built and in which order. Update it when a milestone finishes or a technical choice changes.

## Constraints that shape every milestone

- Runs only in **Expo Go** on two iPhones with the dev server running. Use only modules bundled in Expo Go (check the SDK 58 docs page for `Included in Expo Go`). No custom native builds: they would require the $99/year Apple Developer Program.
- **$0**: no billing accounts, paid APIs, or metered services.
- Hebrew (RTL) and English (LTR), switchable at runtime without losing a draft.
- **Local-first**: everything is stored on the phone until the Supabase milestone. All persistence goes through one data layer (`src/data/`) so screens don't change when the backend arrives.

## Architecture

```
src/
  app/                    Expo Router routes only
    _layout.tsx           providers (settings, i18n/direction, theme, fonts) + root Stack
    welcome.tsx           first-launch language choice
    settings.tsx          language, appearance, "writing as" people (modal)
    (tabs)/_layout.tsx    native tabs: Map, Timeline
    (tabs)/index.tsx      Map
    (tabs)/timeline.tsx   Timeline
    place/[id].tsx        place profile (M1+)
    visit/...             add/edit visit (M2+)
  components/             shared UI (themed text/view, postcard card, rating picker, ...)
  features/<area>/        feature logic and feature-specific components (map, catalog, visits, photos, wishlist)
  data/                   data-access layer: SQLite schema + repositories; later Supabase implementations
  i18n/                   en.ts, he.ts dictionaries, provider, useT(), direction
  settings/               persisted app settings (language, appearance, people)
  constants/theme.ts      postcard palette (light/dark), fonts, spacing
```

### Direction (RTL) in Expo Go

Expo Go resets native RTL overrides, so `I18nManager.forceRTL` cannot be used. Instead:

- The root view sets the Yoga `direction` style (`'rtl'` / `'ltr'`) from the chosen language, so `start`/`end`, row order, and margins flip for all app content.
- Expo Router's `LocaleProvider direction` flips navigation headers, transitions, and gestures.
- `ThemedText` sets `writingDirection` and start-aligned text for the current direction.
- Switching language re-renders immediately (no reload), which also protects unsaved drafts. Drafts are persisted anyway (M2).
- Verify on the phone with both a Hebrew-language and an English-language device setting; the native tab bar order may not flip.

### Data model (local SQLite, mirrors the future Postgres schema)

| Table | Notes |
| --- | --- |
| `people` | The two journal members (name, color). Local stand-in for profiles; later mapped to Supabase users. |
| `places` | OSM snapshot: `osm_type` + `osm_id` (stable key), names (`name`, `name:he`, `name:en`), lat/lon, venue type, cuisine, photo source metadata, `fetched_at`. |
| `journal_places` | Journal state per place: wishlist flag, "want to go back" flag, private cover photo, tags. |
| `visits` | Place, calendar date (`YYYY-MM-DD` text, no timezone), `submission_id` (unique, idempotent saves), created/updated timestamps. |
| `visit_reviews` | One per person per visit: whole-number rating 1–10 (required), optional notes, author, last editor. |
| `photos` | Private photos: kind `visit` (linked to a review/visit) or `menu` (linked to a place), local file URI, taken/added date, upload state (for later sync). |
| `tags`, `place_tags` | The couple's own tags. |

Place summary shows each person's own average; a missing review is absent, never 0.

### Catalog (built-in Israel file + live Overpass)

- **Built-in:** `npm run catalog:build` (`scripts/build-catalog.mjs`) converts Geofabrik's free daily Israel-and-Palestine OSM extract into `assets/catalog/israel.json`. `src/data/starter-catalog.ts` loads it into `places` on first launch and whenever its `version` changes, never overwriting fresher live data, and marks its map tiles (plus one neighboring tile, ~2 km) as fresh. Rebuild roughly monthly.
- **Live:** for tiles that are missing or older than 30 days (abroad, empty areas), query Overpass for the visible map area for `amenity` in `restaurant|cafe|fast_food|bar|pub|ice_cream`, only when zoomed in enough (bounded area), with a timeout and sequential fallback servers.
- Cache results in `places` keyed by OSM ID; show cached places immediately and refresh in the background.
- On failure: keep cached data and retry later. The map shows a loading or error message only when no places are visible. Never parallelize retries; space them out; identify the app in the User-Agent.
- Show "© OpenStreetMap contributors" on the place profile (linking to the OSM page). The map itself shows no OSM credit so Apple Maps' required logo (bottom-left) stays unobstructed. Show a Commons photo only with source, author, and license; otherwise "No photo yet".

## Milestones

Each milestone ends with `npx tsc --noEmit`, `npx expo lint`, and a check on the iPhone in both languages.

Progress: **M0 built November 2, 2026** — typecheck, lint, iOS bundle, and the web flow (first-launch choice → tabs → settings language/appearance switch → persisted after reload) verified. **iPhone check pending** (especially RTL via the `direction` style and the native tab bar in Hebrew).

**M3 built November 3, 2026** — wishlist (place-page toggle, Wishlist tab with "Want to try" / "Want to go back"), "want to go back" mark (cleared by a new visit), own place tags (create/rename/delete, chips on the place page), Timeline tab (month-grouped postcards, person filter, paging), map pins by journal status (visited postcard pin, wishlist heart, want-to-go-back badge, journal pins visible zoomed out) and a filter sheet (show / type / cuisine / tags). Built by three parallel sub-agents on a committed contract. Verified: typecheck, lint, iOS + web bundles, 59 data-layer checks, web click-through in Hebrew (wishlist → tag → visit → off wishlist → timeline). **iPhone check pending** (pins and filter sheet can only be seen on the phone).

**M2 built November 3, 2026** — local journal: add a visit (date, "Writing as" Artur/Agam, whole 1–10 rating, optional notes), the partner's review on the same visit, edit either review, change date, delete with confirmation, per-person averages, postcard visit cards, persistent drafts, idempotent saves, journal places kept through catalog refreshes, all writes serialized. Built by two parallel sub-agents (forms vs. history) on a committed contract. Verified: typecheck, lint, iOS + web bundles, 24 data-layer checks, and a full web click-through in Hebrew. **iPhone check pending.** — Apple Maps (`JournalMap`), built-in Israel catalog (7,210 places; Tel Aviv count matches live Overpass), Overpass client with fallback, SQLite cache with tiles, place profile sheet (bilingual names, cuisine, address, hours, website, Commons photo with license or "No photo yet", Open in Apple Maps, OSM credit), "locate me" (permission only on tap), ⓘ map credit. Verified: typecheck, lint, iOS + web bundles; catalog/DB logic against Node SQLite and live Commons. Live Overpass was overloaded during testing (all instances 502/timeout), so the live path is verified only for failure handling. **iPhone check pending.**

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | **Foundation** — remove starter screens; postcard theme (light/dark + manual switch); Frank Ruhl Libre; i18n (he/en) with runtime RTL; first-launch language picker; Map/Timeline tabs; settings modal; fix starter type errors; ESLint set up. | App opens to the language picker on first launch, then tabs; switching language/appearance in settings updates instantly and persists across restarts; typecheck and lint pass. |
| M1 | **Map + catalog** — `react-native-maps` (Apple Maps) behind an app-owned `JournalMap` component; Overpass client + SQLite cache; catalog dots; place profile sheet with names, cuisine, photo or placeholder, attribution. | Pan Tel Aviv, tap a real OSM restaurant, see its profile; works again offline from cache; Overpass failure shows a clear message without losing the map. |
| M2 | **First visit** — local data layer; add/edit visit (date, "writing as", rating 1–10, notes); draft persistence; idempotent save; place history with both averages; postcard visit card. | Save a visit, kill the app, reopen, see it; add the second person's review to the same visit; return visit creates a new visit; failed save keeps the draft; double-tap doesn't duplicate. |
| M3 | **Wishlist, tags, timeline** — wishlist + "want to go back"; automatic wishlist removal on first saved visit; own tags; filters (visited/wishlist, venue type, cuisine, tag); timeline by visit date. | Wishlist place leaves the wishlist only after a successful first visit; filters combine correctly; timeline order is stable for same-day visits. |
| M4 | **Photos** — `expo-image-picker` (camera/library) for visit photos (add anytime later) and place menu photos (also before any visit); private cover photo choice; delete with confirmation. | Photos survive restart; menu photos show on the place before/after visits; profile photos and private photos never mix. |
| M5 | **Backend + two phones** — Supabase Free (schema mirroring SQLite, RLS member-only), Sign in with Apple, invite link + 6-digit code, one-time upload of local data keeping review authors, photo storage (private bucket). | Both phones see the same journal; a third account sees nothing; local data migrated without duplicates. |
| M6 | **Private beta polish** — search within cached catalog, weak-network behavior, delete flows, date handling abroad, RTL/LTR review on both phones. | First real outing recorded end to end by both of you. |

## Open questions to resolve when their milestone starts

- M1: done with defaults — zoom limit ~5 km map height, 250 nearest markers, 30-day refresh, two Overpass servers. Revisit after phone testing (marker density, clustering).
- M2: done. People default to Artur (terracotta) and Agam (sea blue), renamable in Settings; date only, no time. Deferred to M5 (only possible with two phones): what to do when a restored draft hits an edit conflict.
- M3: done. Person filter on the Timeline resets each launch; tag selection saves on each tap; cuisine choices come from places in view.
- M4: photo count/size limits per visit; compression level (matters for Supabase's 1 GB free storage later).
- M5: how local-first data is merged if both phones created data before sync; sign-out cleanup.
