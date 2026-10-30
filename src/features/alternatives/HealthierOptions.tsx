// "Better alternatives": same-category products that score Good or Excellent, as a horizontal row
// of cards (DESIGN.md AlternativeCard). Shown for Poor and Bad products.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreBadge } from '../../components/score';
import { Button, Icon } from '../../components/ui';
import type { OffProduct } from '../../data/normalize';
import { RADIUS, TYPE, useTheme } from '../../theme';
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
  const note = (text: string) => (
    <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{text}</Text>
  );

  let body;
  if (isPending) {
    body = (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={t.textSecondary} />
        {note('Looking on Open Food Facts…')}
      </View>
    );
  } else if (!data || data.status === 'error') {
    body = (
      <View style={[styles.empty, { backgroundColor: t.surface, borderColor: t.border }]}>
        {note(
          data?.error === 'rate_limited'
            ? 'Open Food Facts is busy. Try again in a minute.'
            : 'Couldn’t load alternatives. Check your connection and try again.',
        )}
        <Button title="Try again" tertiary onPress={() => refetch()} disabled={isRefetching} />
      </View>
    );
  } else if (!data.items.length) {
    body = (
      <View
        style={[
          styles.empty,
          styles.emptyRow,
          { backgroundColor: t.surface, borderColor: t.border },
        ]}
      >
        <Icon sf="checkmark.circle" fallback="✓" color={t.accent} size={20} />
        <Text style={[TYPE.body, { color: t.text, flex: 1 }]}>
          Nothing in this category on Open Food Facts scores Good or better yet.
        </Text>
      </View>
    );
  } else {
    body = (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Bleed to the screen edge so the next card peeks.
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {data.items.map((a) => (
          <Card key={a.barcode} item={a} />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[TYPE.headlineL, { color: t.text }]}>
          Better alternatives
        </Text>
        {data?.status === 'ok' && data.category
          ? note(
              data.wider
                ? `Nothing in ${categoryName(own)} scores Good or better, so these are other ${categoryName(data.category)}.`
                : sentence(`${categoryName(data.category)} sold in India that score higher.`),
            )
          : null}
      </View>
      {body}
      {data?.status === 'ok' &&
        data.items.length > 0 &&
        note('Picked from Open Food Facts data, which can contain mistakes. Check the pack.')}
    </View>
  );
}

function Card({ item }: { item: Alternative }) {
  const t = useTheme();
  const router = useRouter();
  const name = item.off.product_name || item.barcode;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${item.off.brands ? `, ${item.off.brands}` : ''}, score ${item.score.value} of 100, ${item.score.word.toLowerCase()}`}
      accessibilityHint="Opens this product"
      onPress={() =>
        router.push({ pathname: '/product/[barcode]', params: { barcode: item.barcode } })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.image, { backgroundColor: t.fill }]}>
        {item.off.image_front_small_url ? (
          <Image
            source={{ uri: item.off.image_front_small_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : (
          <Icon sf="shippingbox" fallback="□" color={t.textTertiary} size={24} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        <ScoreBadge {...item.score} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  empty: { borderWidth: 1, borderRadius: RADIUS.card, padding: 16, gap: 4 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { width: 148, borderWidth: 1, borderRadius: RADIUS.card, overflow: 'hidden' },
  image: { height: 92, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12, gap: 8 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600', minHeight: 40 },
});
