// "How scores work" and "About and data sources", opened from Profile. Each opens with the short
// answer; the method detail sits in rows that open on tap, so the page reads at a glance.

import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { TierMark } from '../../components/score';
import { DISCLAIMER, Icon, Screen } from '../../components/ui';
import { RADIUS, TYPE, useTheme, type Tier } from '../../theme';
import { EXPLAIN, TIER_WORD } from '../product/productView';

const BANDS: [Tier, string, string][] = [
  ['great', '75–100', 'Nutri-Score A'],
  ['moderate', '50–74', 'Nutri-Score B'],
  ['occasional', '25–49', 'Nutri-Score C or D'],
  ['rare', '0–24', 'Nutri-Score E'],
];

export function ScoresScreen() {
  const t = useTheme();
  return (
    <Screen>
      <Lead>Every product gets one score out of 100, in one of four bands.</Lead>

      <Card>
        {BANDS.map(([tier, range, grade]) => (
          <View
            key={tier}
            accessible
            accessibilityLabel={`${range}, ${TIER_WORD[tier]}, from ${grade}`}
            style={styles.row}
          >
            <View style={[styles.bandMark, { backgroundColor: t.tiers[tier].tint }]}>
              <TierMark tier={tier} size={14} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.headline, { color: t.text }]}>{TIER_WORD[tier]}</Text>
              <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{grade}</Text>
            </View>
            <Text style={[TYPE.headline, styles.tabular, { color: t.tiers[tier].fg }]}>
              {range}
            </Text>
          </View>
        ))}
      </Card>

      <Group title="How the number is set">
        <Card>
          <Step n={1} title="Nutri-Score picks the band" />
          <Step
            n={2}
            title="Some additives lower it one band"
            body="Only additives that EFSA found people may eat too much of."
          />
          <Step
            n={3}
            title="India rating and processing fine-tune it"
            body="More stars and less processing move it up within the band."
          />
        </Card>
      </Group>

      <Group title="The ratings behind it">
        <Card>
          <Disclosure sf="star" title="India rating" summary="0.5 to 5 stars">
            {EXPLAIN.inr}
          </Disclosure>
          <Disclosure sf="a.square" title="Nutri-Score" summary="A to E">
            {EXPLAIN.nutriscore}
          </Disclosure>
          <Disclosure sf="gearshape.2" title="Processing" summary="NOVA 1 to 4">
            {EXPLAIN.nova} When Open Food Facts has no NOVA group, Labelwise estimates one from the
            ingredients and says so.
          </Disclosure>
          <Disclosure sf="chart.bar" title="Nutrient levels" summary="Low, Moderate, High">
            High uses the ICMR-NIN Dietary Guidelines for Indians (2024) for energy, salt and added
            sugar, and the UK Food Standards Agency bands for saturated fat and sugars. Low follows
            FSSAI’s rules for “low” claims. Protein is Good from 10% of the daily allowance.
          </Disclosure>
          <Disclosure sf="flask" title="Additives" summary="EFSA findings">
            Names, INS numbers and EFSA findings come from Open Food Facts. “No data” means EFSA has
            no finding on record, not that the additive is safe.
          </Disclosure>
          <Disclosure sf="arrow.triangle.swap" title="Better alternatives" summary="Same category">
            For products under 50, Labelwise looks for products in the same category sold in India,
            scores them the same way, and shows only those scoring 50 or more.
          </Disclosure>
        </Card>
      </Group>

      <Group title="What never changes a score">
        <Card>
          <Point sf="megaphone" text="Brands can’t pay for a better score. No ads, no sponsors." />
          <Point
            sf="person"
            text="Your profile adds warnings, like allergens, but never moves the score."
          />
        </Card>
      </Group>
    </Screen>
  );
}

