# Labelwise — UI Design Spec

Implementation spec for the Labelwise redesign (iOS-first, React Native). Screenshots of every screen are in the same folder as this file; this document gives the exact values the images can't. If an image and this file disagree on a number, this file wins.

**Product:** scan a packaged Indian food product (barcode or label) and show one clear verdict plus details on demand.
**Data:** Open Food Facts. Ratings combined: Nutri-Score, India rating (FSSAI-based, draft), NOVA.
**Tone:** calm, trustworthy, health-tool. Not diet-culture. Neutral wording ("high in sodium", never "toxic"/"bad").
**Core goal:** the user understands "Is this good for me?" within 2 seconds of a scan, without reading.

## Screens (see images)

The designs are exported as five PDFs in this folder. Each PDF holds several screens; the artboard titles are printed on each page.

| File | Screens inside |
|---|---|
| `scan.pdf` | 1 Scan (barcode), 1b Scan (label, no barcode), 1c Type a barcode / search |
| `result_high-low.pdf` | 2 Result, high score (full scroll), 2b Result, low score (full scroll, alternatives above details), 3 Ingredient detail sheet |
| `loadingState-errorState.pdf` | 6a Found, loading; 6b Product not found; 6c No internet; 6d Poor lighting |
| `history-darkMode.pdf` | 4 History and saved, 5 Profile and preferences, 2 Result in Dark Mode |
| `design_system.pdf` | Color tokens, Type and spacing, Components |

If a screen isn't in the PDF listed here, check the neighbouring PDFs by its title (for example, the ingredient sheet or profile may have landed in a different file). The text below is the source of truth for every value.

All sample values (scores 86 / 32, the noodle product, history items, additive concern levels) are **placeholder data** for layout only.

## Color tokens

One accent only. Score colors are semantic. Never use color alone: every score carries a glyph and a word.

### Core

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F6F6F3` | `#1A1B1D` | Screen / sheet background (dark is soft charcoal, not pure black) |
| `surface` | `#FFFFFF` | `#25272A` | Cards, rows, chips |
| `fill` | `#EFEFEC` | `#2E3034` | Icon buttons, placeholders |
| `border` | `#E2E2DE` | `#3A3D41` | 1 pt card borders, separators |
| `text` | `#1C1C1E` | `#ECECEA` | Primary text |
| `textSecondary` | `#5E6166` | `#A5A8AD` | Secondary text |
| `textTertiary` | `#6E7176` | `#8E9196` | Chevrons, fine print (4.5:1 minimum) |
| `accent` | `#0E6B4E` | `#5DBB93` | Primary buttons, links, selection |
| `accentTint` | `#E3F0EA` | `#1E3229` | Secondary button, selected chip |
| `onAccent` | `#FFFFFF` | `#0F1A15` | Text on accent |

Camera screens use a fixed dark overlay: `rgba(20,20,20,0.55)` controls with a `rgba(255,255,255,0.18)` 1 pt border, white text, and `#7FD3A2` for the active tab.

### Score tiers

| Tier | Range | Word | Glyph | Ring (light / dark) | Tint (light / dark) | Foreground (light / dark) |
|---|---|---|---|---|---|---|
| Great | 75–100 | Great choice | check | `#2E8A66` / `#5DBF85` | `#E5F2E9` / `#1F3328` | `#1D6A41` / `#7FD3A2` |
| Moderate | 50–74 | Fine in moderation | dash | `#C28A12` / `#E8B84A` | `#FAF0D7` / `#3A3020` | `#7A5600` / `#F0C565` |
| Occasional | 25–49 | Eat occasionally | exclamation | `#D06A2A` / `#EE9459` | `#FCE7D8` / `#3D2A1E` | `#9A4511` / `#F4A472` |
| Rare | 0–24 | Eat rarely | triangle | `#B8463F` / `#E2766D` | `#F8E2DF` / `#3E2423` | `#9C2F28` / `#F0948C` |

- Foreground on tint is at least 5.4:1 (light) and 6.3:1 (dark). Ring on surface is at least 3:1.
- Tiers also differ in lightness (amber lightest, red darkest) so they survive greyscale. Green and orange converge under red-green color blindness, so glyph + number + word are mandatory everywhere a score appears.
- The score thresholds above are a proposal. The scoring formula itself (how Nutri-Score, India rating and NOVA combine into 0–100) is owned by the app, not this spec.

