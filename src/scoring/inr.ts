// Indian Nutrition Rating, implemented exactly from the FSSAI DRAFT Food Safety and Standards
// (Labelling & Display) Amendment Regulations, 2022 (F. No. Std./SP-08/T(FoPNL-N-01), 13 Sep 2022),
// Schedule III Tables 2-6. Source: docs/sources/fssai-inr-draft-2022-usda-IN2022-0085.pdf, Appendix I pages 9-10.
// This is a draft proposal, never finalised. As of Oct 2026 FSSAI is moving to warning labels instead
// (docs/FSSAI Front-of-Pack Labelling ... October 2026.md).
//
// Units in the draft: energy kcal, sugars/sat fat/fibre/protein g, sodium mg, FV/NLM %,
// per 100 g (solid) or 100 ml (liquid), as sold.
//
// Decisions where the draft is ambiguous (agreed with the project owner, 2026-10-19):
// 1. Table 6 liquid rows overlap (16-18 / 18-20 / >=20): the stricter rating wins, so 18 -> 1 star, 20 -> 0.5.
// 2. Table 3 (liquids) has no sat fat or sodium columns: liquid baseline = energy + sugars only.
// 3. "Beverage without energy and/or sugar" is not rated: liquids with 0 kcal OR 0 g sugar get no stars.

import type {
  NutrientKey,
  ProductType,
  Reason,
  ScoreResult,
  ScoringInput,
  ScoringMethod,
} from './types';

type Thresholds = readonly number[];

// Points = number of thresholds the value is strictly greater than (">" in the tables).
export const points = (value: number, thresholds: Thresholds) =>
  thresholds.filter((t) => value > t).length;

const range = (start: number, step: number, count: number) =>
  Array.from({ length: count }, (_, i) => Number((start + step * i).toFixed(1)));

// Table 2: Category-I solid foods, per 100 g.
const SOLID = {
  energyKcal: range(80, 80, 10),
  saturatedFatG: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  ],
  sugarsG: range(4.2, 4.2, 20),
  sodiumMg: range(90, 90, 25),
  fruitVegPct: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  nutsLegumesMilletsPct: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  fibreG: range(3, 3, 10),
  proteinG: [1.5, 2, 2.5, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50],
} as const;

// Table 3: Category-II liquid foods (excluding dairy), per 100 ml. FV skips >50 as printed.
const LIQUID = {
  energyKcal: range(6, 6, 10),
  sugarsG: [0.1, 1.6, 3.1, 4.6, 6.1, 7.6, 9.1, 10.6, 12.1, 13.6],
  fruitVegPct: [5, 10, 15, 20, 25, 30, 35, 40, 45, 55],
  proteinG: [1.5, 2, 2.5, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50],
} as const;

export const RISK: Record<ProductType, NutrientKey[]> = {
  solid: ['energyKcal', 'saturatedFatG', 'sugarsG', 'sodiumMg'],
  liquid: ['energyKcal', 'sugarsG'],
};

const POSITIVE: Record<ProductType, NutrientKey[]> = {
  solid: ['fruitVegPct', 'nutsLegumesMilletsPct', 'fibreG', 'proteinG'],
  liquid: ['fruitVegPct', 'proteinG'],
};

// Table 4: caps on positive points, by baseline points.
function cap(type: ProductType, baseline: number, key: NutrientKey): number {
  if (type === 'solid') {
    if (key === 'proteinG') return baseline <= 20 ? 15 : 7;
    return baseline <= 20 ? 10 : 5;
  }
  if (key === 'proteinG') return baseline <= 10 ? 15 : 7;
  return baseline <= 10 ? 10 : 5;
}

// Table 6: highest final score for each star rating; anything above the last row is 0.5 stars.
const STARS: Record<ProductType, readonly [number, number][]> = {
  solid: [
    [-11, 5],
    [-7, 4.5],
    [-2, 4],
    [2, 3.5],
    [6, 3],
    [11, 2.5],
    [15, 2],
    [20, 1.5],
    [24, 1],
  ],
  liquid: [
    [0, 5],
    [2, 4.5],
    [4, 4],
    [6, 3.5],
    [9, 3],
    [12, 2.5],
    [15, 2],
    [17, 1.5], // draft lists 16-18; 18 resolved to 1 star (decision 1)
    [19, 1], // draft lists 18-20; 20 resolved to 0.5 stars (decision 1)
  ],
};

export function starsFor(type: ProductType, finalScore: number): number {
  return STARS[type].find(([max]) => finalScore <= max)?.[1] ?? 0.5;
}

export interface InrComponent {
  key: NutrientKey;
  /** against = baseline (risk) points, for = positive points after the Table 4 cap. */
  kind: 'against' | 'for';
  points: number;
  /** Most points this component can give: table length, or the Table 4 cap for positives. */
  max: number;
}

export interface InrBreakdown {
  baseline: number;
  positive: number;
  finalScore: number;
  stars: number;
  components: InrComponent[];
}

