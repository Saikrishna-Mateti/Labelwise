// Score display shared by the product sheet and history. Every colour sits next to a letter,
// number or star count, never alone.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body } from '../../components/ui';
import type { ScoreResult } from '../../scoring/types';
import { NOVA_COLORS, NUTRISCORE_COLORS, OVERALL_COLORS, useTheme } from '../../theme';
import type { PrimaryMethod } from '../queries';
import { EXPLAIN, overallFor, type ProductScores } from './productView';

type Method = keyof ProductScores;

export const METHOD_ORDER: Record<PrimaryMethod, Method[]> = {
  inr: ['inr', 'nutriscore', 'nova'],
  nutriscore: ['nutriscore', 'inr', 'nova'],
};

const TILE_LABEL: Record<Method, string> = {
  inr: 'India rating (draft)',
  nutriscore: 'Nutri-Score',
  nova: 'Processing',
};

export function Stars({ value, size = 28 }: { value: number; size?: number }) {
  const t = useTheme();
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        const star = { fontSize: size, lineHeight: size * 1.15 };
        return (
          <View key={i}>
            <Text style={[star, { color: t.border }]}>★</Text>
            {fill > 0 && (
              <View style={[styles.starFill, { width: `${fill * 100}%` }]}>
                <Text style={[star, { color: t.star }]}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function LetterBox({ text, colors }: { text: string; colors: { bg: string; fg: string } }) {
  return (
    <View style={[styles.letterBox, { backgroundColor: colors.bg }]}>
      <Text style={[styles.letter, { color: colors.fg }]}>{text}</Text>
    </View>
  );
}

/** Text form of a score, also used as its accessibility label. */
function describe(method: Method, r: ScoreResult): { text: string; note?: string } {
  const estimated = r.source === 'estimated' && r.value !== null ? 'estimated' : undefined;
  if (method === 'inr') {
    return r.value !== null
      ? { text: `${r.value} of 5 stars`, note: estimated }
      : { text: r.band ?? 'Not available' };
  }
  if (method === 'nutriscore') return { text: r.band ?? 'Not available' };
  return r.value !== null ? { text: `NOVA ${r.value}`, note: estimated } : { text: 'Unknown' };
}

function TileValue({ method, r }: { method: Method; r: ScoreResult }) {
  const t = useTheme();
  if (method === 'inr' && r.value !== null) return <Stars value={r.value} size={16} />;
  if (method === 'nutriscore' && r.band && NUTRISCORE_COLORS[r.band]) {
    return <LetterBox text={r.band} colors={NUTRISCORE_COLORS[r.band]} />;
  }
  if (method === 'nova' && r.value !== null && NOVA_COLORS[r.value]) {
    return <LetterBox text={String(r.value)} colors={NOVA_COLORS[r.value]} />;
  }
  return <Text style={[styles.none, { color: t.muted }]}>—</Text>;
}

/** Three tiles; the main score comes first. Tapping a tile explains that score. */
export function ScoreTiles({ scores, primary }: { scores: ProductScores; primary: PrimaryMethod }) {
  const t = useTheme();
  const [open, setOpen] = useState<Method | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.tiles}>
        {METHOD_ORDER[primary].map((m) => {
          const r = scores[m];
          const { text, note } = describe(m, r);
          const selected = open === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`${TILE_LABEL[m]}: ${text}${note ? `, ${note}` : ''}${m === primary ? ', main score' : ''}`}
              accessibilityHint="Explains this score"
              accessibilityState={{ expanded: selected }}
              onPress={() => setOpen(selected ? null : m)}
              style={[
                styles.tile,
                { backgroundColor: t.card, borderColor: selected ? t.primary : t.card },
              ]}
            >
              <Text style={[styles.tileLabel, { color: t.muted }]} numberOfLines={2}>
                {TILE_LABEL[m]}
              </Text>
              <TileValue method={m} r={r} />
              <Text style={[styles.tileText, { color: t.text }]}>{text}</Text>
              {note && <Text style={[styles.tileNote, { color: t.muted }]}>{note}</Text>}
            </Pressable>
          );
        })}
      </View>
      {open && <Body muted>{EXPLAIN[open]}</Body>}
    </View>
  );
}

/** Small badge for list rows: the overall band, else the main score or the next one with a value. */
export function CompactScore({
  scores,
  primary,
}: {
  scores: ProductScores;
  primary: PrimaryMethod;
}) {
  const t = useTheme();
  const overall = overallFor(scores.nutriscore.band);
  if (overall) {
    return (
      <View accessible accessibilityLabel={`Overall: ${overall.label}`} style={styles.compact}>
        <View style={[styles.compactDot, { backgroundColor: OVERALL_COLORS[overall.band] }]} />
        <Text style={[styles.tileNote, { color: t.text }]}>{overall.label}</Text>
      </View>
    );
  }
  const method = METHOD_ORDER[primary].find((m) => scores[m].band !== null && m !== 'nova');
  if (!method) return null;
  const r = scores[method];
  return (
    <View
      accessible
      accessibilityLabel={`${TILE_LABEL[method]}: ${describe(method, r).text}`}
      style={styles.compact}
    >
      {method === 'inr' && r.value !== null ? (
        <Text style={[styles.compactStars, { color: t.text }]}>
          <Text style={{ color: t.star }}>★</Text> {r.value}
        </Text>
      ) : (
        <TileValue method={method} r={r} />
      )}
      <Text style={[styles.tileNote, { color: t.muted }]}>
        {method === 'inr' ? 'India' : 'Nutri'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
  starFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileText: { fontSize: 14, fontWeight: '600' },
  tileNote: { fontSize: 12 },
  letterBox: {
    borderRadius: 6,
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  letter: { fontSize: 18, fontWeight: '800' },
  none: { fontSize: 18 },
  compact: { alignItems: 'center', justifyContent: 'center', minWidth: 48, gap: 2 },
  compactStars: { fontSize: 16, fontWeight: '700' },
  compactDot: { width: 18, height: 18, borderRadius: 9 },
});
