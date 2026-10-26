import { mergeProduct } from '../../../data/resolver';
import { draftFrom, offKeys, parseEntry, type Draft } from '../entryForm';

const draft = (values: Draft['values'], extra: Partial<Draft> = {}): Draft => ({
  values,
  sodiumUnit: 'sodium_mg',
  productType: 'solid',
  ingredientsText: '',
  serving: '',
  ...extra,
});

describe('parseEntry', () => {
  test('parses numbers, accepts a comma decimal and skips empty fields', () => {
    const r = parseEntry(draft({ energyKcal: '450', sugarsG: '2,5', fibreG: ' ' }), new Set());
    expect(r).toEqual({
      ok: true,
      entry: { nutrition: { energyKcal: 450, sugarsG: 2.5 }, productType: 'solid' },
    });
  });

  test('salt in g becomes sodium in mg (salt = sodium × 2.5)', () => {
    const r = parseEntry(draft({ sodiumMg: '2.5' }, { sodiumUnit: 'salt_g' }), new Set());
    expect(r.ok && r.entry.nutrition.sodiumMg).toBe(1000);
  });

  test('rejects text, impossible values and more added than total sugar', () => {
    const r = parseEntry(
      draft({
        energyKcal: '950',
        proteinG: 'abc',
        sugarsG: '5',
        addedSugarsG: '6',
        fruitVegPct: '101',
      }),
      new Set(),
    );
    expect(r).toEqual({
      ok: false,
      errors: {
        energyKcal: 'Can’t be more than 900 kcal per 100',
        proteinG: 'Enter a number, like 12 or 12.5',
        addedSugarsG: 'Added sugars can’t be more than total sugars',
        fruitVegPct: 'Can’t be more than 100 % per 100',
      },
    });
    const salt = parseEntry(draft({ sodiumMg: '120' }, { sodiumUnit: 'salt_g' }), new Set());
    expect(salt).toEqual({
      ok: false,
      errors: { sodiumMg: 'Salt can’t be more than 100 g per 100' },
    });
  });

  test('Open Food Facts values are shown but never saved as the user’s', () => {
    const product = mergeProduct('8901058000290', {
      code: '8901058000290',
      nutriments: { proteins_100g: 9 },
    });
    const d = draftFrom(product);
    expect(d.values.proteinG).toBe('9');
    const r = parseEntry({ ...d, values: { ...d.values, energyKcal: '400' } }, offKeys(product));
    expect(r.ok && r.entry.nutrition).toEqual({ energyKcal: 400 });
  });
});

describe('serving size', () => {
  it('is saved in g for food and ml for drinks', () => {
    const food = parseEntry(draft({}, { serving: '34' }), new Set());
    expect(food.ok && food.entry.serving).toEqual({ amount: 34, unit: 'g' });
    const drink = parseEntry(draft({}, { serving: '250,5', productType: 'liquid' }), new Set());
    expect(drink.ok && drink.entry.serving).toEqual({ amount: 250.5, unit: 'ml' });
  });

  it('is optional, and rejects nonsense', () => {
    const none = parseEntry(draft({}), new Set());
    expect(none.ok && 'serving' in none.entry).toBe(false);
    for (const serving of ['0', '5000', 'abc']) {
      const r = parseEntry(draft({}, { serving }), new Set());
      expect(!r.ok && r.errors.serving).toBeTruthy();
    }
  });
});
