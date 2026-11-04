// Scan tab (DESIGN.md 1 and 1b): full-bleed camera, Barcode | Label modes, torch, and a pill that
// opens the "Find a product" sheet.

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/ui';
import { newLocalId, normalizeBarcode } from '../../data/barcode';
import { CAMERA, TYPE } from '../../theme';
import { putPendingLabel } from '../entry/pendingLabel';
import { ocrSupported, readImage } from '../entry/recognise';
import { useRecordScan } from '../queries';

type Mode = 'barcode' | 'label';

const FRAME = { barcode: { width: 280, height: 164 }, label: { width: 260, height: 340 } };
// Same barcode within this time is the camera seeing it again, not a new scan.
const REPEAT_MS = 3000;
// No barcode read for this long: offer the torch. The camera gives no light reading, so the
// hint says what happened, not that it is dark.
const STUCK_MS = 6000;

export function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recordScan = useRecordScan();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [mode, setMode] = useState<Mode>('barcode');
  const [locked, setLocked] = useState(false);
  const [stuck, setStuck] = useState(false);
  const last = useRef({ code: '', at: 0 });
  const camera = useRef<CameraView>(null);
  const [label, setLabel] = useState<{
    step: 1 | 2;
    nutrition?: string;
    busy?: boolean;
    error?: string;
  }>({
    step: 1,
  });

  // The camera pauses while another screen or the result sheet is on top; coming back re-arms it.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setLocked(false);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!focused || mode !== 'barcode' || locked || torch) return;
    const timer = setTimeout(() => setStuck(true), STUCK_MS);
    return () => {
      clearTimeout(timer);
      setStuck(false);
    };
  }, [focused, mode, locked, torch]);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const code = normalizeBarcode(data);
    const now = Date.now();
    if (!code || locked) return;
    if (code === last.current.code && now - last.current.at < REPEAT_MS) return;
    last.current = { code, at: now };
    setLocked(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    recordScan.mutate(code);
    // Let the green frame show before the sheet covers it.
    setTimeout(
      () => router.push({ pathname: '/product/[barcode]', params: { barcode: code } }),
      250,
    );
  };

  // Label mode: nutrition table, then ingredients, then both are read on the phone.
  const shoot = async () => {
    if (label.busy) return;
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      if (label.step === 1) {
        setLabel({ step: 2, nutrition: photo.uri });
        return;
      }
      await finishLabel(label.nutrition!, photo.uri);
    } catch {
      setLabel({ ...label, busy: false, error: 'Couldn’t take the photo. Try again.' });
    }
  };
  const finishLabel = async (nutritionUri: string, ingredientsUri?: string) => {
    setLabel((l) => ({ ...l, busy: true, error: undefined }));
    try {
      const [nutrition, ingredients] = await Promise.all([
        readImage(nutritionUri),
        ingredientsUri ? readImage(ingredientsUri) : Promise.resolve([]),
      ]);
      const id = newLocalId();
      putPendingLabel(id, { nutrition, ingredients });
      setLabel({ step: 1 });
      router.push({ pathname: '/entry/[barcode]', params: { barcode: id, from: 'label' } });
    } catch {
      setLabel({ step: 1, error: 'Couldn’t read the photos. Try again in good light.' });
    }
  };

  const frame = FRAME[mode];
  const granted = permission?.granted;
  const hint =
    mode === 'barcode'
      ? stuck
        ? 'Can’t read a barcode yet? Try the torch'
        : 'Point at the barcode'
      : label.step === 1
        ? 'Fit the nutrition table in the frame'
        : 'Now the ingredients list';

  return (
    <View style={styles.root}>
      {granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={focused}
          enableTorch={torch && focused}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
          onBarcodeScanned={mode === 'barcode' && focused ? onScanned : undefined}
          accessibilityLabel="Camera view"
        />
      ) : null}
      {/* 28% scrim keeps the controls readable over a bright scene. */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

      <View style={[styles.top, { top: insets.top + 8 }]}>
        {granted && (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Torch"
            accessibilityState={{ checked: torch }}
            onPress={() => setTorch(!torch)}
            style={[styles.round, torch && styles.roundActive]}
          >
            <Icon
              sf={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'}
              fallback="⚡"
              color="#ffffff"
              size={18}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        {granted ? (
          <>
            <View style={styles.hint} accessibilityLiveRegion="polite">
              <Text style={styles.hintText}>{hint}</Text>
            </View>
            <View style={[frame, styles.frame]} accessibilityElementsHidden>
              <Corners color={locked ? CAMERA.active : '#ffffff'} />
              {locked && (
                <View style={styles.check}>
                  <Icon sf="checkmark" fallback="✓" color="#0F1A15" size={22} />
                </View>
              )}
              {label.busy && <ActivityIndicator color="#ffffff" size="large" />}
            </View>
            {mode === 'label' && (
              <Text style={styles.step}>
                {label.busy
                  ? 'Reading the label…'
                  : (label.error ??
                    (label.step === 1
                      ? 'Step 1 of 2 · then the ingredients list'
                      : 'Step 2 of 2 · or skip if there is no list'))}
              </Text>
            )}
            {mode === 'barcode' && stuck && !torch && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setTorch(true)}
                style={styles.torchPill}
              >
                <Icon sf="flashlight.on.fill" fallback="⚡" color="#1C1C1E" size={18} />
                <Text style={styles.torchPillText}>Turn on torch</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permissionText}>
              {permission && !permission.canAskAgain
                ? 'Camera access is off. Turn it on in Settings to scan, or type a barcode.'
                : 'Labelwise uses the camera to read barcodes and labels. Nothing is recorded.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                permission && !permission.canAskAgain ? Linking.openSettings() : requestPermission()
              }
              style={styles.torchPill}
            >
              <Text style={styles.torchPillText}>
                {permission && !permission.canAskAgain ? 'Open Settings' : 'Allow camera'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Above the floating tab bar. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 72 }]}>
        {granted && ocrSupported && (
          <View accessibilityRole="tablist" style={styles.modes}>
            {(['barcode', 'label'] as Mode[]).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  setMode(m);
                  setLabel({ step: 1 });
                }}
                style={[styles.mode, mode === m && styles.modeActive]}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                  {m === 'barcode' ? 'Barcode' : 'Label'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {mode === 'label' && granted ? (
          <View style={styles.shutterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                label.step === 1
                  ? 'Take photo of the nutrition table'
                  : 'Take photo of the ingredients'
              }
              disabled={label.busy}
              onPress={shoot}
              style={({ pressed }) => [
                styles.shutter,
                { opacity: pressed || label.busy ? 0.6 : 1 },
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            {label.step === 2 && !label.busy && (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => finishLabel(label.nutrition!)}
                style={styles.skip}
              >
                <Text style={styles.modeText}>Skip</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/find')}
            style={styles.findPill}
          >
            <Icon sf="keyboard" fallback="⌨" color="#ffffff" size={18} />
            <Text style={styles.findText}>Type a barcode or search</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Four white corner brackets (4 pt, 34 pt arms, 16 pt radius); no full outline. */
function Corners({ color }: { color: string }) {
  const arm = { position: 'absolute', width: 34, height: 34, borderColor: color } as const;
  return (
    <>
      <View
        style={[
          arm,
          { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
        ]}
      />
      <View
        style={[
          arm,
          { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
        ]}
      />
      <View
        style={[
          arm,
          {
            bottom: 0,
            left: 0,
            borderBottomWidth: 4,
            borderLeftWidth: 4,
            borderBottomLeftRadius: 16,
          },
        ]}
      />
      <View
        style={[
          arm,
          {
            bottom: 0,
            right: 0,
            borderBottomWidth: 4,
            borderRightWidth: 4,
            borderBottomRightRadius: 16,
          },
        ]}
      />
    </>
  );
}

const white = '#ffffff';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1B1D' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.28)' },
  top: { position: 'absolute', right: 20, flexDirection: 'row', zIndex: 1 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CAMERA.control,
    borderWidth: 1,
    borderColor: CAMERA.controlBorder,
  },
  roundActive: { borderWidth: 2, borderColor: CAMERA.active },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  hint: {
    backgroundColor: CAMERA.hint,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintText: { ...TYPE.subheadline, color: white },
  frame: { alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CAMERA.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: { ...TYPE.subheadline, color: white, textAlign: 'center', paddingHorizontal: 20 },
  torchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: white,
    borderRadius: 24,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  torchPillText: { ...TYPE.headline, color: '#1C1C1E' },
  permission: { gap: 16, alignItems: 'center', paddingHorizontal: 32 },
  permissionText: { ...TYPE.body, color: white, textAlign: 'center' },
  bottom: { alignItems: 'center', gap: 16 },
  modes: { flexDirection: 'row', gap: 4 },
  mode: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center' },
  modeActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  modeText: { ...TYPE.body, color: 'rgba(255,255,255,0.85)' },
  modeTextActive: { color: white, fontWeight: '600' },
  findPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: CAMERA.control,
    borderWidth: 1,
    borderColor: CAMERA.controlBorder,
  },
  findText: { ...TYPE.body, color: white },
  shutterRow: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: white },
  skip: { position: 'absolute', left: 92, minHeight: 44, justifyContent: 'center' },
});
