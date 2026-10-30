// Healthier options: products in the same category that score a better overall band in our own
// re-scoring. Pure, so it is tested without the network. Rules in docs/sources/README.md.

import { nutritionFromOff, type OffProduct } from '../../data/normalize';
import {
  fetchProduct,
  searchCategory,
  type FetchProduct,
  type OffError,
} from '../../data/offClient';
import { mergeProduct } from '../../data/resolver';
import { KCAL_PER_G } from '../../scoring/units';
import { productView, type Overall, type OverallBand } from '../product/productView';

const ORDER: OverallBand[] = ['excellent', 'good', 'poor', 'bad'];
/** Only Poor and Bad products get suggestions, and only Good or Excellent ones are suggested. */
export const wantsAlternatives = (band?: OverallBand) => band === 'poor' || band === 'bad';
const isRecommendable = (band: OverallBand) => band === 'excellent' || band === 'good';

/** Nutri-Score grades that can give Good or Excellent (A, B): the search's first filter. */
export const GOOD_GRADES = ['a', 'b'];

const isTaxonomyTag = (t: string) => /^[a-z]{2}:[a-z0-9-]+$/.test(t);

/** OFF's comparison category, then the one above it in the product's category list. */
export function categoriesFor(off: OffProduct): string[] {
  const tags = (off.categories_tags ?? []).filter(isTaxonomyTag);
  const own = off.compared_to_category ?? tags.at(-1);
  if (!own || !isTaxonomyTag(own)) return [];
  const i = tags.indexOf(own);
  const up = i > 0 ? tags[i - 1] : undefined;
  return up ? [own, up] : [own];
}

// The wider fallback for snacks, most specific first. Only snacks get one: a "healthier" pick
// from a different kind of food makes sense between snacks, not for drinks or meals.
const SNACK_GROUPS = ['en:sweet-snacks', 'en:salty-snacks', 'en:snacks'];

/** The snack group to fall back to, if the product is a snack and it isn't already searched. */
export function snackGroupFor(off: OffProduct): string | undefined {
  const tags = off.categories_tags ?? [];
  const group = SNACK_GROUPS.find((g) => tags.includes(g));
  return group && !categoriesFor(off).includes(group) ? group : undefined;
}

/**
 * Labelwise's data check (docs/sources/README.md): stated energy within 30% (or 15 kcal) of
 * 9 x fat + 4 x carbohydrate + 4 x protein. Missing values fail, since they can't be checked.
 */
export function energyConsistent(nutriments: OffProduct['nutriments'] = {}): boolean {
  const n = (k: string) => {
    const v = Number(nutriments[k]);
    return Number.isFinite(v) && nutriments[k] !== '' && nutriments[k] != null ? v : undefined;
  };
  const stated = nutritionFromOff(nutriments).energyKcal;
  const fat = n('fat_100g');
  const carbs = n('carbohydrates_100g');
  const protein = n('proteins_100g');
  if (stated === undefined || fat === undefined || carbs === undefined || protein === undefined) {
    return false;
  }
  const computed =
    KCAL_PER_G.fat * fat + KCAL_PER_G.carbohydrate * carbs + KCAL_PER_G.protein * protein;
  return Math.abs(stated - computed) <= Math.max(0.3 * computed, 15);
}

export interface Alternative {
  barcode: string;
  off: OffProduct;
  overall: Overall;
}

/** Candidates that pass the data check and rate Good or Excellent, best first, at most `max`. */
export function pickAlternatives(
  current: { barcode: string },
  candidates: OffProduct[],
  max = 5,
): Alternative[] {
  const picked: (Alternative & { points: number })[] = [];
  for (const off of candidates) {
    const barcode = off.code;
    if (!barcode || barcode === current.barcode || !energyConsistent(off.nutriments)) continue;
    const view = productView({ status: 'ok', product: mergeProduct(barcode, off) });
    if (view.kind !== 'scored' || !view.overall) continue;
    if (!isRecommendable(view.overall.band)) continue;
    picked.push({ barcode, off, overall: view.overall, points: view.scores.nutriscore.value ?? 0 });
  }
  return picked
    .sort(
      (a, b) =>
        ORDER.indexOf(a.overall.band) - ORDER.indexOf(b.overall.band) || a.points - b.points,
    )
    .slice(0, max)
    .map(({ points: _, ...a }) => a);
}

export type AlternativesResult =
  /** `wider` = nothing in the product's own category, so these are other snacks. */
  | { status: 'ok'; items: Alternative[]; category?: string; wider?: boolean }
  | { status: 'error'; error: OffError };

/**
 * Searches the product's category, then one level up, then (snacks only) its snack group, stopping
 * at the first that has something Good or Excellent.
 */
export async function findAlternatives(
  current: { barcode: string; band: OverallBand; off: OffProduct },
  deps: { search?: typeof searchCategory; fetch?: FetchProduct } = {},
): Promise<AlternativesResult> {
  const { search = searchCategory, fetch = fetchProduct } = deps;
  const group = snackGroupFor(current.off);
  for (const category of [...categoriesFor(current.off), ...(group ? [group] : [])]) {
    const found = await search(category, GOOD_GRADES);
    if (found.status === 'error') return found;
    // One at a time: a burst of parallel lookups is what trips OFF's rate limit.
    const candidates: OffProduct[] = [];
    let failed: OffError | undefined;
    for (const code of found.codes) {
      const r = await fetch(code);
      if (r.status === 'found') candidates.push(r.product);
      else if (r.status === 'error') failed = r.error;
    }
    if (failed && !candidates.length) return { status: 'error', error: failed };
    const items = pickAlternatives(current, candidates);
    if (items.length) return { status: 'ok', items, category, wider: category === group };
  }
  return { status: 'ok', items: [] };
}

/** "en:potato-crisps" -> "potato crisps" */
export const categoryName = (tag: string) => tag.replace(/^\w+:/, '').replace(/-/g, ' ');
