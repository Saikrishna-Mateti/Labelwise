# Scoring sources

- `fssai-inr-draft-2022-usda-IN2022-0085.pdf`: USDA FAS GAIN report IN2022-0085 (19 Oct 2022). Appendix I (pages 5-12) reproduces the Gazette pages of the FSSAI **draft** Food Safety and Standards (Labelling & Display) Amendment Regulations, 2022, F. No. Std./SP-08/T(FoPNL-N-01), 13 Sep 2022, including Schedule III Tables 1-6 and Schedule IV. Used by `src/scoring/inr.ts` and `src/scoring/reasons.ts`.
- `nutriscore-2023-update-spf-summary.pdf`: Santé publique France summary page for the 2023 Nutri-Score update. Summary only, **no algorithm tables**. The official specification is still needed before `src/scoring/nutriscore.ts` can compute grades itself.

## INR interpretation decisions (2026-10-19)

The draft is ambiguous in places. These are the choices made, also recorded at the top of `inr.ts`:

1. Table 6 liquid rows overlap (16-18, 18-20, ≥20). The stricter rating wins: 18 gives 1 star, 20 gives 0.5 stars.
2. Table 3 (liquids) has no saturated fat or sodium columns. Liquid baseline uses energy and sugars only; sat fat and sodium still appear as reasons, using the Table 1 liquid reference values.
3. "Any beverage/carbonated beverage without energy and/or sugar shall not be eligible" is read literally: a liquid with 0 kcal **or** 0 g sugar is not rated.
4. Liquid (Category-II, FSS categories 6.8.1 and 14.0) is inferred from Open Food Facts tags: `en:beverages` and not dairy. The user can override it.

Not implemented yet: Schedule IV exemptions (needs a mapping from FSS category numbers to OFF categories).
