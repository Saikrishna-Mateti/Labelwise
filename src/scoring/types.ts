// Pure types for the scoring engine. No React, Expo, network or storage imports in src/scoring/.

export type ProductType = 'solid' | 'liquid';

/** Nutrition per 100 g (solid) or 100 ml (liquid), as sold. Undefined = not known. */
export interface NutritionPer100 {
  energyKcal?: number;
  sugarsG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  fibreG?: number;
  proteinG?: number;
  /** Fruit and vegetable content, % */
  fruitVegPct?: number;
  /** Nuts, legumes and millets content, % */
  nutsLegumesMilletsPct?: number;
  /** Not used by INR, Nutri-Score or NOVA; kept for the warning-label method. */
  addedSugarsG?: number;
  addedFatG?: number;
}

export type NutrientKey = keyof NutritionPer100;

export interface ScoringInput {
  nutrition: NutritionPer100;
  productType: ProductType;
  ingredientsText?: string;
  /** Values already computed by Open Food Facts, used as-is when present. */
  off?: {
    novaGroup?: number;
    /** Human-readable markers OFF gives for its NOVA group, e.g. "E150d - Sulphite ammonia caramel". */
    novaMarkers?: string[];
    nutriscoreGrade?: string;
    nutriscoreScore?: number;
    /** OFF's Nutri-Score breakdown: points each component adds (negative) or removes (positive). */
    nutriscoreComponents?: NutriscoreComponent[];
    /** OFF additive tags, e.g. "en:e621". */
    additives?: string[];
  };
}

export interface NutriscoreComponent {
  /** OFF id, e.g. "sugars", "saturated_fat", "fiber". */
  id: string;
  kind: 'negative' | 'positive';
  points: number;
  pointsMax: number;
  value: number | null;
  unit: string;
}

export interface Reason {
  kind: 'pro' | 'con' | 'info';
  text: string;
}

export interface ScoreResult {
  method: string;
  /** Stars for INR, points for Nutri-Score, group for NOVA. Null when it cannot be scored. */
  value: number | null;
  /** Human label, e.g. "3.5 stars", "C", "NOVA 4". Null when it cannot be scored. */
  band: string | null;
  /** off = taken from Open Food Facts; computed = from complete inputs; estimated = some inputs missing or inferred. */
  source: 'off' | 'computed' | 'estimated';
  missingInputs: NutrientKey[];
  reasons: Reason[];
}

export interface ScoringMethod {
  id: string;
  name: string;
  score(input: ScoringInput): ScoreResult;
}
