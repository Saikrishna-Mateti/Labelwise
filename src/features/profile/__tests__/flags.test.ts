import type { OffProduct } from '../../../data/normalize';
import type { NutrientLevel } from '../../../scoring/levels';
import { EMPTY_PROFILE, profileFlags, withProfileChips, type Profile } from '../flags';

// Tags as Open Food Facts returned them for Maggi (8901058000290), trimmed.
const maggi: OffProduct = {
  allergens_tags: ['en:gluten'],
  traces_tags: ['en:gluten', 'en:milk', 'en:mustard', 'en:soybeans'],
  ingredients_analysis_tags: ['en:palm-oil', 'en:vegan-status-unknown', 'en:vegetarian'],
  ingredients_tags: [
    'en:refined-wheat-flour',
    'en:wheat-flour',
    'en:sugar',
    'en:added-sugar',
    'en:onion',
    'en:onion-family-vegetable',
    'en:root-vegetable',
    'en:garlic',
  ],
};
// Lay's Classic Salted (8901491101837): potato, no onion.
const chips: OffProduct = {
  ingredients_analysis_tags: ['en:vegan-status-unknown', 'en:vegetarian-status-unknown'],
  ingredients_tags: ['en:potato', 'en:starchy-root-vegetable', 'en:root-vegetable'],
};
const nonVegan: OffProduct = {
  ingredients_analysis_tags: ['en:non-vegan', 'en:maybe-vegetarian'],
  ingredients_tags: ['en:milk'],
};

const p = (patch: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, ...patch });
const words = (profile: Partial<Profile>, off: OffProduct, levels: NutrientLevel[] = []) =>
  profileFlags(p(profile), off, levels).chips.map((c) => c.text);

test('allergens: listed ones are "contains", trace-only ones "may contain", others ignored', () => {
  const f = profileFlags(p({ allergies: ['en:gluten', 'en:milk', 'en:peanuts'] }), maggi, []);
  expect(f.contains).toEqual(['gluten']);
  expect(f.traces).toEqual(['milk']);
});

test('Jain flags onion family and other root vegetables separately', () => {
  expect(words({ jain: true }, maggi)).toEqual(['Onion or garlic']);
  expect(words({ jain: true }, chips)).toEqual(['Root vegetables']);
});

test('diet uses OFF ingredient analysis; unknown status gives no flag', () => {
  expect(words({ vegetarian: true }, maggi)).toEqual([]);
  expect(words({ vegetarian: true }, chips)).toEqual([]);
  expect(words({ vegetarian: true }, nonVegan)).toEqual(['May not be vegetarian']);
  expect(words({ vegetarian: true, vegan: true }, nonVegan)).toEqual(['Not vegan']);
  expect(words({ vegetarian: true }, { labels_tags: ['en:non-vegetarian'] })).toEqual([
    'Not vegetarian',
  ]);
});

test('health goals: added sugar, refined flour, and high sodium from the levels', () => {
  const salty = [{ key: 'salt', level: 'high' }] as NutrientLevel[];
  expect(words({ diabetes: true, lowSodium: true }, maggi, salty)).toEqual([
    'Added sugar',
    'Refined flour',
    'High sodium',
  ]);
});

test('no ingredient data means the profile is reported as unchecked', () => {
  expect(profileFlags(p({ allergies: ['en:milk'] }), {}, []).unchecked).toBe(true);
  expect(profileFlags(p({ lowSodium: true }), {}, []).unchecked).toBe(false);
  expect(profileFlags(EMPTY_PROFILE, {}, []).unchecked).toBe(false);
});

test('profile chips go first, replace the same chip, and keep four at most', () => {
  const own = ['High sodium', 'Ultra-processed', 'Low sugar', 'Good protein'].map((text) => ({
    text,
    tone: 'concern' as const,
  }));
  const mine = [
    { text: 'Not vegan', tone: 'concern' as const },
    { text: 'High sodium', tone: 'concern' as const },
  ];
  expect(withProfileChips(mine, own).map((c) => c.text)).toEqual([
    'Not vegan',
    'High sodium',
    'Ultra-processed',
    'Low sugar',
  ]);
});
