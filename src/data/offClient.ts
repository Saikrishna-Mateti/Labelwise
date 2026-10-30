// Read-only Open Food Facts client: GET /api/v2/product for one product, and the search service
// (search.openfoodfacts.org) for healthier options. Only the fields Labelwise uses.

import { OFF_FIELDS, type OffProduct } from './normalize';

export const USER_AGENT = 'Labelwise/0.1 (saikrrish321@gmail.com)';
const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const TIMEOUT_MS = 10_000;

export type OffError = 'offline' | 'timeout' | 'rate_limited' | 'server_error';

export type OffResult =
  | { status: 'found'; product: OffProduct }
  | { status: 'not_found' }
  | { status: 'error'; error: OffError };

export type FetchProduct = (barcode: string) => Promise<OffResult>;

type JsonResult<T> =
  { status: 'ok'; body: T } | { status: 'not_found' } | { status: 'error'; error: OffError };

async function getJson<T>(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<JsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 429) return { status: 'error', error: 'rate_limited' };
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', error: 'server_error' };
    return { status: 'ok', body: (await res.json()) as T };
  } catch (e) {
    if (controller.signal.aborted) return { status: 'error', error: 'timeout' };
    // fetch rejects with TypeError when there is no connection; a bad JSON body is OFF's fault.
    return { status: 'error', error: e instanceof TypeError ? 'offline' : 'server_error' };
  } finally {
    clearTimeout(timer);
  }
}

/** `barcode` must already be normalized (see barcode.ts). */
// ponytail: no client-side throttle; one request per scan plus the cache stays far under OFF's
// read limit. HTTP 429 is reported as rate_limited; add a queue if bulk lookups ever appear.
export async function fetchProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<OffResult> {
  const r = await getJson<{ status?: number; product?: OffProduct }>(
    `${BASE_URL}/${barcode}?fields=${OFF_FIELDS.join(',')}`,
    fetchImpl,
    timeoutMs,
  );
  if (r.status !== 'ok') return r;
  return r.body.status === 1 && r.body.product
    ? { status: 'found', product: r.body.product }
    : { status: 'not_found' };
}

export type SearchResult = { status: 'ok'; codes: string[] } | { status: 'error'; error: OffError };

/**
 * Barcodes of products sold in India in one category with one of these Nutri-Score grades, lowest
 * (best) Nutri-Score points first. The caller re-scores each one; the grade here is only a first filter.
 */
export async function searchCategory(
  category: string,
  grades: string[],
  limit = 8,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<SearchResult> {
  const q = [
    'countries_tags:"en:india"',
    `categories_tags:"${category.replace(/"/g, '')}"`,
    `nutriscore_grade:(${grades.map((g) => `"${g.toLowerCase()}"`).join(' OR ')})`,
  ].join(' AND ');
  const params = new URLSearchParams({
    q,
    fields: 'code',
    page_size: String(limit),
    // Healthiest first, so the few we fetch are the likeliest to pass our own re-scoring.
    sort_by: 'nutriscore_score',
  });
  const r = await getJson<{ hits?: { code?: string }[] }>(
    `${SEARCH_URL}?${params}`,
    fetchImpl,
    timeoutMs,
  );
  if (r.status === 'error') return r;
  if (r.status === 'not_found') return { status: 'ok', codes: [] };
  return { status: 'ok', codes: (r.body.hits ?? []).flatMap((h) => (h.code ? [h.code] : [])) };
}
