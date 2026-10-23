// Top of the product sheet: close / save / share, the product, and its overall band.

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Icon, Small } from '../../components/ui';
import { vegMark } from '../../data/normalize';
import type { ResolvedProduct } from '../../data/resolver';
import { tint, useBandShades, useTheme } from '../../theme';
import { useSaved } from '../queries';
import type { Overall, OverallBand } from './productView';

export function Hero({
  product,
  overall,
  subtitle,
}: {
  product: ResolvedProduct;
  /** Omitted on screens that don't rate the product; null when it is rated but has no band. */
  overall?: Overall | null;
  subtitle?: string;
}) {
  const t = useTheme();
  const off = product.off;
  const name = off?.product_name || 'Unnamed product';
  const mark = vegMark(off?.labels_tags);
  const shades = useBandShades(overall?.band);
  // White fading into the band's soft shade, like the mockup; plain card colour when unrated.
  const background = shades
    ? {
        backgroundColor: t.bg,
        backgroundImage: `linear-gradient(180deg, ${shades.soft}66 0%, ${shades.soft} 100%)`,
      }
    : { backgroundColor: t.card };

  return (
    <View style={[styles.hero, background]}>
      <TopBar
        barcode={product.barcode}
        shareText={[
          name,
          overall && `Labelwise: ${overall.label} (Nutri-Score ${overall.grade})`,
          off && `https://world.openfoodfacts.org/product/${product.barcode}`,
        ]
          .filter(Boolean)
          .join('\n')}
      />
      <View style={styles.row}>
        {off?.image_front_small_url && (
          <View style={[styles.imageBox, { backgroundColor: t.bg }]}>
            <Image
              source={{ uri: off.image_front_small_url }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={200}
              accessibilityLabel="Product photo"
            />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={[styles.name, { color: t.text }]}
            numberOfLines={3}
          >
            {name}
          </Text>
          {off?.brands && <Text style={[styles.brand, { color: t.muted }]}>{off.brands}</Text>}
          <Small>Barcode {product.barcode}</Small>
          {mark && <VegMark mark={mark} />}
          {overall !== undefined && <BandPill overall={overall} subtitle={subtitle} />}
        </View>
      </View>
    </View>
  );
}

function BandPill({ overall, subtitle }: { overall: Overall | null; subtitle?: string }) {
  const t = useTheme();
  const shades = useBandShades(overall?.band);
  const title = overall?.label ?? 'No overall rating';
  const sub = overall ? subtitle : 'No Nutri-Score for this product';
  const text = shades?.text ?? t.text;
  return (
    <View
      accessible
      accessibilityLabel={`Overall: ${title}${overall ? `, from Nutri-Score ${overall.grade}` : ''}${sub ? `. ${sub}` : ''}`}
      style={[
        styles.pill,
        {
          backgroundColor: shades ? tint(shades.dot, 0.08) : t.bg,
          borderColor: shades ? tint(shades.dot, 0.16) : t.border,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: shades?.dot ?? t.border }]} />
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.band, { color: text }]}>{title}</Text>
        {sub && <Text style={[styles.bandSub, { color: text }]}>{sub}</Text>}
      </View>
    </View>
  );
}

function TopBar({ barcode, shareText }: { barcode: string; shareText: string }) {
  const t = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useSaved(barcode);
  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    setSaved(!saved);
  };
  return (
    <View style={styles.bar}>
      <RoundButton label="Close" sf="chevron.down" fallback="⌄" onPress={() => router.back()} />
      <View style={{ flex: 1 }} />
      <RoundButton
        label={saved ? 'Remove from saved' : 'Save product'}
        selected={saved}
        sf={saved ? 'bookmark.fill' : 'bookmark'}
        fallback={saved ? '★' : '☆'}
        color={saved ? t.primary : undefined}
        onPress={toggle}
      />
      <RoundButton
        label="Share"
        sf="square.and.arrow.up"
        fallback="↑"
        onPress={() => Share.share({ message: shareText }).catch(() => {})}
      />
    </View>
  );
}

function RoundButton({
  label,
  sf,
  fallback,
  color,
  selected,
  onPress,
}: {
  label: string;
  sf: string;
  fallback: string;
  color?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: t.bg, opacity: pressed ? 0.6 : 1, shadowColor: '#000' },
      ]}
    >
      <Icon sf={sf} fallback={fallback} color={color ?? t.text} size={18} />
    </Pressable>
  );
}

/** India's printed marks: green square with a dot, brown square with a triangle. */
function VegMark({ mark }: { mark: 'veg' | 'non-veg' }) {
  const t = useTheme();
  const color = mark === 'veg' ? '#1b8a2f' : '#7b3f00';
  return (
    <View style={styles.vegRow}>
      <View style={[styles.vegSquare, { borderColor: color }]}>
        <Text style={{ color, fontSize: 10, lineHeight: 12 }}>{mark === 'veg' ? '●' : '▲'}</Text>
      </View>
      <Text style={{ color: t.text }}>
        {mark === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} (mark on the pack)
      </Text>
    </View>
  );
}

// Left icon says good or watch-out; the right one is the mockup's flame (leaf for the good bands).
const SUMMARY_ICON: Record<OverallBand, { left: string; right: string }> = {
  excellent: { left: 'checkmark.circle.fill', right: 'leaf.fill' },
  good: { left: 'checkmark.circle.fill', right: 'leaf.fill' },
  poor: { left: 'exclamationmark.circle.fill', right: 'flame.fill' },
  bad: { left: 'exclamationmark.circle.fill', right: 'flame.fill' },
};

/** Under the hero: what cost the most points, and a plain line that follows the overall band. */
export function SummaryCard({
  title,
  note,
  band,
}: {
  title: string;
  note?: string;
  band?: OverallBand;
}) {
  const t = useTheme();
  const shades = useBandShades(band);
  const color = shades?.dot ?? t.muted;
  const icon = band ? SUMMARY_ICON[band] : { left: 'info.circle.fill', right: undefined };
  return (
    <View style={[styles.summary, { backgroundColor: tint(color, 0.07) }]}>
      <Icon
        sf={icon.left}
        fallback={band === 'bad' || band === 'poor' ? '!' : '✓'}
        color={color}
        size={28}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.summaryTitle, { color: t.text }]}>{title}</Text>
        {note && <Small>{note}</Small>}
      </View>
      {icon.right && <Icon sf={icon.right} fallback="" color={tint(color, 0.85)} size={34} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Edge to edge: cancels the screen padding, rounded only at the bottom.
  hero: {
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  bar: { flexDirection: 'row', gap: 10 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  imageBox: { width: 116, height: 116, borderRadius: 18, overflow: 'hidden' },
  name: { fontSize: 22, fontWeight: '800', lineHeight: 27 },
  brand: { fontSize: 16 },
  vegRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vegSquare: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hugs its text instead of filling the column.
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 14,
    marginTop: 8,
  },
  // Sits on the first line, next to the band word.
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  band: { fontSize: 16, fontWeight: '700' },
  bandSub: { fontSize: 13, lineHeight: 17 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
});
