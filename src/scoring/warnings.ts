// ICMR-NIN "nutrients of concern" limits. Source: Dietary Guidelines for Indians 2024, Table 15.1
// (page 96), per 100 g (solids) or 100 ml (liquids). The same sugar, fat and salt values are in
// FSSAI's 2026 school-food draft, regulation 7, which counts as high only "more than" the value;
// the energy limit is ICMR-NIN's alone. See docs/sources/README.md.

import type { ProductType, ScoringInput } from './types';
import { SALT_PER_SODIUM } from './units';

export type LimitKey = 'energy' | 'salt' | 'addedSugars' | 'addedFat';

const LIMITS: Record<ProductType, Record<LimitKey, number>> = {
  // energy kcal, salt g (Table 15.1 gives mg: 625 / 175), added sugar g, added fat g
  solid: { energy: 250, salt: 0.625, addedSugars: 3, addedFat: 4.2 },
  liquid: { energy: 70, salt: 0.175, addedSugars: 2, addedFat: 1.5 },
};

export type LimitCheck =
  | { key: LimitKey; status: 'high' | 'within'; value: number; limit: number }
  | { key: LimitKey; status: 'unknown'; limit: number };

/** Each limit checked against the product; `unknown` when the value is missing, never guessed. */
export function checkLimits({ nutrition: n, productType }: ScoringInput): LimitCheck[] {
  const values: Record<LimitKey, number | undefined> = {
    energy: n.energyKcal,
    salt: n.sodiumMg === undefined ? undefined : (n.sodiumMg * SALT_PER_SODIUM) / 1000,
    // Added, never total: the limits are for added sugar and added fat only.
    addedSugars: n.addedSugarsG,
    addedFat: n.addedFatG,
  };
  return (Object.keys(LIMITS[productType]) as LimitKey[]).map((key) => {
    const limit = LIMITS[productType][key];
    const value = values[key];
    return value === undefined
      ? { key, status: 'unknown', limit }
      : { key, status: value > limit ? 'high' : 'within', value, limit };
  });
}
