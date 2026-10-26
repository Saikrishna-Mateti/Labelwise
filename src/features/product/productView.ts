// Decides which product screen to show for a resolver result. Pure, so it is unit-tested.

import { notFoodKind, type NotFoodKind } from '../../data/normalize';
import type { Resolution, ResolvedProduct } from '../../data/resolver';
import { toScoringInput } from '../../data/resolver';
import type { OffError } from '../../data/offClient';
import { lookupAdditives, type Additive } from '../../scoring/additives';
import { biggestPointsAgainst, inr, LABEL_FOR, RISK } from '../../scoring/inr';
import { nova } from '../../scoring/nova';
import { nutriscore } from '../../scoring/nutriscore';
import type { ScoreResult, ScoringInput } from '../../scoring/types';
import { checkLimits, type LimitCheck } from '../../scoring/warnings';

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
      /** One-line summary, e.g. "Most points lost to total sugars and energy". */
      verdict: string | null;
      /** "Ultra-processed" (NOVA 4 from OFF) or "Likely ultra-processed" (estimated); else null. */
      processing: string | null;
      /** ICMR-NIN 2024 limits: energy, salt, added sugar, added fat (salt is checked but not shown yet). */
      limits: LimitCheck[];
      /** Labelwise's overall band, from the Nutri-Score grade and additives. Null without a grade. */
      overall: Overall | null;
      /** From Open Food Facts; most concerning first. */
      additives: Additive[];
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
  const additives = lookupAdditives(input.off?.additives);
  const overall = overallFor(scores.nutriscore.band, additives);
  return {
    kind: 'scored',
    product,
    scores,
    verdict: verdict(input),
    processing: processing(scores.nova),
    limits: checkLimits(input),
    overall,
    additives,
    offError,
  };
}

export type OverallBand = 'excellent' | 'good' | 'poor' | 'bad';

export interface Overall {
  band: OverallBand;
  label: string;
  grade: string;
  /** Additives with a high EFSA intake risk that moved the band down one step; empty if none did. */
  loweredBy: Additive[];
}

/** Labelwise's own mapping (docs/sources/README.md): a grade E product can never look good. */
const BAND_FOR_GRADE: Record<string, OverallBand> = {
  A: 'excellent',
  B: 'good',
  C: 'poor',
  D: 'poor',
  E: 'bad',
};

const BAND_LABEL: Record<OverallBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  poor: 'Poor',
  bad: 'Bad',
};

const ORDER: OverallBand[] = ['excellent', 'good', 'poor', 'bad'];

/**
 * Labelwise's own rule (docs/sources/README.md): the Nutri-Score band, one step lower when the
 * product has any additive EFSA found a high overexposure risk for. Bad stays Bad.
 */
export function overallFor(grade: string | null, additives: Additive[] = []): Overall | null {
  const base = grade ? BAND_FOR_GRADE[grade] : undefined;
  if (!base || !grade) return null;
  const high = additives.filter((a) => a.efsa?.risk === 'high');
  const band = high.length ? ORDER[Math.min(ORDER.indexOf(base) + 1, ORDER.length - 1)] : base;
  return { band, label: BAND_LABEL[band], grade, loweredBy: band === base ? [] : high };
}

export const joinAnd = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Built only from facts shown below it: the INR risk factors costing the most draft points. Says
 * nothing is "high": the 2022 draft defines no such limits.
 */
export function verdict(input: ScoringInput): string | null {
  const top = biggestPointsAgainst(input);
  return top.length ? `Most points lost to ${joinAnd(top)}` : null;
}

export function processing(novaResult: ScoreResult): string | null {
  if (novaResult.value !== 4) return null;
  return novaResult.source === 'off' ? 'Ultra-processed' : 'Likely ultra-processed';
}

/** Short NOVA group names (Monteiro et al.), short enough for one line in a rating tile. */
export const NOVA_GROUP: Record<number, string> = {
  1: 'Unprocessed',
  2: 'Culinary ingredient',
  3: 'Processed',
  4: 'Ultra-processed',
};

/** Labelwise's own wording per overall band (docs/sources/README.md); follows the band, nothing more. */
export const BAND_NOTE: Record<OverallBand, string> = {
  excellent: 'A good choice for regular consumption.',
  good: 'A reasonable choice for regular consumption.',
  poor: 'Best kept for occasional consumption.',
  bad: 'Not a healthy choice for regular consumption.',
};

/** The card under the hero: what cost the most points, then what the band means for regular use. */
export function summaryFor(
  verdict: string | null,
  overall: Overall | null,
): { title: string; note?: string } | null {
  const lowered = overall?.loweredBy.length
    ? ` Rated one step lower for ${joinAnd(overall.loweredBy.map((a) => a.name.toLowerCase()))}: ${overall.loweredBy.length > 1 ? 'additives' : 'an additive'} EFSA found people may eat too much of.`
    : '';
  const note = overall ? BAND_NOTE[overall.band] + lowered : undefined;
  if (verdict) return { title: verdict, note };
  return note ? { title: note } : null;
}

/** One-sentence explanations shown when a score is tapped. */
export const EXPLAIN = {
  inr: 'A 0.5 to 5 star rating from FSSAI’s 2022 draft rules, which were never finalised. FSSAI now plans warning labels instead, so treat this as a guide only. Energy, sugar, saturated fat and sodium lower it; fruit and vegetables, nuts, legumes, millets, fibre and protein raise it.',
  nutriscore:
    'A European grade from A (best) to E based on nutrients per 100 g, as calculated by Open Food Facts.',
  nova: 'Groups foods from 1 to 4 by how processed they are. Group 4 means ultra-processed.',
};
