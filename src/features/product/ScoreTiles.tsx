// Score display shared by the product sheet and history. Every colour sits next to a letter,
// number or star count, never alone.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body } from '../../components/ui';
import type { ScoreResult } from '../../scoring/types';
import { ACCENT, NOVA_COLORS, NUTRISCORE_COLORS, tint, useBandShades, useTheme } from '../../theme';
import type { PrimaryMethod } from '../queries';
import { EXPLAIN, NOVA_GROUP, type Overall, type ProductScores } from './productView';

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
function describe(
  method: Method,
  r: ScoreResult,
): { text: string; note?: string; estimated?: boolean } {
  const estimated = r.source === 'estimated' && r.value !== null;
  if (method === 'inr') {
    return r.value !== null
      ? { text: `${r.value} of 5 stars`, estimated }
      : { text: r.band ?? 'Not available' };
  }
  if (method === 'nutriscore') {
    return r.band ? { text: `Grade ${r.band}`, note: 'A (best) to E' } : { text: 'Not available' };
  }
  return r.value !== null
    ? { text: `NOVA ${r.value}`, note: NOVA_GROUP[r.value], estimated }
    : { text: 'Unknown' };
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
          const { text, note, estimated } = describe(m, r);
          const selected = open === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`${TILE_LABEL[m]}: ${[text, note, estimated && 'estimated'].filter(Boolean).join(', ')}${m === primary ? ', main score' : ''}`}
              accessibilityHint="Explains this score"
              accessibilityState={{ expanded: selected }}
              onPress={() => setOpen(selected ? null : m)}
              style={[
                styles.tile,
                {
                  backgroundColor: tint(ACCENT[m], 0.08),
                  borderColor: selected ? ACCENT[m] : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tileLabel, { color: t.text }]} numberOfLines={2}>
                {TILE_LABEL[m]}
              </Text>
              <TileValue method={m} r={r} />
              <Text style={[styles.tileText, { color: t.text }]}>{text}</Text>
              {/* One line: the text shrinks a little rather than wrapping at the hyphen. */}
              {note && (
                <Text
                  style={[styles.tileNote, { color: t.muted }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {note}
                </Text>
              )}
              {estimated && <Text style={[styles.tileNote, { color: t.muted }]}>estimated</Text>}
            </Pressable>
          );
        })}
      </View>
      {open && <Body muted>{EXPLAIN[open]}</Body>}
    </View>
  );
}

/** Small pill for list rows. A dot is optional; the words always carry the meaning. */
export function Badge({
  label,
  color,
  background,
  dot,
  accessibilityLabel,
}: {
  label: string;
  color: string;
  background: string;
  dot?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { backgroundColor: background }]}
    >
      {dot && <View style={[styles.badgeDot, { backgroundColor: dot }]} />}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** The overall band as a small pill, else the India rating when there is no Nutri-Score. */
export function ScoreBadge({
  scores,
  overall,
}: {
  scores: ProductScores;
  overall: Overall | null;
}) {
  const t = useTheme();
  const shades = useBandShades(overall?.band);
  if (overall && shades) {
    return (
      <Badge
        label={overall.label}
        color={shades.text}
        background={tint(shades.dot, 0.12)}
        dot={shades.dot}
        accessibilityLabel={`Overall: ${overall.label}`}
      />
    );
  }
  const { value } = scores.inr;
  if (value === null) return null;
  return (
    <Badge
      label={`${value} of 5 stars`}
      color={t.text}
      background={t.skeleton}
      accessibilityLabel={`India rating (draft): ${value} of 5 stars`}
    />
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
  starFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  tileLabel: { fontSize: 14, fontWeight: '600' },
  tileText: { fontSize: 16, fontWeight: '700' },
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
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
