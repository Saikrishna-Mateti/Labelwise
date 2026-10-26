import { hasHighRisk, lookupAdditives } from '../additives';
import type { OffProduct } from '../../data/normalize';
import fixtures from './fixtures/off-products.json';

const off = fixtures as Record<string, OffProduct>;

describe('lookupAdditives', () => {
  test('Pepsi: names, INS numbers and the EFSA finding, most concerning first', () => {
    const list = lookupAdditives(off['8902080104581'].additives_tags);
    expect(list.map((a) => [a.ins, a.name, a.efsa?.risk])).toEqual([
      ['338', 'Phosphoric acid', 'high'],
      ['436', 'Polyoxyethylene sorbitan tristearate', 'moderate'],
      ['150d', 'Sulphite ammonia caramel', 'no'],
    ]);
    expect(list[0].efsa?.url).toMatch(/^https?:\/\//);
    expect(hasHighRisk(list)).toBe(true);
  });

  test('a sub-code replaces its parent and inherits its finding and class', () => {
    const [a] = lookupAdditives(['en:e450', 'en:e450i']);
    expect(a).toMatchObject({ ins: '450i', name: 'Disodium diphosphate', efsa: { risk: 'high' } });
    expect(a.classes).toContain('Emulsifier');
  });

  test('vegetarian status comes from OFF, including "maybe"', () => {
    expect(lookupAdditives(['en:e120'])[0].vegetarian).toBe('no');
    expect(lookupAdditives(['en:e322i'])[0].vegetarian).toBe('maybe');
  });

  test('no finding is not a pass', () => {
    const list = lookupAdditives(off['8901491101837'].additives_tags); // Lay's
    expect(list.every((a) => a.efsa?.risk !== 'high')).toBe(true);
    expect(hasHighRisk(list)).toBe(false);
    expect(lookupAdditives(['en:e9999x'])).toEqual([
      { tag: 'en:e9999x', ins: undefined, name: 'E9999X', classes: [] },
    ]);
  });
});
