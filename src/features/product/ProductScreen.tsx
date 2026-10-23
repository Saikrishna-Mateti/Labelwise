import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  DISCLAIMER,
  Icon,
  Message,
  OffAttribution,
  Screen,
  Skeleton,
  Small,
} from '../../components/ui';
import type { OffError } from '../../data/offClient';
import type { ResolvedProduct } from '../../data/resolver';
import { LABEL_FOR } from '../../scoring/inr';
import type { NutrientKey, Reason } from '../../scoring/types';
import { useTheme } from '../../theme';
import { usePrimaryMethod, useProduct, type PrimaryMethod } from '../queries';
import { joinAnd, productView, summaryFor, type ProductScores } from './productView';
import { Hero, SummaryCard } from './Hero';
import { NutritionCards } from './NutritionCards';
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
            <AddNutritionButton barcode={view.barcode} />
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
          <Hero product={view.product} />
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
          <Hero product={view.product} />
          {view.offError && <StaleNotice error={view.offError} />}
          <Message
            title="Not enough data to rate this"
            body={
              view.missing.length
                ? `We don’t have its ${joinAnd(view.missing)} yet. You’ll find these in the nutrition table on the pack.`
                : 'We don’t have the nutrition values needed to rate it yet.'
            }
          >
            <AddNutritionButton barcode={view.product.barcode} edit={hasUserValues(view.product)} />
          </Message>
          <NutritionTable product={view.product} />
          {view.product.off && <OffAttribution barcode={view.product.barcode} />}
        </Screen>
      );

    case 'scored': {
      const summary = summaryFor(view.verdict, view.overall);
      return (
        <Screen>
          <Hero
            product={view.product}
            overall={view.overall}
            subtitle={view.processing ?? undefined}
          />
          {view.offError && <StaleNotice error={view.offError} />}
          {summary && <SummaryCard {...summary} band={view.overall?.band} />}
          <Collapsible
            title="Nutrition"
            suffix={`(per ${view.product.productType.value === 'liquid' ? '100 ml' : '100 g'})`}
            plain
            initiallyOpen
          >
            <NutritionCards product={view.product} limits={view.limits} />
          </Collapsible>
          <SectionTitle>All ratings</SectionTitle>
          <ScoreTiles scores={view.scores} primary={primary} />
          {hasUserValues(view.product) ? (
            <>
              <Small>Scored partly with values you entered, marked “yours” below.</Small>
              <AddNutritionButton barcode={view.product.barcode} edit />
            </>
          ) : (
            view.scores[primary].band === null && (
              <AddNutritionButton barcode={view.product.barcode} />
            )
          )}
          <Collapsible title="How the ratings were worked out" sf="info.circle">
            <ReasonSections scores={view.scores} primary={primary} />
          </Collapsible>
          <NutritionTable product={view.product} />
          <Disclaimer barcode={view.product.off ? view.product.barcode : undefined} />
        </Screen>
      );
    }
  }
}

/** Mockup footer: info icon with the disclaimer, then the Open Food Facts link and licence. */
function Disclaimer({ barcode }: { barcode?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Icon sf="info.circle" fallback="i" color={t.muted} size={18} />
        <View style={{ flex: 1 }}>
          <Small>{DISCLAIMER}</Small>
        </View>
      </View>
      {barcode && <OffAttribution barcode={barcode} />}
    </View>
  );
}

const hasUserValues = (p: ResolvedProduct) =>
  Object.values(p.nutrition).some((v) => v.source === 'user');

function AddNutritionButton({ barcode, edit }: { barcode: string; edit?: boolean }) {
  const router = useRouter();
  return (
    <Button
      title={edit ? 'Edit your values' : 'Add nutrition info'}
      secondary={edit}
      onPress={() => router.push({ pathname: '/entry/[barcode]', params: { barcode } })}
    />
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

const ROWS: [NutrientKey, string][] = [
  ['energyKcal', 'kcal'],
  ['sugarsG', 'g'],
  ['saturatedFatG', 'g'],
  ['sodiumMg', 'mg'],
  ['fibreG', 'g'],
  ['proteinG', 'g'],
  ['fruitVegPct', '%'],
  ['nutsLegumesMilletsPct', '%'],
  ['addedSugarsG', 'g'],
  ['addedFatG', 'g'],
];

function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.text }]}>
      {children}
    </Text>
  );
}

/**
 * Shows or hides what is under it. `plain` is a section heading; otherwise a bordered row with an
 * icon, like a settings row.
 */
function Collapsible({
  title,
  suffix,
  sf,
  plain,
  initiallyOpen = false,
  children,
}: {
  title: string;
  /** Quiet text after the title, e.g. "(per 100 g)". */
  suffix?: string;
  sf?: string;
  plain?: boolean;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [
          styles.collapsible,
          !plain && [styles.rowButton, { borderColor: t.border }],
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        {sf && <Icon sf={sf} fallback="•" color={t.link} size={22} />}
        <Text style={[plain ? styles.sectionTitle : styles.cardTitle, { color: t.text, flex: 1 }]}>
          {title}
          {suffix && <Text style={[styles.suffix, { color: t.muted }]}> {suffix}</Text>}
        </Text>
        <Icon
          sf={open ? 'chevron.up' : plain ? 'chevron.down' : 'chevron.right'}
          fallback={open ? '▾' : '▸'}
          color={t.muted}
          size={16}
        />
      </Pressable>
      {open && children}
    </View>
  );
}

function NutritionTable({ product }: { product: ResolvedProduct }) {
  const t = useTheme();
  const per = product.productType.value === 'liquid' ? '100 ml' : '100 g';
  return (
    <Collapsible
      title={`Nutrition per ${per}`}
      sf="list.bullet.rectangle"
      initiallyOpen={hasUserValues(product)}
    >
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {ROWS.map(([key, unit]) => {
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
    </Collapsible>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  suffix: { fontSize: 15, fontWeight: '400' },
  collapsible: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16 },
  notice: { borderRadius: 8, padding: 12 },
  reason: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
