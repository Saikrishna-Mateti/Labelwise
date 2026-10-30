// Low / Moderate / High per nutrient, per 100 g (solids) or 100 ml (liquids). Every threshold is
// cited in docs/sources/README.md ("Nutrient levels"):
// - High: ICMR-NIN DGI 2024 Table 15.1 where it has a limit (energy, salt, added sugar), else UK FSA
//   front-of-pack guidance 2016, Table 2/3 (saturated fat, total sugars).
// - Low: FSSAI Advertising and Claims Regulations 2018, Schedule I "low" claims.
// - Protein "Good": FSSAI "source of protein" (10% of RDA per 100 g, 5% per 100 ml), with the
//   RDA of 54 g a day from DGI 2024 p. 75.
// High is checked first, so where sources overlap (salt in drinks) the stricter one wins.

import type { NutrientKey, ScoringInput } from './types';
import { SALT_PER_SODIUM } from './units';
import { LIMITS } from './warnings';

export type Level = 'low' | 'moderate' | 'high' | 'good' | 'within' | 'unknown' | 'none';
export type LevelKey = 'energy' | 'saturatedFat' | 'salt' | 'sugars' | 'addedSugars' | 'protein';

export interface NutrientLevel {
  key: LevelKey;
  /** Per 100 g / 100 ml, in the row's unit (kcal, g, or mg for salt shown as sodium). */
  value?: number;
  level: Level;
}

const PROTEIN_RDA_G = 54;

// [low (at or under), high (more than)]; undefined = no sourced threshold.
const BANDS: Record<
  'solid' | 'liquid',
  Record<LevelKey, [number | undefined, number | undefined]>
> = {
  solid: {
    energy: [40, LIMITS.solid.energy],
    saturatedFat: [1.5, 5],
    salt: [0.12 * SALT_PER_SODIUM, LIMITS.solid.salt],
    sugars: [5, 22.5],
    addedSugars: [undefined, LIMITS.solid.addedSugars],
    protein: [undefined, undefined],
  },
  liquid: {
    energy: [20, LIMITS.liquid.energy],
    saturatedFat: [0.75, 2.5],
    salt: [0.12 * SALT_PER_SODIUM, LIMITS.liquid.salt],
    sugars: [2.5, 11.25],
    addedSugars: [undefined, LIMITS.liquid.addedSugars],
    protein: [undefined, undefined],
  },
};

const PROTEIN_SOURCE = { solid: 0.1 * PROTEIN_RDA_G, liquid: 0.05 * PROTEIN_RDA_G };

const FIELD: Record<LevelKey, NutrientKey> = {
  energy: 'energyKcal',
  saturatedFat: 'saturatedFatG',
  salt: 'sodiumMg',
  sugars: 'sugarsG',
  addedSugars: 'addedSugarsG',
  protein: 'proteinG',
};

export function nutrientLevel(
  key: LevelKey,
  value: number | undefined,
  type: 'solid' | 'liquid',
): Level {
  if (value === undefined) return 'unknown';
  if (key === 'protein') return value >= PROTEIN_SOURCE[type] ? 'good' : 'none';
  // Salt thresholds are in g of salt; the row value is sodium in mg.
  const v = key === 'salt' ? (value * SALT_PER_SODIUM) / 1000 : value;
  const [low, high] = BANDS[type][key];
  if (high !== undefined && v > high) return 'high';
  if (low === undefined) return 'within';
  return v <= low ? 'low' : 'moderate';
}

export function nutrientLevels({ nutrition, productType }: ScoringInput): NutrientLevel[] {
  return (Object.keys(FIELD) as LevelKey[]).map((key) => {
    const value = nutrition[FIELD[key]];
    return { key, value, level: nutrientLevel(key, value, productType) };
  });
}
