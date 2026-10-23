# Scoring sources

- `fssai-inr-draft-2022-usda-IN2022-0085.pdf`: USDA FAS GAIN report IN2022-0085 (19 Oct 2022). Appendix I (pages 5-12) reproduces the Gazette pages of the FSSAI **draft** Food Safety and Standards (Labelling & Display) Amendment Regulations, 2022, F. No. Std./SP-08/T(FoPNL-N-01), 13 Sep 2022, including Schedule III Tables 1-6 and Schedule IV. Used by `src/scoring/inr.ts` and `src/scoring/reasons.ts`.
- `Draft Food Safety and Standards (Safe food and balanced diets for children in school) Regulations, 2026.pdf`: official FSSAI **draft** (F. No. SS-T0SP08(NOTI)/1/2026-Standard-FSSAI, 7 Aug 2026; Gazette CG-DL-E-10082026-275350, 10 Aug 2026). Draft regulation 7, page 3: "high" = more than 4.2 g/100 g added fat (solid) or 1.5 g/100 ml (liquid); more than 3 g/100 g added sugar or 2 g/100 ml; more than 0.625 g/100 g salt or 0.175 g/100 ml. No energy threshold. Its "more than" wording is used for all four limits in `src/scoring/warnings.ts`.
- `DGI_2024.pdf`: ICMR-NIN Dietary Guidelines for Indians 2024. Table 15.1 (page 96) "Nutrients of concern threshold criteria", per 100 g or ml, liquids / solids: calories 70 / 250 kcal, salt 175 / 625 mg, added sugar 2.0 / 3 g, added fat 1.5 / 4.2 g. Footnote 1: applies to cooked/packaged foods and beverages with added sugar, salt or fat. Footnote 2: liquids include all beverages, fruit juices, coconut water, buttermilk, lassi, coffee and tea. Used in `src/scoring/warnings.ts` (High / OK chips on the product sheet).
- `nutriscore-2023-update-spf-summary.pdf`: Santé publique France summary page for the 2023 Nutri-Score update. Summary only, **no algorithm tables**. The official specification is still needed before `src/scoring/nutriscore.ts` can compute grades itself. Until then the grade and its per-component points come from Open Food Facts (`nutriscore_grade`, `nutriscore_data`).

## Status of the INR draft (checked 2026-10-21)

The 2022 draft was never finalised. FSSAI has told the Supreme Court it is moving to red "HIGH SUGAR / HIGH SALT / HIGH FAT" warning labels based on ICMR-NIN 2024 thresholds; the Court reserved its order on 28 Sep 2026. Details and sources: `docs/FSSAI Front-of-Pack Labelling and the Indian Nutrition Rating_ Status, Methodology and Thresholds as of October 2026.md`. The app labels INR "2022 FSSAI draft, not in force".

Table 1 values (e.g. liquids 30 kcal, 6 g sugars) are reference points inside the scoring tables, not "high in" limits. Reasons therefore show each nutrient's draft points ("Total sugars 10.9 g per 100 ml: 8 of 10 points against"), never "high in".

## INR interpretation decisions (2026-10-19)

The draft is ambiguous in places. These are the choices made, also recorded at the top of `inr.ts`:

1. Table 6 liquid rows overlap (16-18, 18-20, ≥20). The stricter rating wins: 18 gives 1 star, 20 gives 0.5 stars.
2. Table 3 (liquids) has no saturated fat or sodium columns. Liquid baseline uses energy and sugars only; sat fat and sodium still appear as reasons, using the Table 1 liquid reference values.
3. "Any beverage/carbonated beverage without energy and/or sugar shall not be eligible" is read literally: a liquid with 0 kcal **or** 0 g sugar is not rated.
4. Liquid (Category-II, FSS categories 6.8.1 and 14.0) is inferred from Open Food Facts tags: `en:beverages` and not dairy. The user can override it.

Not implemented yet: Schedule IV exemptions (needs a mapping from FSS category numbers to OFF categories).

## Warning-label method: decisions (2026-10-21; chips built 2026-10-23)

Planned as its own milestone after Milestone 4 (manual entry), using the school-food draft and DGI 2024 Table 15.1 above.

1. Added sugar from OFF `added-sugars_100g` (declared on Indian labels). Never substitute total sugars.
2. Added fat is not declared on labels and has no OFF field: shown as "unknown", never replaced by total fat. Manual entry can supply it.
3. Salt = stored sodium × 2.5 (the same factor OFF uses for `salt_100g`), thresholds 0.625 g / 0.175 g.
4. Energy check (250 kcal / 70 kcal) included, credited to ICMR-NIN DGI 2024, not FSSAI (the FSSAI draft has no energy threshold).
5. Liquid = any beverage, including dairy drinks, tea and coffee (DGI footnote 2), separate from INR's Category II.
6. No exemptions until an official text lists them (the affidavit exemptions are only reported secondhand).

## Manual entry: salt and sodium (Milestone 4)

The form takes sodium (mg) or salt (g) and stores sodium. Salt = sodium × 2.5, from DGI 2024 ch. "Restrict salt intake": "5g of salt per day (equivalent to 2g of sodium)" and "salt is sodium chloride (40% sodium and 60% chloride)". Range checks only reject impossible values: energy ≤ 900 kcal (pure fat, 9 kcal/g), grams and % ≤ 100, sodium ≤ 40 000 mg, added sugars ≤ total sugars.

## Overall band (Labelwise's own, 2026-10-23)

The product sheet's headline Excellent / Good / Poor / Bad band is a Labelwise mapping of OFF's Nutri-Score grade: A → Excellent, B → Good, C and D → Poor, E → Bad. Colours dark green, light green, orange, red. Not a published method. No score out of 100: a straight-line rescale of Nutri-Score points (range about −17 to 55) put grade E products at 52–58/100 ("Good"), so it was rejected. Additives and organic status are not part of it (no sourced additive risk data; Phase 2).
