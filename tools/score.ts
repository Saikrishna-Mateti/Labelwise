// Usage: npm run score -- <barcode>
// Fetches one product from Open Food Facts (read-only) and prints every score with its reasons.

import {
  additivesFromOff,
  OFF_FIELDS,
  scoringInputFromOff,
  type OffProduct,
} from '../src/data/normalize';
import { inr } from '../src/scoring/inr';
import { nova } from '../src/scoring/nova';
import { nutriscore } from '../src/scoring/nutriscore';

// ponytail: inline fetch; Milestone 2's offClient.ts (timeouts, offline, cache) replaces this.
const USER_AGENT = 'Labelwise/0.1 (https://github.com/Saikrishna-Mateti/Labelwise)';

async function main() {
  const barcode = process.argv[2]?.trim();
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    console.error('Usage: npm run score -- <barcode>   (8-14 digits)');
    process.exit(1);
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${OFF_FIELDS.join(',')}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok && res.status !== 404) throw new Error(`OFF returned HTTP ${res.status}`);
  const body = (await res.json()) as { status: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) {
    console.log(`${barcode}: not found on Open Food Facts`);
    return;
  }

  const p = body.product;
  const input = scoringInputFromOff(p);
  console.log(`${p.product_name || '(no name)'} — ${p.brands || '(no brand)'} [${barcode}]`);
  console.log(`Type: ${input.productType}`);
  console.log('Per 100:', JSON.stringify(input.nutrition));

  for (const method of [inr, nutriscore, nova]) {
    const r = method.score(input);
    console.log(`\n${method.name}: ${r.band ?? 'not available'} (${r.source})`);
    if (r.missingInputs.length) console.log(`  missing: ${r.missingInputs.join(', ')}`);
    for (const reason of r.reasons) console.log(`  [${reason.kind}] ${reason.text}`);
  }

  const additives = additivesFromOff(p.additives_tags);
  console.log(`\nAdditives (${additives.length}):`);
  for (const a of additives) console.log(`  ${a}`);
  console.log('\nData © Open Food Facts contributors (ODbL)');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
