import { scoringInputFromOff, type OffProduct } from '../../data/normalize';
import { inr, inrBreakdown, starsFor } from '../inr';
import type { NutritionPer100, ProductType } from '../types';
import fixtures from './fixtures/off-products.json';

const off = fixtures as Record<string, OffProduct>;

const solidZero: NutritionPer100 = { energyKcal: 0, saturatedFatG: 0, sugarsG: 0, sodiumMg: 0 };
const liquidZero: NutritionPer100 = { energyKcal: 0, sugarsG: 0 };

const baseline = (productType: ProductType, nutrition: NutritionPer100) =>
  inrBreakdown({ productType, nutrition })!.baseline;

describe('Table 2 (solid) points boundaries', () => {
  test.each([
    [{ energyKcal: 80 }, 0],
    [{ energyKcal: 80.01 }, 1],
    [{ energyKcal: 800 }, 9],
    [{ energyKcal: 801 }, 10],
    [{ energyKcal: 5000 }, 10],
    [{ saturatedFatG: 10 }, 9],
    [{ saturatedFatG: 10.1 }, 10],
    [{ saturatedFatG: 40.1 }, 25],
    [{ sugarsG: 21 }, 4],
    [{ sugarsG: 21.01 }, 5],
    [{ sugarsG: 84.01 }, 20],
    [{ sodiumMg: 90 }, 0],
    [{ sodiumMg: 2250.1 }, 25],
  ])('%j -> %i points', (n, expected) => {
    expect(baseline('solid', { ...solidZero, ...n })).toBe(expected);
  });
});

describe('Table 3 (liquid) points boundaries', () => {
  test.each([
    [{ energyKcal: 6 }, 0],
    [{ energyKcal: 60.1 }, 10],
    [{ sugarsG: 0.1 }, 0],
    [{ sugarsG: 0.11 }, 1],
    [{ sugarsG: 13.7 }, 10],
  ])('%j -> %i points', (n, expected) => {
    expect(baseline('liquid', { ...liquidZero, ...n })).toBe(expected);
  });

  test('liquid baseline ignores saturated fat and sodium', () => {
    expect(baseline('liquid', { ...liquidZero, saturatedFatG: 50, sodiumMg: 5000 })).toBe(0);
  });

  test('liquid FV skips >50 as printed: 50 -> 9, 55.1 -> 10', () => {
    const pos = (fruitVegPct: number) =>
      inrBreakdown({ productType: 'liquid', nutrition: { ...liquidZero, fruitVegPct } })!.positive;
    expect(pos(50)).toBe(9);
    expect(pos(55)).toBe(9);
    expect(pos(55.1)).toBe(10);
  });
});

describe('Table 4 capping', () => {
  const rich = { proteinG: 60, fibreG: 40, fruitVegPct: 60, nutsLegumesMilletsPct: 60 };

  test('solid baseline 20: full points (15 + 10 + 10 + 10)', () => {
    const b = inrBreakdown({
      productType: 'solid',
      nutrition: { energyKcal: 500, saturatedFatG: 10.5, sugarsG: 0, sodiumMg: 400, ...rich },
    })!;
    expect(b.baseline).toBe(20);
    expect(b.positive).toBe(45);
  });

  test('solid baseline 21: capped (7 + 5 + 5 + 5)', () => {
    const b = inrBreakdown({
      productType: 'solid',
      nutrition: { energyKcal: 500, saturatedFatG: 10.5, sugarsG: 0, sodiumMg: 500, ...rich },
    })!;
    expect(b.baseline).toBe(21);
    expect(b.positive).toBe(22);
    expect(b.finalScore).toBe(-1);
    expect(b.stars).toBe(3.5);
  });

  test('liquid baseline 10 uncapped, 11 capped (5 FV + 7 protein)', () => {
    const pos = (sugarsG: number) =>
      inrBreakdown({
        productType: 'liquid',
        nutrition: { energyKcal: 43, sugarsG, proteinG: 60, fruitVegPct: 60 },
      })!;
    expect(pos(3.2).baseline).toBe(10);
    expect(pos(3.2).positive).toBe(25);
    expect(pos(4.7).baseline).toBe(11);
    expect(pos(4.7).positive).toBe(12);
  });
});

