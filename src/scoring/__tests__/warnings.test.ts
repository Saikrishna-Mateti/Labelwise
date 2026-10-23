import { checkLimits } from '../warnings';

const status = (input: Parameters<typeof checkLimits>[0]) =>
  Object.fromEntries(checkLimits(input).map((c) => [c.key, c.status]));

test('solid limits (DGI 2024 Table 15.1): high only when more than the value', () => {
  // Parle-G: 461 kcal, 320 mg sodium = 0.8 g salt; no added sugar or added fat on OFF.
  expect(status({ productType: 'solid', nutrition: { energyKcal: 461, sodiumMg: 320 } })).toEqual({
    energy: 'high',
    salt: 'high',
    addedSugars: 'unknown',
    addedFat: 'unknown',
  });
  // Exactly at the limit is within it; total sugars never stand in for added sugars.
  expect(
    status({
      productType: 'solid',
      nutrition: { energyKcal: 250, sodiumMg: 250, sugarsG: 30, addedSugarsG: 3, addedFatG: 4.3 },
    }),
  ).toEqual({ energy: 'within', salt: 'within', addedSugars: 'within', addedFat: 'high' });
});

test('liquid limits are per 100 ml', () => {
  // Pepsi-like: 43 kcal, 10.9 g added sugar.
  expect(
    status({
      productType: 'liquid',
      nutrition: { energyKcal: 43, sodiumMg: 80, addedSugarsG: 10.9 },
    }),
  ).toEqual({ energy: 'within', salt: 'high', addedSugars: 'high', addedFat: 'unknown' });
});
