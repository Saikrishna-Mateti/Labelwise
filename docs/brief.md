# Prompt for Claude Code: Build the Labelwise MVP

Paste everything below the line into Claude Code, run from an empty project folder on your Mac.

---

You are building **Labelwise**, an iOS-first mobile app that lets people in India scan the barcode on a packaged food product and instantly see how healthy it is, with clear reasons. Think of the French app Yuka, but for products sold in India, using Open Food Facts data and India-relevant scoring.

Work in milestones. Finish each one, run its checks, commit, and give me a short summary before starting the next. If anything in this brief is ambiguous or you would have to guess a number, a threshold or a legal claim, stop and ask me instead of inventing it.

## 1. Context you must design around

- I am a full-stack developer working on a Mac (Apple Silicon) with Xcode installed. I will test in the iOS simulator and on a physical iPhone. Android comes later, so keep the code cross-platform where it costs nothing.
- Data source is **Open Food Facts (OFF)**, via its public API. I ran a coverage test on 500 Indian-barcode (890-prefix) products: only about 14% had the five nutrition fields needed to score a product (energy, sugars, saturated fat, salt or sodium, protein). About 75% had no nutrition data at all, and roughly a quarter had no product name. So **"we don't have enough data for this product" will be a very common result**. It is a core screen, not an error case. The path from that screen to adding data yourself (manual entry first, label photo later) is a core feature.
- Some Indian-barcode records in OFF are not food (cosmetics, medicine, supplements, alcohol). Handle this gracefully.
- OFF data is under the ODbL license: attribution is required wherever its data is shown, and databases combined with OFF data must stay open. Keep user-entered data in its own local store, separate from OFF data.
- India's front-of-pack labelling rules are still being decided. FSSAI's 2022 draft "Indian Nutrition Rating" (INR, 0.5 to 5 stars) is public, but FSSAI has reportedly moved toward a warning-label model. Treat INR as a **draft-based method** and keep scoring methods swappable.

## 2. Tech stack (use exactly this unless you tell me why not)

- React Native with **Expo (development builds, not Expo Go)**, TypeScript in strict mode, Expo Router for navigation.
- Barcode scanning with `react-native-vision-camera` code scanner (EAN-13, EAN-8, UPC-A), or `expo-camera` if Vision Camera causes problems. Say which you chose and why.
- Data fetching: TanStack Query. Local storage: `expo-sqlite` (scan history, cached products, user-entered nutrition data).
- Tests: Jest (plus React Native Testing Library for a few screens). Lint and format: ESLint and Prettier.
- No backend, no accounts, no analytics, no ads in the MVP. Do not add any.
- Before installing any library, check that it is currently maintained and compatible with the current Expo SDK. Pin versions.

## 3. Project structure

```
app/                  Expo Router screens
src/
  scoring/            PURE TypeScript. No React, no Expo, no network imports.
    types.ts          NutritionPer100, ScoreResult, ScoringMethod interface
    inr.ts            Indian Nutrition Rating (draft-based)
    nutriscore.ts     Nutri-Score (2023 algorithm)
    nova.ts           NOVA from OFF value, else estimated from ingredients
    reasons.ts        Turns score inputs into human-readable pros and cons
    __tests__/
  data/
    offClient.ts      OFF API v2 client
    db.ts             SQLite schema and queries
    normalize.ts      OFF response -> internal Product type
  features/           scan, product, history, manual-entry
  components/
  theme/
tools/                coverage script (I will add off_india_coverage.py here)
README.md
CLAUDE.md             project conventions (create this in Milestone 0)
```

Every scoring method implements one interface, `ScoringMethod`, so methods can be added, swapped or removed without touching the UI. Scoring functions must be deterministic and unit-tested.

## 4. Milestones

### Milestone 0: Project setup

- Create the Expo TypeScript project, configure ESLint, Prettier, Jest, strict TypeScript.
- Write `CLAUDE.md` (conventions: scoring stays pure, never invent thresholds, run typecheck + lint + tests before saying "done", small commits) and a `README.md` with exact commands to run on the simulator and on a device (`npx expo run:ios`, `npx expo run:ios --device`).
- Use bundle identifier `com.labelwise.app` as a placeholder and tell me it needs changing before App Store submission.
- Done when: the app launches in the simulator showing a placeholder home screen, and `npm test`, `npm run lint` and `npm run typecheck` pass.

### Milestone 1: Scoring engine (no UI)

Implement and test these in `src/scoring/`:

1. **INR.** Fetch the draft regulation from `https://comments.fssai.gov.in/Bestviewwl.aspx?NOTIFICATION_ID=4123` (Schedule III, tables for baseline reference values and the points-to-stars conversion for solid and liquid foods). Implement it **exactly as written**: the four risk factors (energy, total sugars, saturated fat, sodium, per 100 g or 100 ml), the positive components (fruit and vegetable content, nuts/legumes/millets, fibre, protein), separate solid and liquid tables, and the stars mapping. Confirm the units used in the draft (kJ vs kcal, sodium in mg vs g) and convert OFF values correctly. **If you cannot access or parse the tables, stop and ask me to supply the PDF. Do not reconstruct thresholds from memory.** Where an input is missing (for example fruit/vegetable percentage), say so in the result instead of silently assuming zero, and mark the score as "estimated".
2. **Nutri-Score (2023 algorithm).** Implement from the official specification, including the separate handling of beverages, fats/oils and cheese if the spec requires it. If OFF already provides `nutriscore_grade`, the app displays that value and uses your implementation only when OFF has none. Write a test that compares your implementation with OFF's grade on fixture products and reports mismatches.
3. **NOVA.** Use OFF's `nova_group` when present. Otherwise estimate from the ingredient list with a transparent rule set (for example, flag markers of ultra-processing such as flavours, emulsifiers, maltodextrin, hydrogenated oils, certain sweeteners and colours). The result must carry `source: "off" | "estimated"` and the UI must label estimates as estimates.
4. **Reasons.** For each result, produce a short list of pros and cons ("High in sugar", "Good source of protein") derived from the same inputs. Never show a score without reasons.

