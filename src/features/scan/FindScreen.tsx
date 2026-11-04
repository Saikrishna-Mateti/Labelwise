// "Find a product" sheet (DESIGN.md 1c): type a barcode, or search Open Food Facts by name.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScoreBadge } from '../../components/score';
import { Button, Icon, Segmented } from '../../components/ui';
import { normalizeBarcode } from '../../data/barcode';
import { searchByName, type NameSearchResult } from '../../data/offClient';
import { RADIUS, TYPE, useTheme } from '../../theme';
import { nameOfScan, viewOfScan } from '../product/productView';
import { useRecordScan, useScans } from '../queries';

type Mode = 'barcode' | 'name';

export function FindScreen() {
  const t = useTheme();
  const router = useRouter();
  const recordScan = useRecordScan();
  const [mode, setMode] = useState<Mode>('barcode');

  const open = (code: string) => {
    recordScan.mutate(code);
    // Replaces this sheet with the product's, rather than stacking a sheet on a sheet.
    router.replace({ pathname: '/product/[barcode]', params: { barcode: code } });
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[TYPE.title, { color: t.text, flex: 1 }]}>
          Find a product
        </Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Text style={[TYPE.body, { color: t.accent }]}>Cancel</Text>
        </Pressable>
      </View>
      <Segmented
        options={[
          ['barcode', 'Barcode'],
          ['name', 'Name'],
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'barcode' ? <BarcodeForm onOpen={open} /> : <NameSearch onOpen={open} />}
    </ScrollView>
  );
}

function BarcodeForm({ onOpen }: { onOpen: (code: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = text.replace(/\D/g, '').length;
  const code = normalizeBarcode(text);
  const submit = () => {
    if (!code) {
      setError('Enter the 8, 12 or 13 digits printed under the barcode.');
      return;
    }
    onOpen(code);
  };
  return (
    <View style={{ gap: 8 }}>
      <Text nativeID="barcodeLabel" style={[TYPE.subheadline, { color: t.textSecondary }]}>
        Barcode number
      </Text>
      <TextInput
        accessibilityLabelledBy="barcodeLabel"
        accessibilityHint={error ?? undefined}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={submit}
        autoFocus
        keyboardType="number-pad"
        returnKeyType="search"
        maxLength={16}
        placeholder="e.g. 8901491103794"
        placeholderTextColor={t.textTertiary}
        style={[
          styles.input,
          {
            color: t.text,
            backgroundColor: t.surface,
            borderColor: error ? t.tiers.rare.ring : focused ? t.accent : t.border,
            borderWidth: focused || error ? 2 : 1,
          },
        ]}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={[TYPE.footnote, { color: error ? t.tiers.rare.fg : t.textSecondary }]}
      >
        {error ?? `${digits} of 13 digits · printed under the bars`}
      </Text>
      <View style={{ paddingTop: 8 }}>
        <Button title="Look up" onPress={submit} />
      </View>
      <Recent onOpen={onOpen} />
    </View>
  );
}

function Recent({ onOpen }: { onOpen: (code: string) => void }) {
  const t = useTheme();
  const { data } = useScans();
  const recent = (data ?? []).slice(0, 3);
  if (!recent.length) return null;
  return (
    <View style={{ gap: 8, paddingTop: 24 }}>
      <Text style={[TYPE.footnote, styles.groupLabel, { color: t.textSecondary }]}>RECENT</Text>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        {recent.map((scan, i) => {
          const view = viewOfScan(scan);
          const score = view?.kind === 'scored' ? view.score : null;
          return (
            <Pressable
              key={scan.id}
              accessibilityRole="button"
              onPress={() => onOpen(scan.barcode)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: t.border },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text numberOfLines={1} style={[TYPE.body, { color: t.text, flex: 1 }]}>
                {nameOfScan(scan)}
              </Text>
              {score && <ScoreBadge {...score} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NameSearch({ onOpen }: { onOpen: (code: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NameSearchResult | null>(null);
  // Searches on Return only: OFF's search service allows about ten searches a minute.
  const submit = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    setResult(await searchByName(text));
    setBusy(false);
  };
  return (
    <View style={{ gap: 8 }}>
      <Text nativeID="nameLabel" style={[TYPE.subheadline, { color: t.textSecondary }]}>
        Product name or brand
      </Text>
      <TextInput
        accessibilityLabelledBy="nameLabel"
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        placeholder="e.g. Quaker oats"
        placeholderTextColor={t.textTertiary}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 },
        ]}
      />
      <Text style={[TYPE.footnote, { color: t.textSecondary }]}>
        Searches products sold in India on Open Food Facts.
      </Text>
      <View style={{ paddingTop: 8 }}>
        <Button title="Search" onPress={submit} disabled={busy || text.trim().length < 2} />
      </View>
      {busy && <ActivityIndicator color={t.textSecondary} style={{ paddingTop: 16 }} />}
      {!busy && result?.status === 'error' && (
        <Text style={[TYPE.subheadline, { color: t.textSecondary, paddingTop: 16 }]}>
          {result.error === 'rate_limited'
            ? 'Open Food Facts is busy. Try again in a minute.'
            : 'Couldn’t search. Check your connection and try again.'}
        </Text>
      )}
      {!busy && result?.status === 'ok' && (
        <View style={{ paddingTop: 16 }}>
          {result.hits.length ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              {result.hits.map((h, i) => {
                const brand = Array.isArray(h.brands) ? h.brands.join(', ') : h.brands;
                return (
                  <Pressable
                    key={h.code}
                    accessibilityRole="button"
                    accessibilityLabel={[h.product_name || h.code, brand]
                      .filter(Boolean)
                      .join(', ')}
                    onPress={() => onOpen(h.code)}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: 1, borderTopColor: t.border },
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={[styles.thumb, { backgroundColor: t.fill }]}>
                      {h.image_front_small_url ? (
                        <Image
                          source={{ uri: h.image_front_small_url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          accessible={false}
                        />
                      ) : (
                        <Icon sf="shippingbox" fallback="□" color={t.textTertiary} size={18} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[TYPE.body, { color: t.text }]}>
                        {h.product_name || h.code}
                      </Text>
                      {brand ? (
                        <Text numberOfLines={1} style={[TYPE.footnote, { color: t.textSecondary }]}>
                          {brand}
                        </Text>
                      ) : null}
                    </View>
                    <Icon sf="chevron.right" fallback="›" color={t.textTertiary} size={14} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>
              Nothing found. Try fewer words, or the brand name.
            </Text>
          )}
          <Text style={[TYPE.footnote, { color: t.textTertiary, paddingTop: 8 }]}>
            Data © Open Food Facts contributors (ODbL)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { minHeight: 50, borderRadius: RADIUS.button, paddingHorizontal: 16, fontSize: 20 },
  groupLabel: { fontWeight: '600', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.thumb,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
