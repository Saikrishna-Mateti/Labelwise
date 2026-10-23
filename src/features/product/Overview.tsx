// The top of the product sheet: one overall band, then what pushed it down or up.

import { StyleSheet, Text, View } from 'react-native';

import { Icon, Small } from '../../components/ui';
import { OVERALL_COLORS, useTheme } from '../../theme';
import type { Factor, Overall } from './productView';

export function OverallBadge({ overall }: { overall: Overall | null }) {
  const t = useTheme();
  if (!overall) {
    return (
      <View style={[styles.badge, { backgroundColor: t.card }]}>
        <View style={[styles.dot, { backgroundColor: t.border }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.band, { color: t.text }]}>No overall rating</Text>
          <Small>Nutri-Score isn’t available for this product. See the other ratings below.</Small>
        </View>
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`Overall: ${overall.label}, from Nutri-Score ${overall.grade}`}
      style={[styles.badge, { backgroundColor: t.card }]}
    >
      <View style={[styles.dot, { backgroundColor: OVERALL_COLORS[overall.band] }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.band, { color: t.text }]}>{overall.label}</Text>
        <Small>From Nutri-Score {overall.grade}</Small>
      </View>
    </View>
  );
}

/** Yuka-style lists: "To watch" (points against) and "Good" (no points lost, or points in favour). */
export function FactorLists({ factors }: { factors: Factor[] }) {
  const watch = factors.filter((f) => !f.good);
  const good = factors.filter((f) => f.good);
  return (
    <View style={{ gap: 16 }}>
      {watch.length > 0 && <FactorList title="To watch" factors={watch} />}
      {good.length > 0 && <FactorList title="Good" factors={good} />}
    </View>
  );
}

function FactorList({ title, factors }: { title: string; factors: Factor[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={[styles.listTitle, { color: t.text }]}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {factors.map((f, i) => {
          const color = f.good ? t.pro : t.con;
          const points =
            f.kind === 'against' && f.points === 0
              ? 'No points lost'
              : `${f.points} of ${f.max} points ${f.kind === 'against' ? 'against' : 'in favour'}`;
          return (
            <View
              key={f.label}
              accessible
              accessibilityLabel={`${f.label}${f.amount ? `, ${f.amount}` : ''}: ${points}`}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border },
              ]}
            >
              <Icon
                sf={f.good ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
                fallback={f.good ? '✓' : '!'}
                color={color}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.label, { color: t.text }]}>{f.label}</Text>
                  {f.amount && <Text style={{ color: t.muted }}>{f.amount}</Text>}
                </View>
                <View style={[styles.track, { backgroundColor: t.border }]}>
                  <View
                    style={[
                      styles.fill,
                      { backgroundColor: color, width: `${(f.points / f.max) * 100}%` },
                    ]}
                  />
                </View>
                <Small>{points}</Small>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16 },
  dot: { width: 44, height: 44, borderRadius: 22 },
  band: { fontSize: 26, fontWeight: '800' },
  listTitle: { fontSize: 20, fontWeight: '700' },
  card: { borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
