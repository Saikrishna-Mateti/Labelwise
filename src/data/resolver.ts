// Barcode -> one merged product view. OFF values come first; the user's entries fill what OFF is
// missing. Every value says where it came from.

import type { NutrientKey, ProductType, ScoringInput } from '../scoring/types';
import { normalizeBarcode } from './barcode';
import type { Store, UserEntry } from './db';
import { scoringInputFromOff, servingFromOff, type OffProduct, type Serving } from './normalize';
import type { FetchProduct, OffError } from './offClient';

/** Cached OFF data younger than this is used without a network call. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Source = 'off' | 'user';

export interface Sourced<T> {
  value: T;
  source: Source;
}

export interface ResolvedProduct {
  barcode: string;
  /** Raw OFF record (name, brand, NOVA, Nutri-Score), if OFF has the product. */
  off?: OffProduct;
  offFetchedAt?: number;
  productType: Sourced<ProductType>;
  nutrition: Partial<Record<NutrientKey, Sourced<number>>>;
  ingredientsText?: Sourced<string>;
  /** For showing amounts per serving; ratings are always per 100 g. */
  serving?: Sourced<Serving>;
}

export type Resolution =
  | { status: 'invalid_barcode' }
  | { status: 'not_found'; barcode: string }
  | { status: 'unavailable'; barcode: string; error: OffError }
  /** `offError` set = OFF could not be reached; data is from the cache and/or the user. */
  | { status: 'ok'; product: ResolvedProduct; offError?: OffError };

export interface ResolverDeps {
  store: Store;
  fetchProduct: FetchProduct;
  now?: () => number;
}

export async function resolveProduct(
  input: string,
  { store, fetchProduct, now = Date.now }: ResolverDeps,
): Promise<Resolution> {
  const barcode = normalizeBarcode(input);
  if (!barcode) return { status: 'invalid_barcode' };

  const [cached, user] = await Promise.all([store.getCached(barcode), store.getUserEntry(barcode)]);
  let off = cached ?? undefined;
  let offError: OffError | undefined;

  if (!cached || now() - cached.fetchedAt >= CACHE_TTL_MS) {
    const result = await fetchProduct(barcode);
    if (result.status === 'found') {
      off = { product: result.product, fetchedAt: now() };
      await store.putCached(barcode, off.product, off.fetchedAt);
    } else if (result.status === 'not_found') {
      off = undefined;
    } else {
      offError = result.error; // keep the stale cache, if any
    }
  }

  if (!off && !user) {
    return offError
      ? { status: 'unavailable', barcode, error: offError }
      : { status: 'not_found', barcode };
  }
  const product = mergeProduct(barcode, off?.product, user ?? undefined);
  product.offFetchedAt = off?.fetchedAt;
  return offError ? { status: 'ok', product, offError } : { status: 'ok', product };
}

export function mergeProduct(barcode: string, off?: OffProduct, user?: UserEntry): ResolvedProduct {
  const fromOff = off ? scoringInputFromOff(off) : undefined;
  const offServing = servingFromOff(off);

  const nutrition: ResolvedProduct['nutrition'] = {};
  const keys = new Set([
    ...Object.keys(fromOff?.nutrition ?? {}),
    ...Object.keys(user?.nutrition ?? {}),
  ]) as Set<NutrientKey>;
  for (const key of keys) {
    const o = fromOff?.nutrition[key];
    const u = user?.nutrition[key];
    if (o !== undefined) nutrition[key] = { value: o, source: 'off' };
    else if (u !== undefined) nutrition[key] = { value: u, source: 'user' };
  }

  const ingredients = fromOff?.ingredientsText
    ? { value: fromOff.ingredientsText, source: 'off' as const }
    : user?.ingredientsText
      ? { value: user.ingredientsText, source: 'user' as const }
      : undefined;

  return {
    barcode,
    off,
    // The type is a judgement call (OFF tags are a heuristic), so the user's choice wins.
    productType: user
      ? { value: user.productType, source: 'user' }
      : { value: fromOff?.productType ?? 'solid', source: 'off' },
    nutrition,
    ingredientsText: ingredients,
    serving: offServing
      ? { value: offServing, source: 'off' }
      : user?.serving
        ? { value: user.serving, source: 'user' }
        : undefined,
  };
}

export function toScoringInput(p: ResolvedProduct): ScoringInput {
  const nutrition: ScoringInput['nutrition'] = {};
  for (const [key, v] of Object.entries(p.nutrition) as [NutrientKey, Sourced<number>][]) {
    nutrition[key] = v.value;
  }
  return {
    nutrition,
    productType: p.productType.value,
    ingredientsText: p.ingredientsText?.value,
    off: p.off ? scoringInputFromOff(p.off).off : undefined,
  };
}
