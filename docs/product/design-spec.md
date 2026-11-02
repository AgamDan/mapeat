# MapEat: first-release plan

Status: draft for discussion. Product decisions below are proposals unless explicitly confirmed. No feature implementation is authorized by this document alone.

## Purpose and confirmed context

Create a journal for the user and her boyfriend to remember restaurants and other places in Israel and abroad. The map is the main experience; a timeline helps rediscover visits. Each place can have many visits with their own dates, notes, photos, and ratings. A repeat visit must preserve earlier experiences.

The user selected Expo SDK 58, uses Windows and VS Code, and reports connecting the app through Expo Go on her iPhone. The current source remains the Expo starter, with a customized welcome heading. No journal, map, backend, authentication, or photo flow has been implemented. Supabase, Google Cloud, GitHub, billing, and distribution setup remain unverified. App source lives at the repository root (`src/`, `assets/`, `app.json`, `package.json`); it moved there from `mapeat-starter/` on November 2, 2026.

MapEat is a working name. The user confirmed both Hebrew and English for the interface. Support language switching, Hebrew right-to-left layouts, and English left-to-right layouts. Initial/default language selection remains undecided. Translate interface labels and validation/error messages; user-written notes stay in their original language. Branding, privacy rules, and final release scope have not been approved. Browser mockups were requested; their sample content is illustrative, and their current English-only labels do not represent the complete approved language scope.

Confirmed review model: the user selected one shared visit with separate reviews. The place and visit date belong to the shared visit; each person has their own rating and notes, displayed together under that visit. Either person can edit either review's rating and notes. Saved reviews are immediately visible to both journal members, even before the partner submits their review. Returning on another date creates another visit with its own reviews. The user selected a 1–10 rating scale. Rating increments (whole numbers or fractional values), required fields, deletion permissions, and place-summary calculations remain undecided.

Confirmed journal model: one shared journal for the couple, accessed through their separate accounts. Personal journals and journal-switching UI are outside the first-release scope. Separate reviews remain part of the same shared journal. Shared-journal membership rules still need agreement.

Confirmed wishlist model: one shared wishlist within the journal. Either person can add places for both to try. No personal wishlists are included. After the first visit is successfully saved, the place automatically leaves the wishlist and remains in the journal as visited with its full visit history. Manual removal permissions and any later re-addition/"want to return" behavior remain undecided.

Confirmed save behavior: a visit can be saved after one person submits their review. The partner can add their review to that existing visit later; saving does not wait for both reviews. The first saved review is immediately visible to both members. Do not hide reviews until both submit.

Confirmed sign-in method: Sign in with Apple. Each person uses their own identity to access the shared journal. Both the user and her boyfriend use iPhones, so plan native Apple sign-in testing on both devices.

Confirmed initial audience: just the user and her boyfriend. Plan a private first version for their two iPhones, two accounts, and one shared journal. Public onboarding, other couples creating journals, multi-journal discovery, and public distribution are outside this version. Private installation/distribution method still needs agreement. A future broader product would be a separate scope decision.

Confirmed hard budget constraint: everything must be free to the user, with no billing accounts, payment details, paid services, or usage-based billing exposure. The user explicitly rejected billing-enabled Google use even with free allowances. If any proposed step could cost money, explain that concrete cost and stop before taking it. Do not keep requesting Google billing approval or treat a free allowance as satisfying this constraint. Read-only research and free planning may continue. Free-service quotas and native iPhone distribution constraints must be explained rather than promising an indefinitely free standalone app.

Confirmed restaurant-discovery requirement: restaurant listings and profiles exist on the map independently of the couple visiting or saving them. The user wants restaurant names and existing place photos from outside sources, not imported public reviews/ratings. Each restaurant profile must be available before the first personal visit. The user now permits Google and other free sources for this catalog, while the hard no-billing rule still applies. Google Places names/photos still require billing-enabled access and are excluded unless that instruction changes. External Google Maps links remain a possible no-key feature, not permission to scrape or auto-import Google photos. Investigate no-billing open place data and properly licensed images; the user has not approved a specific replacement map renderer/provider. Coverage, photo availability, and missing-photo behavior must be validated and discussed. A manual-only catalog does not satisfy this requirement.

