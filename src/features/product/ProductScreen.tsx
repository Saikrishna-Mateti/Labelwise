// The result sheet (design/DESIGN.md, screen 2): verdict first, details on demand.

import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { HighlightChip, ScoreRing } from '../../components/score';
import { Button, DISCLAIMER, Icon, Message } from '../../components/ui';
import type { OffError } from '../../data/offClient';
import type { ResolvedProduct } from '../../data/resolver';
import type { LevelKey } from '../../scoring/levels';
import type { Reason } from '../../scoring/types';
import { RADIUS, TYPE, useTheme, type Tier } from '../../theme';
import { HealthierOptions } from '../alternatives/HealthierOptions';
import { wantsAlternatives } from '../alternatives/alternatives';
import { ocrSupported } from '../entry/recognise';
import { useProduct } from '../queries';
import { additivesSummary, Ingredients } from './Additives';
import { Hero } from './Hero';
import { NutritionRows } from './NutritionRows';
import {
  EXPLAIN,
  joinAnd,
  NOVA_GROUP,
  productView,
  type Overall,
  type ProductScores,
} from './productView';

const UNAVAILABLE: Record<OffError, string> = {
  offline: 'You’re offline. Connect to the internet to look this product up.',
  timeout: 'Open Food Facts didn’t respond in time. Try again in a moment.',
  rate_limited: 'Open Food Facts is busy right now. Try again in a minute.',
  server_error: 'Open Food Facts had a problem answering. Try again in a moment.',
};

const offUrl = (barcode: string) => `https://world.openfoodfacts.org/product/${barcode}`;

/**
 * One scroll view for the sheet's whole life (loading, result, errors). iOS picks the scroll view
 * that drives "swipe up to expand" when the sheet opens, so swapping it later breaks that gesture.
 */
export function ProductScreen({ barcode }: { barcode: string }) {
  const t = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Body barcode={barcode} scroll={scroll} />
    </ScrollView>
  );
}

function Body({
  barcode,
  scroll,
}: {
  barcode: string;
  scroll: RefObject<ScrollViewInstance | null>;
}) {
  const router = useRouter();
  const { data, isPending, isError, refetch, isRefetching } = useProduct(barcode);

  if (isPending) return <ResultSkeleton barcode={barcode} />;
  if (isError || !data) {
    return (
      <>
        <Message title="Something went wrong" body="This product couldn’t be loaded.">
          <Button title="Try again" onPress={() => refetch()} disabled={isRefetching} />
        </Message>
      </>
    );
  }

  const view = productView(data);
  switch (view.kind) {
    case 'invalid_barcode':
      return (
        <>
          <Message
            title="That isn’t a product barcode"
            body="Product barcodes have 8, 12 or 13 digits."
          />
        </>
      );

    case 'not_found':
      return (
        <>
          <StateIcon sf="questionmark.magnifyingglass" />
          <Message
            title="We couldn’t find this product"
            body={`Barcode ${view.barcode} isn’t in Open Food Facts yet. You can still get a score from the label.`}
          >
            <AddNutritionButton barcode={view.barcode} />
            <Button
              title="Add it to Open Food Facts"
              secondary
              onPress={() =>
                Linking.openURL(
                  `https://world.openfoodfacts.org/cgi/product.pl?type=add&code=${view.barcode}`,
                )
              }
            />
            <Button title="Scan something else" tertiary onPress={() => router.back()} />
          </Message>
        </>
      );

    case 'unavailable':
      return (
        <>
          <StateIcon sf={view.error === 'offline' ? 'wifi.slash' : 'exclamationmark.icloud'} />
          <Message
            title={view.error === 'offline' ? 'You’re offline' : 'Can’t look this up right now'}
            body={UNAVAILABLE[view.error]}
          >
            <Button title="Try again" onPress={() => refetch()} disabled={isRefetching} />
            <Button title="Open history" secondary onPress={() => router.navigate('/history')} />
          </Message>
        </>
      );

    case 'not_food':
      return (
        <>
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
          <Footer barcode={view.product.off ? view.product.barcode : undefined} />
        </>
      );

    case 'not_enough_data':
      return (
        <>
          <Hero product={view.product} />
          {view.offError && <StaleNotice error={view.offError} />}
          <Message
            title="Not enough data to score this"
            body={
              view.missing.length
                ? `We don’t have its ${joinAnd(view.missing)} yet. You’ll find these in the nutrition table on the pack.`
                : 'We don’t have the nutrition values needed to score it yet.'
            }
          >
            <AddNutritionButton barcode={view.product.barcode} edit={hasUserValues(view.product)} />
          </Message>
          <Footer barcode={view.product.off ? view.product.barcode : undefined} />
        </>
      );

    case 'scored':
      return <Scored view={view} scroll={scroll} />;
  }
}

