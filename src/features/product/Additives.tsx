// The product's additives with EFSA's intake-risk finding, from Open Food Facts.

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Small } from '../../components/ui';
import type { Additive, EfsaRisk } from '../../scoring/additives';
import { OVERALL_COLORS, tint, useTheme } from '../../theme';

const RISK: Record<EfsaRisk | 'none', { label: string; spoken: string }> = {
  high: { label: 'High risk', spoken: 'EFSA: high risk of eating too much' },
  moderate: { label: 'Moderate risk', spoken: 'EFSA: moderate risk of eating too much' },
  no: { label: 'No risk found', spoken: 'EFSA: no risk of eating too much found' },
  none: { label: 'No data', spoken: 'no EFSA risk data' },
};

const VEG_NOTE = { no: 'Not vegetarian', maybe: 'May be from animals' } as const;

export function Additives({ additives }: { additives: Additive[] }) {
  if (!additives.length) {
    return <Small>Open Food Facts lists no additives for this product.</Small>;
  }
  return (
    <View style={{ gap: 8 }}>
      {additives.map((a) => (
        <Row key={a.tag} additive={a} />
      ))}
      <Small>
        Risk is EFSA’s finding on whether people may eat more than the safe daily amount, as
        recorded by Open Food Facts. It is not about the amount in this product. No data means EFSA
        has no such finding on record, not that it is safe. Tap an additive to read EFSA’s opinion.
      </Small>
    </View>
  );
}

function Row({ additive: a }: { additive: Additive }) {
  const t = useTheme();
  const risk = a.efsa?.risk ?? 'none';
  const color =
    risk === 'high'
      ? t.con
      : risk === 'moderate'
        ? OVERALL_COLORS.poor
        : risk === 'no'
          ? t.pro
          : t.muted;
  const veg = a.vegetarian === 'no' || a.vegetarian === 'maybe' ? VEG_NOTE[a.vegetarian] : null;
  const detail = [a.ins && `INS ${a.ins}`, a.classes.join(', ').toLowerCase(), veg]
    .filter(Boolean)
    .join(', ');
  const url = a.efsa?.url;
  return (
    <Pressable
      accessibilityRole={url ? 'link' : undefined}
      accessibilityLabel={[
        a.name,
        detail,
        RISK[risk].spoken,
        a.efsa?.date && `assessed ${a.efsa.date.slice(0, 4)}`,
      ]
        .filter(Boolean)
        .join(', ')}
      disabled={!url}
      onPress={() => url && Linking.openURL(url)}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.name, { color: t.text }]}>{a.name}</Text>
        {detail ? <Small>{detail}</Small> : null}
      </View>
      <View style={[styles.chip, { backgroundColor: tint(color, 0.12) }]}>
        <Text style={[styles.chipText, { color }]} numberOfLines={1}>
          {RISK[risk].label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  name: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
