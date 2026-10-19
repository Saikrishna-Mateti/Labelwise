// Nutri-Score. Uses the grade computed by Open Food Facts when present.
// The 2023 algorithm itself is NOT implemented yet: the official specification (Santé publique France
// Scientific Committee update reports for foods and beverages) has not been obtained. Do not
// reconstruct its tables from memory.

import { nutrientReasons } from './reasons';
import type { ScoringMethod } from './types';

const GRADES = ['a', 'b', 'c', 'd', 'e'];

export const nutriscore: ScoringMethod = {
  id: 'nutriscore',
  name: 'Nutri-Score',
  score({ off, nutrition, productType }) {
    const grade = off?.nutriscoreGrade?.toLowerCase();
    const reasons = nutrientReasons(nutrition, productType);
    if (grade && GRADES.includes(grade)) {
      return {
        method: 'nutriscore',
        value: off?.nutriscoreScore ?? null,
        band: grade.toUpperCase(),
        source: 'off',
        missingInputs: [],
        reasons: [{ kind: 'info', text: 'Nutri-Score from Open Food Facts' }, ...reasons],
      };
    }
    return {
      method: 'nutriscore',
      value: null,
      band: null,
      source: 'estimated',
      missingInputs: [],
      reasons: [
        { kind: 'info', text: 'Nutri-Score not available for this product yet' },
        ...reasons,
      ],
    };
  },
};
