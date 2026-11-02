# MapEat — Project Summary and Codex Handoff

Last updated: November 2, 2026

Older entries below mention earlier paths (`mapeat-starter/`, `MAPEAT_CODEX_HANDOFF (1).md`, `docs/superpowers/specs/`). They are kept as written; see the November 2 restructure entry for the current locations.

## Working mode (from November 3, 2026) — parallel sub-agents

The user asked that work be split across parallel sub-agents where safe. Continue this in future sessions:

1. Before splitting a milestone, the lead defines and commits the shared contract: types, SQLite schema/migration, data-layer function signatures, route paths (with stub route files and `_layout.tsx` registration), and i18n keys (English + Hebrew). All `npx expo install` runs happen before the split.
2. Each sub-agent owns a file-disjoint chunk in its own git worktree + branch outside the repo (e.g. `git worktree add ..\mapeat-wt\m3-timeline -b m3-timeline`). In the worktree: `npm ci`, generate route types with a short `$env:CI='1'; npx expo start --go --port 8082` (+1 per agent), never the default port.
3. Sub-agents never edit `package.json`, `package-lock.json`, `src/i18n/en.ts`, `src/i18n/he.ts`, or `src/app/_layout.tsx`; they report needed strings (English + Hebrew) and layout wiring for the lead to merge.
4. Sub-agent prompts are self-contained (spec decisions, repo rules, owned files, contract) and say: report open questions instead of guessing. Questions to the user stay in the main chat, always with options.
5. Each sub-agent runs `npx tsc --noEmit` and `npx expo lint` in its worktree before reporting.
6. The lead merges each branch, adds strings, wires layout, runs typecheck + lint + iOS export once on the merged result, then removes worktrees and branches. On Windows `git worktree remove` fails on long `node_modules` paths: delete the folder with `cmd /c rmdir /s /q "\\?\<full path>"`, then `git worktree prune`.
7. Read-only checks (tsc, lint, iOS/web export) and independent doc lookups may run in parallel; a code-review agent reviews each finished milestone while the next starts.
8. Sequential only: single dependency chains, package installs, Overpass/network requests (one at a time), commits and pushes on `main`.
9. When splitting, tell the user in one line which agent owns which files.

Expected split value: M2 small (visit form vs. place visit history, after the data layer), M3 high (wishlist / tags / timeline), M4 medium (menu-photo vs. visit-photo UI after one storage layer), M5 low, M6 parallel read-only audits (RTL, error states).

## Milestone 2 — November 3, 2026

- Built M2 (first visit) in the parallel working mode: lead committed the contract (migration 3, `src/data/visits.ts`, people Artur/Agam, "Writing as" setting, date helpers, strings, stub routes, shared `DateField`); agent `m2-form` built the visit/review forms + drafts, agent `m2-history` built place history, visit card, visit detail. Lead added "Our names" in Settings and merged.
- Code review of M1 + contract found three issues, all fixed: Overpass 200-with-`remark` partial results no longer wipe the cache; catalog sync is single-flight; all DB writes go through one queue (`src/data/write-queue.ts`, `writeTransaction`) with `busy_timeout`.
- Route note: `visit/[id]/index.tsx` produced different typed-route names under `expo start` vs `expo lint`/`export`; routes are now flat (`visit/[id].tsx`, `visit/review.tsx`, `visit/new.tsx`).
- Verified: typecheck, lint, iOS + web bundles, 24 data-layer checks, full web click-through in Hebrew (add visit → partner review → averages). **Not yet verified on the iPhone.** Commits still local only (waiting for `Likva32` to be added as collaborator).
- Next: M3 (wishlist, tags, timeline) — high parallel value.

## Milestone 1 — November 3, 2026

