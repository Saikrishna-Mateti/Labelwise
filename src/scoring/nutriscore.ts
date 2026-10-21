// Nutri-Score. Uses the grade computed by Open Food Facts when present.
// The 2023 algorithm itself is NOT implemented yet: the official specification (Santé publique France
// Scientific Committee update reports for foods and beverages) has not been obtained. Do not
// reconstruct its tables from memory.

import type { NutriscoreComponent, Reason, ScoringMethod } from './types';

const GRADES = ['a', 'b', 'c', 'd', 'e'];

const COMPONENT_LABELS: Record<string, string> = {
  energy: 'Energy',
  sugars: 'Sugars',
  saturated_fat: 'Saturated fat',
  salt: 'Salt',
  non_nutritive_sweeteners: 'Non-nutritive sweeteners',
  proteins: 'Protein',
  fiber: 'Fibre',
  fruits_vegetables_legumes: 'Fruit, vegetables and legumes',
};

const fmt = (n: number) => String(Number(n.toFixed(1)));

/** Nutri-Score's own reasons: the components that scored points in OFF's breakdown. */
function componentReasons(components: NutriscoreComponent[], per: string): Reason[] {
  return components
    .filter((c) => c.points > 0)
    .map((c) => {
      const label = COMPONENT_LABELS[c.id] ?? c.id.replace(/_/g, ' ');
      const value =
        c.value === null
          ? ''
          : c.unit === 'number'
            ? ` (${c.value})`
            : ` ${fmt(c.value)} ${c.unit} ${per}`;
      return c.kind === 'negative'
        ? { kind: 'con', text: `${label}${value}: ${c.points} of ${c.pointsMax} points against` }
        : { kind: 'pro', text: `${label}${value}: ${c.points} of ${c.pointsMax} points in favour` };
    });
}

export const nutriscore: ScoringMethod = {
  id: 'nutriscore',
  name: 'Nutri-Score',
  score({ off, productType }) {
    const grade = off?.nutriscoreGrade?.toLowerCase();
    if (grade && GRADES.includes(grade)) {
      const breakdown = componentReasons(
        off?.nutriscoreComponents ?? [],
        productType === 'liquid' ? 'per 100 ml' : 'per 100 g',
      );
      return {
        method: 'nutriscore',
        value: off?.nutriscoreScore ?? null,
        band: grade.toUpperCase(),
        source: 'off',
        missingInputs: [],
        reasons: [
          {
            kind: 'info',
            text: breakdown.length
              ? 'Nutri-Score from Open Food Facts. Points against raise the grade towards E; points in favour lower it.'
              : 'Nutri-Score from Open Food Facts (no breakdown available)',
          },
          ...breakdown,
        ],
      };
    }
    return {
      method: 'nutriscore',
      value: null,
      band: null,
      source: 'estimated',
      missingInputs: [],
      reasons: [{ kind: 'info', text: 'Nutri-Score not available for this product yet' }],
    };
  },
};
