// History list logic: search, tier filter and Today / Yesterday / Earlier groups.

import type { Scan } from '../../data/db';
import type { Tier } from '../../theme';
import { nameOfScan, viewOfScan } from '../product/productView';

export interface Row {
  scan: Scan;
  name: string;
  brand?: string;
  score: { value: number; tier: Tier; word: string } | null;
}

export interface Group {
  title: 'Today' | 'Yesterday' | 'Earlier';
  rows: Row[];
}

export function toRow(scan: Scan): Row {
  const view = viewOfScan(scan);
  return {
    scan,
    name: nameOfScan(scan),
    brand: scan.off?.brands || undefined,
    score: view?.kind === 'scored' ? view.score : null,
  };
}

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** Rows matching the search text (name or brand) and tier, grouped by day, newest first. */
export function groupRows(
  rows: Row[],
  query: string,
  tier: Tier | null,
  now = Date.now(),
): Group[] {
  const q = query.trim().toLowerCase();
  const today = startOfDay(now);
  const yesterday = startOfDay(today - 1);
  const groups: Group[] = [];
  for (const row of rows) {
    if (tier && row.score?.tier !== tier) continue;
    if (q && !`${row.name} ${row.brand ?? ''}`.toLowerCase().includes(q)) continue;
    const at = row.scan.scannedAt;
    const title = at >= today ? 'Today' : at >= yesterday ? 'Yesterday' : 'Earlier';
    const last = groups.at(-1);
    if (last?.title === title) last.rows.push(row);
    else groups.push({ title, rows: [row] });
  }
  return groups;
}

/** "11:20" for today and yesterday, "22 Oct" before that. */
export const timeLabel = (ms: number, group: Group['title']) =>
  new Date(ms).toLocaleString(
    undefined,
    group === 'Earlier'
      ? { day: 'numeric', month: 'short' }
      : { hour: '2-digit', minute: '2-digit' },
  );
