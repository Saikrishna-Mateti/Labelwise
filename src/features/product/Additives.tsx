// Ingredients section: the ingredient text, then each additive with a concern pill. Concern is
// EFSA's intake finding as recorded by Open Food Facts (high -> Higher, moderate -> Some,
// no -> Low); without a finding it says "No data", never low.

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import type { Additive, EfsaRisk } from '../../scoring/additives';
import { TYPE, useTheme, type Tier } from '../../theme';

export const CONCERN: Record<EfsaRisk | 'none', { word: string; tier?: Tier; spoken: string }> = {
  high: {
    word: 'Higher concern',
    tier: 'occasional',
    spoken: 'EFSA found people may eat too much',
  },
  moderate: {
    word: 'Some concern',
    tier: 'moderate',
    spoken: 'EFSA found some people may eat too much',
  },
  no: { word: 'Low concern', tier: 'great', spoken: 'EFSA found no risk of eating too much' },
  none: { word: 'No data', spoken: 'no EFSA finding on record' },
};

const VEG_NOTE = { no: 'not vegetarian', maybe: 'may be from animals' } as const;

export const additivesSummary = (n: number) =>
  n === 0 ? 'no additives listed' : `${n} ${n === 1 ? 'additive' : 'additives'}`;

export function Ingredients({ text, additives }: { text?: string; additives: Additive[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <Text style={[TYPE.body, { color: text ? t.text : t.textSecondary }]}>
        {text ?? 'The ingredient list isn’t on Open Food Facts yet.'}
      </Text>
      {additives.length > 0 && (
        <View>
          <Text style={[TYPE.footnote, { color: t.textSecondary, fontWeight: '600' }]}>
            Additives · tap for EFSA’s opinion
          </Text>
          {additives.map((a) => (
            <Row key={a.tag} additive={a} />
          ))}
          <Text style={[TYPE.footnote, { color: t.textSecondary, paddingTop: 8 }]}>
            Concern is EFSA’s finding on whether people may eat more than the safe daily amount, as
            recorded by Open Food Facts. It is not about the amount in this product. No data means
            EFSA has no such finding on record, not that it is safe.
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({ additive: a }: { additive: Additive }) {
  const t = useTheme();
  const concern = CONCERN[a.efsa?.risk ?? 'none'];
  const c = concern.tier ? t.tiers[concern.tier] : undefined;
  const veg = a.vegetarian === 'no' || a.vegetarian === 'maybe' ? VEG_NOTE[a.vegetarian] : null;
  const detail = [a.ins && `INS ${a.ins}`, a.classes.join(', ').toLowerCase(), veg]
    .filter(Boolean)
    .join(' · ');
  const url = a.efsa?.url;
  return (
    <Pressable
      accessibilityRole={url ? 'link' : undefined}
      accessibilityLabel={[a.name, detail, concern.word, concern.spoken].filter(Boolean).join(', ')}
      disabled={!url}
      onPress={() => url && Linking.openURL(url)}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: t.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[TYPE.body, { color: t.text }]}>{a.name}</Text>
        {detail ? <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{detail}</Text> : null}
      </View>
      <View style={[styles.pill, { backgroundColor: c?.tint ?? t.fill }]}>
        <Text style={[styles.pillText, { color: c?.fg ?? t.textSecondary }]} numberOfLines={1}>
          {concern.word}
        </Text>
      </View>
      {url ? <Icon sf="chevron.right" fallback="›" color={t.textTertiary} size={14} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  pill: { minHeight: 26, borderRadius: 13, paddingHorizontal: 10, justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '600' },
});
