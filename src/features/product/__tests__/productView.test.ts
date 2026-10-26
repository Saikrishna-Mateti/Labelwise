import type { OffProduct } from '../../../data/normalize';
import { mergeProduct } from '../../../data/resolver';
import fixtures from '../../../scoring/__tests__/fixtures/off-products.json';
import { lookupAdditives } from '../../../scoring/additives';
import { overallFor, productView, summaryFor } from '../productView';

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

test('summary says when additives lowered the band', () => {
  expect(summaryFor(null, overallFor('B', lookupAdditives(['en:e621'])))?.title).toBe(
    'Best kept for occasional consumption. Rated one step lower for monosodium glutamate: an additive EFSA found people may eat too much of.',
  );
});

test('Pepsi: additives come through, most concerning first', () => {
  const view = productView(ok(off['8902080104581']));
  expect(view.kind === 'scored' && view.additives.map((a) => a.ins)).toEqual([
    '338',
    '436',
    '150d',
  ]);
});

test('summary card: points lost first, then a line that follows the overall band', () => {
  const verdict = 'Most points lost to total sugars and energy';
  expect(summaryFor(verdict, overallFor('E'))).toEqual({
    title: verdict,
    note: 'Not a healthy choice for regular consumption.',
  });
  expect(summaryFor(verdict, overallFor('C'))?.note).toBe('Best kept for occasional consumption.');
  expect(summaryFor(verdict, overallFor('A'))?.note).toBe('A good choice for regular consumption.');
  // Nothing lost: the band line becomes the title. No band and no verdict: no card.
  expect(summaryFor(null, overallFor('A'))).toEqual({
    title: 'A good choice for regular consumption.',
  });
  expect(summaryFor(verdict, null)).toEqual({ title: verdict, note: undefined });
  expect(summaryFor(null, null)).toBeNull();
});
