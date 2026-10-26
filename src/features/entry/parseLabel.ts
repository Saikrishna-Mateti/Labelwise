// Turns OCR lines from a nutrition table into entry-form values. Pure, so it is tested without
// a camera. It only reads numbers printed on the pack; when a row is unclear (which column is
// "per 100 g", kJ only, "<0.5") it leaves the field empty and reports it, never guesses.

import type { NutrientKey } from '../../scoring/types';
import { FIELDS, type Draft, type SodiumUnit } from './entryForm';

export interface LabelReading {
  values: Draft['values'];
  /** Set only when a sodium or salt value was found. */
  sodiumUnit?: SodiumUnit;
  /** Rows that are on the label but not safe to fill. */
  unsure: NutrientKey[];
  /** False when no "per 100 g" heading was seen, so the column is worth a second look. */
  headingSeen: boolean;
  /** The table is per serving only and no serving size could be read, so nothing is filled. */
  perServing: boolean;
  /** Set when per-serving values were scaled to per 100 g using the printed serving size. */
  servingSize?: { amount: number; unit: 'g' | 'ml' };
}

type RowKey = NutrientKey | 'salt' | 'skip';

// Order matters: added sugars before sugars, saturated fat before the skipped "fat" rows.
const ROWS: [RegExp, RowKey][] = [
  [/^\W*energy\b|^\W*calories?\b/, 'energyKcal'],
  [/^\W*(incl\w*\b.*)?added\s*sugar/, 'addedSugarsG'],
  [/^\W*((of\s*which|total|incl\w*)\s*)*sugars?\b/, 'sugarsG'],
  [/^\W*((of\s*which|incl\w*)\s*)?(saturated|sat\.?)\s*(fat|fatty)/, 'saturatedFatG'],
  [/^\W*sodium\b/, 'sodiumMg'],
  [/^\W*salt\b/, 'salt'],
  [/^\W*(total\s*|dietary\s*)*fib(re|er)\b/, 'fibreG'],
  [/^\W*protein/, 'proteinG'],
  [
    /^\W*(total\s*)?(fat|carbohydrates?|carbs|trans|cholesterol|mono|poly|vitamin|calcium|iron|potassium)\b/,
    'skip',
  ],
];

const EXPECTED_UNIT: Partial<Record<RowKey, 'g' | 'mg' | 'kcal'>> = {
  energyKcal: 'kcal',
  sodiumMg: 'mg',
};
const MAX: Partial<Record<RowKey, number>> = {
  ...Object.fromEntries(FIELDS.map((f) => [f.key, f.max])),
  salt: 100,
};

const TOKEN = /(<\s*)?(\d+(?:\.\d+)?)\s*(kcal|kj|mg|mcg|µg|ug|gm|g|ml)?(?![a-z])/g;

const rowKey = (line: string): RowKey | undefined => ROWS.find(([re]) => re.test(line))?.[1];

/** Numbers on a row in column order; null marks a value that can't be used ("<0.5", wrong unit). */
function valuesOf(text: string, key: RowKey): (number | null)[] {
  const cleaned = text
    .replace(/per\s*100\s*(g|gm|ml)/g, ' ')
    .replace(/[\d.,]+\s*%/g, ' ')
    .replace(/(?<!\d)([1-9]\d{0,2}),(\d{3})(?!\d)/g, '$1$2') // 1,200 mg
    .replace(/(\d),(\d)/g, '$1.$2'); // 12,5 g
  const labelUnit = cleaned.match(/\((kcal|kj|mg|g|gm)\)/)?.[1];
  const want = EXPECTED_UNIT[key] ?? 'g';
  const tokens = [...cleaned.matchAll(TOKEN)].map((m) => ({
    less: !!m[1],
    n: Number(m[2]),
    unit: (m[3] ?? labelUnit)?.replace('gm', 'g'),
  }));

  if (key === 'energyKcal') {
    // "Calories" always means kcal, so a bare number on that row is kcal.
    const calories = /^\W*calories?\b/.test(cleaned);
    const kcal = tokens.filter((t) => t.unit === 'kcal' || (calories && t.unit === undefined));
    // A kJ-only row has no kcal to read, and we don't convert (the user can).
    return kcal.map((t) => (t.less ? null : t.n));
  }
  return tokens
    .filter((t) => t.unit === undefined || t.unit === 'g' || t.unit === 'mg')
    .map((t) => {
      if (t.less) return null;
      if (t.unit === undefined || t.unit === want) return t.n;
      return want === 'mg' ? t.n * 1000 : t.n / 1000; // g <-> mg
    });
}

