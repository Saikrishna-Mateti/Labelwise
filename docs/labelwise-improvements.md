# Labelwise: Improvements Inspired by Competing Apps

Notes on what to adopt from Yuka and the India-focused food scanners (FactsScan, Zabel, NutriScan India, OpenLabel, EaterIQ, Open Food Facts), plus fixes found while testing the CLI with Pepsi (`8902080104581`).

---

## 1. Fixes from CLI testing (Pepsi Cola)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Nutri-Score block shows FSSAI reasons ("FSSAI draft reference 30 kcal / 6 g") | Each rating system explains itself with its own logic. Nutri-Score shows the OFF grade plus the nutrients driving it (energy, sugars). |
| 2 | FSSAI star rating of 2 may be too generous for a 10.9 g/100 ml cola | Hand-calculate this product against the spec and review thresholds and penalty weights. |
| 3 | "Real rating may be higher" when `fruitVegPct` is missing | Infer `fruitVegPct = 0` from category (`en:sodas`, `en:carbonated-drinks`) or from an ingredients list with no fruit or vegetable. Show "estimated" only when it can't be inferred. |
| 4 | Duplicate `[con]` lines under two ratings | Dedupe and keep each reason under its own system. |
| 5 | `Per 100:` printed as raw JSON | Print "Per 100 ml" (liquids) or "Per 100 g" with units. |
| 6 | NOVA line says only "NOVA group 4" | Read `nova_groups_markers` and list the triggers (colour, flavouring, acidity regulator, sweetener). |
| 7 | Missing nutrient fields may silently drop out of the star calculation | Make absent fields explicit (treated as unknown vs zero) and test it. |

Sanity check: Nutri-Score E for Pepsi is correct under the beverage rules (about 180 kJ gives 5 points, 10.9 g sugar gives 7 points, total 12, which is above the E threshold of 9).

---

## 2. What the three current ratings mean

| Metric | Question answered | Scale | Source in Labelwise |
|--------|-------------------|-------|---------------------|
| Nutri-Score | How nutritionally good per 100 g/ml? | A to E | Read from Open Food Facts |
| Indian Nutrition Rating (FSSAI draft) | Same question, against Indian reference values | 1 to 5 stars | Calculated by Labelwise |
| NOVA | How industrially processed? | 1 to 4 | Read from Open Food Facts (`nova_group`, `nova_groups_markers`) |

UI note: label the FSSAI-based rating as an estimate based on the draft front-of-pack proposal, not an official FSSAI score.

---

## 3. What to adopt from each app

### Yuka (scoring structure and trust)
- Additive risk layer: classify each additive as high, moderate, limited or no risk, using `additives_tags` from OFF.
- Cap rule: a product with a high-risk additive cannot score well regardless of nutrition.
- Simple colour bands, and healthier alternatives in the same category for poorly rated products.
- State plainly that brands cannot influence scores.

### FactsScan (Indian context and engagement)
- Front-of-pack style warning badges for calories, sugar, saturated fat, salt and sweetened beverages (reuse FSSAI draft thresholds).
- Personalisation by health profile (diabetes, BP, allergens, weight goals).
- Portion guidance and product search by name.
- Streaks and missions (optional, later).

### Zabel (transparency and Indian label reality)
- Show the arithmetic: expandable score with the contribution of each line.
- INS code decoder: Indian labels use INS numbers (e.g. INS 150d, INS 338), so decode them in plain language.
- Per-serving view against daily limits (ICMR-NIN reference values).
- Label photo and OCR fallback when there is no barcode.
- Hindi language support.

### NutriScan India (explanations and business model)
- Use an LLM for plain-language explanation and "what to avoid" text only, not for scoring.
- Freemium model: free core scoring, paid personalisation and export.
- Calculators and a food log are optional extras outside the core scope.

### OpenLabel (privacy and offline)
- On-device OCR and offline scanning.
- Bundle a small dataset of popular Indian products so the first scan is instant.
- "Restricted or banned elsewhere" flag for additives (needs a carefully sourced list).
- No account, no ads, no tracking.

