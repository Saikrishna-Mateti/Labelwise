// Additives in a product, looked up in the Open Food Facts additives taxonomy (ODbL), rebuilt by
// `npm run additives`. The only risk information is EFSA's finding on whether usual intake may go
// over the acceptable daily intake ("overexposure"), as recorded by OFF. No finding is shown as
// "no risk data", never as safe. See docs/sources/README.md.

import offAdditives from './data/off-additives.json';

export type EfsaRisk = 'high' | 'moderate' | 'no';

export interface Additive {
  tag: string;
  /** INS number as printed on Indian packs, e.g. "621" or "322i". */
  ins?: string;
  name: string;
  /** What it does, e.g. ["Flavour enhancer"]. */
  classes: string[];
  /** yes, no, or maybe (depends on how it is made). */
  vegetarian?: 'yes' | 'no' | 'maybe';
  efsa?: { risk: EfsaRisk; date?: string; url?: string };
}

interface Entry {
  name: string;
  parents?: string[];
  ins?: string;
  classes?: string[];
  vegetarian?: string;
  efsa?: { risk: string; date?: string; url?: string };
}

const TAXONOMY = offAdditives.additives as Record<string, Entry>;

/** A field from the entry, else from its parents (E450i takes E450's EFSA finding). */
function inherited<K extends keyof Entry>(
  tag: string,
  key: K,
  seen = new Set<string>(),
): Entry[K] | undefined {
  const e = TAXONOMY[tag];
  if (!e || seen.has(tag)) return undefined;
  seen.add(tag);
  if (e[key] !== undefined) return e[key];
  for (const p of e.parents ?? []) {
    const v = inherited(p, key, seen);
    if (v !== undefined) return v;
  }
  return undefined;
}

const RISK_ORDER: Record<string, number> = { high: 0, moderate: 1 };

/** The product's additives, most concerning first. Drops a parent listed beside its sub-code. */
export function lookupAdditives(tags: string[] = []): Additive[] {
  const parents = new Set(tags.flatMap((t) => TAXONOMY[t]?.parents ?? []));
  return tags
    .filter((t) => !parents.has(t))
    .map((tag): Additive => {
      const e = TAXONOMY[tag];
      const code = tag.replace(/^\w+:/, '');
      const efsa = inherited(tag, 'efsa');
      const vegetarian = inherited(tag, 'vegetarian');
      return {
        tag,
        ins: e?.ins,
        // "E621 - Monosodium glutamate" -> "Monosodium glutamate"
        name: e?.name.replace(/^E\d+[a-z]*\s*-\s*/i, '') ?? code.toUpperCase(),
        classes: inherited(tag, 'classes') ?? [],
        ...(vegetarian && { vegetarian: vegetarian as Additive['vegetarian'] }),
        ...(efsa && { efsa: efsa as Additive['efsa'] }),
      };
    })
    .sort((a, b) => (RISK_ORDER[a.efsa?.risk ?? ''] ?? 2) - (RISK_ORDER[b.efsa?.risk ?? ''] ?? 2));
}

export const hasHighRisk = (additives: Additive[]) =>
  additives.some((a) => a.efsa?.risk === 'high');