### Nutrient status pills

Same tint/foreground pairs as the tiers: **Low** and **Good** use Great; **Moderate** uses Moderate; **High** uses Occasional; **Unknown** uses `fill` + `textSecondary` (no glyph).

## Typography

System font (SF Pro). Use iOS text styles so Dynamic Type works. Three weights only: Regular 400, Semibold 600, Bold 700.

| Style | iOS name | Size / leading | Weight | Used for |
|---|---|---|---|---|
| Large Title | `.largeTitle` | 34 / 41 | Bold | Tab screen titles |
| Title | `.title2` | 22 / 28 | Bold | Product name, sheet and state titles |
| Headline L | `.title3` | 20 / 25 | Semibold | Verdict, section headings |
| Headline | `.headline` | 17 / 22 | Semibold | Row titles, buttons, values |
| Body | `.body` | 17 / 22 | Regular | Row labels, explanations |
| Subheadline | `.subheadline` | 15 / 20 | Regular | Chips, brand, verdict line |
| Footnote | `.footnote` | 13 / 18 | Regular / Semibold | Captions, status pills, group labels |
| Caption | `.caption2` | 11 / 13 | Semibold | Tab labels, "of 100" |
| Score numeral | custom | 32 / 34 | Bold, tabular figures | Score number; scale relative to `.title` |

In React Native: do not set fixed `fontSize` without `allowFontScaling` (default true). Cap with `maxFontSizeMultiplier` only on the score ring and tab labels. Rows must grow with text; never fix a row height that can truncate.

## Spacing, shape, elevation

8 pt grid.

| Token | pt | Use |
|---|---|---|
| `xxs` | 4 | Glyph to label |
| `xs` | 8 | Chip gap, button group |
| `sm` | 12 | Icon to text in rows |
| `md` | 16 | Row/card padding |
| `lg` | 20 | **Screen side margins**, score card padding |
| `xl` | 24 | Between groups |
| `2xl` | 32 | Between sections |
| `3xl` | 40 | Bottom of scroll |

Radii: 16 cards and grouped lists; 14 buttons and product image; 10 thumbnails and segmented control; capsule for chips, pills, tab bar; sheets use the system corner.
Separation is a 1 pt `border`, never a shadow. No gradients. No decorative illustrations.
Tap targets are at least 44 × 44 pt even when the visual is smaller (chips draw at 34 pt tall with a 44 pt hit area via `hitSlop`).

## Components

### ScoreRing
- 92 pt, stroke 8 pt, round cap, arc starts at 12 o'clock and runs clockwise. Track = tier tint, arc = tier ring color.
- Centered: score numeral (32 Bold) over "of 100" (11, `textSecondary`).
- Beside it: tier glyph (20 pt filled circle with white mark, triangle for Rare) + verdict word (20 Semibold, tier foreground) + one-line reason (15, `textSecondary`).
- Whole card: `surface`, 1 pt `border`, radius 16, padding 20.
- Accessibility: one element, label "Score 86 of 100, great choice".
- Motion: ring and number count up together, 300 ms ease-out. With Reduce Motion, show the final value immediately.

### ScoreBadge (history rows, alternative cards)
Capsule, 28 pt tall, 10 pt horizontal padding, tier tint fill, tier foreground text 15 Semibold, 12 pt tier glyph then the number, tabular figures.

### HighlightChip
- Capsule, 34 pt tall, 12 pt padding, `surface` fill, 1 pt `border`, text 15 `text`, 14 pt glyph in the tier ring color (the glyph carries the color; the chip stays neutral).
- Max 4 chips, concerns first then positives, wrap to a second line.
- Tap scrolls to and briefly highlights the matching nutrition row.
- Wording examples: "High sodium", "High saturated fat", "Ultra-processed", "Low sugar", "Good protein", "Unprocessed". Never "toxic", "bad", "unhealthy".

