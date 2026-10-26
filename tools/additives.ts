// Usage: npm run additives
// Rebuilds src/scoring/data/off-additives.json from the Open Food Facts additives taxonomies (ODbL).
// Keeps only what the app shows: name, INS number, function, vegetarian status and EFSA's
// overexposure finding with its date and link. Nothing is added or edited by hand.

import { writeFileSync } from 'node:fs';

const BASE = 'https://static.openfoodfacts.org/data/taxonomies';
const UA = { 'User-Agent': 'Labelwise/0.1 (saikrrish321@gmail.com)' };
type Lang = Record<string, string>;
type Entry = Partial<Record<string, Lang>> & { parents?: string[] };

const get = async (file: string) => {
  const res = await fetch(`${BASE}/${file}`, { headers: UA });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as Record<string, Entry>;
};

async function main() {
  const [additives, classes] = await Promise.all([
    get('additives.json'),
    get('additives_classes.json'),
  ]);
  const className = (tag: string) => classes[tag.trim()]?.name?.en ?? tag.replace(/^\w+:/, '');
  const out: Record<string, object> = {};
  for (const [tag, a] of Object.entries(additives)) {
    const name = a.name?.en;
    if (!name) continue;
    const risk = a.efsa_evaluation_overexposure_risk?.en?.replace('en:', '');
    // INS numbers match E-numbers; the tag carries the sub-variant, e.g. en:e322i -> 322i.
    const ins = /^en:e(\d+[a-z]*)$/.exec(tag)?.[1];
    out[tag] = {
      name,
      ...(a.parents?.length && { parents: a.parents }),
      ...(ins && { ins }),
      ...(a.additives_classes?.en && {
        classes: a.additives_classes.en.split(',').map(className),
      }),
      ...(a.vegetarian?.en && { vegetarian: a.vegetarian.en }),
      ...(risk && {
        efsa: {
          risk,
          date: a.efsa_evaluation_date?.en?.replace(/\//g, '-'),
          url: a.efsa_evaluation_url?.en,
        },
      }),
    };
  }
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(
    'src/scoring/data/off-additives.json',
    JSON.stringify({
      _source: `Open Food Facts additives and additives_classes taxonomies (${BASE}/), retrieved ${date}. Data (c) Open Food Facts contributors, ODbL 1.0.`,
      additives: out,
    }),
  );
  console.log(`Wrote ${Object.keys(out).length} additives`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
