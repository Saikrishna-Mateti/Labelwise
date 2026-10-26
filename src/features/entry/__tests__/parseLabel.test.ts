import { draftFrom } from '../entryForm';
import { applyReading, describeReading, parseLabel } from '../parseLabel';

// Synthetic OCR output: shapes Indian nutrition tables commonly produce, not real photos.
describe('parseLabel', () => {
  it('picks the per 100 g column when it comes first', () => {
    const r = parseLabel([
      'NUTRITION INFORMATION',
      'Per 100 g',
      'Per Serve (30 g)',
      'Energy 450 kcal 135 kcal',
      'Protein 7.1 g 2.1 g',
      'Total Fat 12 g 3.6 g',
      'Saturated Fat 5.5 g 1.7 g',
      'Total Sugars 24.8 g 7.4 g',
      'Added Sugars 24 g 7.2 g',
      'Sodium 320 mg 96 mg',
    ]);
    expect(r.values).toEqual({
      energyKcal: '450',
      proteinG: '7.1',
      saturatedFatG: '5.5',
      sugarsG: '24.8',
      addedSugarsG: '24',
      sodiumMg: '320',
    });
    expect(r.sodiumUnit).toBe('sodium_mg');
    expect(r.unsure).toEqual([]);
    expect(r.headingSeen).toBe(true);
  });

  it('picks the second column when per serve is printed first', () => {
    const r = parseLabel([
      'Per serve (30 g)',
      'Per 100 g',
      'Energy 135 kcal 450 kcal',
      'Protein 2.1 g 7.1 g',
    ]);
    expect(r.values).toEqual({ energyKcal: '450', proteinG: '7.1' });
  });

  it('leaves two-column rows empty when the columns can not be ordered', () => {
    const r = parseLabel(['Energy 450 kcal 135 kcal', 'Protein 7.1 g 2.1 g']);
    expect(r.values).toEqual({});
    expect(r.unsure.sort()).toEqual(['energyKcal', 'proteinG']);
  });

  it('reads a single column and notes a missing heading', () => {
    const r = parseLabel(['Energy (kcal)', '389', 'Protein (g)', '7.1']);
    expect(r.values).toEqual({ energyKcal: '389', proteinG: '7.1' });
    expect(r.headingSeen).toBe(false);
  });

  it('joins values that OCR put on separate lines', () => {
    const r = parseLabel([
      'Per 100 g',
      'Energy',
      '389 kcal',
      'Protein',
      '7.1 g',
      '% RDA',
      'Dietary Fibre',
      '2.5 g',
    ]);
    expect(r.values).toEqual({ energyKcal: '389', proteinG: '7.1', fibreG: '2.5' });
  });

  it('takes kcal from a kJ / kcal pair and never converts kJ alone', () => {
    expect(parseLabel(['Per 100 g', 'Energy 1628 kJ / 389 kcal']).values).toEqual({
      energyKcal: '389',
    });
    const kj = parseLabel(['Per 100 g', 'Energy 1628 kJ']);
    expect(kj.values).toEqual({});
    expect(kj.unsure).toEqual(['energyKcal']);
  });

  it('ignores % daily value numbers and comma decimals', () => {
    const r = parseLabel(['Per 100 g', 'Protein 7,1 g 14%', 'Sodium 1,200 mg 50%']);
    expect(r.values).toEqual({ proteinG: '7.1', sodiumMg: '1200' });
  });

  it('converts sodium in g to mg and flags "<" values', () => {
    const r = parseLabel(['Per 100 g', 'Sodium 0.32 g', 'Protein <0.5 g']);
    expect(r.values).toEqual({ sodiumMg: '320' });
    expect(r.unsure).toEqual(['proteinG']);
  });

  it('uses salt through the salt switch only when sodium is absent', () => {
    expect(parseLabel(['Per 100 g', 'Salt 0.8 g'])).toMatchObject({
      values: { sodiumMg: '0.8' },
      sodiumUnit: 'salt_g',
    });
    expect(parseLabel(['Per 100 g', 'Sodium 320 mg', 'Salt 0.8 g'])).toMatchObject({
      values: { sodiumMg: '320' },
      sodiumUnit: 'sodium_mg',
    });
  });

  it('rejects impossible values and does not read ingredient text as a row', () => {
    const r = parseLabel([
      'Per 100 g',
      'Energy 3890 kcal',
      'Protein 7.1 g',
      'Ingredients: Sugar 20 g, salt',
    ]);
    expect(r.values).toEqual({ proteinG: '7.1' });
    expect(r.unsure).toEqual(['energyKcal']);
  });

  it('returns nothing for unrelated text', () => {
    expect(parseLabel(['MRP Rs. 20', 'Best before 6 months'])).toMatchObject({
      values: {},
      unsure: [],
    });
  });
});

