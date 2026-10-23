// Manual-entry form: field list, parsing and range checks. Pure, so it is tested without React.
// Ranges only reject impossible values; they say nothing about whether a food is healthy.

import type { UserEntry } from '../../data/db';
import type { ResolvedProduct } from '../../data/resolver';
import type { NutrientKey, NutritionPer100, ProductType } from '../../scoring/types';
import { SALT_PER_SODIUM } from '../../scoring/units';

export type SodiumUnit = 'sodium_mg' | 'salt_g';

export interface Field {
  key: NutrientKey;
  label: string;
  unit: string;
  max: number;
  hint?: string;
}

export const FIELDS: Field[] = [
  { key: 'energyKcal', label: 'Energy', unit: 'kcal', max: 900, hint: 'Use kcal, not kJ' },
  { key: 'sugarsG', label: 'Total sugars', unit: 'g', max: 100 },
  { key: 'addedSugarsG', label: 'Added sugars', unit: 'g', max: 100, hint: 'Optional' },
  { key: 'saturatedFatG', label: 'Saturated fat', unit: 'g', max: 100 },
  { key: 'addedFatG', label: 'Added fat', unit: 'g', max: 100, hint: 'Optional' },
  // Sodium has its own unit switch; max is in mg and checked separately for salt.
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg', max: 40000 },
  { key: 'fibreG', label: 'Fibre', unit: 'g', max: 100 },
  { key: 'proteinG', label: 'Protein', unit: 'g', max: 100 },
  { key: 'fruitVegPct', label: 'Fruit and vegetables', unit: '%', max: 100, hint: 'Optional' },
  {
    key: 'nutsLegumesMilletsPct',
    label: 'Nuts, legumes and millets',
    unit: '%',
    max: 100,
    hint: 'Optional',
  },
];

export interface Draft {
  values: Partial<Record<NutrientKey, string>>;
  sodiumUnit: SodiumUnit;
  productType: ProductType;
  ingredientsText: string;
}

export type Errors = Partial<Record<NutrientKey, string>>;

const NUMBER = /^(\d+\.?\d*|\.\d+)$/;
const fmt = (n: number) => String(Number(n.toFixed(2)));

/** Keys whose value comes from Open Food Facts; the form shows them but does not save them. */
export function offKeys(product?: ResolvedProduct): Set<NutrientKey> {
  return new Set(
    Object.entries(product?.nutrition ?? {})
      .filter(([, v]) => v.source === 'off')
      .map(([k]) => k as NutrientKey),
  );
}

/** Starts the form from what is already known: OFF values (shown read-only) and earlier entries. */
export function draftFrom(product?: ResolvedProduct): Draft {
  const values: Draft['values'] = {};
  for (const [key, v] of Object.entries(product?.nutrition ?? {})) {
    values[key as NutrientKey] = fmt(v.value);
  }
  return {
    values,
    sodiumUnit: 'sodium_mg',
    productType: product?.productType.value ?? 'solid',
    ingredientsText:
      product?.ingredientsText?.source === 'user' ? product.ingredientsText.value : '',
  };
}

export function parseEntry(
  draft: Draft,
  locked: Set<NutrientKey>,
): { ok: true; entry: Omit<UserEntry, 'updatedAt'> } | { ok: false; errors: Errors } {
  const all: NutritionPer100 = {};
  const errors: Errors = {};

  for (const { key, max, unit } of FIELDS) {
    const raw = draft.values[key]?.trim().replace(',', '.');
    if (!raw) continue;
    if (!NUMBER.test(raw)) {
      errors[key] = 'Enter a number, like 12 or 12.5';
      continue;
    }
    let n = Number(raw);
    // OFF sodium is always shown in mg; only the user's own value follows the switch.
    if (key === 'sodiumMg' && !locked.has(key) && draft.sodiumUnit === 'salt_g') {
      if (n > 100) {
        errors[key] = 'Salt can’t be more than 100 g per 100';
        continue;
      }
      n = (n / SALT_PER_SODIUM) * 1000;
    }
    if (n > max) {
      errors[key] = `Can’t be more than ${max} ${unit} per 100`;
      continue;
    }
    all[key] = n;
  }

  const { addedSugarsG: added, sugarsG: total } = all;
  if (added !== undefined && total !== undefined && added > total) {
    errors.addedSugarsG = 'Added sugars can’t be more than total sugars';
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const nutrition: NutritionPer100 = {};
  for (const [key, v] of Object.entries(all) as [NutrientKey, number][]) {
    if (!locked.has(key)) nutrition[key] = v;
  }
  const ingredientsText = draft.ingredientsText.trim();
  return {
    ok: true,
    entry: {
      nutrition,
      productType: draft.productType,
      ...(ingredientsText ? { ingredientsText } : {}),
    },
  };
}
