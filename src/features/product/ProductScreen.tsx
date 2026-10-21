import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Body,
  Button,
  DISCLAIMER,
  Icon,
  Message,
  OffAttribution,
  Screen,
  Skeleton,
  Small,
  Title,
} from '../../components/ui';
import { vegMark } from '../../data/normalize';
import type { OffError } from '../../data/offClient';
import type { ResolvedProduct } from '../../data/resolver';
import { LABEL_FOR } from '../../scoring/inr';
import type { NutrientKey, Reason } from '../../scoring/types';
import { useTheme } from '../../theme';
import { usePrimaryMethod, useProduct, type PrimaryMethod } from '../queries';
import { joinAnd, productView, type ProductScores } from './productView';
import { METHOD_ORDER, ScoreTiles } from './ScoreTiles';

const UNAVAILABLE: Record<OffError, string> = {
  offline: 'You’re offline. Connect to the internet to look this product up.',
  timeout: 'Open Food Facts didn’t respond in time. Try again in a moment.',
  rate_limited: 'Open Food Facts is busy right now. Try again in a minute.',
  server_error: 'Open Food Facts had a problem answering. Try again in a moment.',
};

export function ProductScreen({ barcode }: { barcode: string }) {
  const { data, isPending, isError, refetch, isRefetching } = useProduct(barcode);
  const [primary] = usePrimaryMethod();

  if (isPending) return <Skeleton />;
  if (isError || !data) {
    return (
      <Screen>
        <Message title="Something went wrong" body="This product couldn’t be loaded.">
          <Button title="Try again" onPress={() => refetch()} disabled={isRefetching} />
        </Message>
      </Screen>
    );
  }

  const view = productView(data);
  switch (view.kind) {
    case 'invalid_barcode':
      return (
        <Screen>
          <Message
            title="That isn’t a product barcode"
            body="Product barcodes have 8, 12 or 13 digits."
          />
        </Screen>
      );

    case 'not_found':
      return (
        <Screen>
          <Message
            title="Product not found"
            body={`Barcode ${view.barcode} isn’t on Open Food Facts yet. You can add its nutrition values from the pack yourself.`}
          >
            <AddNutritionButton />
          </Message>
        </Screen>
      );

    case 'unavailable':
      return (
        <Screen>
          <Message title="Can’t look this up right now" body={UNAVAILABLE[view.error]}>
            <Button title="Try again" onPress={() => refetch()} disabled={isRefetching} />
          </Message>
        </Screen>
      );

    case 'not_food':
      return (
        <Screen>
          <ProductHeader product={view.product} />
          <Message
            title={
              view.notFood === 'alcohol'
                ? 'Alcoholic drinks aren’t rated'
                : view.notFood === 'supplement'
                  ? 'Supplements aren’t rated'
                  : 'This isn’t a food product'
            }
            body="Labelwise rates everyday packaged foods and non-alcoholic drinks."
          />
          <OffAttribution barcode={view.product.off ? view.product.barcode : undefined} />
        </Screen>
      );

    case 'not_enough_data':
      return (
        <Screen>
          {view.offError && <StaleNotice error={view.offError} />}
          <ProductHeader product={view.product} />
          <Message
            title="Not enough data to rate this"
            body={
              view.missing.length
                ? `We don’t have its ${joinAnd(view.missing)} yet. You’ll find these in the nutrition table on the pack.`
                : 'We don’t have the nutrition values needed to rate it yet.'
            }
          >
            <AddNutritionButton />
          </Message>
          <NutritionTable product={view.product} />
          {view.product.off && <OffAttribution barcode={view.product.barcode} />}
        </Screen>
      );

    case 'scored':
      return (
        <Screen>
          {view.offError && <StaleNotice error={view.offError} />}
          <ProductHeader product={view.product} />
          {view.verdict && <Verdict text={view.verdict} />}
          <ScoreTiles scores={view.scores} primary={primary} />
          {view.scores[primary].band === null && <AddNutritionButton />}
          <Small>{DISCLAIMER}</Small>
          <ReasonSections scores={view.scores} primary={primary} />
          <NutritionTable product={view.product} />
          {view.product.off && <OffAttribution barcode={view.product.barcode} />}
        </Screen>
      );
  }
}

// ponytail: placeholder until Milestone 4 adds the manual-entry form.
function AddNutritionButton() {
  return (
    <View style={{ gap: 6 }}>
      <Button title="Add nutrition info" disabled />
      <Small>Adding your own values is coming in the next update.</Small>
    </View>
  );
}

