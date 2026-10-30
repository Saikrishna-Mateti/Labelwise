/** Salt is 40% sodium: "5 g of salt per day (equivalent to 2 g of sodium)", ICMR-NIN DGI 2024. */
export const SALT_PER_SODIUM = 2.5;

/** Energy per gram: "each gram of lipid gives energy of 9 Kcal, while protein or carbohydrates
 * give only 4 Kcal for every gram", ICMR-NIN DGI 2024, p. 70. */
export const KCAL_PER_G = { fat: 9, protein: 4, carbohydrate: 4 } as const;