describe('applyReading', () => {
  const reading = parseLabel(['Per 100 g', 'Energy 450 kcal', 'Protein 7.1 g', 'Salt 0.8 g']);

  it('fills the form but never touches values locked to Open Food Facts', () => {
    const { draft, applied } = applyReading(draftFrom(), reading, new Set(['proteinG']));
    expect(draft.values).toEqual({ energyKcal: '450', sodiumMg: '0.8' });
    expect(draft.sodiumUnit).toBe('salt_g');
    expect(applied).toBe(2);
  });

  it('keeps the sodium unit when sodium is locked', () => {
    const { draft } = applyReading(draftFrom(), reading, new Set(['sodiumMg']));
    expect(draft.sodiumUnit).toBe('sodium_mg');
  });
});

describe('describeReading', () => {
  it('asks to check against the pack, and names unclear rows', () => {
    const r = parseLabel(['Energy 1628 kJ', 'Protein 7.1 g']);
    const text = describeReading(r, 1);
    expect(text).toContain('Filled 1 value');
    expect(text).toContain('Energy');
    expect(text).toContain('per 100 g');
  });

  it('says so when nothing was read', () => {
    expect(describeReading(parseLabel(['MRP Rs. 20']), 0)).toContain('Couldn’t read');
  });
});

// Real Vision output from a US-style cookie label (per serving only), captured on an iPhone.
const US_COOKIES = [
  'Nutrition Facts',
  'About 18 servings per container',
  'Serving size',
  '4 Cookies (34g)',
  'Amount per serving',
  'Calories',
  '170',
  'Total Fat 8g',
  'Saturated Fat 3.5g',
  'Trans Fat 0g',
  'Cholesterol 1mg',
  'Sodium 75mg',
  'Total Carbohydrate 23g',
  'Dietary Fibre 0g',
  'Total Sugars 7g',
  'Includes 7g Added Sugars',
  'Protein 2g',
  '% Daily Value*',
  '10%',
  '18%',
  'Vitamin D 0mcg',
  '0% • Calcium 10mg',
  '1%',
  'Iron 1 mg',
  '5% • Potassium 45mg',
  '1%',
];

describe('per-serving labels', () => {
  it('scales per serving to per 100 g using the printed serving size', () => {
    const r = parseLabel(US_COOKIES);
    expect(r.perServing).toBe(false);
    expect(r.servingSize).toEqual({ amount: 34, unit: 'g' });
    expect(r.values).toEqual({
      energyKcal: '500',
      saturatedFatG: '10.29',
      sodiumMg: '220.59',
      fibreG: '0',
      sugarsG: '20.59',
      addedSugarsG: '20.59',
      proteinG: '5.88',
    });
    expect(describeReading(r, 7)).toContain('scaled from the 34 g serving');
  });

  it('refuses when no serving size can be read', () => {
    const r = parseLabel(US_COOKIES.filter((l) => !l.includes('34g')));
    expect(r).toMatchObject({ values: {}, unsure: [], perServing: true });
    expect(describeReading(r, 0)).toContain('per serving');
  });

  it('treats a millilitre serving as a drink', () => {
    const r = parseLabel(['Serving size 250 ml', 'Per serving', 'Calories 100', 'Sugars 20 g']);
    expect(r.servingSize).toEqual({ amount: 250, unit: 'ml' });
    expect(r.values).toEqual({ energyKcal: '40', sugarsG: '8' });
    expect(applyReading(draftFrom(), r, new Set()).draft.productType).toBe('liquid');
  });

  it('reads the same rows once the column is headed per 100 g, and Calories means kcal', () => {
    const r = parseLabel(['Per 100 g', ...US_COOKIES.slice(5)]);
    expect(r.perServing).toBe(false);
    expect(r.values).toEqual({
      energyKcal: '170',
      saturatedFatG: '3.5',
      sodiumMg: '75',
      fibreG: '0',
      sugarsG: '7',
      addedSugarsG: '7',
      proteinG: '2',
    });
  });
});