### NutritionRow
- 48 pt minimum height, separators 1 pt `border`. Left: label (17). Right: value (17 Semibold) then a 96 pt-wide status pill (26 pt tall, capsule, 13 Semibold, 12 pt glyph).
- Statuses: Low · Moderate · High · Good · Unknown. "Unknown" is used when the value needed for the check is missing (for example added sugar not listed on the pack).
- Rows in order: Energy, Saturated fat (or Sodium for noodles-type products), Sugars, Added sugar, Protein. Show per 100 g.
- At accessibility text sizes the pill moves below the value.
- Footnote under the table: "Levels use ICMR-NIN 2024 limits where they exist (energy 250 kcal, added sugar 3 g), otherwise standard per-100 g bands." Followed by a "Full nutrition table" link row.

### SectionRow (accordion)
- 52 pt minimum, icon 20 pt in `accent`, title 17 Semibold, a right-aligned summary (15, `textSecondary`) that answers the question without opening, chevron 14 pt in `textTertiary`.
- Sections in order: Nutrition (open by default), Ingredients, Allergens, Processing, All ratings. All live inside one card (`surface`, 1 pt `border`, radius 16).
- If a product contains an allergen from the user's profile, the Allergens summary becomes a warning line and the warning also appears above the score card, outside any collapsed section.
- `accessibilityState={{ expanded }}`. Animate height + chevron rotate, 250 ms.

### IngredientRow
Ingredient name (17) with INS code and function underneath (13, `textSecondary`), a concern pill (Low concern / Some concern; same pill spec, 26 pt tall) and a chevron. Tapping opens the Ingredient sheet. Concern levels are neutral wording for information only: Low concern, Some concern, Higher concern.

### AlternativeCard
148 pt wide, `surface`, 1 pt `border`, radius 16. 92 pt image area (`fill` when no photo), name 15 Semibold (2 lines, 40 pt), ScoreBadge. Horizontal scroll, next card peeks. Show only same-category products scoring at least 10 points higher. When the score is under 50 the "Better alternatives" section moves above the detail card; otherwise it sits below. If none exist: "Nothing in this category scores higher yet." plus a "See similar products" link.

### Buttons
- Primary: 50 pt, radius 14, `accent` fill, `onAccent` 17 Semibold. One per screen.
- Secondary: 50 pt, radius 14, `accentTint` fill, `accent` text.
- Tertiary: 44 pt, text only, `accent`.
- Icon button: 44 × 44 circle, `fill` background, 18 pt icon.
- Pressed: 0.85 opacity. Disabled: `fill` background, `textTertiary` text.

### Bottom sheet
- Use a native-feeling sheet with a visible grabber (36 × 5, `#C9C9C4` light / `#4A4D52` dark).
- Result sheet opens at the medium detent with the skeleton, then expands to large when data arrives. Swipe down or the chevron button returns to the live camera.
- Ingredient sheet: title 22 Bold, subtitle 15 `textSecondary`, close button 44 pt, a three-segment concern meter (Low / Some / Higher, active segment `#C28A12` for "Some", with its label also shown in text), then "What it is", "What's known", "Often found in" (headings 17 Semibold, body 17 Regular), and a "Sources" line with a link.

### Tab bar
- Tabs: **Scan · History · Profile** (About moves inside Profile).
- Use the platform tab bar (on iOS 26 it is the floating glass pill). Don't hand-draw it in production; the mockup only approximates it.
- Over the camera it uses the dark material; elsewhere the light one. Active item uses `accent` and a `fill` capsule behind it.
- 22 pt icons, one stroke weight (1.8), 11 pt Semibold labels. In production use SF Symbols (iOS) with a consistent weight.

## Screen layouts (top to bottom)

### 1. Scan (barcode)
Full-bleed camera under everything, including under the tab bar and status bar. Dark scrim at 28% for legibility.
1. Torch button, top-right, 44 pt, labeled "Torch, on/off" (icon alone is not enough for VoiceOver). Active state: 2 pt `#7FD3A2` ring.
2. Hint capsule "Point at the barcode" above the frame, `rgba(20,20,20,0.6)`, 15 text.
3. Scan frame: 280 × 164, four white corner brackets (4 pt stroke, 16 pt corner radius, 34 pt arm length). No full outline.
4. Segmented mode switch below the frame: **Barcode | Label**.
5. "Type a barcode or search" pill button (44 pt tall) opening the manual entry sheet. This replaces the always-visible text field and giant "Look up" button.
6. Floating tab bar.

