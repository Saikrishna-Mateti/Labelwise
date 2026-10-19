import { nova, novaMarkers } from '../nova';
import { nutriscore } from '../nutriscore';
import { nutrientReasons } from '../reasons';

describe('nova', () => {
  test('uses OFF group when present', () => {
    expect(
      nova.score({ productType: 'solid', nutrition: {}, off: { novaGroup: 1 } }),
    ).toMatchObject({
      value: 1,
      source: 'off',
    });
  });

  test('estimates group 4 from markers', () => {
    const r = nova.score({
      productType: 'solid',
      nutrition: {},
      ingredientsText:
        'Wheat flour, Sugar, Invert Sugar Syrup, Emulsifier [INS 322], Artificial flavouring',
    });
    expect(r).toMatchObject({ value: 4, band: 'NOVA 4 (estimated)', source: 'estimated' });
    expect(r.reasons[0].text).toBe(
      'Likely ultra-processed: contains flavours, emulsifiers, invert sugar',
    );
  });

  test('no markers: not estimated', () => {
    const r = nova.score({
      productType: 'solid',
      nutrition: {},
      ingredientsText: 'Potato, Sunflower oil, Salt',
    });
    expect(r).toMatchObject({ value: null, source: 'estimated' });
  });

  test('no ingredient list: unknown', () => {
    expect(nova.score({ productType: 'solid', nutrition: {} }).value).toBeNull();
  });

  test.each([
    ['Sweetened condensed milk', []],
    ['Sweetener (INS 955)', ['sweeteners']],
    ['Sucralose', ['sweeteners']],
    ['Permitted natural colour (INS 150d)', ['colours']],
    ['Partially hydrogenated vegetable oil', ['hydrogenated or interesterified fat']],
    ['Soy protein isolate', ['protein isolate or hydrolysed protein']],
  ])('markers in %p', (text, expected) => expect(novaMarkers(text)).toEqual(expected));
});

describe('nutrientReasons (FSSAI draft Table 1 thresholds)', () => {
  test('solid: above reference is a con, at reference is not', () => {
    const texts = nutrientReasons({ sugarsG: 21.5, sodiumMg: 450 }, 'solid').map((r) => r.text);
    expect(texts).toEqual(['High in sugar: 21.5 g per 100 g (FSSAI draft reference 21 g)']);
  });

  test('liquid uses liquid reference values', () => {
    const r = nutrientReasons({ sugarsG: 6.5 }, 'liquid');
    expect(r[0]).toEqual({
      kind: 'con',
      text: 'High in sugar: 6.5 g per 100 ml (FSSAI draft reference 6 g)',
    });
  });

  test('positive factors above minimum are pros', () => {
    const r = nutrientReasons({ proteinG: 7.09, fibreG: 3 }, 'solid');
    expect(r).toEqual([{ kind: 'pro', text: 'Contains protein: 7.1 g per 100 g' }]);
  });

  test('nothing notable with full data vs missing data', () => {
    const full = { energyKcal: 100, sugarsG: 1, saturatedFatG: 1, sodiumMg: 10 };
    expect(nutrientReasons(full, 'solid')[0].text).toMatch(/^No nutrient is above/);
    expect(nutrientReasons({}, 'solid')[0].text).toMatch(/^Not enough nutrition data/);
  });
});

describe('nutriscore (OFF pass-through until the 2023 spec is supplied)', () => {
  test('uses OFF grade', () => {
    const r = nutriscore.score({
      productType: 'solid',
      nutrition: {},
      off: { nutriscoreGrade: 'e', nutriscoreScore: 21 },
    });
    expect(r).toMatchObject({ value: 21, band: 'E', source: 'off' });
  });

  test.each(['unknown', 'not-applicable', undefined])('no usable grade (%p): null', (grade) => {
    const r = nutriscore.score({
      productType: 'solid',
      nutrition: {},
      off: { nutriscoreGrade: grade },
    });
    expect(r).toMatchObject({ value: null, band: null });
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});
