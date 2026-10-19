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

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run format   # rewrite files with Prettier
```

## Bundle identifier

`com.labelwise.app` in `app.json` is a placeholder. Change it to a reverse-domain ID you own before any App Store submission.

## Dependencies

- `expo`, `react`, `react-native`: app runtime (Expo SDK 58).
- `expo-router`: file-based navigation in `app/`.
- `expo-linking`, `expo-constants`, `react-native-screens`, `react-native-safe-area-context`: required by Expo Router.
- `react-dom`: optional peer of Expo Router, pinned to match `react` so npm can resolve the tree.
- `expo-status-bar`: status bar colour following light/dark mode.
- `jest`, `jest-expo`, `@types/jest`: unit tests.
- `@testing-library/react-native`: screen tests.
- `eslint`, `eslint-config-expo`: linting.
- `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`: formatting, enforced through lint.
- `typescript`, `@types/react`: strict type checking.

## Data and licence

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) and is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Labelwise is not affiliated with or endorsed by Open Food Facts or FSSAI.

App code is MIT licensed (see `LICENSE`). OFF data and fixtures derived from it remain under ODbL.