function StaleNotice({ error }: { error: OffError }) {
  const t = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: t.warningBg }]}>
      <Text style={{ color: t.text }}>
        Showing saved data.{' '}
        {error === 'offline' ? 'You’re offline.' : 'Open Food Facts didn’t respond.'}
      </Text>
    </View>
  );
}

function ProductHeader({ product }: { product: ResolvedProduct }) {
  const t = useTheme();
  const off = product.off;
  const mark = vegMark(off?.labels_tags);
  return (
    <View style={styles.header}>
      {off?.image_front_small_url && (
        <Image
          source={{ uri: off.image_front_small_url }}
          style={[styles.image, { backgroundColor: t.card }]}
          contentFit="contain"
          transition={200}
          accessibilityLabel="Product photo"
        />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Title>{off?.product_name || 'Unnamed product'}</Title>
        {off?.brands && <Body muted>{off.brands}</Body>}
        <Small>Barcode {product.barcode}</Small>
        {mark && <VegMark mark={mark} />}
      </View>
    </View>
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

const REASON_STYLE: Record<Reason['kind'], { sf: string; fallback: string; label: string }> = {
  con: { sf: 'exclamationmark.circle.fill', fallback: '!', label: 'To watch' },
  pro: { sf: 'checkmark.circle.fill', fallback: '✓', label: 'Good' },
  info: { sf: 'info.circle', fallback: 'i', label: 'Note' },
};
const KIND_ORDER: Reason['kind'][] = ['con', 'pro', 'info'];

const SECTION_TITLE: Record<keyof ProductScores, string> = {
  inr: 'Indian Nutrition Rating (2022 FSSAI draft, not in force)',
  nutriscore: 'Nutri-Score',
  nova: 'Processing (NOVA)',
};

/** Each score explains itself with its own reasons, main score first. */
function ReasonSections({ scores, primary }: { scores: ProductScores; primary: PrimaryMethod }) {
  const t = useTheme();
  const color = { pro: t.pro, con: t.con, info: t.muted };
  return (
    <View style={{ gap: 12 }}>
      {METHOD_ORDER[primary].map((m) => {
        const reasons = KIND_ORDER.flatMap((k) => scores[m].reasons.filter((r) => r.kind === k));
        return (
          <View key={m} style={[styles.card, { backgroundColor: t.card }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: t.text }]}>
              {SECTION_TITLE[m]}
            </Text>
            {reasons.map((r) => (
              <View
                key={r.text}
                style={styles.reason}
                accessible
                accessibilityLabel={`${REASON_STYLE[r.kind].label}: ${r.text}`}
              >
                <Icon
                  sf={REASON_STYLE[r.kind].sf}
                  fallback={REASON_STYLE[r.kind].fallback}
                  color={color[r.kind]}
                />
                <Text style={[styles.reasonText, { color: t.text }]}>{r.text}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Verdict({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[styles.verdict, { color: t.text }]}>{text}</Text>;
}

const ROWS: [NutrientKey, string][] = [
  ['energyKcal', 'kcal'],
  ['sugarsG', 'g'],
  ['saturatedFatG', 'g'],
  ['sodiumMg', 'mg'],
  ['fibreG', 'g'],
  ['proteinG', 'g'],
  ['fruitVegPct', '%'],
  ['nutsLegumesMilletsPct', '%'],
];

function NutritionTable({ product }: { product: ResolvedProduct }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const per = product.productType.value === 'liquid' ? '100 ml' : '100 g';
  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={[styles.cardTitle, { color: t.text }]}>
          {open ? '▾' : '▸'} Nutrition per {per}
        </Text>
      </Pressable>
      {open &&
        ROWS.map(([key, unit]) => {
          const v = product.nutrition[key];
          const label = LABEL_FOR[key];
          return (
            <View key={key} style={[styles.row, { borderColor: t.border }]}>
              <Text style={{ color: t.text, flex: 1 }}>
                {label[0].toUpperCase() + label.slice(1)}
              </Text>
              <Text style={{ color: v ? t.text : t.muted }}>
                {v
                  ? `${Number(v.value.toFixed(1))} ${unit}${v.source === 'user' ? ' (yours)' : ''}`
                  : '—'}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  image: { width: 80, height: 80, borderRadius: 12 },
  vegRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vegSquare: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  verdict: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  notice: { borderRadius: 8, padding: 12 },
  reason: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
