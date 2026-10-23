import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, DISCLAIMER, Link, OffAttribution, Screen, Small } from '../../components/ui';
import { useTheme } from '../../theme';
import { EXPLAIN } from '../product/productView';
import { usePrimaryMethod, type PrimaryMethod } from '../queries';

const METHODS: { id: PrimaryMethod; title: string; note: string }[] = [
  {
    id: 'inr',
    title: 'Indian Nutrition Rating',
    note: 'Stars, from FSSAI’s 2022 draft (not in force)',
  },
  { id: 'nutriscore', title: 'Nutri-Score', note: 'A to E, when Open Food Facts has it' },
];

export function AboutScreen() {
  const t = useTheme();
  const [primary, setPrimary] = usePrimaryMethod();
  return (
    <Screen>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
        About
      </Text>
      <Section title="Main score">
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {METHODS.map((m) => {
            const selected = m.id === primary;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setPrimary(m.id)}
                style={[
                  styles.option,
                  { borderColor: selected ? t.primary : t.border, backgroundColor: t.card },
                ]}
              >
                <Text style={[styles.optionTitle, { color: t.text }]}>
                  {selected ? '◉' : '○'} {m.title}
                </Text>
                <Small>{m.note}</Small>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="About the scores">
        <Body>
          Overall (Excellent, Good, Poor, Bad): Labelwise’s plain-language reading of the
          Nutri-Score grade. A is Excellent, B is Good, C and D are Poor, E is Bad. It doesn’t yet
          include additives.
        </Body>
        <Body>
          High / OK: compared with the ICMR-NIN Dietary Guidelines for Indians 2024 limits for
          energy, added sugar and added fat. Saturated fat and total sugars have no such limit.
        </Body>
        <Body>Indian Nutrition Rating: {EXPLAIN.inr}</Body>
        <Body>Nutri-Score: {EXPLAIN.nutriscore}</Body>
        <Body>
          NOVA: {EXPLAIN.nova} When Open Food Facts has no NOVA group, Labelwise estimates it from
          the ingredient list and labels it “estimated”.
        </Body>
      </Section>

      <Section title="How scores are made">
        <Body>
          Scores come only from published methods and the product’s data. No brand can pay to change
          a score, and Labelwise has no ads or sponsors.
        </Body>
      </Section>

      <Section title="Disclaimer">
        <Body>{DISCLAIMER}</Body>
        <Body>
          Labelwise is not affiliated with or endorsed by FSSAI or Open Food Facts. The Indian
          Nutrition Rating here follows FSSAI’s 2022 draft, which was never finalised. FSSAI has
          since proposed “high in” warning labels instead, and no front-of-pack rating is mandatory
          in India yet.
        </Body>
        <Body>
          Product data can be incomplete or out of date. Always check the label on the pack.
        </Body>
      </Section>

      <Section title="Privacy">
        <Body>
          No account, no tracking and no ads. Your scan history and anything you enter stay on this
          device. Labelwise only sends the barcode to Open Food Facts to look the product up.
        </Body>
      </Section>

      <Section title="Data and licences">
        <Body>
          Product information comes from Open Food Facts, a free database built by volunteers, and
          is available under the Open Database License (ODbL).
        </Body>
        <OffAttribution />
        <Link title="Open Database License" url="https://opendatacommons.org/licenses/odbl/1-0/" />
        <Small>App code: MIT licence. Version {Constants.expoConfig?.version ?? '—'}</Small>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={[styles.section, { color: t.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '800' },
  section: { fontSize: 20, fontWeight: '700' },
  option: { borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 2 },
  optionTitle: { fontSize: 17, fontWeight: '600' },
});
