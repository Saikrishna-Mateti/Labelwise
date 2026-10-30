import type { OffProduct } from '../../../data/normalize';
import fixtures from '../../../scoring/__tests__/fixtures/off-products.json';
import {
  GOOD_GRADES,
  categoriesFor,
  energyConsistent,
  findAlternatives,
  snackGroupFor,
  pickAlternatives,
  wantsAlternatives,
} from '../alternatives';

const off = fixtures as Record<string, OffProduct>;

// Oats-like: 9x7 + 4x66 + 4x13 = 379 kcal, stated 380.
const candidate = (code: string, grade: string, extra: Partial<OffProduct> = {}): OffProduct => ({
  code,
  product_name: `Candidate ${code}`,
  nutriscore_grade: grade,
  nutriments: {
    'energy-kcal_100g': 380,
    fat_100g: 7,
    carbohydrates_100g: 66,
    proteins_100g: 13,
    sugars_100g: 1,
    'saturated-fat_100g': 1.2,
    sodium_100g: 0.006,
    fiber_100g: 10,
  },
  ...extra,
});

test('only Poor and Bad products get suggestions, searched by grades A and B', () => {
  expect([wantsAlternatives('poor'), wantsAlternatives('bad'), wantsAlternatives('good')]).toEqual([
    true,
    true,
    false,
  ]);
  expect(GOOD_GRADES).toEqual(['a', 'b']);
});

test("category: OFF's comparison category, then one level up; unknown tags skipped", () => {
  expect(categoriesFor({ ...off['8901719101038'], compared_to_category: 'en:biscuits' })).toEqual([
    'en:biscuits',
    'en:biscuits-and-crackers',
  ]);
  // Maggi's last tag is free text, not a taxonomy tag.
  expect(categoriesFor(off['8901058000290'])).toEqual(['en:instant-noodles', 'en:noodles']);
  expect(categoriesFor({})).toEqual([]);
});

test('energy check: stated energy must roughly match fat, carbohydrate and protein', () => {
  expect(energyConsistent(candidate('1', 'a').nutriments)).toBe(true);
  expect(energyConsistent({ ...candidate('1', 'a').nutriments, 'energy-kcal_100g': 120 })).toBe(
    false,
  );
  // Missing values can't be checked, so they fail.
  expect(energyConsistent({ 'energy-kcal_100g': 380 })).toBe(false);
  expect(energyConsistent(off['8901719101038'].nutriments)).toBe(true); // Parle-G
});

test('picks only Good or Excellent products, even for a Bad one, best first, and drops bad data and the product itself', () => {
  const picks = pickAlternatives({ barcode: '8901719101038' }, [
    candidate('1', 'b'),
    candidate('2', 'a'),
    candidate('3', 'c'), // Poor: better than Bad, but not worth suggesting
    candidate('4', 'a', { nutriments: {} }), // grade but no data, like the "A" bourbon biscuit
    candidate('5', 'a', { additives_tags: ['en:e621'] }), // high-risk additive: Good, still better
    candidate('8901719101038', 'a'),
  ]);
  expect(picks.map((p) => [p.barcode, p.overall.label])).toEqual([
    ['2', 'Excellent'],
    ['1', 'Good'],
    ['5', 'Good'],
  ]);
});

test('a high-risk additive can push a candidate out', () => {
  // Grade B with MSG is Poor in our band, so it is not suggested.
  const picks = pickAlternatives({ barcode: 'x' }, [
    candidate('1', 'b', { additives_tags: ['en:e621'] }),
  ]);
  expect(picks).toEqual([]);
});

test('findAlternatives goes one category up when the first has nothing better', async () => {
  const search = jest.fn(async (category: string, _grades: string[]) => ({
    status: 'ok' as const,
    codes: category === 'en:biscuits' ? ['3'] : ['2'],
  }));
  const products: Record<string, OffProduct> = {
    '2': candidate('2', 'a'),
    '3': candidate('3', 'c'),
  };
  const fetch = jest.fn(async (code: string) => ({
    status: 'found' as const,
    product: products[code],
  }));
  const r = await findAlternatives(
    {
      barcode: '8901719101038',
      band: 'poor',
      off: { ...off['8901719101038'], compared_to_category: 'en:biscuits' },
    },
    { search, fetch },
  );
  expect(search.mock.calls.map((c) => c[0])).toEqual(['en:biscuits', 'en:biscuits-and-crackers']);
  expect(search.mock.calls[0][1]).toEqual(['a', 'b']);
  expect(r).toMatchObject({ status: 'ok', category: 'en:biscuits-and-crackers' });
  expect(r.status === 'ok' && r.items.map((i) => i.barcode)).toEqual(['2']);
});

test('findAlternatives passes on a search error', async () => {
  const r = await findAlternatives(
    { barcode: 'x', band: 'bad', off: off['8901719101038'] },
    { search: async () => ({ status: 'error', error: 'rate_limited' }) },
  );
  expect(r).toEqual({ status: 'error', error: 'rate_limited' });
});

test('findAlternatives reports an error when every lookup failed', async () => {
  const r = await findAlternatives(
    {
      barcode: 'x',
      band: 'bad',
      off: { ...off['8901719101038'], compared_to_category: 'en:biscuits' },
    },
    {
      search: async () => ({ status: 'ok', codes: ['1', '2'] }),
      fetch: async () => ({ status: 'error', error: 'rate_limited' }),
    },
  );
  expect(r).toEqual({ status: 'error', error: 'rate_limited' });
});

test('snacks fall back to their snack group; drinks and meals do not', () => {
  expect(snackGroupFor(off['8901719101038'])).toBe('en:sweet-snacks'); // Parle-G
  expect(snackGroupFor(off['8901491101837'])).toBe('en:salty-snacks'); // Lay's
  expect(snackGroupFor(off['8902080104581'])).toBeUndefined(); // Pepsi
  expect(snackGroupFor(off['8901058000290'])).toBeUndefined(); // Maggi
});

test('findAlternatives tries the snack group last and marks the results as wider', async () => {
  const search = jest.fn(async (category: string, _grades: string[]) => ({
    status: 'ok' as const,
    codes: category === 'en:sweet-snacks' ? ['2'] : ['3'],
  }));
  const products: Record<string, OffProduct> = {
    '2': candidate('2', 'a'),
    '3': candidate('3', 'c'),
  };
  const r = await findAlternatives(
    {
      barcode: '8901719101038',
      band: 'bad',
      off: { ...off['8901719101038'], compared_to_category: 'en:biscuits' },
    },
    { search, fetch: async (code) => ({ status: 'found', product: products[code] }) },
  );
  expect(search.mock.calls.map((c) => c[0])).toEqual([
    'en:biscuits',
    'en:biscuits-and-crackers',
    'en:sweet-snacks',
  ]);
  expect(r).toMatchObject({ status: 'ok', category: 'en:sweet-snacks', wider: true });
});
