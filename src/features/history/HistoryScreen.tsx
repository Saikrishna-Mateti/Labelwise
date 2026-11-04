// History (DESIGN.md 4): search, All scans | Saved, tier filter chips, rows grouped by day.

import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ScoreBadge, TierMark } from '../../components/score';
import { Icon, Message, Segmented } from '../../components/ui';
import { RADIUS, TYPE, useTheme, type Tier } from '../../theme';
import {
  useClearSaved,
  useClearScans,
  useDeleteScan,
  useSavedList,
  useScans,
  useSetSaved,
} from '../queries';
import { groupRows, timeLabel, toRow, type Group, type Row } from './history';

type Tab = 'all' | 'saved';

const FILTERS: [Tier | null, string][] = [
  [null, 'All'],
  ['great', 'Great'],
  ['moderate', 'Moderation'],
  ['occasional', 'Occasionally'],
  ['rare', 'Rarely'],
];

export function HistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<Tier | null>(null);
  const recent = useScans();
  const saved = useSavedList();
  // Tabs stay mounted when you leave them, so reload both lists each time this tab comes back.
  const { refetch: reloadRecent } = recent;
  const { refetch: reloadSaved } = saved;
  useFocusEffect(
    useCallback(() => {
      reloadRecent();
      reloadSaved();
    }, [reloadRecent, reloadSaved]),
  );
  const { data: scans = [], isPending } = tab === 'all' ? recent : saved;
  const savedCodes = useMemo(() => new Set(saved.data?.map((s) => s.barcode)), [saved.data]);
  const rows = useMemo(() => scans.map(toRow), [scans]);
  const groups = groupRows(rows, query, tier);

  const del = useDeleteScan();
  const setSaved = useSetSaved();
  const clearScans = useClearScans();
  const clearSaved = useClearSaved();

  // Wipes the whole list, so it asks first and says what stays.
  const confirmClear = () => {
    const n = scans.length;
    const all = tab === 'all';
    Alert.alert(
      all ? 'Clear all history?' : 'Remove all saved products?',
      all
        ? `This removes ${n} ${n === 1 ? 'scan' : 'scans'} from this device. Saved products and your own nutrition entries are kept.`
        : `This removes ${n} saved ${n === 1 ? 'product' : 'products'}. Your history is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: all ? 'Clear all' : 'Remove all',
          style: 'destructive',
          onPress: () => (all ? clearScans.mutate() : clearSaved.mutate()),
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={[TYPE.largeTitle, { color: t.text }]}>
        History
      </Text>
      <View style={[styles.search, { backgroundColor: t.fill }]}>
        <Icon sf="magnifyingglass" fallback="⌕" color={t.textSecondary} size={16} />
        <TextInput
          accessibilityLabel="Search your scans"
          value={query}
          onChangeText={setQuery}
          placeholder="Search your scans"
          placeholderTextColor={t.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[TYPE.body, styles.searchInput, { color: t.text }]}
        />
      </View>
      <Segmented
        options={[
          ['all', 'All scans'],
          ['saved', 'Saved'],
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map(([value, label]) => {
          const selected = value === tier;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={value ? `Show ${label.toLowerCase()} only` : 'Show all'}
              onPress={() => setTier(value)}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: t.text, borderColor: t.text }
                  : { backgroundColor: t.surface, borderColor: t.border },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {value && <TierMark tier={value} size={12} color={selected ? t.bg : undefined} />}
              <Text style={[TYPE.subheadline, { color: selected ? t.bg : t.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {groups.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={[TYPE.footnote, styles.groupLabel, { color: t.textSecondary }]}
          >
            {g.title.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            {g.rows.map((row, i) => (
              <HistoryRow
                key={row.scan.id}
                row={row}
                group={g.title}
                first={i === 0}
                saved={savedCodes.has(row.scan.barcode)}
                savedTab={tab === 'saved'}
                onSave={(on) => setSaved.mutate({ barcode: row.scan.barcode, saved: on })}
                onDelete={() => del.mutate(row.scan.id)}
              />
            ))}
          </View>
        </View>
      ))}

      {!isPending && !scans.length ? (
        tab === 'all' ? (
          <Message title="No scans yet" body="Products you scan or look up will appear here." />
        ) : (
          <Message
            title="Nothing saved yet"
            body="Tap the bookmark on a product, or swipe a row in All scans, to keep it here."
          />
        )
      ) : null}
      {scans.length > 0 && !groups.length && (
        <Text style={[TYPE.subheadline, { color: t.textSecondary, paddingTop: 8 }]}>
          {query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing in this group yet.'}
        </Text>
      )}

      {scans.length > 0 && (
        <View style={styles.footer}>
          <Text style={[TYPE.footnote, { color: t.textSecondary }]}>
            {tab === 'all'
              ? 'Swipe a row left to save or delete it. History stays on this device.'
              : 'Swipe a row left to remove it.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tab === 'all' ? 'Clear all history' : 'Remove all saved'}
            hitSlop={12}
            onPress={confirmClear}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={[TYPE.subheadline, { color: t.tiers.rare.fg, fontWeight: '600' }]}>
              {tab === 'all' ? 'Clear history' : 'Remove all saved'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function HistoryRow({
  row: { scan, name, brand, score },
  group,
  first,
  saved,
  savedTab,
  onSave,
  onDelete,
}: {
  row: Row;
  group: Group['title'];
  first: boolean;
  saved: boolean;
  savedTab: boolean;
  onSave: (saved: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const swipe = useRef<SwipeableMethods>(null);
  const time = timeLabel(scan.scannedAt, group);
  const actions = savedTab
    ? [{ name: 'remove', label: 'Remove', run: () => onSave(false) }]
    : [
        { name: 'save', label: saved ? 'Unsave' : 'Save', run: () => onSave(!saved) },
        { name: 'delete', label: 'Delete', run: onDelete },
      ];
  const run = (action: (typeof actions)[number]) => {
    swipe.current?.close();
    action.run();
  };

  return (
    <Swipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.name}
              accessibilityRole="button"
              onPress={() => run(a)}
              style={[
                styles.action,
                { backgroundColor: a.name === 'save' ? t.accent : t.tiers.rare.ring },
              ]}
            >
              <Text
                style={[
                  TYPE.subheadline,
                  styles.actionText,
                  // onAccent / surface keep 4.5:1 on these fills in both modes.
                  { color: a.name === 'save' ? t.onAccent : t.surface },
                ]}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          name,
          brand,
          time,
          score ? `score ${score.value} of 100, ${score.word.toLowerCase()}` : 'no score yet',
          saved && !savedTab && 'saved',
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={actions.map(({ name: n, label }) => ({ name: n, label }))}
        onAccessibilityAction={(e) =>
          actions.find((a) => a.name === e.nativeEvent.actionName)?.run()
        }
        onPress={() =>
          router.push({ pathname: '/product/[barcode]', params: { barcode: scan.barcode } })
        }
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 },
          !first && { borderTopWidth: 1, borderTopColor: t.border },
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: t.fill }]}>
          {scan.off?.image_front_small_url && (
            <Image
              source={{ uri: scan.off.image_front_small_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              accessible={false}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={[TYPE.body, { color: t.text, flexShrink: 1 }]}>
              {name}
            </Text>
            {saved && !savedTab && (
              <Icon sf="bookmark.fill" fallback="▮" color={t.accent} size={12} />
            )}
          </View>
          <Text numberOfLines={1} style={[TYPE.footnote, { color: t.textSecondary }]}>
            {[brand, time].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {score ? (
          <ScoreBadge {...score} />
        ) : (
          <Text style={[TYPE.footnote, { color: t.textSecondary }]}>No score</Text>
        )}
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    borderRadius: RADIUS.thumb,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 8 },
  chipStrip: { marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  groupLabel: { fontWeight: '600', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: 44, height: 44, borderRadius: RADIUS.thumb, overflow: 'hidden' },
  actions: { flexDirection: 'row' },
  action: { justifyContent: 'center', paddingHorizontal: 20 },
  actionText: { fontWeight: '600' },
  footer: { gap: 12, alignItems: 'flex-start', paddingTop: 8 },
});