describe('Table 6 stars', () => {
  test.each([
    [-45, 5],
    [-11, 5],
    [-10, 4.5],
    [-7, 4.5],
    [-6, 4],
    [-2, 4],
    [-1, 3.5],
    [2, 3.5],
    [3, 3],
    [6, 3],
    [7, 2.5],
    [11, 2.5],
    [12, 2],
    [15, 2],
    [16, 1.5],
    [20, 1.5],
    [21, 1],
    [24, 1],
    [25, 0.5],
  ])('solid %i -> %f stars', (score, stars) => expect(starsFor('solid', score)).toBe(stars));

  test.each([
    [-25, 5],
    [0, 5],
    [1, 4.5],
    [2, 4.5],
    [3, 4],
    [5, 3.5],
    [7, 3],
    [9, 3],
    [10, 2.5],
    [13, 2],
    [15, 2],
    [16, 1.5],
    [17, 1.5],
    [18, 1], // overlap, stricter wins
    [19, 1],
    [20, 0.5], // overlap, stricter wins
  ])('liquid %i -> %f stars', (score, stars) => expect(starsFor('liquid', score)).toBe(stars));
});

describe('inr.score', () => {
  test('complete solid input is computed, not estimated', () => {
    const r = inr.score({
      productType: 'solid',
      nutrition: { ...solidZero, fibreG: 0, proteinG: 0, fruitVegPct: 0, nutsLegumesMilletsPct: 0 },
    });
    // final score 0 falls in the solid "-1 – 2" row
    expect(r).toMatchObject({
      value: 3.5,
      band: '3.5 stars',
      source: 'computed',
      missingInputs: [],
    });
  });

  test('missing risk factor: no rating, says what is missing', () => {
    const r = inr.score({ productType: 'solid', nutrition: { energyKcal: 100, sugarsG: 1 } });
    expect(r.value).toBeNull();
    expect(r.missingInputs).toEqual(expect.arrayContaining(['saturatedFatG', 'sodiumMg']));
    expect(r.reasons[0].text).toBe('Cannot rate: missing saturated fat, sodium');
  });

  test('missing positive factors: rated but estimated, with a reason', () => {
    const r = inr.score({ productType: 'solid', nutrition: solidZero });
    expect(r.value).toBe(3.5);
    expect(r.source).toBe('estimated');
    expect(r.missingInputs).toEqual(['fruitVegPct', 'nutsLegumesMilletsPct', 'fibreG', 'proteinG']);
    expect(r.reasons[0].text).toMatch(/^Estimated: .* counted as 0/);
  });

  test.each([[{ energyKcal: 0, sugarsG: 5 }], [{ energyKcal: 20, sugarsG: 0 }]])(
    'liquid without energy or sugar is not rated: %j',
    (nutrition) => {
      const r = inr.score({ productType: 'liquid', nutrition });
      expect(r).toMatchObject({ value: null, band: 'Not rated' });
    },
  );

  test('solid with zero sugar is still rated', () => {
    expect(inr.score({ productType: 'solid', nutrition: solidZero }).value).not.toBeNull();
  });

  test('liquid overlap score is explained', () => {
    // energy 60.1 -> 10 points, sugars 10.7 -> 8 points: final 18
    const r = inr.score({
      productType: 'liquid',
      nutrition: { energyKcal: 60.1, sugarsG: 10.7, proteinG: 0 },
    });
    expect(r.value).toBe(1);
    expect(r.reasons.some((x) => x.text.includes('overlap'))).toBe(true);
  });
});

describe('real OFF products (hand-calculated from the draft tables)', () => {
  test('Parle-G: baseline 19, protein 6 -> 13 -> 2 stars, estimated', () => {
    const input = scoringInputFromOff(off['8901719101038']);
    expect(inrBreakdown(input)).toEqual({ baseline: 19, positive: 6, finalScore: 13, stars: 2 });
    expect(inr.score(input)).toMatchObject({ value: 2, source: 'estimated' });
  });

  test("Lay's Classic Salted: baseline 19, protein 5 -> 14 -> 2 stars", () => {
    const input = scoringInputFromOff(off['8901491101837']);
    expect(inrBreakdown(input)).toEqual({ baseline: 19, positive: 5, finalScore: 14, stars: 2 });
  });

  test('Pepsi (liquid): energy 7 + sugars 8 = 15 -> 2 stars', () => {
    const input = scoringInputFromOff(off['8902080104581']);
    expect(input.productType).toBe('liquid');
    expect(inrBreakdown(input)).toEqual({ baseline: 15, positive: 0, finalScore: 15, stars: 2 });
  });

  test('Maggi has only prepared values: not rated', () => {
    expect(inr.score(scoringInputFromOff(off['8901058000290'])).value).toBeNull();
  });
});
