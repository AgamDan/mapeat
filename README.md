# MapEat

A private, shared restaurant journal for one couple: a map of real restaurants, dated visits with each person's own 1–10 review, photos, a shared wishlist, and a timeline.

Status: planning. The app is still the Expo SDK 58 starter; no journal features are implemented yet. See [docs/](./docs/README.md).

## Layout

- `src/` — app source (Expo Router routes in `src/app/`, plus `components/`, `hooks/`, `constants/`)
- `assets/` — images and icons
- `docs/` — product spec, research, and status log ([index](./docs/README.md))

## Run

Requires Node.js and the Expo Go app on an iPhone on the same Wi-Fi network.

```powershell
npm ci                  # install dependencies from package-lock.json
npx expo start --go     # then scan the QR code with the iPhone Camera
npx tsc --noEmit        # typecheck
```

Add packages with `npx expo install <package>`, not `npm install <package>`.
