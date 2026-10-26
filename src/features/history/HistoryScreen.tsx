import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, Message, Small } from '../../components/ui';
import type { Scan } from '../../data/db';
import { mergeProduct } from '../../data/resolver';
import { useTheme } from '../../theme';
import { productView } from '../product/productView';
import { Badge, ScoreBadge } from '../product/ScoreTiles';
import {
  useClearSaved,
  useClearScans,
  useDeleteScan,
  useRemoveSaved,
  useSavedList,
  useScans,
} from '../queries';

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

type Tab = 'recent' | 'saved';

export function HistoryScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('recent');
  const recent = useScans();
  const saved = useSavedList();
  const { data: scans = [], isPending } = tab === 'recent' ? recent : saved;
  // Tabs stay mounted when you leave them, so reload both lists each time this tab comes back.
  const { refetch: reloadRecent } = recent;
  const { refetch: reloadSaved } = saved;
  useFocusEffect(
    useCallback(() => {
      reloadRecent();
      reloadSaved();
    }, [reloadRecent, reloadSaved]),
  );
  const del = useDeleteScan();
  const unsave = useRemoveSaved();
  const clearScans = useClearScans();
  const clearSaved = useClearSaved();

  // Wipes the whole list, so it asks first and says what stays.
  const confirmClear = () => {
    const n = scans.length;
    const recentTab = tab === 'recent';
    Alert.alert(
      recentTab ? 'Clear all history?' : 'Remove all saved products?',
      recentTab
        ? `This removes ${n} ${n === 1 ? 'scan' : 'scans'} from this device. Saved products and your own nutrition entries are kept.`
        : `This removes ${n} saved ${n === 1 ? 'product' : 'products'}. Your history is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: recentTab ? 'Clear all' : 'Remove all',
          style: 'destructive',
          onPress: () => (recentTab ? clearScans.mutate() : clearSaved.mutate()),
        },
      ],
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={scans}
      keyExtractor={(s) => String(s.id)}
      renderItem={({ item }) => (
        <Row
          scan={item}
          deleteLabel={tab === 'recent' ? 'Delete' : 'Remove'}
          onDelete={() => (tab === 'recent' ? del.mutate(item.id) : unsave.mutate(item.barcode))}
        />
      )}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 6 }}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
              History
            </Text>
            {scans.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tab === 'recent' ? 'Clear all history' : 'Remove all saved'}
                hitSlop={10}
                onPress={confirmClear}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text style={[styles.clear, { color: t.con }]}>Clear all</Text>
              </Pressable>
            )}
          </View>
          <Small>
            {tab === 'recent'
              ? 'Your scanned and checked products. They stay on this device.'
              : 'Products you bookmarked. They stay on this device.'}
          </Small>
          <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: t.card }]}>
            {(
              [
                ['recent', 'Recent'],
                ['saved', 'Saved'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && { backgroundColor: t.bg }]}
              >
                <Text style={[styles.tabText, { color: t.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        isPending ? undefined : tab === 'recent' ? (
          <Message title="No scans yet" body="Products you scan or look up will appear here." />
        ) : (
          <Message
            title="Nothing saved yet"
            body="Tap the bookmark on a product to keep it here."
          />
        )
      }
      ListFooterComponent={
        scans.length ? (
          <Small>Swipe a card left to {tab === 'recent' ? 'delete' : 'remove'} it.</Small>
        ) : undefined
      }
    />
  );
}

function Row({
  scan,
  deleteLabel,
  onDelete: remove,
}: {
  scan: Scan;
  deleteLabel: string;
  onDelete: () => void;
}) {
  const t = useTheme();
  const router = useRouter();

  const view =
    scan.off || scan.user
      ? productView({
          status: 'ok',
          product: mergeProduct(scan.barcode, scan.off ?? undefined, scan.user ?? undefined),
        })
      : null;
  const status =
    view?.kind === 'not_enough_data'
      ? 'Not enough data'
      : view?.kind === 'not_food'
        ? 'Not rated'
        : view
          ? null
          : 'Not found or not loaded';

  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      containerStyle={styles.swipe}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          onPress={remove}
          style={[styles.delete, { backgroundColor: t.con }]}
        >
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </Pressable>
      )}
      onSwipeableOpen={remove}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityActions={[{ name: 'delete', label: deleteLabel }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && remove()}
        onPress={() =>
          router.push({ pathname: '/product/[barcode]', params: { barcode: scan.barcode } })
        }
        style={[styles.card, { backgroundColor: t.card }]}
      >
        <View style={[styles.thumb, { backgroundColor: t.skeleton }]}>
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
        <View style={styles.text}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
            {scan.off?.product_name || scan.barcode}
          </Text>
          {scan.off?.brands && (
            <Text style={[styles.brand, { color: t.muted }]} numberOfLines={1}>
              {scan.off.brands}
            </Text>
          )}
          {view?.kind === 'scored' ? (
            <ScoreBadge scores={view.scores} overall={view.overall} />
          ) : (
            status && <Badge label={status} color={t.text} background={t.skeleton} />
          )}
          <Small>{when(scan.scannedAt)}</Small>
        </View>
        <Icon sf="chevron.right" fallback="›" color={t.muted} size={16} />
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 32, fontWeight: '800' },
  clear: { fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabText: { fontSize: 15, fontWeight: '600' },
  swipe: { borderRadius: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  text: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  brand: { fontSize: 13, fontWeight: '400' },
  delete: { justifyContent: 'center', paddingHorizontal: 24, borderRadius: 16, marginLeft: 8 },
  deleteText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
