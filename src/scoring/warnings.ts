// ICMR-NIN "nutrients of concern" limits. Source: Dietary Guidelines for Indians 2024, Table 15.1
// (page 96), per 100 g (solids) or 100 ml (liquids). The same sugar, fat and salt values are in
// FSSAI's 2026 school-food draft, regulation 7, which counts as high only "more than" the value;
// the energy limit is ICMR-NIN's alone. See docs/sources/README.md.

import type { ProductType } from './types';

export type LimitKey = 'energy' | 'salt' | 'addedSugars' | 'addedFat';

export const LIMITS: Record<ProductType, Record<LimitKey, number>> = {
  // energy kcal, salt g (Table 15.1 gives mg: 625 / 175), added sugar g, added fat g
  solid: { energy: 250, salt: 0.625, addedSugars: 3, addedFat: 4.2 },
  liquid: { energy: 70, salt: 0.175, addedSugars: 2, addedFat: 1.5 },
};
