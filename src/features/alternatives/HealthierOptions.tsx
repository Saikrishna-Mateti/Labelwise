// "Healthier options" on the product sheet: same-category products that score better.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Small } from '../../components/ui';
import type { OffProduct } from '../../data/normalize';
import { tint, useBandShades, useTheme } from '../../theme';
import { Badge } from '../product/ScoreTiles';
import type { OverallBand } from '../product/productView';
import { useAlternatives } from '../queries';
import { categoriesFor, categoryName, type Alternative } from './alternatives';

const sentence = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function HealthierOptions({
  barcode,
  band,
  off,
}: {
  barcode: string;
  band: OverallBand;
  off: OffProduct;
}) {
  const t = useTheme();
  const { data, isPending, refetch, isRefetching } = useAlternatives(barcode, band, off);
  const own = categoriesFor(off)[0] ?? 'this category';

  if (isPending) {
    return (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={t.muted} />
        <Small>Looking on Open Food Facts…</Small>
      </View>
    );
  }
  if (!data || data.status === 'error') {
    return (
      <View style={{ gap: 8 }}>
        <Small>
          {data?.error === 'rate_limited'
            ? 'Open Food Facts is busy. Try again in a minute.'
            : 'Couldn’t load options. Check your connection and try again.'}
        </Small>
        <Button title="Try again" secondary onPress={() => refetch()} disabled={isRefetching} />
      </View>
    );
  }
  if (!data.items.length) {
    return (
      <Small>
        No product in this category on Open Food Facts rates Good or Excellent yet. Many Indian
        products are still missing there.
      </Small>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {data.category && (
        <Small>
          {data.wider
            ? `Nothing in ${categoryName(own)} rates Good or Excellent, so these are other ${categoryName(data.category)} sold in India that do.`
            : sentence(`${categoryName(data.category)} sold in India that rate Good or Excellent.`)}
        </Small>
      )}
      {data.items.map((a) => (
        <Row key={a.barcode} item={a} />
      ))}
      <Small>
        Picked from Open Food Facts data, which anyone can edit and can contain mistakes. Each one
        is rated the same way as this product. Check the pack before you buy.
      </Small>
    </View>
  );
}

function Row({ item }: { item: Alternative }) {
  const t = useTheme();
  const router = useRouter();
  const shades = useBandShades(item.overall.band);
  const name = item.off.product_name || item.barcode;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${item.off.brands ? `, ${item.off.brands}` : ''}, overall ${item.overall.label}`}
      accessibilityHint="Opens this product"
      onPress={() =>
        router.push({ pathname: '/product/[barcode]', params: { barcode: item.barcode } })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.card, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: t.skeleton }]}>
        {item.off.image_front_small_url && (
          <Image
            source={{ uri: item.off.image_front_small_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        {item.off.brands && (
          <Text style={[styles.brand, { color: t.muted }]} numberOfLines={1}>
            {item.off.brands}
          </Text>
        )}
        {shades && (
          <Badge
            label={item.overall.label}
            color={shades.text}
            background={tint(shades.dot, 0.12)}
            dot={shades.dot}
          />
        )}
      </View>
      <Icon sf="chevron.right" fallback="›" color={t.muted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  name: { fontSize: 16, fontWeight: '600' },
  brand: { fontSize: 13 },
});