export function AboutScreen() {
  const t = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Screen>
      <Lead>Private by design, built on open data.</Lead>

      <Group title="Privacy">
        <Card>
          <Point sf="lock" text="No account, no tracking, no ads." />
          <Point sf="iphone" text="History and entries stay on this phone." />
          <Point sf="barcode" text="Only the barcode goes to Open Food Facts." />
          <Point sf="camera" text="Label photos never leave your phone." />
        </Card>
      </Group>

      <Group title="Data source">
        <Card>
          <LinkRow
            sf="globe"
            title="Open Food Facts"
            note="Free product database built by volunteers"
            url="https://world.openfoodfacts.org"
          />
          <LinkRow
            sf="doc.text"
            title="Open Database License"
            note="Data © Open Food Facts contributors (ODbL)"
            url="https://opendatacommons.org/licenses/odbl/1-0/"
          />
        </Card>
      </Group>

      <Group title="Good to know">
        <Card>
          <Point sf="info.circle" text={DISCLAIMER} />
          <Point sf="text.magnifyingglass" text="Data can be out of date. Check the pack." />
          <Point sf="building.columns" text="Not linked to FSSAI or Open Food Facts." />
          <Disclosure sf="star" title="About the India rating" summary="Draft">
            It follows FSSAI’s 2022 draft, which was never finalised. FSSAI has since proposed “high
            in” warning labels instead, and no front-of-pack rating is mandatory in India yet.
          </Disclosure>
        </Card>
      </Group>

      <Text style={[TYPE.footnote, { color: t.textTertiary, textAlign: 'center' }]}>
        Labelwise {version} · App code under the MIT licence
      </Text>
    </Screen>
  );
}

function Lead({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[TYPE.headlineL, { color: t.text }]}>{children}</Text>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={[TYPE.headline, { color: t.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Rounded card; rows inside get a separator between them. */
function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  const rows = Array.isArray(children) ? children : [children];
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      {rows.map((row, i) => (
        <View key={i} style={i > 0 && { borderTopWidth: 1, borderTopColor: t.border }}>
          {row}
        </View>
      ))}
    </View>
  );
}

function Step({ n, title, body }: { n: number; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[`Step ${n}`, title, body].filter(Boolean).join('. ')}
      style={styles.row}
    >
      <View style={[styles.step, { backgroundColor: t.accentTint }]}>
        <Text style={[TYPE.subheadline, { color: t.accent, fontWeight: '700' }]}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[TYPE.headline, { color: t.text }]}>{title}</Text>
        {body && <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>{body}</Text>}
      </View>
    </View>
  );
}

function Point({ sf, text }: { sf: string; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Icon sf={sf} fallback="•" color={t.accent} size={18} />
      <Text style={[TYPE.body, { color: t.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function Disclosure({
  sf,
  title,
  summary,
  children,
}: {
  sf: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon sf={sf} fallback="•" color={t.accent} size={18} />
        <Text style={[TYPE.body, { color: t.text, flex: 1 }]}>{title}</Text>
        <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>{summary}</Text>
        <Icon
          sf={open ? 'chevron.up' : 'chevron.down'}
          fallback={open ? '˄' : '˅'}
          color={t.textTertiary}
          size={14}
        />
      </Pressable>
      {open && (
        <Text style={[TYPE.subheadline, styles.detail, { color: t.textSecondary }]}>
          {children}
        </Text>
      )}
    </View>
  );
}

function LinkRow({
  sf,
  title,
  note,
  url,
}: {
  sf: string;
  title: string;
  note: string;
  url: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${note}`}
      accessibilityHint="Opens in your browser"
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Icon sf={sf} fallback="•" color={t.accent} size={18} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[TYPE.body, { color: t.text }]}>{title}</Text>
        <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{note}</Text>
      </View>
      <Icon sf="arrow.up.right" fallback="↗" color={t.textTertiary} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: { fontVariant: ['tabular-nums'] },
  step: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingHorizontal: 16, paddingLeft: 46, paddingBottom: 14 },
});