Output type for every method: `{ method, value, band, source, missingInputs, reasons }`. Unit tests must cover missing inputs, boundary values, solid vs liquid, and units conversion. Use realistic fixtures (for example from the OFF sample rows I will provide in `tools/`).

Done when: all scoring tests pass, and a small CLI script (`npm run score -- <barcode>`) fetches one OFF product and prints all scores and reasons.

### Milestone 2: Data layer

- `offClient.ts`: call `GET https://world.openfoodfacts.org/api/v2/product/{barcode}?fields=...` requesting only the fields you need. Always send a custom `User-Agent` such as `Labelwise/0.1 (contact: <my email placeholder>)`. Respect OFF rate limits, handle `status: 0` (not found), timeouts and offline.
- Normalize UPC-A and EAN-8 inputs sensibly before lookup. Handle the occasional malformed or non-13-digit code without crashing.
- `db.ts`: SQLite tables for scan history, cached OFF products (with timestamp and a sensible refresh policy), and **user-entered nutrition data in a separate table**.
- A resolver that, for a barcode, returns the merged view: user-entered values override missing OFF values, and every value is tagged with where it came from (`off` or `user`).
- Done when: unit tests with a mocked OFF client cover found, not found, partial data, offline with cache, and user override.

### Milestone 3: Core screens

1. **Scan screen:** camera barcode scanner, plus a visible "type a barcode" field (essential for simulator testing). Handle camera permission denied with a clear message. Haptic feedback on a successful scan.
2. **Product screen:** name, brand, image if available, the primary score (INR, with the 0.5 to 5 star display), Nutri-Score as a secondary badge, NOVA badge (labelled "estimated" when it is), the reasons list, and a collapsible nutrition table per 100 g. Show the vegetarian/non-vegetarian label if OFF provides it. Show **"Data © Open Food Facts contributors (ODbL)"** with a link to the product's OFF page on this screen.
3. **Not-enough-data screen:** explain plainly what is missing and offer "Add nutrition info" (goes to manual entry). Product not found at all gets its own wording.
4. **History screen:** past scans from SQLite, tap to reopen, swipe to delete.
5. **Settings/About:** choose primary score method (INR default, Nutri-Score alternative), attribution and licence text, disclaimers (see section 5).

- Done when: I can type a barcode in the simulator and reach a product, a not-enough-data screen and history, and I can scan a real barcode on my iPhone.

### Milestone 4: Manual entry

- Form for the nutrition values per 100 g (energy, sugars, saturated fat, salt or sodium, fibre, protein, and optionally fruit/veg %), unit hints, ingredient text, and product type (solid or liquid). Validate ranges.
- Saving stores to the user-entered table and immediately recomputes the score.
- Done when: an empty product becomes scorable after I enter its values, and the product screen shows which values are mine.

### Milestone 5: Label photo OCR (prefill only)

- Let me photograph a nutrition table, run **on-device** text recognition (ML Kit based library; check current maintenance), parse the numbers into the manual-entry form as suggestions, and **always require me to review and confirm** before saving. Never auto-save OCR output. Photos stay on the device.
- Handle Indian label formats (per 100 g, per serving, "Energy (kcal)", salt vs sodium). If you cannot reliably parse something, leave the field empty rather than guessing.
- Done when: a photo of a typical Indian nutrition table prefills at least energy, sugars, fat, saturated fat, protein and salt in most clear photos, with the review step enforced.

### Phase 2 (do NOT start unless I ask)

Additive flags by INS number (only with a sourced data file), contributing user data back to OFF, a backend, Android, accounts, healthier-alternative suggestions.

## 5. Legal, safety and copy rules

- Show a short disclaimer in About and under scores: scores are informational and not medical or dietary advice.
- State that Labelwise is **not affiliated with or endorsed by FSSAI or Open Food Facts**. Do not use the FSSAI logo or imply official status. Label INR as based on a **draft** FSSAI proposal.
- Do not make health claims about specific brands beyond what the score and listed values show.
- Requested camera permission strings must say plainly why the camera is used.
- Privacy: no accounts, no tracking, scan history and photos stay on the device.

## 6. UX and design

- Clean, calm, high-contrast. Score bands use color **and** an icon or label, never color alone. Support dark mode and Dynamic Type.
- A scan should feel fast: show a skeleton while loading, and open cached products instantly.
- Plain language. Avoid jargon; explain INR, Nutri-Score and NOVA in one sentence each on tap.

## 7. Working agreements

- Use git from the start. Small commits with clear messages, one milestone per branch or tag.
- Before saying a milestone is done: run typecheck, lint and tests, and launch the app in the simulator.
- Never invent nutrition thresholds, scoring tables or additive data. If a source is unreachable, stop and ask.
- Do not scrape websites or call OFF write endpoints. Read-only API use only, with the custom User-Agent.
- Keep dependencies minimal and explain each one you add in one line in the README.
- At the end of each milestone, give me: what changed, how to test it (exact commands and taps), and anything you want me to decide.

Start with Milestone 0, then stop and summarize.
