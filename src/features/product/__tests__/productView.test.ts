import type { OffProduct } from '../../../data/normalize';
import { mergeProduct } from '../../../data/resolver';
import fixtures from '../../../scoring/__tests__/fixtures/off-products.json';
import { lookupAdditives } from '../../../scoring/additives';
import type { NutrientLevel } from '../../../scoring/levels';
import {
  highlightsFor,
  overallFor,
  productView,
  reasonFor,
  scoreFor,
  tierForScore,
} from '../productView';

const off = fixtures as Record<string, OffProduct>;
const ok = (p: OffProduct, offError?: 'offline') => ({
  status: 'ok' as const,
  product: mergeProduct(p.code!, p),
  offError,
});

test('passes through lookup failures', () => {
  expect(productView({ status: 'invalid_barcode' })).toEqual({ kind: 'invalid_barcode' });
  expect(productView({ status: 'not_found', barcode: '1' })).toEqual({
    kind: 'not_found',
    barcode: '1',
  });
  expect(productView({ status: 'unavailable', barcode: '1', error: 'offline' })).toEqual({
    kind: 'unavailable',
    barcode: '1',
    error: 'offline',
  });
});

test('scored product keeps the offline flag', () => {
  const v = productView(ok(off['8901719101038'], 'offline'));
  if (v.kind !== 'scored') throw new Error(v.kind);
  expect(v.scores.inr.band).toBe('2 stars');
  expect(v.offError).toBe('offline');
});

test('only prepared values and no Nutri-Score: not enough data, naming what is missing', () => {
  const { nutriscore_grade, nutriscore_score, ...maggi } = off['8901058000290'];
  const v = productView(ok(maggi));
  if (v.kind !== 'not_enough_data') throw new Error(v.kind);
  expect(v.missing).toEqual(['energy', 'saturated fat', 'total sugars', 'sodium']);
});

test('a Nutri-Score alone is enough to show the product', () => {
  expect(productView(ok(off['8901058000290'])).kind).toBe('scored');
});

test('non-food and alcohol are not scored', () => {
  expect(productView(ok({ ...off['8901719101038'], product_type: 'beauty' })).kind).toBe(
    'not_food',
  );
  const beer = productView(ok({ code: '1', categories_tags: ['en:alcoholic-beverages'] }));
  expect(beer).toMatchObject({ kind: 'not_food', notFood: 'alcohol' });
});

test('overall band follows the Nutri-Score grade, so an E never looks good', () => {
  expect(['A', 'B', 'C', 'D', 'E'].map((g) => overallFor(g)?.label)).toEqual([
    'Excellent',
    'Good',
    'Poor',
    'Poor',
    'Bad',
  ]);
  expect(overallFor(null)).toBeNull();
});

test('a high EFSA intake risk additive lowers the band one step; Bad stays Bad', () => {
  const msg = lookupAdditives(['en:e621']); // EFSA: high
  const caramel = lookupAdditives(['en:e150d']); // EFSA: no
  const moderate = lookupAdditives(['en:e436']); // EFSA: moderate
  expect(['A', 'B', 'C', 'E'].map((g) => overallFor(g, msg)?.label)).toEqual([
    'Good',
    'Poor',
    'Bad',
    'Bad',
  ]);
  expect(overallFor('B', msg)?.loweredBy.map((a) => a.ins)).toEqual(['621']);
  expect(overallFor('E', msg)?.loweredBy).toEqual([]); // nothing lower to go
  expect(overallFor('B', caramel)?.label).toBe('Good');
  expect(overallFor('B', moderate)?.label).toBe('Good');
  // Two high-risk additives still mean one step.
  expect(overallFor('A', lookupAdditives(['en:e621', 'en:e250']))?.label).toBe('Good');
});

test('Pepsi: additives come through, most concerning first', () => {
  const view = productView(ok(off['8902080104581']));
  expect(view.kind === 'scored' && view.additives.map((a) => a.ins)).toEqual([
    '338',
    '436',
    '150d',
  ]);
});

describe('0-100 score (Labelwise, approved 2026-10-30)', () => {
  const a = overallFor('A')!;
  test('the band picks the range; India rating and NOVA place it inside', () => {
    expect(scoreFor(a, 4, 1)).toEqual({ value: 97, tier: 'great', word: 'Great choice' }); // Quaker
    expect(scoreFor(overallFor('B')!, 4, 1).value).toBe(71);
    expect(scoreFor(overallFor('D')!, 2, 4).value).toBe(29); // Lay's
    expect(scoreFor(overallFor('E')!, null, 4).value).toBe(0); // Maggi
    expect(scoreFor(a, null, null).value).toBe(88); // middle of 75-100
  });

  test('never leaves its band, so it never contradicts the verdict', () => {
    for (const g of ['A', 'B', 'C', 'D', 'E']) {
      const o = overallFor(g)!;
      for (const stars of [0.5, 5, null]) {
        for (const n of [1, 4, null]) {
          expect(tierForScore(scoreFor(o, stars, n).value)).toBe(scoreFor(o, stars, n).tier);
        }
      }
    }
  });

  test('a high-risk additive drops it into the lower range', () => {
    const lowered = overallFor('A', lookupAdditives(['en:e621']))!;
    expect(scoreFor(lowered, 4, 1)).toMatchObject({ tier: 'moderate', value: 71 });
  });
});

describe('highlights and reason line', () => {
  const levels = (map: Record<string, string>) =>
    Object.entries(map).map(([key, level]) => ({ key, level }) as NutrientLevel);

  test('noodles-like: concerns first, max 4', () => {
    const l = levels({
      salt: 'high',
      saturatedFat: 'high',
      energy: 'high',
      sugars: 'low',
      protein: 'good',
    });
    expect(highlightsFor(l, 4).map((h) => h.text)).toEqual([
      'High sodium',
      'High saturated fat',
      'Ultra-processed',
      'High energy',
    ]);
    expect(reasonFor(l, 4, null)).toBe(
      'High in sodium, saturated fat and energy. Ultra-processed. Low in sugar, good protein.',
    );
  });

  test('Quaker-like', () => {
    const l = levels({ energy: 'high', saturatedFat: 'moderate', sugars: 'low', protein: 'good' });
    expect(highlightsFor(l, 1).map((h) => h.text)).toEqual([
      'High energy',
      'Low sugar',
      'Good protein',
      'Unprocessed',
    ]);
  });

  test('the additive rule is always in the reason line', () => {
    const l = levels({ salt: 'high', sugars: 'low' });
    expect(reasonFor(l, 4, overallFor('B', lookupAdditives(['en:e621'])))).toBe(
      'High in sodium. Lowered for monosodium glutamate. Ultra-processed.',
    );
  });
});
