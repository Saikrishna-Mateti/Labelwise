// Profile flags: what in a product matters to this user. Flags only; scores never change.
// Every check reads Open Food Facts tags (allergens, traces, ingredient analysis and the
// ingredients taxonomy, where onion and garlic sit under en:root-vegetable), never our own lists.

import type { OffProduct } from '../../data/normalize';
import { vegMark } from '../../data/normalize';
import type { NutrientLevel } from '../../scoring/levels';
import type { Highlight } from '../product/productView';

export const ALLERGENS = [
  ['en:peanuts', 'Peanuts'],
  ['en:nuts', 'Tree nuts'],
  ['en:milk', 'Milk'],
  ['en:gluten', 'Gluten'],
  ['en:soybeans', 'Soy'],
  ['en:sesame-seeds', 'Sesame'],
  ['en:eggs', 'Egg'],
  ['en:fish', 'Fish'],
  ['en:crustaceans', 'Crustaceans'],
  ['en:sulphur-dioxide-and-sulphites', 'Sulphites'],
] as const;
export type AllergenTag = (typeof ALLERGENS)[number][0];

export interface Profile {
  vegetarian: boolean;
  vegan: boolean;
  jain: boolean;
  diabetes: boolean;
  lowSodium: boolean;
  allergies: AllergenTag[];
}

export const EMPTY_PROFILE: Profile = {
  vegetarian: false,
  vegan: false,
  jain: false,
  diabetes: false,
  lowSodium: false,
  allergies: [],
};

export interface ProfileFlags {
  /** Allergens from the profile that the pack lists. */
  contains: string[];
  /** Allergens from the profile the pack says it may contain. */
  traces: string[];
  /** Diet and health-goal concerns, shown first among the chips. */
  chips: Highlight[];
  /** The profile asks for checks but Open Food Facts has no ingredient data to check. */
  unchecked: boolean;
}

const nameOf = (tag: string) => ALLERGENS.find(([t]) => t === tag)?.[1].toLowerCase() ?? tag;

export function profileFlags(
  profile: Profile,
  off: OffProduct | undefined,
  levels: NutrientLevel[],
): ProfileFlags {
  const mine = (tags: string[] = []) =>
    profile.allergies.filter((a) => tags.includes(a)).map(nameOf);
  const contains = mine(off?.allergens_tags);
  const traces = mine(off?.traces_tags).filter((a) => !contains.includes(a));

  const ingredients = off?.ingredients_tags ?? [];
  const analysis = off?.ingredients_analysis_tags ?? [];
  const has = (tag: string) => ingredients.includes(tag);
  const chips: Highlight[] = [];
  const concern = (text: string) => chips.push({ text, tone: 'concern' });

  if (profile.vegetarian && !profile.vegan) {
    if (vegMark(off?.labels_tags) === 'non-veg' || analysis.includes('en:non-vegetarian'))
      concern('Not vegetarian');
    else if (analysis.includes('en:maybe-vegetarian')) concern('May not be vegetarian');
  }
  if (profile.vegan) {
    if (analysis.includes('en:non-vegan')) concern('Not vegan');
    else if (analysis.includes('en:maybe-vegan')) concern('May not be vegan');
  }
  if (profile.jain) {
    const onion = has('en:onion-family-vegetable');
    if (onion) concern('Onion or garlic');
    if (ingredients.some(isOtherRoot) || (has('en:root-vegetable') && !onion))
      concern('Root vegetables');
  }
  if (profile.diabetes) {
    if (has('en:added-sugar')) concern('Added sugar');
    if (has('en:refined-wheat-flour')) concern('Refined flour');
  }
  // Same text and row as the product's own chip, so it moves first rather than repeating.
  if (profile.lowSodium && levels.some((l) => l.key === 'salt' && l.level === 'high'))
    chips.push({ text: 'High sodium', tone: 'concern', key: 'salt' });

  const asksIngredients =
    profile.allergies.length > 0 ||
    profile.vegetarian ||
    profile.vegan ||
    profile.jain ||
    profile.diabetes;
  return {
    contains,
    traces,
    chips,
    unchecked: asksIngredients && !ingredients.length && !off?.allergens_tags?.length,
  };
}

/** Root vegetables other than the onion family (onion and garlic are root vegetables in OFF). */
const isOtherRoot = (tag: string) =>
  tag === 'en:taproot-vegetable' || tag === 'en:starchy-root-vegetable' || tag === 'en:tuber';

/** Profile chips first, then the product's own, without repeats, four at most. */
export const withProfileChips = (profile: Highlight[], own: Highlight[]) =>
  [...profile, ...own.filter((h) => !profile.some((p) => p.text === h.text))].slice(0, 4);