export function parseLabel(lines: string[]): LabelReading {
  // Group lines into rows: a nutrient name starts one, number-led lines after it belong to it.
  const rows: { key: RowKey; text: string }[] = [];
  const other: string[] = [];
  let current: (typeof rows)[number] | null = null;
  for (const raw of lines) {
    const line = raw.toLowerCase().trim();
    const key = rowKey(line);
    if (key) {
      current = { key, text: line };
      rows.push(current);
    } else if (current && /^[<>]?\s*\d/.test(line)) {
      current.text += ` ${line}`;
    } else {
      current = null;
      if (line.length <= 60) other.push(line);
    }
  }

  // Which column is "per 100 g": known only when both headings are there to order.
  const heading = other.join(' ');
  const at100 = heading.search(/\b100\s*(g|gm|ml)\b/);
  const atServing = heading.search(/\b(serv(e|ing)|portion|pack|piece|bar)\b/);
  // Only rows we read count; skipped rows (iron, potassium...) often share a line.
  const columns = Math.max(
    0,
    ...rows.filter((r) => r.key !== 'skip').map((r) => valuesOf(r.text, r.key).length),
  );
  const servingHeading =
    /\b(per\s*serv(e|ing)|serving\s*size|per\s*(pack|portion|piece|bar))\b/.test(heading);
  // One column headed per serving and no per 100 g anywhere: those numbers are not per 100 g.
  const servingOnly = columns <= 1 && at100 < 0 && servingHeading;
  // "Serving size 4 cookies (34g)": the first g or ml amount after the words.
  const sized = servingOnly
    ? heading.match(/serving\s*size.{0,40}?(\d+(?:\.\d+)?)\s*(g|gm|ml)\b/)
    : null;
  const amount = Number(sized?.[1]);
  const servingSize =
    sized && amount >= 1 && amount <= 1000
      ? { amount, unit: sized[2] === 'ml' ? ('ml' as const) : ('g' as const) }
      : undefined;
  const perServing = servingOnly && !servingSize;
  const scale = servingSize ? 100 / servingSize.amount : 1;
  const per100: number | undefined =
    columns <= 1 ? 0 : at100 >= 0 && atServing >= 0 ? (at100 < atServing ? 0 : 1) : undefined;

  const found: Partial<Record<RowKey, number>> = {};
  const unsure = new Set<NutrientKey>();
  for (const { key, text } of rows) {
    if (perServing || key === 'skip' || key in found) continue;
    const vals = valuesOf(text, key);
    if (!vals.length) {
      // Numbers present but none usable (e.g. energy in kJ only).
      if (/\d/.test(text) && key !== 'salt') unsure.add(key);
      continue;
    }
    const raw = per100 === undefined ? null : vals[per100];
    const v = raw == null ? null : raw * scale;
    if (v == null || v < 0 || v > (MAX[key] ?? Infinity)) {
      if (key !== 'salt') unsure.add(key);
      continue;
    }
    found[key] = v;
  }

  const fmt = (n: number) => String(Number(n.toFixed(2)));
  const values: Draft['values'] = {};
  let sodiumUnit: SodiumUnit | undefined;
  for (const [key, v] of Object.entries(found) as [RowKey, number][]) {
    if (key === 'salt') continue;
    values[key as NutrientKey] = fmt(v);
  }
  if (found.sodiumMg !== undefined) sodiumUnit = 'sodium_mg';
  else if (found.salt !== undefined) {
    // Same switch the form already has; the form converts salt to sodium on save.
    values.sodiumMg = fmt(found.salt);
    sodiumUnit = 'salt_g';
  }
  for (const k of Object.keys(values) as NutrientKey[]) unsure.delete(k);

  return {
    values,
    ...(sodiumUnit && { sodiumUnit }),
    unsure: [...unsure],
    headingSeen: at100 >= 0,
    perServing,
    ...(servingSize && Object.keys(values).length > 0 && { servingSize }),
  };
}

/** Puts a reading into the form. Values from Open Food Facts stay as they are. */
export function applyReading(
  draft: Draft,
  reading: LabelReading,
  locked: Set<NutrientKey>,
  /** Open Food Facts already has the serving size, so the form doesn't ask for it. */
  servingKnown = false,
): { draft: Draft; applied: number } {
  const values = { ...draft.values };
  let applied = 0;
  for (const [key, v] of Object.entries(reading.values) as [NutrientKey, string][]) {
    if (locked.has(key)) continue;
    values[key] = v;
    applied++;
  }
  const sodiumUnit =
    reading.sodiumUnit && !locked.has('sodiumMg') ? reading.sodiumUnit : draft.sodiumUnit;
  // Per 100 ml values only make sense for a drink.
  const productType = reading.servingSize?.unit === 'ml' ? 'liquid' : draft.productType;
  const serving =
    reading.servingSize && !servingKnown ? String(reading.servingSize.amount) : draft.serving;
  return { draft: { ...draft, values, sodiumUnit, productType, serving }, applied };
}

/** What to tell the user after a scan. Always ends with the reminder to check against the pack. */
export function describeReading(reading: LabelReading, applied: number): string {
  if (reading.perServing) {
    return 'This label only shows values per serving, not per 100 g. Labelwise rates per 100 g, so nothing was filled. Look for a “per 100 g” column on the pack, or type the values.';
  }
  if (!applied && !reading.unsure.length) {
    return 'Couldn’t read a nutrition table. Try again in good light with the table flat and in focus, or type the values.';
  }
  const label = (k: NutrientKey) => FIELDS.find((f) => f.key === k)?.label ?? k;
  const size = reading.servingSize;
  return [
    size &&
      `This label is per serving, so values were scaled from the ${size.amount} ${size.unit} serving to per 100 ${size.unit}. Check the serving size too.`,
    applied
      ? `Filled ${applied} ${applied === 1 ? 'value' : 'values'} from the photo. Check each one against the pack.`
      : 'Nothing could be filled safely. Type the values from the pack.',
    reading.unsure.length &&
      `Not filled because they were unclear: ${reading.unsure.map(label).join(', ')}.`,
    !reading.headingSeen && 'No “per 100 g” heading was found, so make sure these are per 100 g.',
  ]
    .filter(Boolean)
    .join(' ');
}
