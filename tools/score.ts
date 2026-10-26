// Usage: npm run score -- <barcode>
// Fetches one product from Open Food Facts (read-only) and prints every score with its reasons.

import { normalizeBarcode } from '../src/data/barcode';
import { scoringInputFromOff } from '../src/data/normalize';
import { lookupAdditives } from '../src/scoring/additives';
import { fetchProduct } from '../src/data/offClient';
import { inr, LABEL_FOR } from '../src/scoring/inr';
import { nova } from '../src/scoring/nova';
import { nutriscore } from '../src/scoring/nutriscore';
import type { NutrientKey } from '../src/scoring/types';

const NUTRIENT_UNITS: [NutrientKey, string][] = [
  ['energyKcal', 'kcal'],
  ['sugarsG', 'g'],
  ['saturatedFatG', 'g'],
  ['sodiumMg', 'mg'],
  ['fibreG', 'g'],
  ['proteinG', 'g'],
  ['fruitVegPct', '%'],
  ['nutsLegumesMilletsPct', '%'],
];

async function main() {
  const barcode = normalizeBarcode(process.argv[2] ?? '');
  if (!barcode) {
    console.error('Usage: npm run score -- <barcode>   (EAN-13, EAN-8 or UPC-A)');
    process.exitCode = 1;
    return;
  }

  const result = await fetchProduct(barcode);
  if (result.status === 'error') throw new Error(`Open Food Facts lookup failed: ${result.error}`);
  if (result.status === 'not_found') {
    console.log(`${barcode}: not found on Open Food Facts`);
    return;
  }

  const p = result.product;
  const input = scoringInputFromOff(p);
  console.log(`${p.product_name || '(no name)'} — ${p.brands || '(no brand)'} [${barcode}]`);
  console.log(`Type: ${input.productType}`);
  console.log(`Per ${input.productType === 'liquid' ? '100 ml' : '100 g'}:`);
  for (const [key, unit] of NUTRIENT_UNITS) {
    const v = input.nutrition[key];
    console.log(
      `  ${LABEL_FOR[key]}: ${v === undefined ? 'unknown' : `${Number(v.toFixed(1))} ${unit}`}`,
    );
  }

  for (const method of [inr, nutriscore, nova]) {
    const r = method.score(input);
    console.log(`\n${method.name}: ${r.band ?? 'not available'} (${r.source})`);
    if (r.missingInputs.length) console.log(`  missing: ${r.missingInputs.join(', ')}`);
    for (const reason of r.reasons) console.log(`  [${reason.kind}] ${reason.text}`);
  }

  const additives = lookupAdditives(p.additives_tags);
  console.log(`\nAdditives (${additives.length}):`);
  for (const a of additives) {
    const risk = a.efsa ? `EFSA overexposure risk: ${a.efsa.risk}` : 'no EFSA risk data';
    console.log(
      `  INS ${a.ins ?? '?'} ${a.name} (${a.classes.join(', ') || 'no class'}) - ${risk}`,
    );
  }
  console.log('\nData © Open Food Facts contributors (ODbL)');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
