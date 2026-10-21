import type { NutritionPer100, ProductType, ScoringInput } from '../scoring/types';
import offAdditives from './off-additives.json';

/** Fields requested from the OFF API v2. */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories_tags',
  'nutriments',
  'nova_group',
  'nutriscore_grade',
  'nutriscore_score',
  'ingredients_text',
  'ingredients_text_en',
  'additives_tags',
  'nova_groups_markers',
] as const;

export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
  nova_group?: number;
  nutriscore_grade?: string;
  nutriscore_score?: number;
  ingredients_text?: string;
  ingredients_text_en?: string;
  additives_tags?: string[];
  /** NOVA group -> [marker type, tag], e.g. { "4": [["additives", "en:e150d"]] } */
  nova_groups_markers?: Record<string, string[][]>;
}

const KJ_PER_KCAL = 4.184;

const DAIRY_TAGS = ['en:dairies', 'en:dairy-drinks', 'en:milks'];

/**
 * FSSAI Category-II (liquid) = non-dairy beverages; everything else is solid.
 * OFF has no FSS category codes, so this uses OFF category tags. The user can override in manual entry.
 */
// ponytail: tag heuristic, beverage powders tagged en:beverages count as liquid; refine with real misses.
export function productTypeFromOff(categories: string[] = []): ProductType {
  const beverage = categories.includes('en:beverages');
  const dairy = categories.some((c) => DAIRY_TAGS.includes(c));
  return beverage && !dairy ? 'liquid' : 'solid';
}

function num(v: number | string | undefined): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

/** OFF per-100 g/ml values as sold. Prepared values (`*_prepared_100g`) are ignored on purpose. */
export function nutritionFromOff(nutriments: OffProduct['nutriments'] = {}): NutritionPer100 {
  const kcal = num(nutriments['energy-kcal_100g']);
  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments['energy_100g']);
  const sodiumG = num(nutriments['sodium_100g']);
  // OFF has no declared fruit/veg or nuts/legumes/millets % in INR's split; left undefined (missing).
  return {
    energyKcal: kcal ?? (kj !== undefined ? kj / KJ_PER_KCAL : undefined),
    sugarsG: num(nutriments['sugars_100g']),
    saturatedFatG: num(nutriments['saturated-fat_100g']),
    sodiumMg: sodiumG !== undefined ? sodiumG * 1000 : undefined,
    fibreG: num(nutriments['fiber_100g']),
    proteinG: num(nutriments['proteins_100g']),
  };
}

const ADDITIVES: Record<string, { name: string; parents?: string[] }> = offAdditives.additives;

/** "en:e150d" -> "E150d - Sulphite ammonia caramel"; unknown tags fall back to the code. */
export function additiveName(tag: string): string {
  return ADDITIVES[tag]?.name ?? tag.replace(/^\w+:/, '').toUpperCase();
}

/** Additive names, without parents that OFF adds next to a more specific code (e500 beside e500ii). */
export function additivesFromOff(tags: string[] = []): string[] {
  const parents = new Set(tags.flatMap((t) => ADDITIVES[t]?.parents ?? []));
  return tags.filter((t) => !parents.has(t)).map(additiveName);
}

/** OFF's reasons for the NOVA group it assigned, as readable text. */
export function novaMarkersFromOff(p: OffProduct): string[] {
  const markers = p.nova_group ? (p.nova_groups_markers?.[String(p.nova_group)] ?? []) : [];
  return markers.flatMap(([type, tag]) => {
    if (!type || !tag) return [];
    if (type === 'additives') return additiveName(tag);
    const label = tag.replace(/^\w+:/, '').replace(/-/g, ' ');
    return type === 'categories' ? `category: ${label}` : label;
  });
}

export function scoringInputFromOff(p: OffProduct): ScoringInput {
  return {
    nutrition: nutritionFromOff(p.nutriments),
    productType: productTypeFromOff(p.categories_tags),
    ingredientsText: p.ingredients_text_en || p.ingredients_text || undefined,
    off: {
      novaGroup: p.nova_group,
      novaMarkers: novaMarkersFromOff(p),
      nutriscoreGrade: p.nutriscore_grade,
      nutriscoreScore: p.nutriscore_score,
    },
  };
}
