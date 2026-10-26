# Labelwise

Being smart about what’s on the label.

Scan a packaged food barcode sold in India and see how healthy it is, with reasons. iOS first, built with Expo.

## Requirements

- macOS with Xcode (from the App Store) and its iOS Simulator.
- Node 20.19+ (tested on 22).

## Run

```sh
npm install
npx expo run:ios            # build and launch in the iOS Simulator
npx expo run:ios --device   # build and install on a connected iPhone
```

This uses a development build, not Expo Go. The first run generates `ios/` and takes a few minutes.

On a physical iPhone, pick your Apple ID team in Xcode signing the first time (open `ios/labelwise.xcworkspace`).

## Try it in the simulator

The simulator has no camera, so type a barcode on the scan screen:

- `8901719101038` (Parle-G): rated product
- `8901058000290` (Maggi): rated by Nutri-Score only; the Indian Nutrition Rating needs values per 100 g as sold
- `8902080104581` (Pepsi): a drink, rated with the liquid tables
- `8900000000001`: not found

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run format   # rewrite files with Prettier
```

Route types come from `.expo/types`, which Expo generates when the dev server starts. On a fresh clone, run `npx expo start` once before `npm run typecheck`.

## Score a product from the command line

```sh
npm run score -- 8901719101038
```

Fetches the product from Open Food Facts and prints the Indian Nutrition Rating (based on the FSSAI **draft** proposal), Nutri-Score and NOVA with reasons. Sources and interpretation decisions: `docs/sources/README.md`.

## Bundle identifier

`com.labelwise.app` in `app.json` is a placeholder. Change it to a reverse-domain ID you own before any App Store submission.

## Dependencies

- `expo`, `react`, `react-native`: app runtime (Expo SDK 58).
- `expo-router`: file-based navigation in `app/`.
- `expo-linking`, `expo-constants`, `react-native-screens`, `react-native-safe-area-context`: required by Expo Router.
- `react-dom`: optional peer of Expo Router, pinned to match `react` so npm can resolve the tree.
- `expo-status-bar`: status bar colour following light/dark mode.
- `expo-camera`: barcode scanner (EAN-13, EAN-8, UPC-A). Chosen over react-native-vision-camera because it ships with each Expo SDK and covers these barcode types.
- `expo-image-picker`: takes or picks the photo of a nutrition label (camera or library) for the entry form.
- `expo-text-extractor`: on-device text recognition for that photo (Apple Vision on iOS, ML Kit on Android). Chosen because it is small, offline and has no cloud step, so photos never leave the phone.
- `expo-haptics`: vibration on a successful scan.
- `expo-glass-effect`: Liquid Glass for the torch button over the camera (iOS 26+, solid fallback elsewhere and with Reduce Transparency).
- `expo-image`: product photos from Open Food Facts, with caching.
- `@tanstack/react-query`: loading and error states for product lookups and history.
- `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`: swipe to delete in history (already required by Expo Router, now listed directly).
- `expo-sqlite`: on-device storage for scan history, the Open Food Facts cache and user-entered nutrition.
- `jest`, `jest-expo`, `@types/jest`: unit tests.
- `@testing-library/react-native`: screen tests.
- `eslint`, `eslint-config-expo`: linting.
- `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`: formatting, enforced through lint.
- `typescript`, `@types/react`: strict type checking.
- `tsx`: runs the TypeScript CLI in `tools/` under Node.
- `@types/node`: types for Node's built-in SQLite, which the data-layer tests use in place of the native module.

## Data and licence

Product lookups are read-only `GET` requests to the Open Food Facts API v2, sent with the User-Agent `Labelwise/0.1 (saikrrish321@gmail.com)`. Results are cached on the device for 7 days. Nutrition you enter yourself is stored in its own table and never leaves the device.

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) and is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Labelwise is not affiliated with or endorsed by Open Food Facts or FSSAI.

App code is MIT licensed (see `LICENSE`). OFF data and files derived from it remain under ODbL: test fixtures in `src/scoring/__tests__/fixtures/` and the additive names in `src/data/off-additives.json` (from the OFF additives taxonomy).
