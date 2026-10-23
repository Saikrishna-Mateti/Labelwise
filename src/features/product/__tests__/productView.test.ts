import type { OffProduct } from '../../../data/normalize';
import { mergeProduct } from '../../../data/resolver';
import fixtures from '../../../scoring/__tests__/fixtures/off-products.json';
import { overallFor, productView } from '../productView';

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

test('factors: Nutri-Score points, worst first; zero points against counts as good', () => {
  const v = productView(ok(off['8902080104581'])); // Pepsi
  if (v.kind !== 'scored') throw new Error(v.kind);
  expect(v.overall?.label).toBe('Bad');
  expect(v.factors[0]).toMatchObject({ label: 'Sugars', points: 9, max: 10, good: false });
  expect(v.factors.find((f) => f.label === 'Saturated fat')).toMatchObject({
    points: 0,
    good: true,
  });
});