### 1b. Scan (label)
Same shell. Frame becomes a tall portrait rectangle (260 × 340). Hint: "Fit the nutrition table in the frame", with "Step 1 of 2 · then the ingredients list". A 72 pt shutter button replaces the manual entry pill. Flow: nutrition table photo, then ingredients photo, then on-device text recognition, then the same Result screen with a small "Estimated from label" note.

### 1c. Type a barcode or search
Medium-detent sheet over the dimmed camera. Title "Find a product", Cancel (text button). Segmented **Barcode | Name**. Label "Barcode number", numeric field 50 pt tall with a 2 pt `accent` border when focused and a live digit counter ("12 of 13 digits"). Primary "Look up" button. Below, a "Recent" list of two rows with ScoreBadges.

### 2. Result
Large-detent sheet over the camera. Top to bottom:
1. Grabber; close (chevron), Save (bookmark), Share. All 44 pt.
2. Header: 84 pt product photo (radius 14, 1 pt border) beside name (22 Bold), brand (15, `textSecondary`) and the veg mark + "Vegetarian, per pack" (13).
3. ScoreRing card (see component). **This is the answer; it must be fully visible without scrolling on a 6.1" phone.**
4. HighlightChips row (up to 4).
5. One caption line: "Combines Nutri-Score A, India rating 4★ (draft) and NOVA 1" with a "How it's scored" link on the right (44 pt hit area).
6. Detail card with the SectionRows (Nutrition open; others collapsed).
7. "Better alternatives" (above the detail card when score under 50).
8. Footer: disclaimer "Scores are for information only and aren't medical or dietary advice." (13), links "View on Open Food Facts ↗" and "Report a problem with this product", then barcode and "Data © Open Food Facts contributors (ODbL)" (12, `textTertiary`).

Keep the "draft" label on the India rating inside the "How it's scored" explainer only, not on the main result.

### 3. Ingredient sheet
See Bottom sheet. Opens at the medium detent over the dimmed result.

### 4. History
Large Title "History". Search field (40 pt, `fill`). Segmented **All scans | Saved**. Horizontally scrolling filter chips: All, Great, Moderation, Occasionally, Rarely (each with its tier glyph; selected = filled `text` color capsule). Date-grouped lists (Today, Yesterday, Earlier) in rounded cards. Row: 44 pt thumbnail (radius 10), name 17, brand + time 13 `textSecondary`, saved bookmark glyph if saved, ScoreBadge. Row min height 64. Swipe: save / delete.

### 5. Profile
Large Title "Profile" with one line "These adjust your scores and highlight what matters to you."
- **Diet:** switches for Vegetarian, Vegan, Jain (Jain subtitle: "Flags onion, garlic and root vegetables").
- **Allergies:** wrap of toggle chips (Peanuts, Tree nuts, Milk, Gluten, Soy, Sesame, Egg, Fish, Crustaceans, Sulphites). Selected chip: `accentTint` fill, 1.5 pt `accent` border, check glyph, `accent` text.
- **Health goals:** switches for Diabetes-friendly (flags added sugar and refined flour) and Low sodium (flags above 600 mg per 100 g), with the note "Not medical advice. Ask a doctor or dietitian about a medical diet."
- **App:** Appearance (System/Light/Dark), How scores work, About and data sources.
Switch: 51 × 31, on = `accent`, off = `border`. Profile settings change which chips appear and can lower or raise the score; the allergen warning is a hard flag regardless of score.

### 6. States
- **Loading:** frame turns `#7FD3A2` with a check, sheet opens medium with skeleton blocks in the exact layout of the result (photo, two text lines, ring, chips). Status line "Looking up 8901491103794…" (`role=status`). Target: skeleton within 300 ms of lock.
- **Not found:** icon in a 56 pt `fill` circle, title "We couldn't find this product", body "Barcode … isn't in Open Food Facts yet. You can still get a score from the label.", Primary "Scan the label instead", Secondary "Add it to Open Food Facts", tertiary "Scan something else". `.warning` haptic, no shake.
- **Offline:** "Offline" status capsule at the top, title "You're offline", body "We saved barcode … and will look it up when you're back online. Saved products still open.", Primary "Try again", Secondary "Open history". Queue the barcode locally and resolve automatically on reconnect.
- **Poor lighting:** shown after about 2 s with no detection and low ambient brightness. Hint "Too dark to read the barcode", frame dims to 60%, a white "Turn on torch" button appears under the frame.
- **Camera permission denied** (not drawn): fall back to manual entry with a link to Settings.

