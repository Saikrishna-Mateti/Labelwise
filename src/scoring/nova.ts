// NOVA processing group. Open Food Facts' nova_group is used as-is when present.
// Otherwise the ingredient list is checked for markers of ultra-processing (NOVA group 4) taken from
// the NOVA definition: Monteiro et al., "Ultra-processed foods: what they are and how to identify them",
// Public Health Nutrition 22(5), 2019. Markers found -> group 4 (estimated). None found -> not estimated,
// because groups 1-3 cannot be told apart reliably from ingredient text alone.
// ponytail: keyword match, misses INS-number-only labels; add a sourced INS table in Phase 2.

import type { ScoringMethod } from './types';

// [label shown to the user, pattern]
const MARKERS: readonly [string, RegExp][] = [
  ['flavours', /\bflavou?r/i], // also matches flavour enhancers, flavouring
  ['colours', /\bcolou?rs?\b/i],
  ['emulsifiers', /\bemulsif/i],
  ['sweeteners', /\bsweeteners?\b|sucralose|aspartame|acesulfame|saccharin|steviol/i],
  ['thickeners', /\bthicken/i],
  ['glazing, gelling, foaming or bulking agents', /\b(glazing|gelling|foaming|bulking) agent/i],
  ['maltodextrin', /maltodextrin/i],
  ['invert sugar', /invert(ed)? sugar/i],
  ['high-fructose syrup', /high[- ]fructose|glucose[- ]fructose syrup/i],
  ['hydrogenated or interesterified fat', /hydrogenated|interesterified/i],
  ['protein isolate or hydrolysed protein', /protein isolate|hydroly[sz]ed .*protein/i],
  ['monosodium glutamate', /monosodium glutamate/i],
];

export function novaMarkers(ingredientsText: string): string[] {
  return MARKERS.filter(([, re]) => re.test(ingredientsText)).map(([label]) => label);
}

export const nova: ScoringMethod = {
  id: 'nova',
  name: 'NOVA processing group',
  score({ off, ingredientsText }) {
    const group = off?.novaGroup;
    if (group !== undefined && group >= 1 && group <= 4) {
      return {
        method: 'nova',
        value: group,
        band: `NOVA ${group}`,
        source: 'off',
        missingInputs: [],
        reasons: [
          {
            kind: group === 4 ? 'con' : 'info',
            text: off?.novaMarkers?.length
              ? `NOVA group ${group} (from Open Food Facts) because of: ${off.novaMarkers.join('; ')}`
              : `NOVA group ${group} (from Open Food Facts)`,
          },
        ],
      };
    }

    if (!ingredientsText?.trim()) {
      return {
        method: 'nova',
        value: null,
        band: null,
        source: 'estimated',
        missingInputs: [],
        reasons: [{ kind: 'info', text: 'No ingredient list, so processing level is unknown' }],
      };
    }

    const found = novaMarkers(ingredientsText);
    if (found.length === 0) {
      return {
        method: 'nova',
        value: null,
        band: null,
        source: 'estimated',
        missingInputs: [],
        reasons: [{ kind: 'pro', text: 'No signs of ultra-processing found in the ingredients' }],
      };
    }
    return {
      method: 'nova',
      value: 4,
      band: 'NOVA 4 (estimated)',
      source: 'estimated',
      missingInputs: [],
      reasons: [{ kind: 'con', text: `Likely ultra-processed: contains ${found.join(', ')}` }],
    };
  },
};
