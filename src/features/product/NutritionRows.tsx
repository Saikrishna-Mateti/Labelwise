// Nutrition per 100 g (or per serving): label, value and a Low / Moderate / High pill per row.
// Thresholds and sources: src/scoring/levels.ts.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PILL_WORD, StatusPill } from '../../components/score';
import { Icon } from '../../components/ui';
import type { Serving } from '../../data/normalize';
import type { ResolvedProduct } from '../../data/resolver';
import { LABEL_FOR } from '../../scoring/inr';
import type { LevelKey, NutrientLevel } from '../../scoring/levels';
import type { NutrientKey } from '../../scoring/types';
import { LIMITS } from '../../scoring/warnings';
import { TYPE, useTheme } from '../../theme';

const ROW: Record<LevelKey, { label: string; unit: string; digits: number }> = {
  energy: { label: 'Energy', unit: 'kcal', digits: 0 },
  saturatedFat: { label: 'Saturated fat', unit: 'g', digits: 1 },
  salt: { label: 'Sodium', unit: 'mg', digits: 0 },
  sugars: { label: 'Sugars', unit: 'g', digits: 1 },
  addedSugars: { label: 'Added sugar', unit: 'g', digits: 1 },
  protein: { label: 'Protein', unit: 'g', digits: 1 },
};
const FIELD: Record<LevelKey, NutrientKey> = {
  energy: 'energyKcal',
  saturatedFat: 'saturatedFatG',
  salt: 'sodiumMg',
  sugars: 'sugarsG',
  addedSugars: 'addedSugarsG',
  protein: 'proteinG',
};

const fmt = (n: number, digits: number) =>
  Number(n.toFixed(digits)).toLocaleString('en-IN', { maximumFractionDigits: digits });

export function NutritionRows({
  product,
  levels,
  highlighted,
}: {
  product: ResolvedProduct;
  levels: NutrientLevel[];
  /** Row to flash after a highlight chip is tapped. */
  highlighted?: LevelKey;
}) {
  const t = useTheme();
  const liquid = product.productType.value === 'liquid';
  const per = liquid ? '100 ml' : '100 g';
  const serving = product.serving?.value;
  const [perServing, setPerServing] = useState(false);
  const [fullTable, setFullTable] = useState(false);
  const k = perServing && serving ? serving.amount / 100 : 1;
  const limits = LIMITS[liquid ? 'liquid' : 'solid'];

  return (
    <View>
      {serving && (
        <PerToggle serving={serving} per={per} perServing={perServing} onChange={setPerServing} />
      )}
      {levels.map(({ key, value, level }) => {
        const row = ROW[key];
        const source = product.nutrition[FIELD[key]]?.source;
        const shown =
          value === undefined
            ? key === 'addedSugars'
              ? 'Not listed'
              : 'Not known'
            : `${fmt(value * k, row.digits)} ${row.unit}`;
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={[
              row.label,
              shown,
              source === 'user' && 'your value',
              !perServing && PILL_WORD(level),
            ]
              .filter(Boolean)
              .join(', ')}
            style={[
              styles.row,
              { borderTopColor: t.border },
              highlighted === key && { backgroundColor: t.accentTint },
            ]}
          >
            <Text style={[TYPE.body, { color: t.text, flex: 1 }]}>
              {row.label}
              {source === 'user' ? (
                <Text style={[TYPE.footnote, { color: t.textSecondary }]}> yours</Text>
              ) : null}
            </Text>
            <Text
              style={[
                value === undefined ? TYPE.body : TYPE.headline,
                { color: value === undefined ? t.textSecondary : t.text },
              ]}
            >
              {shown}
            </Text>
            {!perServing && <StatusPill level={level} />}
          </View>
        );
      })}
      <Text style={[TYPE.footnote, styles.note, { color: t.textSecondary }]}>
        {perServing && serving
          ? `Amounts for one serving of ${serving.amount} ${serving.unit}. Levels always use per ${per}.`
          : `Levels use ICMR-NIN 2024 limits where they exist (energy ${limits.energy} kcal, added sugar ${limits.addedSugars} g, salt ${limits.salt} g), otherwise FSSAI “low” claim limits and UK FSA bands. Protein is Good from 10% of the daily allowance.`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: fullTable }}
        onPress={() => setFullTable(!fullTable)}
        style={({ pressed }) => [
          styles.linkRow,
          { borderTopColor: t.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[TYPE.headline, { color: t.accent, flex: 1 }]}>Full nutrition table</Text>
        <Icon
          sf={fullTable ? 'chevron.up' : 'chevron.right'}
          fallback={fullTable ? '▾' : '›'}
          color={t.accent}
          size={14}
        />
      </Pressable>
      {fullTable && <FullTable product={product} per={per} />}
    </View>
  );
}

const TABLE: [NutrientKey, string][] = [
  ['energyKcal', 'kcal'],
  ['sugarsG', 'g'],
  ['addedSugarsG', 'g'],
  ['saturatedFatG', 'g'],
  ['addedFatG', 'g'],
  ['sodiumMg', 'mg'],
  ['fibreG', 'g'],
  ['proteinG', 'g'],
  ['fruitVegPct', '%'],
  ['nutsLegumesMilletsPct', '%'],
];

function FullTable({ product, per }: { product: ResolvedProduct; per: string }) {
  const t = useTheme();
  return (
    <View accessibilityLabel={`Full nutrition table per ${per}`}>
      {TABLE.map(([key, unit]) => {
        const v = product.nutrition[key];
        const label = LABEL_FOR[key];
        return (
          <View key={key} style={[styles.tableRow, { borderTopColor: t.border }]}>
            <Text style={[TYPE.subheadline, { color: t.text, flex: 1 }]}>
              {label[0].toUpperCase() + label.slice(1)}
            </Text>
            <Text style={[TYPE.subheadline, { color: v ? t.text : t.textSecondary }]}>
              {v ? `${fmt(v.value, 1)} ${unit}${v.source === 'user' ? ' (yours)' : ''}` : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PerToggle({
  serving,
  per,
  perServing,
  onChange,
}: {
  serving: Serving;
  per: string;
  perServing: boolean;
  onChange: (perServing: boolean) => void;
}) {
  const t = useTheme();
  const options: [boolean, string][] = [
    [false, `Per ${per}`],
    [true, `Per serving (${serving.amount} ${serving.unit})`],
  ];
  return (
    <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: t.fill }]}>
      {options.map(([value, label]) => {
        const selected = value === perServing;
        return (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(value)}
            style={[styles.segmentItem, selected && { backgroundColor: t.surface }]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[TYPE.footnote, { color: t.text, fontWeight: selected ? '600' : '400' }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  note: { paddingVertical: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: 8 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
});