## Interaction notes

- **Scan flow:** continuous detection. On a valid EAN-13/EAN-8/UPC: frame turns green (200 ms ease-out), `.success` haptic, result sheet at medium with skeleton, expands to large on data. Ignore repeats of the same barcode for 3 s. Swipe down to resume scanning.
- **Haptics:** success on lock, light impact on Save, warning on Not found. Nothing else.
- **Motion:** 200–300 ms, subtle. Score count-up 300 ms. Accordion 250 ms. With Reduce Motion: cross-fades only, no count-up. With Reduce Transparency: solid backgrounds.
- **Gestures:** sheet swipe-down, history row swipe, horizontal scroll on alternatives and filter chips.
- **Offline:** previously scanned products open from local cache; new lookups queue.
- **Errors in copy:** friendly and short; say what happened and offer the next step.

## Accessibility checklist

- VoiceOver: score ring is one element ("Score 86 of 100, great choice"); every icon-only button has an `accessibilityLabel`; chips and rows read label, value and status ("Sodium, 1,180 milligrams, high"); accordions expose expanded/collapsed.
- Contrast: text at least 4.5:1 in both modes; score rings and meters at least 3:1 (verified for every token above).
- Tap targets at least 44 × 44 pt (use `hitSlop` where the visual is smaller).
- Color independence: every tier has a unique glyph, a number and a word; status pills have glyph + word; concern levels have text labels.
- Dynamic Type: system text styles only; rows grow; pills drop under values at accessibility sizes; verify at the largest accessibility size.
- Dark Mode: true dark with soft charcoal, tokens above; verify product photos have a visible 1 pt border on dark.
- Reduce Motion and Reduce Transparency supported.

## Content rules

- Neutral, factual wording. Allowed: "high in sodium", "ultra-processed", "some concern". Not allowed: "toxic", "bad", "dangerous", "clean", "detox", "guilt".
- Don't make health claims beyond the data. Additive concern levels must cite a source and be reviewed before launch.
- Keep the disclaimer on every result and the Open Food Facts (ODbL) credit.
- Don't show "draft" or "estimated" in the main result; explain methodology on the "How it's scored" page.

## Features added or changed (confirm before building)

Existing features kept: scan, manual barcode entry, torch, result with nutrition per 100 g, Nutri-Score, India rating, NOVA, veg mark, save, share, history, Open Food Facts link, disclaimer.

New or changed, each needing data or engineering:
- Single 0–100 score with verdict (needs the combination formula).
- Label scanning (on-device text recognition).
- Search by name (Open Food Facts search).
- Additive concern levels and an ingredients list (needs a risk mapping and sources).
- Better alternatives (category queries and score comparison).
- Profile personalization, including a Jain option.
- Offline queue and "Report a problem".
- About moved into Profile; tabs are Scan, History, Profile.

Removed: per-nutrient colored tiles and the four-line legend; the always-visible manual entry panel on the scan screen.

## Implementation notes (React Native)

- Create `theme.ts` first with the color, type and spacing tokens above (light + dark via `useColorScheme`).
- Build in this order: tokens, ScoreRing (react-native-svg), StatusPill, ScoreBadge, HighlightChip, NutritionRow, SectionRow, then the Result screen, then Scan, History, Profile, states.
- Use the native tab bar and a native sheet (for example a bottom-sheet library with detents) rather than custom ones.
- Icons: SF Symbols on iOS at one weight; the mockups use stroke icons as stand-ins.
- Start with the Quaker Oats product (barcode 8901491103794) as the fixture: 407 kcal, 1.9 g saturated fat, 1.8 g sugars, added sugar unknown, 11.8 g protein per 100 g.