- Built M1 (map + catalog): Apple Maps via `react-native-maps` behind `src/features/map/journal-map.tsx` (web stub), SQLite cache (`src/data/`), Overpass client with fallback servers, tile-based refresh, place profile sheet (`src/app/place/[id].tsx`), "locate me" (permission only on tap), ⓘ OpenStreetMap credit on the map. Added `react-native-maps`, `expo-sqlite`, `expo-location`, dev-only `osm-pbf-parser`, `metro.config.js` (expo-sqlite web).
- All public Overpass instances failed during testing (overpass-api.de 502 "at capacity", private.coffee and kumi timeouts, mail.ru 504). User chose a built-in Israel catalog plus live Overpass: `npm run catalog:build` → `assets/catalog/israel.json` (7,210 places, 943 KB, Geofabrik data 2026-11-02; Tel Aviv rectangle 1,315 vs 1,316 from live Overpass the night before).
- Verified: typecheck, lint, iOS and web bundles; migrations/seed/cache/refresh against Node's SQLite; Commons photo lookup with license. **Not yet verified on the iPhone.** Push to GitHub is blocked: git is signed in as `Likva32`, which lacks write access to `AgamDan/mapeat` (local commits only).
- Next: phone check of M0 + M1; then M2 (first visit).

## Planning + Milestone 0 — November 2, 2026