type ScoredView = Extract<ReturnType<typeof productView>, { kind: 'scored' }>;
type SectionKey = 'nutrition' | 'ingredients' | 'processing' | 'ratings';

function Scored({
  view,
  scroll,
}: {
  view: ScoredView;
  scroll: RefObject<ScrollViewInstance | null>;
}) {
  const t = useTheme();
  const detailY = useRef(0);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    nutrition: true,
    ingredients: false,
    processing: false,
    ratings: false,
  });
  const [highlighted, setHighlighted] = useState<LevelKey>();
  const { product, scores, score } = view;
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const reveal = (k: SectionKey) => {
    setOpen((o) => ({ ...o, [k]: true }));
    scroll.current?.scrollTo({ y: detailY.current - 8, animated: true });
  };
  const flash = (key: LevelKey) => {
    reveal('nutrition');
    setHighlighted(key);
    setTimeout(() => setHighlighted(undefined), 1500);
  };
  const alternatives =
    product.off && view.overall && wantsAlternatives(view.overall.band) ? (
      <HealthierOptions barcode={product.barcode} band={view.overall.band} off={product.off} />
    ) : null;
  const ns = scores.nutriscore.band;
  const stars = scores.inr.value;
  const nova = scores.nova.value;

  return (
    <>
      <Hero product={product} score={score} />
      {view.offError && <StaleNotice error={view.offError} />}

      {score ? (
        <ScoreRing {...score} reason={view.reason} />
      ) : (
        <View
          style={[styles.card, styles.pad, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Text style={[TYPE.headlineL, { color: t.text }]}>No score yet</Text>
          <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>
            Open Food Facts has no Nutri-Score for this product, so it can’t be scored. The India
            rating and processing are under All ratings.
          </Text>
        </View>
      )}

      {view.highlights.length > 0 && (
        <View style={styles.chips}>
          {view.highlights.map((h) => (
            <HighlightChip
              key={h.text}
              text={h.text}
              tone={h.tone}
              onPress={h.key ? () => flash(h.key!) : undefined}
            />
          ))}
        </View>
      )}

      <View style={styles.caption}>
        <Text style={[TYPE.footnote, { color: t.textSecondary, flex: 1 }]}>
          Combines{' '}
          <GoldStars
            text={joinAnd(
              [
                ns && `Nutri-Score ${ns}`,
                stars !== null && `India rating ${stars}★ (draft)`,
                nova !== null && `NOVA ${nova}`,
              ].filter((x): x is string => !!x),
            )}
          />
        </Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => reveal('ratings')}>
          <Text style={[TYPE.footnote, { color: t.accent, fontWeight: '600' }]}>
            How it’s scored
          </Text>
        </Pressable>
      </View>

      {/* Low scores put alternatives before the details (DESIGN.md). */}
      {alternatives}

      <View
        onLayout={(e) => (detailY.current = e.nativeEvent.layout.y)}
        style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <SectionRow
          sf="chart.bar.fill"
          title="Nutrition"
          summary={`per ${product.productType.value === 'liquid' ? '100 ml' : '100 g'}`}
          open={open.nutrition}
          onToggle={() => toggle('nutrition')}
          first
        >
          <NutritionRows product={product} levels={view.levels} highlighted={highlighted} />
        </SectionRow>
        <SectionRow
          sf="list.bullet"
          title="Ingredients"
          summary={additivesSummary(view.additives.length)}
          open={open.ingredients}
          onToggle={() => toggle('ingredients')}
        >
          <Ingredients text={product.ingredientsText?.value} additives={view.additives} />
        </SectionRow>
        <SectionRow
          sf="square.stack.3d.up"
          title="Processing"
          summary={nova !== null ? `NOVA ${nova} · ${NOVA_GROUP[nova].toLowerCase()}` : 'Unknown'}
          open={open.processing}
          onToggle={() => toggle('processing')}
        >
          <Reasons explain={EXPLAIN.nova} reasons={scores.nova.reasons} />
        </SectionRow>
        <SectionRow
          sf="star"
          title="All ratings"
          summary={[
            ns ?? '–',
            stars !== null ? `${stars}★` : '–',
            nova !== null ? `NOVA ${nova}` : '–',
          ].join(' · ')}
          open={open.ratings}
          onToggle={() => toggle('ratings')}
        >
          <AllRatings scores={scores} overall={view.overall} />
        </SectionRow>
      </View>

      {hasUserValues(product) && (
        <View style={{ gap: 8 }}>
          <Text style={[TYPE.footnote, { color: t.textSecondary }]}>
            Scored partly with values you entered, marked “yours”.
          </Text>
          <AddNutritionButton barcode={product.barcode} edit />
        </View>
      )}

      <Footer barcode={product.off ? product.barcode : undefined} shownBarcode={product.barcode} />
    </>
  );
}

