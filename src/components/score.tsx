// Score display components from design/DESIGN.md: ScoreRing, ScoreBadge, StatusPill,
// HighlightChip. Colour never carries meaning alone: every tier has a glyph, number and word.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Level } from '../scoring/levels';
import { RADIUS, TYPE, useTheme, type Tier } from '../theme';
import { Icon } from './ui';

/** SF Symbol per tier: the filled form for the verdict, the bare mark for badges and pills. */
const GLYPH: Record<Tier, { filled: string; mark: string; fallback: string }> = {
  great: { filled: 'checkmark.circle.fill', mark: 'checkmark', fallback: '✓' },
  moderate: { filled: 'minus.circle.fill', mark: 'minus', fallback: '–' },
  occasional: { filled: 'exclamationmark.circle.fill', mark: 'exclamationmark', fallback: '!' },
  rare: { filled: 'exclamationmark.triangle.fill', mark: 'triangle.fill', fallback: '▲' },
};

export function TierMark({ tier, size, filled }: { tier: Tier; size: number; filled?: boolean }) {
  const t = useTheme();
  const g = GLYPH[tier];
  const color = filled ? t.tiers[tier].ring : t.tiers[tier].fg;
  return <Icon sf={filled ? g.filled : g.mark} fallback={g.fallback} color={color} size={size} />;
}

/** 0 to `to` over 300 ms; the final value at once with Reduce Motion. */
function useCountUp(to: number) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => true)
      .then((reduce) => {
        if (reduce || cancelled) return;
        const start = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / 300);
          setValue(Math.round(to * (1 - (1 - p) ** 3))); // ease-out
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setValue(0);
        frame = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [to]);
  return value;
}

const RING = 92;
const STROKE = 8;

export function ScoreRing({
  value,
  tier,
  word,
  reason,
}: {
  value: number;
  tier: Tier;
  word: string;
  reason: string;
}) {
  const t = useTheme();
  const c = t.tiers[tier];
  const shown = useCountUp(value);
  const r = (RING - STROKE) / 2;
  const length = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityLabel={`Score ${value} of 100, ${word.toLowerCase()}. ${reason}`}
      style={[styles.ringCard, { backgroundColor: t.surface, borderColor: t.border }]}
    >
      <View style={{ width: RING, height: RING }}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={c.tint}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={c.ring}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={length * (1 - Math.max(shown, 1) / 100)}
            // Starts at 12 o'clock, runs clockwise.
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text maxFontSizeMultiplier={1.2} style={[styles.numeral, { color: t.text }]}>
            {shown}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={[TYPE.caption, { color: t.textSecondary }]}>
            of 100
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.verdict}>
          <TierMark tier={tier} size={20} filled />
          <Text style={[TYPE.headlineL, { color: c.fg, flexShrink: 1 }]}>{word}</Text>
        </View>
        {reason ? (
          <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>{reason}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Small score capsule for history rows and alternative cards. */
export function ScoreBadge({ value, tier, word }: { value: number; tier: Tier; word: string }) {
  const t = useTheme();
  const c = t.tiers[tier];
  return (
    <View
      accessible
      accessibilityLabel={`Score ${value} of 100, ${word.toLowerCase()}`}
      style={[styles.badge, { backgroundColor: c.tint }]}
    >
      <TierMark tier={tier} size={12} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{value}</Text>
    </View>
  );
}

const PILL: Record<Exclude<Level, 'none'>, { word: string; tier?: Tier }> = {
  low: { word: 'Low', tier: 'great' },
  good: { word: 'Good', tier: 'great' },
  within: { word: 'Within limit', tier: 'great' },
  moderate: { word: 'Moderate', tier: 'moderate' },
  high: { word: 'High', tier: 'occasional' },
  unknown: { word: 'Unknown' },
};

export const PILL_WORD = (level: Level) => (level === 'none' ? '' : PILL[level].word);

export function StatusPill({ level }: { level: Level }) {
  const t = useTheme();
  if (level === 'none') return <View style={styles.pillSpace} />;
  const { word, tier } = PILL[level];
  return (
    <View
      style={[styles.pill, { backgroundColor: tier ? t.tiers[tier].tint : t.fill }]}
      accessible={false}
    >
      {tier && <TierMark tier={tier} size={11} />}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.pillText, { color: tier ? t.tiers[tier].fg : t.textSecondary }]}
      >
        {word}
      </Text>
    </View>
  );
}

export function HighlightChip({
  text,
  tone,
  onPress,
}: {
  text: string;
  tone: 'concern' | 'positive';
  onPress?: () => void;
}) {
  const t = useTheme();
  const tier: Tier = tone === 'concern' ? 'occasional' : 'great';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={text}
      hitSlop={5}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Icon
        sf={tone === 'concern' ? 'exclamationmark' : 'checkmark'}
        fallback={tone === 'concern' ? '!' : '✓'}
        color={t.tiers[tier].ring}
        size={14}
      />
      <Text style={[TYPE.subheadline, { color: t.text }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 20,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  numeral: { fontSize: 32, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  badgeText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pill: {
    width: 104,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 13,
    paddingHorizontal: 8,
  },
  pillSpace: { width: 104 },
  pillText: { fontSize: 13, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
});
