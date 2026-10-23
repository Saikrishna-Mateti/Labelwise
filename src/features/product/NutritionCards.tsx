// The four nutrients people look for first, each with the ICMR-NIN 2024 limit where one exists.

import { StyleSheet, Text, View } from 'react-native';

import { Icon, Small } from '../../components/ui';
import type { ResolvedProduct, Sourced } from '../../data/resolver';
import type { LimitCheck, LimitKey } from '../../scoring/warnings';
import { ACCENT, tint, useTheme } from '../../theme';

const fmt = (n: number, digits = 1) => String(Number(n.toFixed(digits)));

interface Card {
  label: string;
  sf: string;
  fallback: string;
  accent: string;
  value?: Sourced<number>;
  unit: string;
  digits?: number;
  /** Extra line, e.g. "Added 10.9 g". */
  note?: string;
  limit?: LimitCheck;
  /** Leave out the High / OK / No limit chip. */
  noChip?: boolean;
}

const LIMIT_NAME: Record<LimitKey, string> = {
  energy: 'kcal energy',
  salt: 'g salt',
  addedSugars: 'g added sugar',
  addedFat: 'g added fat',
};

export function NutritionCards({
  product,
  limits,
}: {
  product: ResolvedProduct;
  limits: LimitCheck[];
}) {
  const t = useTheme();
  const n = product.nutrition;
  const liquid = product.productType.value === 'liquid';
  const per = liquid ? '100 ml' : '100 g';
  // The check for a limit, including "unknown" when the value it needs is missing.
  const limit = (key: LimitKey) => limits.find((l) => l.key === key);

  const cards: Card[] = [
    {
      label: 'Saturated fat',
      sf: 'drop.fill',
      fallback: '●',
      accent: ACCENT.saturatedFat,
      value: n.saturatedFatG,
      unit: 'g',
    },
    {
      label: 'Energy',
      sf: 'bolt.fill',
      fallback: '⚡',
      accent: ACCENT.energy,
      value: n.energyKcal,
      unit: 'kcal',
      digits: 0,
      limit: limit('energy'),
    },
    {
      label: 'Sugars',
      sf: 'cube.fill',
      fallback: '■',
      accent: ACCENT.sugars,
      value: n.sugarsG,
      unit: 'g',
      // Only added sugar has a limit; total sugars never stand in for it.
      // Same number as total sugars would read as a repeat, so say what it means instead.
      note: !n.addedSugarsG
        ? n.sugarsG && 'Added not known'
        : fmt(n.addedSugarsG.value) === fmt(n.sugarsG?.value ?? NaN)
          ? 'All added'
          : `Added ${fmt(n.addedSugarsG.value)}\u00a0g`,
      limit: limit('addedSugars'),
    },
    {
      label: 'Protein',
      sf: 'dumbbell.fill',
      fallback: '+',
      accent: ACCENT.protein,
      value: n.proteinG,
      unit: 'g',
      // A nutrient to look for, not to limit: no ICMR-NIN limit, so no chip.
      noChip: true,
    },
  ];

  // Added fat is never on OFF; it shows only when the user entered it.
  const addedFatCheck = limit('addedFat');
  const addedFat = addedFatCheck?.status === 'unknown' ? undefined : addedFatCheck;
  // Salt is checked in scoring but not shown on a card, so it isn't listed either.
  const listed = limits.filter((l) => l.key !== 'salt' && (l.key !== 'addedFat' || addedFat));
  const hasUnknown = cards.some((c) => c.limit?.status === 'unknown');

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.grid}>
        {cards.map((c) => (
          <NutrientCard key={c.label} card={c} />
        ))}
      </View>
      {addedFat && (
        <Text style={{ color: addedFat.status === 'high' ? t.con : t.text }}>
          Added fat {fmt(addedFat.value)} g (yours): {addedFat.status === 'high' ? 'High' : 'OK'}
        </Text>
      )}
      <Small>
        High means more than the ICMR-NIN 2024 limit per {per}, OK means at or under it:{' '}
        {listed.map((l) => `${fmt(l.limit, 3)}\u00a0${LIMIT_NAME[l.key]}`).join(', ')}. There is no
        limit for saturated fat or total sugars.
        {hasUnknown && ' Not known means the value needed for the check is missing.'}
      </Small>
    </View>
  );
}

const SPOKEN = {
  High: 'High',
  OK: 'within limit',
  'No limit': 'no official limit',
  'Not known': 'limit not checked',
};

function NutrientCard({ card: c }: { card: Card }) {
  const t = useTheme();
  const v = c.value;
  // Every card gets a chip so the row reads evenly. Grey says why there is no verdict:
  // no official limit exists, or one exists but the value to check is missing.
  const status = !c.limit
    ? 'No limit'
    : c.limit.status === 'high'
      ? 'High'
      : c.limit.status === 'within'
        ? 'OK'
        : 'Not known';
  const chipColor = status === 'High' ? t.con : status === 'OK' ? t.pro : t.muted;
  const value = v ? `${fmt(v.value, c.digits)}\u00a0${c.unit}` : '—';
  return (
    <View
      accessible
      accessibilityLabel={[
        c.label,
        v ? value : 'not known',
        v?.source === 'user' && 'your value',
        c.note,
        !c.noChip && SPOKEN[status],
      ]
        .filter(Boolean)
        .join(', ')}
      style={[styles.card, { backgroundColor: tint(c.accent, 0.08) }]}
    >
      <View style={[styles.icon, { backgroundColor: c.accent }]}>
        <Icon sf={c.sf} fallback={c.fallback} color="#ffffff" size={16} />
      </View>
      <Text
        style={[styles.value, { color: v ? t.text : t.muted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: t.muted }]} numberOfLines={2}>
        {c.label}
        {v?.source === 'user' ? ' (yours)' : ''}
      </Text>
      {c.note && <Text style={[styles.label, { color: t.muted }]}>{c.note}</Text>}
      {!c.noChip && (
        <View style={[styles.chip, { backgroundColor: tint(chipColor, 0.1) }]}>
          <Text style={[styles.chipText, { color: chipColor }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 76,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 13, textAlign: 'center', marginBottom: 2 },
  // Pinned to the bottom so chips line up across cards of different heights.
  chip: { marginTop: 'auto', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
