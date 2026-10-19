import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { nova } from '../../scoring/nova';
import {
  additiveName,
  additivesFromOff,
  novaMarkersFromOff,
  nutritionFromOff,
  productTypeFromOff,
  scoringInputFromOff,
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
  test('Pepsi additives get names from the OFF taxonomy', () => {
    expect(additivesFromOff(off['8902080104581'].additives_tags)).toEqual([
      'E150d - Sulphite ammonia caramel',
      'E338 - Phosphoric acid',
      'E436 - Polyoxyethylene sorbitan tristearate',
    ]);
  });

  test('parent codes are dropped when a more specific code is present', () => {
    const names = additivesFromOff(['en:e500', 'en:e500ii']);
    expect(names).toEqual(['E500ii - Sodium hydrogen carbonate']);
  });

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
