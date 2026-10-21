/**
 * Turns user or scanner input into the code used for lookup and storage, or null if it is not a
 * product barcode. UPC-A (12 digits) becomes EAN-13 with a leading 0, a 14-digit GTIN with a
 * leading 0 becomes EAN-13, EAN-8 and EAN-13 stay as they are. Check digits are not enforced
 * because OFF holds products whose printed codes have a wrong one.
 */
export function normalizeBarcode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 8 || digits.length === 13) return digits;
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1);
  return null;
}