/** Text with every ★ in the star gold; the number next to it carries the meaning. */
function GoldStars({ text }: { text: string }) {
  const t = useTheme();
  return text.split('★').map((part, i) => (
    <Text key={i}>
      {i > 0 && <Text style={{ color: t.star }}>★</Text>}
      {part}
    </Text>
  ));
}

/** Accordion row (DESIGN.md SectionRow): the summary answers the question without opening. */
function SectionRow({
  sf,
  title,
  summary,
  open,
  onToggle,
  first,
  children,
}: {
  sf: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: 1, borderTopColor: t.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHead, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon sf={sf} fallback="•" color={t.accent} size={20} />
        <Text style={[TYPE.headline, { color: t.text }]}>{title}</Text>
        <Text
          numberOfLines={1}
          style={[TYPE.subheadline, { color: t.textSecondary, flex: 1, textAlign: 'right' }]}
        >
          <GoldStars text={summary} />
        </Text>
        <Icon
          sf={open ? 'chevron.up' : 'chevron.down'}
          fallback={open ? '˄' : '˅'}
          color={t.textTertiary}
          size={14}
        />
      </Pressable>
      {open && children}
    </View>
  );
}

const REASON_ICON: Record<Reason['kind'], { sf: string; fallback: string; label: string }> = {
  con: { sf: 'exclamationmark.circle.fill', fallback: '!', label: 'To watch' },
  pro: { sf: 'checkmark.circle.fill', fallback: '✓', label: 'Good' },
  info: { sf: 'info.circle', fallback: 'i', label: 'Note' },
};
const KIND_ORDER: Reason['kind'][] = ['con', 'pro', 'info'];