### EaterIQ (low friction)
- Open and scan immediately, with no signup wall before the first result.

### Open Food Facts (data loop)
- Contribution flow so users can add or fix products. Keep the ODbL attribution.

---

## 4. Suggested build order

1. **Additive layer with INS decoding.** Classification table, read `additives_tags`, feed into the score. This is the biggest gap against Yuka and makes NOVA reasons concrete.
2. **Per-system explanations and expandable arithmetic.** Fix the shared `[con]` lines issue first.
3. **Per-serving view against daily limits.**
4. **Headline verdict above the three ratings**, for example "High sugar, ultra-processed". Keep the three systems visible underneath and avoid blending them into one number at first.
5. **Product search by name and label-photo fallback** for missing barcodes.
6. **Healthier alternatives**, ranked by Labelwise's own scores within a category.
7. **Later:** personalisation, Hindi, offline mode, contribution flow.

---

## 5. Things to avoid

- Do not let an LLM decide scores. Scores must stay deterministic and reproducible. Use the LLM only to phrase explanations from computed results.
- Avoid hazard-only additive flagging that ignores dose, which overstates risk and is a common criticism of Yuka.
- Do not present the FSSAI-based rating as official.
- Search the app stores for the name "LabelWise" before locking in branding. An AI-generated startup-idea page describes a product with that name for India, and it does not appear to be a shipped app, but check.

---

## 6. Competitor snapshot (India-focused)

| App | Status | Scoring | Notable |
|-----|--------|---------|---------|
| FactsScan | Live (Play Store, App Store) | 0 to 100 and A to E | Front-of-pack warnings, personalisation, FSSAI/WHO-based |
| Zabel | In development, Android first | 0 to 100 with arithmetic shown | INS decoder, per-serving, ICMR-NIN limits, Hindi |
| NutriScan India | Web app | 0 to 10, AI-generated | Credits model, calculators, food log |
| OpenLabel | Free, indie | 0 to 10, Nutri-Score method | Offline, on-device OCR, additive flags |
| EaterIQ | Web app | Simple health score | Free, origin unclear |

Labelwise's differentiator: no competitor found shows Nutri-Score, an Indian FSSAI-based rating and NOVA side by side with reasons for each.

---

## 7. Yuka UI/UX: the design rules it follows

Yuka doesn't publish a design guideline. The rules below are inferred from reviews, UX audits, redesign case studies and the Scandit/regulator write-ups listed at the end. Some sources are a few years old, so check the current app before copying details.

### 7.1 Navigation and flow
1. **Scan-first.** The centre tab is highlighted when the app opens and acts as the camera, so the first action takes almost no interaction.
2. **Standard tab bar.** Other tabs: History, Recommendations (alternatives), Overview/summary, manual Search. On iOS the menu sits at the bottom; on Android an older audit found a top menu with the scan button at the bottom right. Follow each platform's convention.
3. **Never leave the scan screen to read the verdict.** After a scan, a bottom popup shows the coloured rating, so the user can scan the next product immediately. Details open only if they tap through.
4. **Simplicity.** A 2020 accessibility audit noted the interface is easy to relearn after uninstalling. Few screens, few concepts.
5. **Share and favourite.** A star to save a product to Favourites, and a share action.

### 7.2 Score and colour system
1. **One number plus one colour.** Score out of 100, with four bands: Bad (red, 0 to 24), Poor (orange, 25 to 49), Good (light green, 50 to 74), Excellent (dark green, 75 to 100).
2. **Same colour language everywhere.** The product list, the product page and each ingredient or nutrient bullet use the same green-to-red scale, with five risk levels for additives (dark green, green, yellow, orange, red).
3. **Nutri-Score-inspired palette.** The colours match what people already see on packaging, so users don't have to learn a new scale.
4. **Brand colours stay secondary to the rating colours.** The brand uses green, orange (the carrot logo) and grey, on a mostly white and neutral interface, so the red-to-green rating is the loudest thing on the screen.