Confirmed first coverage-check area: Tel Aviv. This selects the initial research area, not a permanent limit on the app's travel scope. The [coverage research](../research/2026-10-31-tel-aviv-coverage.md) verifies three reusable historical photo examples but could not measure live restaurant/photo coverage because data endpoints were unreachable from this session. Do not treat those photos as a completed catalog.

Confirmed missing-photo behavior: if no reusable photo is available, keep the restaurant and its profile selectable and show a neutral "No photo yet" placeholder (localized into Hebrew/English). Do not hide a restaurant because its photo is missing, substitute an unrelated venue's image, or treat the couple's private review photos as public profile photos. The user approved this fallback; full photo coverage is not an acceptance requirement.

Confirmed initial use/distribution workflow: use Expo Go on both iPhones, with the computer's development server running when the app is used. The user accepted this after the standalone Apple distribution cost was explained. TestFlight, App Store distribution, and a standalone installation are deferred; paid Apple Developer enrollment is not approved. Expo Go use does not change the requirement that saved journal data persists on the backend across app sessions.

Planning-time checks found existing SDK 58 starter type errors in `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, and `src/hooks/use-theme.ts`: color-scheme nullability/obsolete `unspecified` comparisons and a web tab ref type. ESLint is not installed. Resolve these as foundation work before declaring the SDK upgrade fully validated; Expo connection alone is not a passing typecheck. No app source was changed during planning.

## Decisions confirmed November 2, 2026

These answers resolve or narrow the open decisions listed later in this document. Where they differ from an earlier recommendation in this spec, these win.

| Topic | Decision |
| --- | --- |
| Map | Apple Maps through `react-native-maps` inside Expo Go ($0, no API key). Wrap it in one app-owned map component so a different renderer (e.g. MapLibre for a future Android build) can replace it without touching screens. `expo-maps` and MapLibre need a custom build and are out of scope. Apple Maps' own place labels are not tappable for data in `react-native-maps` (POI click is Google-only). |
| Catalog source | OpenStreetMap via live Overpass queries for the visible map area, cached on the phone. Must tolerate Overpass failures (observed 502/timeout): cached results stay usable, retries are spaced and sequential, errors are clear. Attribution "© OpenStreetMap contributors" visible. |
| Venue types | `restaurant`, `cafe`, `fast_food`, `bar` (and pubs), `ice_cream`. |
| Profile photos | OSM-linked Commons/licensed photos where they exist (about 1% in Tel Aviv), otherwise the "No photo yet" placeholder. The couple may explicitly choose one of their own visit photos as a private journal cover for a place; it is never shown as a public profile photo. |
| Backend timing | Local-first: build the flow with on-device storage first, then connect Supabase. Keep all persistence behind one data-access layer so the switch does not change screens. Until then: no cross-phone sharing and no Apple sign-in. |
| Partner join (with backend) | Share-sheet invite link plus a 6-digit backup code; single use, expires in 24 hours. In Expo Go a link only works while the dev server runs at the same address. |
| First-launch language | Ask on first launch (עברית / English); changeable later in settings. |
| Rating | Whole numbers 1–10. Rating required; notes optional. |
| Place score summary | Each person's own average, side by side in their own color. Never a combined number. |
| Deleting | Either member can delete any visit, review, or photo after a confirmation. |
| Visit date/place editing | Either member. |
| Wishlist | Either member can remove manually. Visited places can carry a separate "want to go back" mark. |
| Categories | Filter by venue type and OSM `cuisine`, plus the couple's own tags (e.g. "date night"). |
| App name | Keep "MapEat" for now. |
| Visual direction | Mediterranean postcard: sand paper, terracotta + sea blue, Frank Ruhl Libre; each visit shown as a stamped postcard with the two reviews as its two halves. Mockups of all four candidate directions: `.superpowers/brainstorm/mapeat-styles-20261102/` (gitignored). |
| Light/dark | Follow the phone by default, with a manual System / Light / Dark switch in settings. |
| Reviewers before the backend | One phone with a "Writing as" switch between the two people, each in their own color. Real accounts replace the switch when the backend arrives; existing local reviews must keep their author. |
| Menu photos | Private (couple-only) photos of a restaurant's menu belong to the place, not a visit: one "Menu" section on the place profile, newest first with the date taken. Can be added before any visit (e.g. for a wishlist place) and anytime later. Never shown as public profile photos. |
| Adding visit photos later | Food/outing photos can be added to an already-saved visit anytime, by either member. |

## Success

First useful milestone: find/select a real restaurant already supplied by the map/place provider, save a dated visit with a rating and notes, close the app, reopen it, and find that visit. Add a second visit to the same place and see both. A manual-only version does not satisfy the user's requirement.

Proposed first-release outcome: each person signs in separately, can access their one shared journal, save visits and photos, keep a wishlist, and browse the same history from their own phone. The shared-only journal model is confirmed; member-only privacy and the remaining release scope still need user approval.

## Proposed screens and flow

| Screen | Purpose and main actions |
| --- | --- |
| Map | Show real restaurant listings from the selected provider alongside the couple's visited/wishlist places; let the user find and select a restaurant, then add a visit or wishlist entry. Confirm provider/search interactions before implementation. Location permission is requested only for a current-location action. |
| Restaurant profile / place details | Available even for never-visited restaurants: show name, location, and an existing-place photo gallery from permitted sources. Separately show journal wishlist/visited state and an "Our visits" section. Never-visited places offer add-to-wishlist/add-visit actions; no personal review is required to open a profile. |
| Add/edit visit | Select the shared visit date and enter your own rating and notes. Each person contributes a separate review to the same visit and adds their own outing photos within their review. Save or keep a draft. |
| Timeline | Browse one entry per shared visit, newest first by visit date, with the place and each person's clearly attributed review. Open the corresponding place and visit; rating aggregation remains undecided. |
| Journal/settings | Sign in/out, view journal membership, invite the partner under agreed rules, and manage approved preferences. |

Proposed navigation: Map and Timeline as the primary tabs, with journal/settings reachable from a small header control. Place details and visit form open from either tab. This is a layout proposal, not an approved visual design.

Both interface languages are in the first-release scope. Include a language control and persist each user's selection. Verify Hebrew/English text, mixed-script place names and notes, directional navigation, form alignment, and localized dates on the phone. Switching language must preserve an unsaved draft; location coordinates and numeric ratings must retain their meaning. Choose the first-launch language behavior with the user before implementation.

Core path: Map → find/select an existing restaurant → add visit → save → updated journal marker → place details with complete visit history. Provider catalog access/discovery is part of the first complete flow, rather than a later optional feature. Any manual fallback is optional and still requires approval; it cannot replace restaurant discovery.

Each screen needs loading, empty, and recoverable error states. A denied location permission must still allow map browsing and restaurant discovery without using the device's current location. Filters are proposed for visited/wishlist, category, and rating; the meaning of a place's rating filter depends on the rating decision below.

## Proposed scope and later work

First release: built-in restaurant discovery and selection, place history, dated visits, the agreed rating model, notes, photos, wishlist, timeline, shared access, and basic filters. Resolve provider and budget feasibility before planning restaurant discovery as implemented. Do not defer it in favor of manual place creation without a new user decision.

Two photo contexts are required: (1) existing restaurant profile photos from permitted sources, available independently of visits, and (2) the couple's own photos attached to their authored visit reviews. Do not fill restaurant profiles with the couple's private visit images automatically or use unrelated stock/generated photos as pictures of a real restaurant. Do not import other people's reviews or ratings. The previously confirmed 1–10 personal reviews remain in scope.

Defer unless requested: food/service/atmosphere subratings, expenses, statistics, AI recommendations, public profiles, social feeds, reservations, and full offline synchronization. Personal journals are excluded by the user's shared-only choice. Retaining an unsaved draft and handling failed saves remain part of the first release.

Do not treat temporary memory, fake sharing, exposed photo URLs, or overwritten visits as a successful milestone. Do not let third-party search content become the authoritative copy of the couple's own memories.

## Proposed technical approach

- Continue the existing React Native, Expo SDK 58, TypeScript, and Expo Router application. Check dependencies against SDK 58 before adding packages; verify phone bundling after changes.
- The user now permits other free sources for restaurant catalog/profile content, alongside Google where genuinely available without billing. Google API catalog/photo import remains blocked; native Google Maps on iPhone is also not included in standard Expo Go. A Google Maps JavaScript/WebView integration is not an exemption from Google's billing requirements. Agree on the actual map renderer and verify that provider content and the renderer are compatible before implementation.
- Recommend Supabase Auth, PostgreSQL, and private Storage for accounts, journal data, and photos. This is a recommendation, not an existing connection. Obtain project details through appropriate configuration without putting server secrets in app code.
- Sign in with Apple is confirmed, and both members use iPhones. Plan native `expo-apple-authentication`; if Supabase is approved, configure its Apple provider and exchange the native Apple identity token for an authenticated session. Expo's module supports iOS, not Android/web; any future Android/web sign-in approach needs separate agreement. Expo Go permits initial Apple sign-in testing, while the app's own build requires its Apple capability/identifier and appropriate developer-account setup. Do not treat an Expo Go test as production credential validation. Apple may supply private relay email; invitations must not assume a known personal email or use email alone as proof of membership. Provider secrets stay server-side.
- Recommend Expo ImagePicker for photo selection and Expo Location for an explicit current-location action. Request only the permissions required by the action being performed.
- Google Places is currently unavailable to this plan because billing was explicitly rejected. If the user changes the requirement in a later request, its display, attribution, and storage policies would still apply. Do not scrape Google Maps to obtain a restaurant catalog or bypass its API requirements.
- Investigate no-billing restaurant profiles using OpenStreetMap/Overpass names and coordinates, with linked Wikimedia Commons images or other explicitly licensed/place-owner-permitted photos. Match images to the actual venue using reliable identifiers/source links; retain photo source, author, license, and attribution. A public image URL or appearance in search results is not evidence of reuse permission. These sources do not guarantee Google's coverage or a photo for every restaurant. Check actual local coverage before committing to a complete gallery experience.
- Start with backend persistence in the first saved-visit milestone so real shared access does not require replacing a temporary data model. If service setup is deferred, build only a clearly labeled local prototype after that choice is approved.
- No standalone application server is proposed initially. Use database transactions or protected server functions for operations that cannot safely be performed as independent client requests.

### Free-first proposal and constraints

- The user wants existing restaurant profiles with names/photos and now allows other free sources. The remaining constraint is no billing; Google's APIs remain excluded. Showing labels, selecting a restaurant, querying the catalog, and obtaining usable photos are separate capabilities. Validate all four, and clearly disclose source/coverage differences instead of promising Google-equivalent data.
- Recommend Supabase Free for shared data, authentication, and private photos. Its checked published limits include 500 MB database storage and 1 GB file storage; inactive free projects may pause after a week. Compress photos, track storage usage, provide a useful paused/unavailable error, and ask before an upgrade. These limits are not a guarantee of unlimited free use or uninterrupted availability.
- The user approved Expo Go for the initial version, including dependence on a running development server. Expo supports Apple sign-in tests there, but identifiers may differ in standalone builds. Apple Developer Program membership is relevant only if the deferred standalone native-sign-in/distribution path is later selected; existing membership has not been confirmed. If migrating later, plan account/membership continuity explicitly rather than assuming Expo Go and standalone Apple identities match.
- Google Places requires billing-enabled setup even where usage can fit free allowances. The user explicitly rejected this; quotas and alerts do not make it an approved option. No Google billing setup is permitted.
- Candidate free catalog: OpenStreetMap restaurants queried via an appropriate public Overpass service, following tile/service policies, visible attribution, modest request volume, and best-effort availability; enrich with matched, properly attributed Wikimedia Commons/place-owner-permitted images where available. Existing catalog profiles must not depend on prior personal visits. Use the approved "No photo yet" placeholder when no reusable image is available. Google Maps URLs can open a place/search externally without an API key, but cannot populate profiles or return selected-place data automatically. The map renderer remains open.
- Initial delivery is the approved Expo Go development workflow. Validate access on both iPhones and explain how to reopen the project after a server restart. Private standalone installation and its costs are deferred.

## Data and behavior

Proposed model incorporating the confirmed shared-only journal and separate-review choices, with membership permissions and rating details still pending:

| Entity | Responsibility |
| --- | --- |
| Profile | Authenticated person's display identity. |
| Journal | The private collection and its settings. |
| JournalMember | Membership and agreed permissions; the authority for access checks. |
| RestaurantProfile / Place | Provider place identity, name, location, and source metadata, subject to that source's reuse/storage terms. Exists independently of a personal visit or wishlist entry. If manual places are later permitted, their user-created data stays journal-private. |
| PlaceProfilePhoto | A restaurant's independently sourced image with verified venue match, source URL, author, license/permission metadata, and attribution. Separate from private review uploads. A profile may have zero images; show the approved placeholder. |
| JournalPlace | A place in the shared journal, its shared wishlist state, and user-created journal metadata. Either member can add a wishlist entry. Category storage depends on the category decision below. |
| Visit | Journal/place link, creator, and shared visit date. Individual ratings and notes belong to reviews. |
| VisitReview | One person's rating and notes for a shared visit; link to visit and review owner. Use one review per owner per visit. Either journal member may edit the content. Technical recommendation: retain the review owner's attribution and track the last editor separately. |
| VisitPhoto | The couple's own outing image associated with a specific VisitReview (and thus its Visit), with private storage reference, uploader, and upload state. Upload/removal permissions remain to be agreed. |

Use stable identifiers so another visit reuses the existing place rather than overwriting it. Search matching can use a permitted provider identifier; a manually selected nearby point must not be silently merged with another place. Offer the existing place as an explicit selection.

Adding the partner's review targets the existing shared visit; it must not create another outing or replace the first person's review. Editing either existing review updates that review, rather than creating another review for the editor. A return visit remains separate. Saving with one review and adding the partner's review later is confirmed; an absent review must not be represented as a zero rating. Saved reviews are immediately visible to both journal members; no blind-review or reveal stage is required. Concurrent-edit handling must avoid silently overwriting a newer change; the builder can select an appropriate conflict check.

Store the user-selected visit calendar date separately from creation/update timestamps, so retrospective entries and travel dates sort correctly. Optional visit time and the appropriate timezone are separate; a date-only visit must not shift day when viewed abroad. Pagination has a stable secondary identifier for visits on the same date.

Recommended reliability rules: retain draft text/date/rating locally, scoped to the current account and journal, until the save succeeds or the user discards it; define sign-out cleanup before implementation. Use a stable submission identifier so retrying an uncertain save does not create duplicate visits. Do not clear a draft on network failure. A successful visit with failed photo uploads remains saved, with visible failed attachments and explicit retry; do not report all photos uploaded if they failed. This is bounded recovery, not a promise of complete offline synchronization.

Creation of a place, journal link, first visit, and first submitted review must be atomic or safely retryable. Do not leave duplicate or orphaned records after an interrupted save. Validate inputs on both client and server, including the rating bounds once chosen.

When a first visit is saved for a wishlist place, clear its wishlist status as part of that successful save. Opening the form, an unsaved draft, or a failed save must not remove it. Photos may finish uploading later; their upload state does not undo a successfully saved visit or its wishlist transition. This transition removes only wishlist status, not the journal place, visit, or reviews. What happens if all visits are later deleted must be decided with deletion behavior.

## Privacy and sharing decisions

Propose member-only access to records and photos, enforced by database and storage policies rather than screen visibility. Account A must not gain access to unrelated journals by changing a request identifier. A removed member must lose future server access; device caches need cleanup behavior.

Confirmed review-edit permission: either of the two journal members may edit either person's rating and notes. Enforce membership for these updates on the server; outsiders remain unauthorized. This does not decide deletion permissions or membership management. Before implementing sharing, agree who may edit shared visit metadata, delete content, and what happens when someone leaves. For this couple-only scope, recommend a one-time authenticated partner invitation or explicit setup of the two approved memberships instead of a public invitation-management system. The user must approve the onboarding approach. If an invitation is used, acceptance must be authenticated, limited to the intended recipient, expiring, and safely repeatable. Signing in with Apple alone must not grant an unapproved account access to the journal.

Before beta, document photo/visit deletion behavior and account deletion, including the effect on a partner's shared history. No cloud resources, paid services, invitations, or distribution will be assumed configured merely because the mobile app starts.

## Delivery order and acceptance gates

| Step | Deliverable | Evidence required |
| --- | --- | --- |
| 1. Agree on product behavior | Review wireframes and resolve membership permissions, first-launch language behavior, and remaining rating/review details. One shared journal only, Hebrew + English, separate reviews, and 1–10 ratings are confirmed. Confirm proposed scope and technical choices. | A user-approved design; open choices recorded rather than guessed. |
| 2. Provider proof and foundation | Prove real restaurant discovery/selection works with the agreed provider, budget, and Expo Go constraints; include pre-existing profiles with independently sourced photos or the approved missing-photo placeholder; verify SDK 58 setup; configure the approved backend and Sign in with Apple for the two iPhones; create journal membership and policies. | Select a real provider restaurant without manually entering it or adding a visit; view its profile; a restaurant without a photo stays selectable and shows "No photo yet"; one user accesses their journal; another unrelated account cannot access its records. A map showing labels alone is not evidence of selectable journal integration. |
| 3. First complete visit | Find/select an existing restaurant, date, rating, notes, durable save with one person's review, journal marker, place history, and draft recovery. | Save without manually creating the restaurant and without waiting for the partner; reopen app and see visit; add another without overwriting; failed save retains text; retries do not duplicate records. |
| 4. Photos and wishlist | Private uploads, photo viewing/retry, and a shared wishlist that either member can add to. | A real visit's photos reopen; upload failure does not lose the saved visit; wishlist entries do not appear as completed visits; the first successful visit removes wishlist status while a failed save leaves it unchanged. |
| 5. Partner and timeline | Approved private setup for the two members, second phone, separate reviews on the same visit, timeline, and agreed filters. | Each saved review is available to both members without waiting for the second review; both accounts see shared data after refresh; an unapproved third account has no access; adding the partner's review preserves the first review and creates no duplicate outing; timeline follows visit dates; access/edit rules hold. Realtime updates are optional. |
| 6. Discovery refinement | Improve the already working first-flow discovery: agreed search/autocomplete behavior, matching existing journal places, coverage/error handling, and attribution. | Find real restaurants and add visits without duplicating saved journal places. Provider failures are clear and do not lose review drafts. This step refines discovery rather than introducing it for the first time. |
| 7. Private beta | Test both interface languages and RTL/LTR layouts, permissions, weak connections, dates abroad, duplicate taps, interrupted uploads, sign-out, and approved deletion flows through the accepted Expo Go workflow. | First real outing recorded end to end by both users while the development server is available. Language switching preserves drafts. Paid services and standalone publishing require a separate decision. |

Steps 5 and 6 can swap after the core flow depending on user priority, but built-in restaurant discovery must be included in the first core flow. Do not provide a fixed deadline until services, scope, and distribution constraints are known. Each implementation step includes the repository's required lint and typecheck, focused behavioral checks, and phone validation appropriate to that change.

## Decisions needed from the user

1. First-launch language behavior: Hebrew and English with RTL/LTR support are confirmed. Still decide whether to follow the phone language or present a language choice initially.
2. Journal model: confirmed as one shared journal only; no personal journals in the first release. Membership permissions remain under decision 4.
3. Rating/review details: separate reviews on one shared visit, a 1–10 rating scale, saving with one review while the partner adds theirs later, and immediate visibility to both members are confirmed. Still decide rating increments and whether notes/rating are required. Define any place-summary rating and rating-filter meaning alongside these choices.
4. Sharing: either journal member editing either review's rating and notes is confirmed. Still decide shared-visit metadata editing, content deletion, invitations/member removal, and history retention after someone leaves.
5. First release: pre-existing restaurant profiles/names/photos are required independently of visits. The "No photo yet" fallback for missing reusable photos is approved. Google and other free sources are permitted only within the hard no-billing rule; a manual-only first version remains rejected. Resolve map renderer, local catalog/photo coverage, exact finding/selection/search interactions, and runtime, then confirm the remaining proposed scope. No public third-party review import is needed.
6. Budget: strictly free, no billing accounts, no paid services or possible metered charges. Google billing was explicitly rejected, so resolve the discovery tradeoff using genuinely no-billing options. Supabase must remain on its Free plan without a payment setup; paid plans and Apple Developer enrollment are not approved. Backend project creation/configuration is still pending.
7. Initial audience and use workflow: confirmed as just the couple, both on iPhone using Expo Go with a running computer development server. Standalone installation and paid distribution are deferred. Public/multi-couple release and Android are outside the current version.
8. Visual direction and final name. Mockups use neutral styling and sample restaurant information, not approved branding.
9. Sign-in method: Sign in with Apple and both members using iPhones are confirmed. Still verify backend-provider setup, production Apple capability/credentials, and compatible invitation flow. Do not introduce another sign-in method without agreement.
10. Wishlist transitions and permissions: a shared wishlist with either person able to add places, and automatic removal after the first successfully saved visit, are confirmed. Still decide manual removal permissions, any re-addition/"want to return" behavior, and the effect of deleting all visits later.
11. Categories: fixed place types, editable tags, or provider categories; define who assigns them or remove category filtering from the first release.

Search, map, and photo-source decisions must be reviewed together: the user permits free sources for restaurant profiles but no billing-enabled Google access. Validate the proposed free catalog and image sources in the user's chosen initial area; use the approved "No photo yet" fallback for incomplete photo coverage. Agree on the map renderer before implementation. Do not proceed with potentially chargeable steps.

Do not ask all questions at once. Discuss the highest-impact unresolved choice, update this draft, and review the full design before feature implementation.

## Builder discretion after approval

Builder may choose file organization within the existing Expo Router conventions, reusable components, validation helpers, indexes, pagination mechanics, retry implementation, and focused tests. Decisions affecting user-visible scope, permissions, spending, language, journal ownership, and rating semantics return to the user.

## Review record

A fresh software-engineering reviewer checked this draft on October 31, 2026. The review identified sign-in method, wishlist ownership/transitions, and categories as additional user decisions; these are now recorded above. The user subsequently confirmed separate reviews on a shared visit, 1–10 ratings, Hebrew and English, and one shared journal only. Remaining review details and membership permissions still need resolution before implementation. This is a reviewed planning draft, not yet a final approved build specification.

## Sources checked for this draft

- [Expo SDK 58 map documentation](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/)
- [Expo SDK 58 ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/)
- [Expo SDK 58 AppleAuthentication](https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/)
- [Supabase Sign in with Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google Places storage, map display, and attribution policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Supabase published free-tier limits](https://supabase.com/pricing)
- [Google Places billing-enabled setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Apple Developer account and distribution options](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Google Maps Platform pricing and free allowances](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Maps cost controls and budget-alert limitations](https://developers.google.com/maps/billing-and-pricing/manage-costs)
- [Expo release note documenting native Google Maps removal from iOS Expo Go](https://expo.dev/changelog/2024-05-07-sdk-51)
- [Expo SDK 58 WebView candidate](https://docs.expo.dev/versions/v58.0.0/sdk/webview/)
- [Google Maps URLs: external search without an API key](https://developers.google.com/maps/documentation/urls/get-started)
- [OpenStreetMap public tile usage requirements](https://operations.osmfoundation.org/policies/tiles/)
- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Google Place Photos API](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [OpenStreetMap links to Wikimedia Commons images](https://wiki.openstreetmap.org/wiki/Key:wikimedia_commons)
- [Wikimedia Commons reuse and attribution guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- [MediaWiki image metadata API](https://www.mediawiki.org/wiki/API:Imageinfo)