function Reasons({ explain, reasons }: { explain?: string; reasons: Reason[] }) {
  const t = useTheme();
  const color = { pro: t.tiers.great.ring, con: t.tiers.occasional.ring, info: t.textTertiary };
  const sorted = KIND_ORDER.flatMap((k) => reasons.filter((r) => r.kind === k));
  return (
    <View style={{ gap: 10, paddingBottom: 12 }}>
      {explain && <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>{explain}</Text>}
      {sorted.map((r) => (
        <View
          key={r.text}
          style={styles.reason}
          accessible
          accessibilityLabel={`${REASON_ICON[r.kind].label}: ${r.text}`}
        >
          <Icon
            sf={REASON_ICON[r.kind].sf}
            fallback={REASON_ICON[r.kind].fallback}
            color={color[r.kind]}
            size={18}
          />
          <Text style={[TYPE.subheadline, { color: t.text, flex: 1 }]}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

type Method = keyof ProductScores;
// Nutri-Score first: it sets the score's range; the other two place it inside.
const METHODS: Method[] = ['nutriscore', 'inr', 'nova'];
const GRADE_TIER: Record<string, Tier> = {
  A: 'great',
  B: 'moderate',
  C: 'occasional',
  D: 'occasional',
  E: 'rare',
};

/** One glance per rating: a value tile, a name, and one plain line. */
function rating(m: Method, scores: ProductScores) {
  const r = scores[m];
  const estimated = r.source === 'estimated' && r.value !== null ? ' Estimated.' : '';
  if (m === 'nutriscore') {
    return {
      title: 'Nutri-Score',
      value: r.band ?? '–',
      tier: r.band ? GRADE_TIER[r.band] : undefined,
      line: r.band ? 'Nutrients per 100 g. A is best, E is worst.' : 'Not available.',
      spoken: r.band ? `grade ${r.band}` : 'not available',
    };
  }
  if (m === 'inr') {
    return {
      title: 'India rating',
      value: r.value !== null ? String(r.value) : '–',
      star: r.value !== null,
      line:
        r.value !== null
          ? `${r.value} of 5 stars. FSSAI 2022 draft, not in force.${estimated}`
          : 'Not available.',
      spoken: r.value !== null ? `${r.value} of 5 stars` : 'not available',
    };
  }
  return {
    title: 'Processing',
    value: r.value !== null ? String(r.value) : '–',
    line:
      r.value !== null
        ? `NOVA ${r.value}: ${NOVA_GROUP[r.value].toLowerCase()}. 1 is least processed.${estimated}`
        : 'Unknown.',
    spoken: r.value !== null ? `NOVA ${r.value}` : 'unknown',
  };
}

function AllRatings({ scores, overall }: { scores: ProductScores; overall: Overall | null }) {
  const t = useTheme();
  const [details, setDetails] = useState(false);
  return (
    <View style={{ paddingBottom: 8 }}>
      {METHODS.map((m) => {
        const r = rating(m, scores);
        const c = r.tier ? t.tiers[r.tier] : undefined;
        return (
          <View
            key={m}
            accessible
            accessibilityLabel={`${r.title}, ${r.spoken}. ${r.line}`}
            style={[styles.ratingRow, { borderTopColor: t.border }]}
          >
            <View style={[styles.ratingTile, { backgroundColor: c?.tint ?? t.fill }]}>
              <Text style={[TYPE.headline, { color: c?.fg ?? t.text }]}>
                {r.value}
                {'star' in r && r.star ? <Text style={{ color: t.star }}>★</Text> : null}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.headline, { color: t.text }]}>{r.title}</Text>
              <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{r.line}</Text>
            </View>
          </View>
        );
      })}
      <Text
        style={[
          TYPE.footnote,
          styles.combine,
          { color: t.textSecondary, borderTopColor: t.border },
        ]}
      >
        Nutri-Score sets the range of the score; the India rating and processing fine-tune it.
        {overall?.loweredBy.length ? ' Lowered one range for an additive of concern.' : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        hitSlop={8}
        onPress={() => setDetails(!details)}
        style={styles.detailsToggle}
      >
        <Text style={[TYPE.subheadline, { color: t.accent, fontWeight: '600' }]}>
          {details ? 'Hide details' : 'Show details'}
        </Text>
      </Pressable>
      {details && (
        <View style={{ gap: 16, paddingTop: 8 }}>
          <Text style={[TYPE.footnote, { color: t.textSecondary }]}>
            The score is Labelwise’s own. Nutri-Score A gives 75–100, B 50–74, C and D 25–49, E
            0–24, one range lower for an additive EFSA found people may eat too much of. The India
            rating and NOVA group place it inside that range.
          </Text>
          {METHODS.map((m) => (
            <View key={m} style={{ gap: 6 }}>
              <Text style={[TYPE.headline, { color: t.text }]}>{rating(m, scores).title}</Text>
              <Reasons explain={EXPLAIN[m]} reasons={scores[m].reasons} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** DESIGN.md loading state: the result's layout in grey, with a status line. */
function ResultSkeleton({ barcode }: { barcode: string }) {
  const t = useTheme();
  const block = (style: object) => (
    <View style={[{ backgroundColor: t.fill, borderRadius: 8 }, style]} />
  );
  return (
    <View style={{ gap: 16 }} accessibilityLabel="Loading product">
      <Text
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        style={[TYPE.subheadline, { color: t.textSecondary }]}
      >
        Looking up {barcode}…
      </Text>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        {block({ width: 84, height: 84, borderRadius: RADIUS.button })}
        <View style={{ flex: 1, gap: 10 }}>
          {block({ height: 20, width: '80%' })}
          {block({ height: 14, width: '50%' })}
          {block({ height: 14, width: '60%' })}
        </View>
      </View>
      <View
        style={[
          styles.card,
          styles.skeletonRing,
          { backgroundColor: t.surface, borderColor: t.border },
        ]}
      >
        {block({ width: 92, height: 92, borderRadius: 46 })}
        <View style={{ flex: 1, gap: 10 }}>
          {block({ height: 20, width: '70%' })}
          {block({ height: 14, width: '90%' })}
        </View>
      </View>
      <View style={styles.chips}>
        {block({ height: 34, width: 110, borderRadius: 17 })}
        {block({ height: 34, width: 130, borderRadius: 17 })}
        {block({ height: 34, width: 100, borderRadius: 17 })}
      </View>
    </View>
  );
}

function StateIcon({ sf }: { sf: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stateIcon, { backgroundColor: t.fill }]}>
      <Icon sf={sf} fallback="?" color={t.textSecondary} size={26} />
    </View>
  );
}

/** Disclaimer, Open Food Facts links and the ODbL credit, on every result. */
function Footer({ barcode, shownBarcode }: { barcode?: string; shownBarcode?: string }) {
  const t = useTheme();
  const link = (title: string, url: string) => (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens in your browser"
      hitSlop={8}
      onPress={() => Linking.openURL(url)}
    >
      <Text style={[TYPE.subheadline, { color: t.accent, fontWeight: '600' }]}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 12, paddingTop: 8 }}>
      <View style={styles.reason}>
        <Icon sf="info.circle" fallback="i" color={t.textTertiary} size={16} />
        <Text style={[TYPE.footnote, { color: t.textSecondary, flex: 1 }]}>{DISCLAIMER}</Text>
      </View>
      {barcode && link('View on Open Food Facts ↗', offUrl(barcode))}
      {barcode &&
        link(
          'Report a problem with this product',
          `https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${barcode}`,
        )}
      <Text style={{ fontSize: 12, lineHeight: 16, color: t.textTertiary }}>
        {[shownBarcode && `Barcode ${shownBarcode}`, 'Data © Open Food Facts contributors (ODbL)']
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );
}

const hasUserValues = (p: ResolvedProduct) =>
  Object.values(p.nutrition).some((v) => v.source === 'user');

function AddNutritionButton({ barcode, edit }: { barcode: string; edit?: boolean }) {
  const router = useRouter();
  return (
    <View style={{ gap: 10 }}>
      {!edit && ocrSupported && (
        <Button
          title="Scan the label instead"
          onPress={() =>
            router.push({ pathname: '/entry/[barcode]', params: { barcode, scan: 'camera' } })
          }
        />
      )}
      <Button
        title={edit ? 'Edit your values' : 'Type the values'}
        secondary
        onPress={() => router.push({ pathname: '/entry/[barcode]', params: { barcode } })}
      />
    </View>
  );
}

function StaleNotice({ error }: { error: OffError }) {
  const t = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: t.tiers.moderate.tint }]}>
      <Text style={[TYPE.subheadline, { color: t.tiers.moderate.fg }]}>
        Showing saved data.{' '}
        {error === 'offline' ? 'You’re offline.' : 'Open Food Facts didn’t respond.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, paddingHorizontal: 16 },
  pad: { paddingVertical: 16, gap: 4 },
  skeletonRing: { flexDirection: 'row', alignItems: 'center', gap: 20, padding: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caption: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  section: {},
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  ratingTile: {
    width: 48,
    height: 40,
    borderRadius: RADIUS.thumb,
    alignItems: 'center',
    justifyContent: 'center',
  },
  combine: { paddingTop: 12, borderTopWidth: 1 },
  detailsToggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
  },
  notice: { borderRadius: 12, padding: 12 },
});
