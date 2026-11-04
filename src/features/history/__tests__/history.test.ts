import type { Scan } from '../../../data/db';
import { groupRows, type Row } from '../history';

const now = new Date(2026, 10, 4, 15, 0).getTime();
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).getTime();
const row = (name: string, scannedAt: number, score?: Row['score'], brand?: string): Row => ({
  scan: { id: scannedAt, barcode: name, scannedAt, off: null, user: null } as Scan,
  name,
  brand,
  score: score ?? null,
});
const great = { value: 86, tier: 'great' as const, word: 'Great choice' };
const rare = { value: 18, tier: 'rare' as const, word: 'Eat rarely' };

const rows = [
  row('Quaker Oats', at(4, 11), great, 'PepsiCo'),
  row('Noodles', at(4, 0), rare),
  row('Mango drink', at(3, 23), rare),
  row('Biscuits', at(3, 0)),
  row('Curd', at(1, 9), great),
];

test('groups by local day: today from midnight, yesterday, then earlier', () => {
  expect(groupRows(rows, '', null, now).map((g) => [g.title, g.rows.map((r) => r.name)])).toEqual([
    ['Today', ['Quaker Oats', 'Noodles']],
    ['Yesterday', ['Mango drink', 'Biscuits']],
    ['Earlier', ['Curd']],
  ]);
});

test('tier filter keeps only that tier and drops unscored rows', () => {
  expect(groupRows(rows, '', 'rare', now).flatMap((g) => g.rows.map((r) => r.name))).toEqual([
    'Noodles',
    'Mango drink',
  ]);
});

test('search matches name or brand, any case, and empty groups vanish', () => {
  expect(groupRows(rows, ' pepsi ', null, now)).toEqual([{ title: 'Today', rows: [rows[0]] }]);
  expect(groupRows(rows, 'curd', 'rare', now)).toEqual([]);
});
