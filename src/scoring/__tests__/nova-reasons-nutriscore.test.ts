import { nova, novaMarkers } from '../nova';
import { nutriscore } from '../nutriscore';

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

  test("reasons come from OFF's own breakdown, not FSSAI values", () => {
    const r = nutriscore.score({
      productType: 'liquid',
      nutrition: { sugarsG: 10.9 },
      off: {
        nutriscoreGrade: 'e',
        nutriscoreComponents: [
          { id: 'energy', kind: 'negative', points: 3, pointsMax: 10, value: 185.3, unit: 'kJ' },
          { id: 'sugars', kind: 'negative', points: 9, pointsMax: 10, value: 10.9, unit: 'g' },
          { id: 'salt', kind: 'negative', points: 0, pointsMax: 20, value: 0.01, unit: 'g' },
          { id: 'proteins', kind: 'positive', points: 2, pointsMax: 7, value: 3.4, unit: 'g' },
        ],
      },
    });
    expect(r.reasons.slice(1)).toEqual([
      { kind: 'con', text: 'Energy 185.3 kJ per 100 ml: 3 of 10 points against' },
      { kind: 'con', text: 'Sugars 10.9 g per 100 ml: 9 of 10 points against' },
      { kind: 'pro', text: 'Protein 3.4 g per 100 ml: 2 of 7 points in favour' },
    ]);
    expect(r.reasons.some((x) => x.text.includes('FSSAI'))).toBe(false);
  });
});
