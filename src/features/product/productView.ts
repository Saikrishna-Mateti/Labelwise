// Decides which product screen to show for a resolver result. Pure, so it is unit-tested.

import { notFoodKind, type NotFoodKind } from '../../data/normalize';
import type { Resolution, ResolvedProduct } from '../../data/resolver';
import { toScoringInput } from '../../data/resolver';
import type { OffError } from '../../data/offClient';
import { biggestPointsAgainst, inr, inrBreakdown, LABEL_FOR, RISK, UNIT } from '../../scoring/inr';
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
      /** Labelwise's overall band, from the Nutri-Score grade. Null without a grade. */
      overall: Overall | null;
      /** What raised or lowered the overall rating, per nutrient. */
      factors: Factor[];
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
  const overall = overallFor(scores.nutriscore.band);
  return {
    kind: 'scored',
    product,
    scores,
    verdict: verdict(input, scores.nova),
    overall,
    factors: factors(input, overall !== null),
    offError,
  };
}

export type OverallBand = 'excellent' | 'good' | 'poor' | 'bad';

export interface Overall {
  band: OverallBand;
  label: string;
  grade: string;
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

export function overallFor(grade: string | null): Overall | null {
  const band = grade ? BAND_FOR_GRADE[grade] : undefined;
  return band && grade ? { band, label: BAND_LABEL[band], grade } : null;
}

/** One nutrient's share of a score. `good` = it helped (or cost nothing), else it counted against. */
export interface Factor {
  label: string;
  /** e.g. "10.9 g per 100 ml"; null when the source gives no value. */
  amount: string | null;
  points: number;
  max: number;
  good: boolean;
  /** "against" points or "in favour" points. */
  kind: 'against' | 'for';
}

const NUTRISCORE_LABEL: Record<string, string> = {
  energy: 'Energy',
  sugars: 'Sugars',
  saturated_fat: 'Saturated fat',
  salt: 'Salt',
  non_nutritive_sweeteners: 'Sweeteners',
  proteins: 'Protein',
  fiber: 'Fibre',
  fruits_vegetables_legumes: 'Fruit, vegetables and legumes',
};

const fmt = (n: number) => String(Number(n.toFixed(1)));
const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Nutri-Score's own breakdown when the overall band comes from it, otherwise the INR draft points.
 * Points against with 0 points count as good ("no points lost"); points in favour with 0 are left out.
 */
export function factors(input: ScoringInput, fromNutriscore: boolean): Factor[] {
  const per = input.productType === 'liquid' ? 'per 100 ml' : 'per 100 g';
  const ns = input.off?.nutriscoreComponents;
  const rows: Factor[] =
    fromNutriscore && ns?.length
      ? ns.map((c) => ({
          label: NUTRISCORE_LABEL[c.id] ?? capitalise(c.id.replace(/_/g, ' ')),
          amount:
            c.value === null || c.unit === 'number' ? null : `${fmt(c.value)} ${c.unit} ${per}`,
          points: c.points,
          max: c.pointsMax,
          kind: c.kind === 'negative' ? 'against' : 'for',
          good: c.kind === 'negative' ? c.points === 0 : true,
        }))
      : (inrBreakdown(input)?.components ?? []).map((c) => ({
          label: capitalise(LABEL_FOR[c.key]),
          amount: `${fmt(input.nutrition[c.key]!)} ${UNIT[c.key]} ${per}`,
          points: c.points,
          max: c.max,
          kind: c.kind,
          good: c.kind === 'against' ? c.points === 0 : true,
        }));
  return rows
    .filter((f) => f.kind === 'against' || f.points > 0)
    .sort((a, b) => b.points / b.max - a.points / a.max);
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
