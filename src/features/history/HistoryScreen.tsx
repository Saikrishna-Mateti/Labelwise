import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Message, Small } from '../../components/ui';
import type { Scan } from '../../data/db';
import { mergeProduct } from '../../data/resolver';
import { useTheme } from '../../theme';
import { productView } from '../product/productView';
import { CompactScore } from '../product/ScoreTiles';
import { usePrimaryMethod, useDeleteScan, useScans, type PrimaryMethod } from '../queries';

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function HistoryScreen() {
  const t = useTheme();
  const { data: scans = [], isPending } = useScans();
  const [primary] = usePrimaryMethod();

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={scans}
      keyExtractor={(s) => String(s.id)}
      renderItem={({ item }) => <Row scan={item} primary={primary} />}
      ListHeaderComponent={
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
          History
        </Text>
      }
      ListEmptyComponent={
        isPending ? undefined : (
          <Message title="No scans yet" body="Products you scan or look up will appear here." />
        )
      }
      ListFooterComponent={
        scans.length ? (
          <Small>Swipe a card left to delete it. History stays on this device.</Small>
        ) : undefined
      }
    />
  );
}

function Row({ scan, primary }: { scan: Scan; primary: PrimaryMethod }) {
  const t = useTheme();
  const router = useRouter();
  const del = useDeleteScan();
  const remove = () => del.mutate(scan.id);

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
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}
      onSwipeableOpen={remove}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
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
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
            {scan.off?.product_name || scan.barcode}
          </Text>
          <Small>{status ? `${status} · ${when(scan.scannedAt)}` : when(scan.scannedAt)}</Small>
        </View>
        {view?.kind === 'scored' && <CompactScore scores={view.scores} primary={primary} />}
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 6 },
  swipe: { borderRadius: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  thumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden' },
  name: { fontSize: 16, fontWeight: '600' },
  delete: { justifyContent: 'center', paddingHorizontal: 24, borderRadius: 16, marginLeft: 8 },
  deleteText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
