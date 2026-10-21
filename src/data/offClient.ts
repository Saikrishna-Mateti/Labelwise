// Read-only Open Food Facts client. Only GET /api/v2/product, only the fields Labelwise uses.

import { OFF_FIELDS, type OffProduct } from './normalize';

export const USER_AGENT = 'Labelwise/0.1 (saikrrish321@gmail.com)';
const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const TIMEOUT_MS = 10_000;

export type OffError = 'offline' | 'timeout' | 'rate_limited' | 'server_error';

export type OffResult =
  | { status: 'found'; product: OffProduct }
  | { status: 'not_found' }
  | { status: 'error'; error: OffError };

export type FetchProduct = (barcode: string) => Promise<OffResult>;

/** `barcode` must already be normalized (see barcode.ts). */
// ponytail: no client-side throttle; one request per scan plus the cache stays far under OFF's
// read limit. HTTP 429 is reported as rate_limited; add a queue if bulk lookups ever appear.
export async function fetchProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<OffResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${BASE_URL}/${barcode}?fields=${OFF_FIELDS.join(',')}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 429) return { status: 'error', error: 'rate_limited' };
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', error: 'server_error' };
    const body = (await res.json()) as { status?: number; product?: OffProduct };
    return body.status === 1 && body.product
      ? { status: 'found', product: body.product }
      : { status: 'not_found' };
  } catch (e) {
    if (controller.signal.aborted) return { status: 'error', error: 'timeout' };
    // fetch rejects with TypeError when there is no connection; a bad JSON body is OFF's fault.
    return { status: 'error', error: e instanceof TypeError ? 'offline' : 'server_error' };
  } finally {
    clearTimeout(timer);
  }
}
