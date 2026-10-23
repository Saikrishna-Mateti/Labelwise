import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Screen, Skeleton, Small, Title } from '../../components/ui';
import type { ResolvedProduct } from '../../data/resolver';
import { useTheme } from '../../theme';
import { useProduct, useSaveEntry } from '../queries';
import { draftFrom, FIELDS, offKeys, parseEntry, type Draft, type Errors } from './entryForm';

export function EntryScreen({ barcode }: { barcode: string }) {
  const { data, isPending } = useProduct(barcode);
  if (isPending) return <Skeleton />;
  return <EntryForm barcode={barcode} product={data?.status === 'ok' ? data.product : undefined} />;
}

function EntryForm({ barcode, product }: { barcode: string; product?: ResolvedProduct }) {
  const t = useTheme();
  const router = useRouter();
  const save = useSaveEntry(barcode);
  const locked = offKeys(product);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(product));
  const [errors, setErrors] = useState<Errors>({});
  const per = draft.productType === 'liquid' ? '100 ml' : '100 g';

  const onSave = () => {
    const result = parseEntry(draft, locked);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    save.mutate(result.entry, { onSuccess: () => router.back() });
  };

  return (
    <Screen>
      <Title>Add nutrition info</Title>
      <Body muted>
        Copy the “per {per}” column from the pack, not per serving. Leave anything you can’t find
        empty. Your values stay on this device.
      </Body>

      <Group label="Product type">
        <Choice
          options={[
            ['solid', 'Food (per 100 g)'],
            ['liquid', 'Drink (per 100 ml)'],
          ]}
          value={draft.productType}
          onChange={(productType) => setDraft({ ...draft, productType })}
        />
      </Group>

      {FIELDS.map(({ key, label, unit, hint }) => {
        const fromOff = locked.has(key);
        const isSodium = key === 'sodiumMg' && !fromOff;
        const shownUnit = isSodium && draft.sodiumUnit === 'salt_g' ? 'g' : unit;
        const shownLabel = isSodium && draft.sodiumUnit === 'salt_g' ? 'Salt' : label;
        return (
          <Group key={key} label={`${shownLabel} (${shownUnit})`} id={key}>
            {isSodium && (
              <Choice
                options={[
                  ['sodium_mg', 'Sodium (mg)'],
                  ['salt_g', 'Salt (g)'],
                ]}
                value={draft.sodiumUnit}
                onChange={(sodiumUnit) => setDraft({ ...draft, sodiumUnit })}
              />
            )}
            <TextInput
              accessibilityLabelledBy={key}
              accessibilityHint={errors[key]}
              editable={!fromOff}
              value={draft.values[key] ?? ''}
              onChangeText={(v) => setDraft({ ...draft, values: { ...draft.values, [key]: v } })}
              keyboardType="decimal-pad"
              placeholder={`${shownUnit} per ${per}`}
              placeholderTextColor={t.muted}
              style={[
                styles.input,
                {
                  color: fromOff ? t.muted : t.text,
                  backgroundColor: t.card,
                  borderColor: errors[key] ? t.con : t.card,
                },
              ]}
            />
            {errors[key] ? (
              <Text style={{ color: t.con }}>{errors[key]}</Text>
            ) : fromOff ? (
              <Small>From Open Food Facts</Small>
            ) : (
              hint && <Small>{hint}</Small>
            )}
          </Group>
        );
      })}

      <Group label="Ingredients (optional)" id="ingredients">
        {product?.ingredientsText?.source === 'off' ? (
          <Small>Already on Open Food Facts.</Small>
        ) : (
          <TextInput
            accessibilityLabelledBy="ingredients"
            value={draft.ingredientsText}
            onChangeText={(ingredientsText) => setDraft({ ...draft, ingredientsText })}
            multiline
            placeholder="As printed, e.g. Wheat flour, sugar, palm oil…"
            placeholderTextColor={t.muted}
            style={[styles.input, styles.multiline, { color: t.text, backgroundColor: t.card }]}
          />
        )}
      </Group>

      {Object.keys(errors).length > 0 && (
        <Text accessibilityLiveRegion="polite" style={{ color: t.con }}>
          Some values need fixing.
        </Text>
      )}
      <Button title="Save" onPress={onSave} disabled={save.isPending} />
      <Button title="Cancel" secondary onPress={() => router.back()} />
    </Screen>
  );
}

function Group({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text nativeID={id} style={[styles.label, { color: t.text }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.choices}>
      {options.map(([v, label]) => {
        const selected = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(v)}
            style={[
              styles.choice,
              { borderColor: t.primary, backgroundColor: selected ? t.primary : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? t.onPrimary : t.primary, fontWeight: '600' }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 18 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
});
