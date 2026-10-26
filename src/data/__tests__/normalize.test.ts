import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { nova } from '../../scoring/nova';
import {
  additiveName,
  notFoodKind,
  novaMarkersFromOff,
  nutriscoreComponentsFromOff,
  nutritionFromOff,
  productTypeFromOff,
  scoringInputFromOff,
  vegMark,
  type OffProduct,
} from '../normalize';

const off = fixtures as Record<string, OffProduct>;

test('Parle-G maps units: sodium g -> mg, energy in kcal', () => {
  const { nutrition, productType } = scoringInputFromOff(off['8901719101038']);
  expect(productType).toBe('solid');
  expect(nutrition.sodiumMg).toBeCloseTo(301.42, 1);
  expect(nutrition.energyKcal).toBeCloseTo(460.99, 1);
  expect(nutrition.fruitVegPct).toBeUndefined();
});

test('falls back to kJ when kcal is missing', () => {
  expect(nutritionFromOff({ energy_100g: 418.4 }).energyKcal).toBeCloseTo(100, 5);
});

test('ignores prepared values', () => {
  expect(nutritionFromOff(off['8901058000290'].nutriments)).toEqual({
    energyKcal: undefined,
    sugarsG: undefined,
    saturatedFatG: undefined,
    sodiumMg: undefined,
    fibreG: undefined,
    proteinG: undefined,
  });
});

test('numeric strings are parsed, junk is dropped', () => {
  expect(nutritionFromOff({ sugars_100g: '4.5', proteins_100g: 'abc' })).toMatchObject({
    sugarsG: 4.5,
    proteinG: undefined,
  });
});

test.each([
  [['en:beverages', 'en:sodas'], 'liquid'],
  [['en:beverages', 'en:dairies', 'en:dairy-drinks'], 'solid'],
  [['en:snacks'], 'solid'],
  [undefined, 'solid'],
])('product type for %j is %s', (tags, expected) => {
  expect(productTypeFromOff(tags)).toBe(expected);
});

describe('additives and NOVA markers', () => {
  test('unknown additive falls back to its code', () => {
    expect(additiveName('en:e9999x')).toBe('E9999X');
  });

  test("Pepsi NOVA markers are OFF's group-4 reasons only", () => {
    expect(novaMarkersFromOff(off['8902080104581'])).toEqual([
      'E150d - Sulphite ammonia caramel',
      'E436 - Polyoxyethylene sorbitan tristearate',
      'colour',
      'flavouring',
    ]);
  });

  test('NOVA reason lists the markers', () => {
    const r = nova.score(scoringInputFromOff(off['8901719101038']));
    expect(r.reasons[0].text).toBe(
      'NOVA group 4 (from Open Food Facts) because of: E322 - Lecithins; ' +
        'E471 - Mono- and diglycerides of fatty acids; E481 - Sodium stearoyl-2-lactylate; ' +
        'flavouring; invert sugar',
    );
  });

  test('no markers: plain OFF reason', () => {
    expect(novaMarkersFromOff({ nova_group: 4 })).toEqual([]);
  });
});

describe('vegMark', () => {
  test.each([
    [['en:vegetarian', 'en:green-dot-india'], 'veg'],
    [['en:non-vegetarian', 'en:brown-triangle-india'], 'non-veg'],
    [['en:green-dot-india'], 'veg'],
    [['en:vegetarian', 'en:non-vegetarian'], null], // contradictory
    [['en:organic'], null],
    [undefined, null],
  ])('%j -> %s', (labels, expected) => expect(vegMark(labels)).toBe(expected));
});

describe('notFoodKind', () => {
  test.each([
    [{ product_type: 'beauty' }, 'non_food'],
    [{ categories_tags: ['en:non-food-products', 'en:open-beauty-facts'] }, 'non_food'],
    [{ categories_tags: ['en:beverages', 'en:alcoholic-beverages', 'en:beers'] }, 'alcohol'],
    [{ categories_tags: ['en:dietary-supplements', 'en:vitamin-supplements'] }, 'supplement'],
    [{ product_type: 'food', categories_tags: ['en:snacks'] }, null],
    [{}, null],
  ])('%j -> %s', (p, expected) => expect(notFoodKind(p)).toBe(expected));
});

test('Nutri-Score breakdown from OFF (Pepsi)', () => {
  const c = nutriscoreComponentsFromOff(off['8902080104581']);
  expect(c.filter((x) => x.points > 0).map((x) => [x.id, x.points])).toEqual([
    ['energy', 3],
    ['sugars', 9],
  ]);
  expect(nutriscoreComponentsFromOff({})).toEqual([]);
});
