import type { NutritionPer100, ProductType, Reason } from './types';

// FSSAI draft Labelling & Display Amendment Regulations, 13 Sep 2022, Schedule III Table 1.
// Source: docs/sources/fssai-inr-draft-2022-usda-IN2022-0085.pdf, Appendix I page 9.
// Baseline reference values for food risk factors, per 100 g / 100 ml as sold.
const REFERENCE: Record<
  ProductType,
  Record<'energyKcal' | 'sugarsG' | 'saturatedFatG' | 'sodiumMg', number>
> = {
  solid: { energyKcal: 400, sugarsG: 21, saturatedFatG: 5, sodiumMg: 450 },
  liquid: { energyKcal: 30, sugarsG: 6, saturatedFatG: 3, sodiumMg: 100 },
};

// Table 1 minimum content of positive factors (%, or g for fibre and protein).
const MINIMUM: Record<
  ProductType,
  Record<'fruitVegPct' | 'nutsLegumesMilletsPct' | 'fibreG' | 'proteinG', number>
> = {
  solid: { fruitVegPct: 10, nutsLegumesMilletsPct: 10, fibreG: 3, proteinG: 1.5 },
  liquid: { fruitVegPct: 5, nutsLegumesMilletsPct: 10, fibreG: 3, proteinG: 1.5 },
};

const RISK_LABELS = {
  energyKcal: ['calories', 'kcal'],
  sugarsG: ['sugar', 'g'],
  saturatedFatG: ['saturated fat', 'g'],
  sodiumMg: ['sodium', 'mg'],
} as const;

const POSITIVE_LABELS = {
  fruitVegPct: ['fruit and vegetables', '%'],
  nutsLegumesMilletsPct: ['nuts, legumes and millets', '%'],
  fibreG: ['fibre', 'g'],
  proteinG: ['protein', 'g'],
} as const;

const fmt = (n: number) => String(Number(n.toFixed(1)));

/**
 * Pros and cons from nutrition values, using the FSSAI draft Table 1 values as the only thresholds:
 * a risk factor above its reference value is a con, a positive factor above its minimum is a pro.
 */
export function nutrientReasons(nutrition: NutritionPer100, type: ProductType): Reason[] {
  const per = type === 'solid' ? 'per 100 g' : 'per 100 ml';
  const reasons: Reason[] = [];

  for (const key of Object.keys(RISK_LABELS) as (keyof typeof RISK_LABELS)[]) {
    const value = nutrition[key];
    const ref = REFERENCE[type][key];
    const [label, unit] = RISK_LABELS[key];
    if (value !== undefined && value > ref) {
      reasons.push({
        kind: 'con',
        text: `High in ${label}: ${fmt(value)} ${unit} ${per} (FSSAI draft reference ${ref} ${unit})`,
      });
    }
  }

  for (const key of Object.keys(POSITIVE_LABELS) as (keyof typeof POSITIVE_LABELS)[]) {
    const value = nutrition[key];
    const [label, unit] = POSITIVE_LABELS[key];
    if (value !== undefined && value > MINIMUM[type][key]) {
      reasons.push({ kind: 'pro', text: `Contains ${label}: ${fmt(value)} ${unit} ${per}` });
    }
  }

  if (reasons.length === 0) {
    const allRiskKnown = Object.keys(RISK_LABELS).every(
      (k) => nutrition[k as keyof typeof RISK_LABELS] !== undefined,
    );
    reasons.push({
      kind: 'info',
      text: allRiskKnown
        ? 'No nutrient is above the FSSAI draft reference values'
        : 'Not enough nutrition data to list pros and cons',
    });
  }
  return reasons;
}
