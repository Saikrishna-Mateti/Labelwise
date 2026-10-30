// Top of the result sheet: close / save / share, then photo, name, brand and veg mark.

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { vegMark } from '../../data/normalize';
import type { ResolvedProduct } from '../../data/resolver';
import { RADIUS, TYPE, useTheme } from '../../theme';
import { useSaved } from '../queries';
import type { Score } from './productView';

export function Hero({ product, score }: { product: ResolvedProduct; score?: Score | null }) {
  const t = useTheme();
  const off = product.off;
  const name = off?.product_name || 'Unnamed product';
  const mark = vegMark(off?.labels_tags);
  return (
    <View style={{ gap: 16 }}>
      <TopBar
        barcode={product.barcode}
        shareText={[
          name,
          score && `Labelwise: ${score.value} of 100, ${score.word.toLowerCase()}`,
          off && `https://world.openfoodfacts.org/product/${product.barcode}`,
        ]
          .filter(Boolean)
          .join('\n')}
      />
      <View style={styles.row}>
        <View style={[styles.photo, { backgroundColor: t.fill, borderColor: t.border }]}>
          {off?.image_front_small_url ? (
            <Image
              source={{ uri: off.image_front_small_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Product photo"
            />
          ) : (
            <Icon sf="shippingbox" fallback="□" color={t.textTertiary} size={28} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={[TYPE.title, { color: t.text }]}
            numberOfLines={3}
          >
            {name}
          </Text>
          {off?.brands && (
            <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>{off.brands}</Text>
          )}
          {mark && <VegMark mark={mark} />}
        </View>
      </View>
    </View>
  );
}

function TopBar({ barcode, shareText }: { barcode: string; shareText: string }) {
  const t = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useSaved(barcode);
  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSaved(!saved);
  };
  return (
    <View style={styles.bar}>
      <IconButton label="Close" sf="chevron.down" fallback="⌄" onPress={() => router.back()} />
      <View style={{ flex: 1 }} />
      <IconButton
        label={saved ? 'Remove from saved' : 'Save product'}
        selected={saved}
        sf={saved ? 'bookmark.fill' : 'bookmark'}
        fallback={saved ? '★' : '☆'}
        color={saved ? t.accent : undefined}
        onPress={toggle}
      />
      <IconButton
        label="Share"
        sf="square.and.arrow.up"
        fallback="↑"
        onPress={() => Share.share({ message: shareText }).catch(() => {})}
      />
    </View>
  );
}

/** 44 pt circle on `fill`, per DESIGN.md. */
export function IconButton({
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: t.fill, opacity: pressed ? 0.85 : 1 },
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
        <Text style={{ color, fontSize: 8, lineHeight: 10 }}>{mark === 'veg' ? '●' : '▲'}</Text>
      </View>
      <Text style={[TYPE.footnote, { color: t.textSecondary }]}>
        {mark === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}, per pack
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  vegSquare: {
    width: 13,
    height: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
