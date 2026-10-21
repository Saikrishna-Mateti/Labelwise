// Decides which product screen to show for a resolver result. Pure, so it is unit-tested.

import { notFoodKind, type NotFoodKind } from '../../data/normalize';
import type { Resolution, ResolvedProduct } from '../../data/resolver';
import { toScoringInput } from '../../data/resolver';
import type { OffError } from '../../data/offClient';
import { biggestPointsAgainst, inr, LABEL_FOR, RISK } from '../../scoring/inr';
import { nova } from '../../scoring/nova';
import { nutriscore } from '../../scoring/nutriscore';
import type { ScoreResult, ScoringInput } from '../../scoring/types';

export interface ProductScores {
  inr: ScoreResult;
  nutriscore: ScoreResult;
  nova: ScoreResult;
}

export type ProductView =
  | { kind: 'invalid_barcode' }
  | { kind: 'not_found'; barcode: string }
  | { kind: 'unavailable'; barcode: string; error: OffError }
  | { kind: 'not_food'; product: ResolvedProduct; notFood: NotFoodKind }
  /** `missing` = readable names of the nutrients INR needs and the product lacks. */
  | { kind: 'not_enough_data'; product: ResolvedProduct; missing: string[]; offError?: OffError }
  | {
      kind: 'scored';
      product: ResolvedProduct;
      scores: ProductScores;
      /** One-line summary, e.g. "Most points lost to total sugars and energy · Ultra-processed". */
      verdict: string | null;
      offError?: OffError;
    };

export function productView(r: Resolution): ProductView {
  if (r.status === 'invalid_barcode') return { kind: 'invalid_barcode' };
  if (r.status === 'not_found') return { kind: 'not_found', barcode: r.barcode };
  if (r.status === 'unavailable')
    return { kind: 'unavailable', barcode: r.barcode, error: r.error };

  const { product, offError } = r;
  const notFood = product.off ? notFoodKind(product.off) : null;
  if (notFood) return { kind: 'not_food', product, notFood };

  const input = toScoringInput(product);
  const scores = {
    inr: inr.score(input),
    nutriscore: nutriscore.score(input),
    nova: nova.score(input),
  };
  if (scores.inr.band === null && scores.nutriscore.band === null) {
    const missing = RISK[input.productType]
      .filter((k) => input.nutrition[k] === undefined)
      .map((k) => LABEL_FOR[k]);
    return { kind: 'not_enough_data', product, missing, offError };
  }
  return { kind: 'scored', product, scores, verdict: verdict(input, scores.nova), offError };
}

export const joinAnd = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Built only from facts shown below it: the INR risk factors costing the most draft points, and the
 * NOVA group. Says nothing is "high": the 2022 draft defines no such limits.
 */
export function verdict(input: ScoringInput, novaResult: ScoreResult): string | null {
  const parts: string[] = [];
  const top = biggestPointsAgainst(input);
  if (top.length) parts.push(`Most points lost to ${joinAnd(top)}`);
  if (novaResult.value === 4) {
    parts.push(novaResult.source === 'off' ? 'Ultra-processed' : 'Likely ultra-processed');
  }
  return parts.length ? parts.join(' · ') : null;
}

/** One-sentence explanations shown when a score is tapped. */
export const EXPLAIN = {
  inr: 'A 0.5 to 5 star rating from FSSAI’s 2022 draft rules, which were never finalised. FSSAI now plans warning labels instead, so treat this as a guide only. Energy, sugar, saturated fat and sodium lower it; fruit and vegetables, nuts, legumes, millets, fibre and protein raise it.',
  nutriscore:
    'A European grade from A (best) to E based on nutrients per 100 g, as calculated by Open Food Facts.',
  nova: 'Groups foods from 1 to 4 by how processed they are. Group 4 means ultra-processed.',
};
