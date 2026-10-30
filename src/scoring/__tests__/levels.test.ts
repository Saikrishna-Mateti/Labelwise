import { nutrientLevel, nutrientLevels } from '../levels';

test('Quaker Oats (spec fixture): energy High, saturated fat Moderate, sugars Low, protein Good', () => {
  const levels = nutrientLevels({
    productType: 'solid',
    nutrition: { energyKcal: 407, saturatedFatG: 1.9, sugarsG: 1.8, proteinG: 11.8, sodiumMg: 6 },
  });
  expect(Object.fromEntries(levels.map((l) => [l.key, l.level]))).toEqual({
    energy: 'high',
    saturatedFat: 'moderate',
    salt: 'low',
    sugars: 'low',
    addedSugars: 'unknown',
    protein: 'good',
  });
});

test.each([
  // [key, value, type, level]
  ['energy', 40, 'solid', 'low'], // FSSAI low energy: not more than 40 kcal
  ['energy', 250, 'solid', 'moderate'], // ICMR: high only when more than 250
  ['energy', 251, 'solid', 'high'],
  ['energy', 20, 'liquid', 'low'],
  ['energy', 71, 'liquid', 'high'],
  ['saturatedFat', 1.5, 'solid', 'low'],
  ['saturatedFat', 5, 'solid', 'moderate'], // FSA: high is more than 5
  ['saturatedFat', 5.1, 'solid', 'high'],
  ['saturatedFat', 2.6, 'liquid', 'high'],
  ['sugars', 5, 'solid', 'low'],
  ['sugars', 22.5, 'solid', 'moderate'],
  ['sugars', 22.6, 'solid', 'high'],
  ['sugars', 11.3, 'liquid', 'high'],
  ['addedSugars', 3, 'solid', 'within'], // ICMR has a limit but no "low"
  ['addedSugars', 3.1, 'solid', 'high'],
  ['salt', 120, 'solid', 'low'], // sodium mg: FSSAI low sodium 0.12 g
  ['salt', 200, 'solid', 'moderate'],
  ['salt', 251, 'solid', 'high'], // more than 0.625 g salt = 250 mg sodium
  ['salt', 71, 'liquid', 'high'], // ICMR drinks limit beats FSSAI "low"
  ['salt', 70, 'liquid', 'low'],
  ['protein', 5.4, 'solid', 'good'], // 10% of 54 g
  ['protein', 5.3, 'solid', 'none'],
  ['protein', 2.7, 'liquid', 'good'],
  ['protein', undefined, 'solid', 'unknown'],
] as const)('%s %s per 100 (%s) is %s', (key, value, type, level) => {
  expect(nutrientLevel(key, value, type)).toBe(level);
});