### 7.3 Product page layout (top to bottom)
1. Product photo (when available), product name, and the score in a coloured badge. One redesign case study put a larger coloured ellipse behind the product image to carry the rating colour.
2. **Negatives and positives**, split into two groups. Each row has a custom line icon for its category (additives, sodium, calories, protein, sugar), a plain-language label such as "too much sodium" or "good quantity of vegetables", and a coloured bullet.
3. **Composition / ingredients** with per-ingredient risk colours.
4. **Alternatives** further down the page, for products that aren't excellent.
5. Long sections collapse (composition, alternatives) so the page doesn't become a long scroll.

### 7.4 History and recommendations
- **History list** shows product name, coloured bullet and the date last scanned, with a list or grid toggle.
- **Rounded-corner cards** for scanned items (redesign case study).
- **Recommendations tab** keeps a running list of poorly rated scanned products with better alternatives. It turns history into a to-do list for better shopping.
- **Premium extras:** offline mode, search without scanning, unlimited history, preference alerts (e.g. gluten-free, vegetarian, palm oil).

### 7.5 Trust and transparency (partly driven by an Italian regulator)
- State that the method is independent and inspired by Nutri-Score but not approved by health authorities.
- Show the score broken down on every product page, with links to the studies used.
- Have a page explaining how alternatives are selected and ranked.
- No ads, and clear funding information.

### 7.6 Known weaknesses (don't copy these)
- **Colour-only meaning.** Redesign critiques flagged colour-blind users. Add icons, letters or labels next to every colour.
- **Inconsistent product photo sizes and shapes** across pages.
- **Wording that shames food.** One reviewer disliked labelling food as "bad"; another found the standards nannying. Prefer neutral wording.
- **Hazard-only additive flags and a 100 g basis** (see section 5).

### 7.7 How to apply this to Labelwise
| Yuka pattern | Labelwise version |
|--------------|-------------------|
| Centre scan tab, camera on launch | Same. Tabs: Scan, History, Search, Profile. |
| Bottom popup with coloured rating | Peek sheet over the camera: headline verdict plus three small tiles (Nutri-Score letter, FSSAI stars, NOVA 1 to 4). |
| One score out of 100 | Don't blend. Keep three ratings, with a short verdict line above them ("High sugar, ultra-processed"). |
| Positives and negatives with icons | Same layout, but one list per rating system, each reason using that system's own logic (fixes the shared `[con]` lines issue). |
| Additive risk colours | Add after the additive layer exists. INS decoding in the detail view. |
| Alternatives on the page and in a tab | Alternatives ranked by Labelwise's own scores within a category. |
| Collapsible composition | Collapsible "How this score was calculated" with arithmetic. |
| Independence statement | Add a Methodology page: data from Open Food Facts (ODbL), FSSAI-based rating is an estimate from the draft proposal, scores can't be bought. |
| Colour-only status | Always pair colour with a letter, star count or icon. |
| Neutral palette, one accent | Neutral interface, one brand accent, rating colours reserved for ratings. |

### 7.8 Design notes when combining with Liquid Glass (iOS)
- Use glass for the tab bar, scanner controls and sheets. Keep rating tiles and breakdown rows on solid, high-contrast surfaces.
- Test legibility of rating colours with the iOS Clear and Tinted glass settings.
- Use Expo Router native tabs and a development build; check the Expo SDK version first.

### 7.9 Sources for this section
- Redesign case studies of the Yuka app (Medium: Ana Galuppo, Marina Pastor, Soraya Amchaar)
- Fueled, "App of the Week: Yuka"
- TapSmart review of Yuka
- Scandit case study on Yuka
- Orientatech accessibility review (October 2020)
- Pasquale Pillitteri, "Is Yuka Accurate?" (covers the Italian regulator commitments)
- Product deep-dive on Medium (design-bootcamp)
- Garage Gym Reviews listing of Yuka's free and premium features
