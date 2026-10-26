import type {
  NutriscoreComponent,
  NutritionPer100,
  ProductType,
  ScoringInput,
} from '../scoring/types';
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
  'product_type',
  'labels_tags',
  'image_front_small_url',
  'nutriscore_data',
  'serving_quantity',
  'serving_quantity_unit',
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
  /** "food", "beauty", "petfood" or "product" since OFF merged its databases. */
  product_type?: string;
  labels_tags?: string[];
  image_front_small_url?: string;
  /** Printed serving size as OFF stores it: a number plus "g" or "ml". */
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriscore_data?: {
    components?: Partial<
      Record<
        'negative' | 'positive',
        {
          id?: string;
          points?: number;
          points_max?: number;
          value?: number | null;
          unit?: string;
        }[]
      >
    >;
  };
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
    // Declared on Indian labels; used only by the ICMR-NIN limits. OFF has no added-fat field.
    addedSugarsG: num(nutriments['added-sugars_100g']),
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

/** OFF's Nutri-Score breakdown; entries missing an id or points are skipped. */
export function nutriscoreComponentsFromOff(p: OffProduct): NutriscoreComponent[] {
  const components = p.nutriscore_data?.components ?? {};
  return (['negative', 'positive'] as const).flatMap((kind) =>
    (components[kind] ?? []).flatMap((c) =>
      c.id && typeof c.points === 'number' && typeof c.points_max === 'number'
        ? [
            {
              id: c.id,
              kind,
              points: c.points,
              pointsMax: c.points_max,
              value: typeof c.value === 'number' ? c.value : null,
              unit: c.unit ?? '',
            },
          ]
        : [],
    ),
  );
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
      nutriscoreComponents: nutriscoreComponentsFromOff(p),
    },
  };
}

/**
 * Vegetarian mark printed on the pack, from OFF label tags only (labels are copied from the
 * packaging; OFF's ingredient-based guess is ignored on purpose). The Indian marks
 * en:green-dot-india and en:brown-triangle-india have en:vegetarian / en:non-vegetarian as parents.
 */
export function vegMark(labels: string[] = []): 'veg' | 'non-veg' | null {
  const veg = labels.includes('en:vegetarian') || labels.includes('en:green-dot-india');
  const nonVeg = labels.includes('en:non-vegetarian') || labels.includes('en:brown-triangle-india');
  if (veg === nonVeg) return null; // none, or contradictory data
  return veg ? 'veg' : 'non-veg';
}

export type NotFoodKind = 'non_food' | 'alcohol' | 'supplement';

/** Records that are in OFF but should not get a food score. Category tags are from the OFF taxonomy. */
export function notFoodKind(p: OffProduct): NotFoodKind | null {
  const c = p.categories_tags ?? [];
  if ((p.product_type && p.product_type !== 'food') || c.includes('en:non-food-products')) {
    return 'non_food';
  }
  if (c.includes('en:alcoholic-beverages')) return 'alcohol';
  if (c.includes('en:dietary-supplements')) return 'supplement';
  return null;
}

export interface Serving {
  amount: number;
  unit: 'g' | 'ml';
}

/** The serving size on OFF, if it has a usable one. */
export function servingFromOff(off?: OffProduct): Serving | undefined {
  const amount = Number(off?.serving_quantity);
  const unit = off?.serving_quantity_unit;
  return amount > 0 && (unit === 'g' || unit === 'ml') ? { amount, unit } : undefined;
}