/** Tables 2-6. Missing positive factors count as 0 points; missing risk factors make it unscorable. */
export function inrBreakdown(input: ScoringInput): InrBreakdown | null {
  const { nutrition: n, productType: type } = input;
  const table: Partial<Record<NutrientKey, Thresholds>> = type === 'solid' ? SOLID : LIQUID;
  if (RISK[type].some((k) => n[k] === undefined)) return null;

  const against: InrComponent[] = RISK[type].map((key) => ({
    key,
    kind: 'against',
    points: points(n[key]!, table[key]!),
    max: table[key]!.length,
  }));
  const baseline = against.reduce((sum, c) => sum + c.points, 0);
  const inFavour: InrComponent[] = POSITIVE[type].flatMap((key) => {
    const v = n[key];
    if (v === undefined) return [];
    const max = cap(type, baseline, key);
    return [{ key, kind: 'for' as const, points: Math.min(points(v, table[key]!), max), max }];
  });
  const positive = inFavour.reduce((sum, c) => sum + c.points, 0);
  const finalScore = baseline - positive;
  return {
    baseline,
    positive,
    finalScore,
    stars: starsFor(type, finalScore),
    components: [...against, ...inFavour],
  };
}

export const LABEL_FOR: Record<NutrientKey, string> = {
  energyKcal: 'energy',
  sugarsG: 'total sugars',
  saturatedFatG: 'saturated fat',
  sodiumMg: 'sodium',
  fibreG: 'fibre',
  proteinG: 'protein',
  fruitVegPct: 'fruit and vegetable %',
  nutsLegumesMilletsPct: 'nuts, legumes and millets %',
};

const UNIT: Record<NutrientKey, string> = {
  energyKcal: 'kcal',
  sugarsG: 'g',
  saturatedFatG: 'g',
  sodiumMg: 'mg',
  fibreG: 'g',
  proteinG: 'g',
  fruitVegPct: '%',
  nutsLegumesMilletsPct: '%',
};

const fmt = (n: number) => String(Number(n.toFixed(1)));
const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * The draft's own points per nutrient. Table 1 values are reference points inside the scoring
 * tables (a nutrient at its reference value scores 5), not "high in" limits, so none are shown as such.
 */
function componentReasons(b: InrBreakdown, input: ScoringInput): Reason[] {
  const per = input.productType === 'liquid' ? 'per 100 ml' : 'per 100 g';
  const reasons: Reason[] = [
    {
      kind: 'info',
      text: `${b.baseline} points against − ${b.positive} in favour = score ${b.finalScore}`,
    },
  ];
  for (const c of b.components) {
    if (c.points === 0) continue;
    const value = `${capitalise(LABEL_FOR[c.key])} ${fmt(input.nutrition[c.key]!)} ${UNIT[c.key]} ${per}`;
    reasons.push(
      c.kind === 'against'
        ? { kind: 'con', text: `${value}: ${c.points} of ${c.max} points against` }
        : { kind: 'pro', text: `${value}: ${c.points} of ${c.max} points in favour` },
    );
  }
  if (input.productType === 'liquid') {
    reasons.push({
      kind: 'info',
      text: 'For drinks the draft scores only energy and sugars against, and fruit and vegetables and protein in favour.',
    });
  }
  return reasons;
}

/** The risk factors costing the most points, largest first (ties keep table order). */
export function biggestPointsAgainst(input: ScoringInput, limit = 2): string[] {
  const b = inrBreakdown(input);
  if (!b) return [];
  return b.components
    .filter((c) => c.kind === 'against' && c.points > 0)
    .sort((x, y) => y.points - x.points)
    .slice(0, limit)
    .map((c) => LABEL_FOR[c.key]);
}

export const inr: ScoringMethod = {
  id: 'inr',
  name: 'Indian Nutrition Rating (2022 FSSAI draft, not in force)',
  score(input) {
    const { nutrition: n, productType: type } = input;
    const missingInputs = [...RISK[type], ...POSITIVE[type]].filter((k) => n[k] === undefined);
    const result = (value: number | null, band: string | null, reasons: Reason[]): ScoreResult => ({
      method: 'inr',
      value,
      band,
      source: missingInputs.length ? 'estimated' : 'computed',
      missingInputs,
      reasons,
    });

    const missingRisk = RISK[type].filter((k) => n[k] === undefined);
    if (missingRisk.length) {
      return result(null, null, [
        {
          kind: 'info',
          text: `Cannot rate: missing ${missingRisk.map((k) => LABEL_FOR[k]).join(', ')}`,
        },
      ]);
    }

    if (type === 'liquid' && (n.energyKcal === 0 || n.sugarsG === 0)) {
      return result(null, 'Not rated', [
        {
          kind: 'info',
          text: 'Not rated: the FSSAI draft excludes beverages without energy or sugar',
        },
      ]);
    }

    const b = inrBreakdown(input)!;
    const extra: Reason[] = [];
    const missingPositive = POSITIVE[type].filter((k) => n[k] === undefined);
    if (missingPositive.length) {
      extra.push({
        kind: 'info',
        text: `Estimated: ${missingPositive.map((k) => LABEL_FOR[k]).join(', ')} unknown, counted as 0. The real rating may be higher.`,
      });
    }
    if (type === 'liquid' && (b.finalScore === 18 || b.finalScore === 20)) {
      extra.push({
        kind: 'info',
        text: `Score ${b.finalScore} sits on an overlap in the draft's liquid table; the lower rating is shown.`,
      });
    }
    return result(b.stars, `${b.stars} stars`, [...extra, ...componentReasons(b, input)]);
  },
};
