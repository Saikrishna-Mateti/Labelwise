// Decides which product screen to show for a resolver result. Pure, so it is unit-tested.

import { notFoodKind, type NotFoodKind } from '../../data/normalize';
import type { Resolution, ResolvedProduct } from '../../data/resolver';
import { toScoringInput } from '../../data/resolver';
import type { OffError } from '../../data/offClient';
import { lookupAdditives, type Additive } from '../../scoring/additives';
import { inr, LABEL_FOR, RISK } from '../../scoring/inr';
import { nova } from '../../scoring/nova';
import { nutriscore } from '../../scoring/nutriscore';
import type { ScoreResult } from '../../scoring/types';
import { nutrientLevels, type LevelKey, type NutrientLevel } from '../../scoring/levels';
import type { Tier } from '../../theme';

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
      /** Labelwise's overall band, from the Nutri-Score grade and additives. Null without a grade. */
      overall: Overall | null;
      /** From Open Food Facts; most concerning first. */
      additives: Additive[];
      /** Labelwise's 0-100 score (docs/sources/README.md); null without an overall band. */
      score: Score | null;
      /** Low / Moderate / High per nutrient, per 100 g or 100 ml. */
      levels: NutrientLevel[];
      /** Up to 4 chips, concerns first. */
      highlights: Highlight[];
      /** One line under the verdict, e.g. "High in sodium and saturated fat. Ultra-processed." */
      reason: string;
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
  const levels = nutrientLevels(input);
  return {
    kind: 'scored',
    product,
    scores,
    overall,
    additives,
    score: overall && scoreFor(overall, scores.inr.value, scores.nova.value),
    levels,
    highlights: highlightsFor(levels, scores.nova.value),
    reason: reasonFor(levels, scores.nova.value, overall),
    offError,
  };
}

export interface Score {
  value: number;
  tier: Tier;
  word: string;
}

const TIER_FOR: Record<OverallBand, Tier> = {
  excellent: 'great',
  good: 'moderate',
  poor: 'occasional',
  bad: 'rare',
};
const RANGE: Record<OverallBand, [number, number]> = {
  excellent: [75, 100],
  good: [50, 74],
  poor: [25, 49],
  bad: [0, 24],
};
export const TIER_WORD: Record<Tier, string> = {
  great: 'Great choice',
  moderate: 'Fine in moderation',
  occasional: 'Eat occasionally',
  rare: 'Eat rarely',
};
export const tierForScore = (value: number): Tier =>
  value >= 75 ? 'great' : value >= 50 ? 'moderate' : value >= 25 ? 'occasional' : 'rare';

/**
 * Labelwise's own 0-100 score (approved 2026-10-30, docs/sources/README.md). The overall band picks
 * the range, so the number never contradicts it; the India rating and NOVA place it inside the
 * range: the average of (stars - 0.5) / 4.5 and (4 - NOVA group) / 3, middle when both are missing.
 */
export function scoreFor(overall: Overall, stars: number | null, novaGroup: number | null): Score {
  const parts = [
    stars === null ? null : (stars - 0.5) / 4.5,
    novaGroup === null ? null : (4 - novaGroup) / 3,
  ].filter((x): x is number => x !== null);
  const f = parts.length ? parts.reduce((a, b) => a + b) / parts.length : 0.5;
  const [lo, hi] = RANGE[overall.band];
  const tier = TIER_FOR[overall.band];
  return {
    value: Math.round(lo + Math.min(1, Math.max(0, f)) * (hi - lo)),
    tier,
    word: TIER_WORD[tier],
  };
}

export interface Highlight {
  text: string;
  tone: 'concern' | 'positive';
  /** The nutrition row it points to, if any. */
  key?: LevelKey;
}

const NOUN: Record<LevelKey, string> = {
  energy: 'energy',
  saturatedFat: 'saturated fat',
  salt: 'sodium',
  sugars: 'sugar',
  addedSugars: 'added sugar',
  protein: 'protein',
};
// Concerns in the order people tend to look for them.
const CONCERN_ORDER: LevelKey[] = ['salt', 'saturatedFat', 'sugars', 'addedSugars', 'energy'];
const POSITIVE_ORDER: LevelKey[] = ['sugars', 'protein', 'salt', 'saturatedFat'];

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function highlightsFor(levels: NutrientLevel[], novaGroup: number | null): Highlight[] {
  const level = (k: LevelKey) => levels.find((l) => l.key === k)?.level;
  const concerns: Highlight[] = CONCERN_ORDER.filter((k) => level(k) === 'high').map((key) => ({
    key,
    text: `High ${NOUN[key]}`,
    tone: 'concern',
  }));
  // Third at most, as in the design, so four high nutrients can't push processing off the row.
  if (novaGroup === 4) concerns.splice(2, 0, { text: 'Ultra-processed', tone: 'concern' });
  const positives: Highlight[] = POSITIVE_ORDER.flatMap((key): Highlight[] => {
    const l = level(key);
    if (key === 'protein')
      return l === 'good' ? [{ key, text: 'Good protein', tone: 'positive' }] : [];
    return l === 'low' ? [{ key, text: `Low ${NOUN[key]}`, tone: 'positive' }] : [];
  });
  if (novaGroup === 1) positives.push({ text: 'Unprocessed', tone: 'positive' });
  return [...concerns, ...positives].slice(0, 4);
}

/** Built only from the chips' facts and the additive rule, in plain words. */
export function reasonFor(
  levels: NutrientLevel[],
  novaGroup: number | null,
  overall: Overall | null,
): string {
  const of = (lvl: string) => levels.filter((l) => l.level === lvl && l.key !== 'protein');
  const high = of('high').map((l) => NOUN[l.key]);
  const low = of('low').map((l) => NOUN[l.key]);
  const goodProtein = levels.some((l) => l.key === 'protein' && l.level === 'good');
  const sentences = [
    high.length && `High in ${joinAnd(high)}.`,
    // The additive rule moves the score, so it is never cut from the line.
    overall?.loweredBy.length &&
      `Lowered for ${joinAnd(overall.loweredBy.map((a) => a.name.toLowerCase()))}.`,
    novaGroup === 4 && 'Ultra-processed.',
    (low.length || goodProtein) &&
      capital(
        [low.length && `low in ${joinAnd(low)}`, goodProtein && 'good protein']
          .filter(Boolean)
          .join(', '),
      ) + '.',
    novaGroup === 1 && 'Minimally processed.',
  ].filter((s): s is string => typeof s === 'string');
  return sentences.slice(0, 3).join(' ');
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

/** Short NOVA group names (Monteiro et al.), short enough for one line in a rating tile. */
export const NOVA_GROUP: Record<number, string> = {
  1: 'Unprocessed',
  2: 'Culinary ingredient',
  3: 'Processed',
  4: 'Ultra-processed',
};

/** One-sentence explanations shown when a score is tapped. */
export const EXPLAIN = {
  inr: 'A 0.5 to 5 star rating from FSSAI’s 2022 draft rules, which were never finalised. FSSAI now plans warning labels instead, so treat this as a guide only. Energy, sugar, saturated fat and sodium lower it; fruit and vegetables, nuts, legumes, millets, fibre and protein raise it.',
  nutriscore:
    'A European grade from A (best) to E based on nutrients per 100 g, as calculated by Open Food Facts.',
  nova: 'Groups foods from 1 to 4 by how processed they are. Group 4 means ultra-processed.',
};