- Live OSM measurement for Tel Aviv succeeded (see `docs/research/2026-10-31-tel-aviv-coverage.md`): 1,316 venues; ~1% link any photo; public Overpass returned 502/timeout before succeeding.
- Remaining product decisions resolved with the user and recorded in `docs/product/design-spec.md` ("Decisions confirmed November 2, 2026"): Apple Maps via `react-native-maps` in Expo Go; live Overpass catalog; five venue types; local-first storage with a "Writing as" switch; invite link + code later; ask language on first launch; whole 1–10 ratings (required), notes optional; per-person averages; either member edits/deletes; wishlist manual removal + "want to go back"; OSM filters + own tags; menu photos on the place; visit photos addable later; postcard visual direction with System/Light/Dark.
- Visual direction mockups (4 styles, bilingual) in `.superpowers/brainstorm/mapeat-styles-20261102/index.html` (gitignored). User chose "Mediterranean postcard".
- Added `docs/product/implementation-plan.md` (architecture, data model, milestones M0–M6).
- Built M0: removed starter screens/assets and `reset-project`; postcard theme (light/dark + manual switch), Frank Ruhl Libre; i18n (`src/i18n/`) with runtime RTL via the Yoga `direction` style and Expo Router `LocaleProvider` (native RTL forcing doesn't work in Expo Go); first-launch language screen gated with `Stack.Protected`; native tabs Map/Timeline; settings modal; settings persisted in AsyncStorage. Added `expo-localization`, `@react-native-async-storage/async-storage`, `@expo-google-fonts/frank-ruhl-libre`, ESLint 9 (`eslint-config-expo`).
- Verified: `npx tsc --noEmit` clean (starter errors gone), `npx expo lint` clean, iOS bundle exports, web flow works in both languages. **Not yet verified on the iPhone.**
- Next: user runs `npx expo start --go` and checks M0 on the phone in Hebrew and English; then M1 (map + catalog).

## Restructure — November 2, 2026

- User requested app code at the repository root and all documentation in one logical place. Chosen options: app at root, docs grouped by type, app renamed to `mapeat`, full scope.
- Moved the Expo app from `mapeat-starter/` to the root with `git mv` (history preserved): `src/`, `assets/`, `scripts/`, `app.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `LICENSE`, `AGENTS.md`, `.vscode/extensions.json`, `.vscode/settings.json`. Merged the starter `.gitignore` into the root one. Removed the generic Expo starter README; added a root `README.md`.
- Renamed `package.json` name, `app.json` name/slug, and URL scheme from `mapeat-starter` / `mapeatstarter` to `mapeat`. No dependency versions changed.
- Docs now live under `docs/`, indexed by `docs/README.md`: `docs/product/design-spec.md` (was `docs/superpowers/specs/2026-10-31-mapeat-design.md`), `docs/research/`, and `docs/status/handoff.md` (this file, was `MAPEAT_CODEX_HANDOFF (1).md` at the root).
- `node_modules` was not present; run `npm ci` at the root before `npx tsc --noEmit` or `npx expo start --go`. Any previous `mapeat-starter/node_modules` must not be reused.

## Continuation status — November 2, 2026

- Git for Windows 2.56 installed via winget. The workspace root is now a git repository pushed to https://github.com/AgamDan/mapeat (`main`). `.superpowers/`, `.mapeat-recovery/`, `node_modules/`, and `.expo/` stay untracked via `.gitignore`.
- Added `.github/copilot-instructions.md` (commands, SDK 58 rules, conventions, confirmed product constraints) and `.vscode/mcp.json` (Playwright MCP; Supabase hosted MCP in read-only mode, no project created yet).
- Typecheck re-verified with installed Expo 58.0.22 / React Native 0.88.1: only the known starter errors in app-tabs.tsx, app-tabs.web.tsx, and use-theme.ts remain. No app source changed.

## Continuation status — October 31, 2026

### Current activity: product planning after Expo connection

- Confirmed missing-photo fallback: keep the restaurant and its profile selectable, show "No photo yet" when no reusable photo is available. Do not hide missing-photo venues or fill their profile gallery with private visit uploads automatically. Update Hebrew/English labels accordingly. Catalog counts and provider/renderer proof remain unverified.
- Updated visual companion screen: `.superpowers/brainstorm/mapeat-plan-20261031/content/restaurant-profiles-v2.html`, served as the latest screen. Includes selectable Keton/Abu Hassan historical photo examples with source/author/license links, a clearly fictional missing-photo state, separate illustrative visit reviews/photos, and Hebrew/English RTL/LTR switching. Server HTTP delivery and script syntax verified; live image download and real device rendering are not verified. This is a review mockup, not application code or a populated dataset.

- User selected Tel Aviv as the first catalog/photo coverage-check area. Research saved in `docs/research/2026-10-31-tel-aviv-coverage.md`: verified Commons photo pages for Keton (2015, CC BY-SA 4.0), Abu Hassan food (2022, CC BY-SA 4.0), and La Mer (2011, public-domain dedication). Historical photos do not verify current opening status or venue coordinates. Live Overpass/OSM endpoints were inaccessible through browsing and terminal, so no live restaurant count, photo-match count, or coverage percentage was verified. Need an approved missing-photo fallback and a real bounded dataset response before promising/populating a complete catalog. No billing or paid services used.

- Latest product clarification: restaurants have their own pre-existing profiles and photos on the map, regardless of whether either person has visited. User only needs names/place photos from catalog sources, not imported public reviews/ratings. The couple's own 1–10 reviews/notes remain, and their personal outing photos belong inside their authored visit reviews, separate from restaurant profile photos. User now permits Google AND other free sources; no billing remains a hard constraint, so automatic Google API names/photos are still excluded. Investigate OSM/Overpass catalog + matched, properly licensed Commons/owner-permitted images. Actual local coverage, missing-photo behavior, and map renderer remain undecided; do not promise a Google-complete restaurant/photo catalog.

- HARD COST CONSTRAINT: user explicitly rejected billing accounts and wants everything free. If a step could cost money, explain the cost and STOP before taking it. No payment details, Google billing, metered-charge exposure, paid plans, or Apple Developer enrollment. Do not keep asking to enable Google billing. This supersedes earlier free-first wording. Google Places integration is blocked by this requirement. Discuss a free non-Google catalog (e.g. OSM/Overpass, with service-policy/coverage validation) or external Google Maps links with manual journal linking; neither alternative is approved yet. Do not substitute providers or scrape Google listings.

- Provider preference: Google Maps listings. Subsequent explicit no-billing instruction blocks Google Places integration; free allowances and a WebView do not remove billing prerequisites. Apple Maps/OSM are not approved substitutions. Native Google Maps on iOS was also removed from Expo Go. Resolve the product tradeoff without chargeable setup or promises of a finished Google integration.

- Important correction: user rejected a manual-only first version and wants real Google restaurants already present/findable on the map. This is required in the first working flow, not a search-later enhancement. Google is now explicitly selected. Verify actual discovery, selection, and journal integration under the free-first/Expo Go constraints before promising a solution; provider map labels alone are insufficient. Do not enable Google billing or change the Expo Go budget/distribution agreement without a decision.

- Confirmed initial use workflow: Expo Go on the two iPhones, with the computer's development server running during use. User accepted this after being told standard TestFlight/App Store distribution involves Apple Developer membership costs. Standalone installation, paid Apple enrollment, and publishing are deferred; saved data must still persist across app sessions.

- Confirmed budget direction: free services first. Do not enable paid plans, Google billing, or Apple Developer enrollment without a separate decision. Draft now proposes Apple Maps on iPhone, Supabase Free, and initial Expo Go testing, while explicitly leaving user approval of provider/search/distribution tradeoffs pending. Explain that Expo Go is a development workflow, free storage has quotas/inactivity behavior, and an independently installed iPhone app with Apple sign-in has additional Apple setup/distribution requirements.

- Confirmed first-version audience: just the user and her boyfriend on their two iPhones, with one shared journal. Public sign-up for other couples, public journal creation, and a public/multi-couple release are outside current scope. Initial use is through Expo Go with a running development server; secure setup of the two memberships still needs agreement.

- Confirmed sign-in method: Sign in with Apple, with separate identities for the two members. Both the user and her boyfriend use iPhones, so plan native Apple sign-in testing on both. Current first-version scope is the couple's two iPhones. Supabase/Apple provider setup and production Apple capability/developer-account configuration remain unverified. Apple relay emails must be considered when designing invitations.

- Confirmed wishlist model: one shared wishlist; either person may add places for both to try. After the first visit is successfully saved, the place automatically leaves the wishlist and stays in the journal/map as visited. Failed saves do not clear wishlist status. No personal wishlists. Manual removal rights, re-addition, and the effect of deleting visits remain undecided.

- Confirmed save and visibility behavior: a visit saves with one person's review; the partner adds theirs later to the same visit. Saved reviews are immediately visible to both members. Do not require both reviews before saving or hide the first review until the second is submitted.

- Confirmed review-edit permission: either person may edit either person's rating and notes. Separate review ownership still distinguishes the two opinions. Deletion rights, shared-visit metadata editing, and membership management are not decided by this answer.

- Confirmed journal model: one shared journal only for the couple, accessed through separate accounts. Personal journals are excluded from the first-release scope. Membership management and deletion rights are still open; review-edit permission and shared wishlist ownership are recorded above.

- Confirmed interface languages: Hebrew and English, including Hebrew RTL and English LTR layouts, with language switching. Initial language selection remains open. Existing English-only wireframes are illustrative and need a bilingual revision before visual sign-off.

- Confirmed product decisions: one shared visit (same place/date) with separate ratings and notes for each person, rated on a 1–10 scale. Keep one Visit with authored VisitReview records. Do not overwrite either person's review or duplicate the outing when the partner adds theirs. Rating increments and other review details remain open; the design document has been updated.

- User reports being connected through Expo and requested an app plan using the existing information. Treat earlier installation/startup blockers below as historical; do not resume setup troubleshooting without new evidence.
- Current package.json targets Expo 58 and React Native 0.88.1. Installed dependencies and a lockfile exist again. Starter source remains, with the welcome heading customized to Mapeat; no journal features are implemented.
- Draft product plan: `docs/superpowers/specs/2026-10-31-mapeat-design.md`. A fresh reviewer checked it and missing user decisions were added. It distinguishes confirmed context from proposed scope and architecture.
- User approved browser mockups. A local visual companion serves four clickable wireframes (map, place history, add visit, timeline); session files are in `.superpowers/brainstorm/mapeat-plan-20261031/`. Read `state/server-info` for the complete current URL and check server liveness before sharing. Wireframes are sample content only; English, colors, and rating behavior are not approved.
- User's standing preference: ask when uncertain. Resolve review/rating semantics and other recorded choices before implementing dependent features. No app feature implementation has started.
- Planning-time typecheck now finds pre-existing SDK 58 starter compatibility errors in app-tabs.tsx, app-tabs.web.tsx, and use-theme.ts (color-scheme handling and web ref types). ESLint is still not installed. Record these as foundation tasks, not reasons to repeat dependency installation blindly. App source was not modified during planning.

### Approved target: Expo SDK 58 (supersedes SDK 57 restoration below)

#### Latest: dependency tree reset after user installation failed

- User's online `npm install` failed with ERESOLVE: installed expo-router 57.0.29 conflicted while resolving expo-router ~58.0.29 and expo-symbols 58.0.4. Read the full npm resolution report and verified that package-lock.json and node_modules retained the old SDK 57 dependency graph.
- Moved the old node_modules directory and package-lock.json out of the app into `.mapeat-recovery/sdk57-dependencies-20261031-224651/` inside the workspace. Also saved a copy of the intended SDK 58 package.json there. No app source was removed. All move paths were checked to remain in the workspace.
- Verified that every SDK-managed dependency in the remaining app package.json matches Expo 58's bundled compatibility metadata and that no node_modules or package-lock.json remains in the app.
- Immediate next step: user runs `npm install` in `mapeat-starter` from the normal VS Code terminal. Codex's terminal still cannot fetch npm packages. A successful install should recreate node_modules and package-lock.json for SDK 58. Do not use --force or --legacy-peer-deps to skip dependency validation.
- Then inspect versions, run dependency checks, typecheck, lint (tooling still needs installation), and iOS bundle validation. No runtime verification is possible before reinstalling. The recovery folder is temporary; retain it until the new installation is verified.

- User explicitly selected Expo 58. Do not downgrade to SDK 57.
- Updated `mapeat-starter/package.json` to Expo ~58.0.22, React Native 0.88.1, React/React DOM 19.3.0, and matching SDK 58 versions of all existing native modules, using the installed Expo 58 compatibility metadata. Updated @types/react to ~19.3.0, matching Expo 58's development dependency.
- Ran Expo CLI `install --fix --npm` with local SDK metadata and a writable temporary npm cache. It confirmed the SDK 58 package versions but installation failed with EACCES fetching npm packages. package-lock.json and node_modules still need updating; this is a prepared manifest, not a completed upgrade.
- Next: successfully install dependencies, run Expo compatibility checks, typecheck, lint, and verify iOS bundling before restarting phone testing. Lint tooling is still missing; previous typechecks use the older installed dependencies and do not validate the SDK 58 upgrade.
- User reports Expo Go 58 installed on the iPhone. Proceed with SDK 58 and Expo Go testing once installation succeeds. Actual phone launch is still unverified.

### Latest verification after user installation

#### Current blocker: mixed SDK dependencies

- A subsequent inspection found Expo changed to `^58.0.22` (installed 58.0.22), while React Native remained 0.86.3 and the other Expo packages remained on SDK 57. The cause of that change is unknown.
- Expo 58's local `bundledNativeModules.json` expects React Native 0.88.1. Its HMR code imports `react-native/unstable-internals-do-not-use`, which the installed React Native package does not provide; this matches the user's bundling error.
- Restored the requested Expo range in `mapeat-starter/package.json` to `~57.0.31` using Expo CLI. Installation could not complete: npm returned `ENOTCACHED` in offline mode. Installed modules and package-lock.json still contain Expo 58 until the user runs installation in their terminal.
- Next: stop Metro, run `npm install` in `mapeat-starter`, then `npx expo install --fix` to align dependencies, and restart with `npx expo start --go --clear`. If any command fails, inspect that failure before continuing.
- TypeScript still passes, but this does not verify Metro resolution. Lint remains blocked by missing lint dependencies. Phone startup is not yet verified.
- User explicitly asked Codex to run the repair itself. Retried `npm install --no-audit --no-fund` with a writable temporary npm cache and no fetch retries. It failed immediately with `EACCES` while fetching `https://registry.npmjs.org/expo`, confirming this session's network restriction. Dependency alignment and Metro restart were not run because installation must succeed first. This session cannot request sandbox escalation under its managed permission policy.

- User successfully generated `mapeat-starter` and installed dependencies. Files now verified locally: Expo ~57.0.31, React Native 0.86.3, React 19.2.3, TypeScript ~6.0.3, and Expo Router with routes in `src/app`.
- App remains in `mapeat-starter` while phone startup is being resolved; moving it to the workspace root is still pending.
- `npm run ios` attempted the macOS-only iOS Simulator and failed at Xcode detection on Windows. For the physical iPhone, use `npx expo start --go` and scan the QR code with the iPhone Camera.
- Current Expo documentation requires Expo CLI and physical-iPhone Expo Go to use the same Expo account; use `npx expo login` in the user's terminal if needed. Computer and phone should use the same Wi-Fi.
- TypeScript check passed (`node node_modules/typescript/bin/tsc --noEmit`). Lint could not complete because the starter has no ESLint dependencies/configuration and this session cannot reach npm. The attempted automatic dependency installation was stopped and its package.json additions reverted.
- User's install reported 17 dependency vulnerabilities; details and fixes have not been evaluated. Do not blindly apply `npm audit fix --force`.
- Phone launch remains unverified. No product feature has been implemented.

### Earlier setup attempt (superseded by installation above)

- Workspace inspected: only this handoff file exists; no app has been created.
- Terminal reports Node.js v26.13.0 and npm 12.2.0. Git is unavailable on PATH and was not found in common Windows installation locations.
- User confirmed testing on an iPhone with Expo Go already installed.
- User requests questions when information is uncertain; do not treat proposed product decisions as approved.
- Current Expo setup documentation recommends SDK 57 for Expo Go on physical devices during the SDK 58 transition.
- Attempted `npx --yes create-expo-app@latest . --template default@sdk-57 --yes`; it produced no output and was stopped. A direct request to the npm registry failed with “Unable to connect to the remote server”. No starter files were created.
- Next: user runs `npx --yes create-expo-app@latest mapeat-starter --template default@sdk-57 --yes` from the VS Code terminal in this workspace. This is a temporary staging directory to keep the existing handoff safe. After generation, inspect generated instructions, move the starter contents into the workspace root after checking conflicts, verify dependencies and TypeScript, then start Expo. The final project belongs in the workspace root, not a nested folder.
- Phone launch, SDK compatibility on the installed Expo Go version, and first-feature behavior remain unverified.

## Purpose

This document provides context for continuing project management and development in Codex. It summarizes the conversation, distinguishes recommendations from completed work, and defines the next step. Do not assume that code or services have been set up without inspecting the actual project directory.

## Product concept

A personal and shared journal app for documenting restaurants and other places in Israel and abroad. The user and her boyfriend frequently visit restaurants and want to preserve their experiences on a map: place markers, photos, reviews, ratings, and visit dates. The map is the primary screen, complemented by a timeline of experiences.

Example flow: search for a restaurant or select a point on the map, add a visit with a date, rating, notes, and photos, then save. Opening the place later shows its visit history. A return visit must not overwrite an earlier visit.

MapEat is a working name inferred from the mapeat-project folder shown in the screenshot. A final product name has not been approved.

## User preferences

- Choose tools based on their suitability for the product, independently of the user's previous experience.
- Use VS Code instead of Cursor. The initial Cursor recommendation was superseded by the user's preference.
- Continue managing the work in Codex, using AI, agents, and skills.
- Provide practical, incremental guidance explaining each action and its expected result.
- No final visual design or branding has been approved. Interface languages are now confirmed as Hebrew and English, with RTL/LTR support and language switching; first-launch language behavior remains undecided.
- This handoff document is in English at the user's request.

## Verified current status

- The user said she downloaded the suggested tools; installed versions and availability have not been verified through terminal output.
- The latest screenshot shows VS Code on Windows.
- A folder named mapeat-project is open and appeared empty in the Explorer.
- VS Code was in Restricted Mode.
- Instructions were provided to trust the user-created folder, open a terminal, check Node/npm, create an Expo project, and run it.
- There is no confirmation that these commands were executed or that the app opened on the phone.
- There is no confirmation that Codex has been connected to VS Code, or that GitHub, Supabase, Google Cloud, or an Expo account has been configured.
- No application code or database was created during the conversation.

## Proposed first-release scope

| Feature | Behavior |
| --- | --- |
| Map | Show visited places and places on the wishlist |
| Add a place | Search by name or select a point manually |
| Add a visit | Date, one overall rating, notes, and photos; optional time |
| Place details | Show all visits to the same place |
| Timeline | Sort by visit date, including visits entered retrospectively |
| Shared journal | Two separate accounts with access to one shared journal |
| Filters | Visited / want to visit, place category, and rating |

This scope is a proposal, not an approved final specification. Defer separate food/service/atmosphere ratings, expense tracking, statistics, AI recommendations, and full offline support. The first version should handle save failures without losing the user's text.

## Recommended technology stack

| Need | Tool | Notes |
| --- | --- | --- |
| Editor | VS Code | User's choice |
| Development assistance and coordination | Codex | User's latest request |
| Mobile application | React Native + Expo | Recommended direction for iOS and Android |
| Language | TypeScript | Typed models and interfaces |
| Map | react-native-maps with Google Maps | Google Maps support on both platforms |
| Place search | Google Places API | Add later; start with a manually selected location |
| Database | Supabase / PostgreSQL | Journals, users, places, and visits |
| Authentication | Supabase Auth | Separate user accounts |
| Photo storage | Supabase Storage | Private storage with access policies |
| Photo selection | Expo ImagePicker | Photo library and camera |
| Location | Expo Location | Request access when needed |
| Initial device testing | Expo Go | A development build may be needed later |
| Version control | Git + GitHub | Repository connection is not confirmed |
| Design | Figma | Optional; no design has been created |

The proposed direction is a mobile app. A website/PWA was mentioned as an alternative if opening a link without installation becomes the priority. A full standalone backend server is unnecessary initially; Supabase and server functions can handle protected operations. Verify current version compatibility before installing packages.

## Data model principles

A place and a visit are separate entities. One place can have many visits, each with its own date, rating, and photos.

| Proposed entity | Purpose |
| --- | --- |
| User | Account and profile |
| Journal | Journal and its settings |
| JournalMember | Journal membership and access permissions |
| Place | Place identity and source; manually entered information as needed |
| JournalPlace | Link a place to a journal, including wishlist entries |
| Visit | Journal, place, author, visit date, rating, and notes |
| Photo | File associated with a visit |

- Store the visit date separately from the record creation timestamp.
- Protect records and photos through service-side permissions, including Row Level Security. Hiding UI elements is not access control.
- Journals and photos are private by default in the proposed design.
- Separate user-created content from information returned by a place provider.
- Google Places restricts content storage and display. Place IDs may be stored under its policies; do not assume every place detail may be stored permanently. Review the policies before integration.
- Do not combine another provider's map with Google Places results without checking the applicable restrictions. Google Maps was the recommended provider.
- Keep server secrets out of client code and source control. Restrict map API keys appropriately for each platform.

## Proposed roadmap

1. **Brief specification:** Define screens, fields, privacy, and sharing behavior. Deliverable: a complete add-and-view-visit scenario.
2. **Design:** Map, place card, visit form, and timeline. Deliverable: a flow that can be reviewed.
3. **Technical foundation:** App, authentication, database, and journal. Deliverable: a user can access their journal.
4. **First working flow:** Manual location, date, rating, and notes. Deliverable: a saved visit remains available after closing and reopening the app.
5. **Search and photos:** Places integration, uploads, and place details. Deliverable: document a real visit end to end.
6. **Sharing and timeline:** Second user, history, and filters. Deliverable: both users access the same journal from separate phones.
7. **Real-world testing:** Permissions, weak connectivity, upload failures, and repeat visits.
8. **Beta and refinement:** Distribute a test build and improve it based on actual usage.

A small technical test on a phone can precede the completed design. No binding estimate or deadline has been established.

## Next step in Codex

Inspect the actual workspace first. Do not recreate the project or overwrite existing files without inspecting them.

1. Inspect mapeat-project for package.json, source code, and project instructions.
2. Check Node.js, npm, and Git versions.
3. If a project exists, identify its Expo version, folder structure, and installation status, then continue from there.
4. If the folder is empty, create an Expo project with TypeScript after checking current Expo guidance and compatibility with Expo Go on the phone.
5. Start the development server and help the user open the starter screen on her phone.
6. Once the app runs successfully, proceed to the first feature and the required service connections.

These commands were suggested in the conversation, but execution has not been confirmed:

```bash
node -v
npm -v
git --version
```

From the empty project directory only:

```bash
npx create-expo-app@latest .
```

After creating the project:

```bash
npx expo start
```

The dot represents the current directory. Do not create an additional places-journal folder: that was an earlier example name; the actual folder opened by the user is mapeat-project.

For initial iPhone testing, connect the computer and phone to the same Wi-Fi network, scan the QR code with the camera, and open it in Expo Go. If the network connection fails, a tunnel can be considered after diagnosing the issue:

```bash
npx expo start --tunnel
```

## Working with AI, agents, and skills

- Work in small features: define behavior, implement, verify, and summarize.
- An agent can implement or review a task; a skill is a reusable workflow with instructions and resources.
- There is no need to install several AI tools to get started. Codex is now the requested tool.
- Suggested roles: specification, implementation, code review, and testing. These can run sequentially; parallel work can be introduced later for independent tasks.
- Potential future skills: adding a consistent screen, changing the database with access policies, and testing features and edge cases.
- No project-specific skills were created or installed during the conversation.
- Do not assume a subscription or active tool connection exists merely because VS Code displays a chat panel.

## Acceptance criteria for the first feature

Task: add a visit with a date, rating, and notes to a point on the map, then see it again after reopening the app.

- The user can select a point and manually name the place.
- The user can enter and save a visit with basic input validation.
- A marker appears on the map, and selecting it displays the visit.
- Data persists across app sessions; temporary in-memory data alone does not satisfy completion.
- The user can add another visit to the same place without overwriting the previous one.
- Save failures are shown clearly, and entered text is retained.
- If accounts are already implemented, a user who is not a journal member cannot read or modify that journal's content.

## Open decisions

- Resolved: both Hebrew and English. First-launch language selection remains open.
- Visual design and final product name.
- Resolved: separate ratings and notes from each person on one shared visit. Remaining review behavior is tracked in the design document.
- Resolved: 1–10 rating scale. Whole-number versus fractional increments remain open.
- Resolved: shared journal only; no personal journals in the first release.
- Resolved budget direction: free services first. Audience is the couple only; private distribution method and cost-related tradeoffs remain open.

These decisions should not delay verifying that the app runs. Resolve each decision before implementing the part that depends on it.

## Technical references mentioned in the conversation

- [Expo — react-native-maps](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Expo — ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Expo — Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Supabase — Getting started](https://supabase.com/docs/guides/getting-started/the-supabase-way-to-build)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google Places — Policies](https://developers.google.com/maps/documentation/places/web-service/policies)

## Starter prompt for Codex

> Read MAPEAT_CODEX_HANDOFF.md and use it as project context. First inspect the actual files and installation status, and briefly summarize what already exists. Continue from the appropriate stage toward an Expo app running on my phone. Do not assume the documented commands have already been executed, and do not create another project if one already exists. Once the app runs, guide me through the first feature in small steps, with explanations in Hebrew and appropriate checks. Keep the progress documentation updated so we can continue in a future session.
