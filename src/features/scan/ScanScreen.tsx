import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { GlassButton } from '../../components/Glass';
import { Body, Button, Icon } from '../../components/ui';
import { normalizeBarcode } from '../../data/barcode';
import { useTheme } from '../../theme';
import { useRecordScan } from '../queries';

export function ScanScreen() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const recordScan = useRecordScan();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  // The camera pauses while another screen or the product sheet is on top; coming back re-arms it.
  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const open = (code: string) => {
    recordScan.mutate(code);
    router.push({ pathname: '/product/[barcode]', params: { barcode: code } });
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const code = normalizeBarcode(data);
    if (handled.current || !code) return;
    handled.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    open(code);
  };

  const onSubmit = () => {
    const code = normalizeBarcode(text);
    if (!code) {
      setError('Enter the 8, 12 or 13 digits printed under the barcode.');
      return;
    }
    setError(null);
    setText('');
    open(code);
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentInsetAdjustmentBehavior="automatic"
      // Scrolls the barcode field above the keyboard.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.camera, { height: height * 0.55, backgroundColor: t.card }]}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              active={focused}
              enableTorch={torch && focused}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
              onBarcodeScanned={onScanned}
              accessibilityLabel="Camera view. Point it at a barcode."
            />
            <View style={styles.controls} pointerEvents="box-none">
              <View style={styles.hint}>
                <Text style={styles.hintText}>Point at the barcode on the pack</Text>
              </View>
              <GlassButton
                label={torch ? 'Turn torch off' : 'Turn torch on'}
                selected={torch}
                onPress={() => setTorch(!torch)}
              >
                <Icon
                  sf={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'}
                  fallback="⚡"
                  color="#ffffff"
                />
              </GlassButton>
            </View>
          </>
        ) : permission && !permission.canAskAgain ? (
          <View style={styles.cameraMessage}>
            <Body>
              Camera access is off. Turn it on in Settings to scan, or type the barcode below.
            </Body>
            <Button title="Open Settings" secondary onPress={() => Linking.openSettings()} />
          </View>
        ) : (
          <View style={styles.cameraMessage}>
            <Body>Labelwise uses the camera only to read barcodes. Nothing is recorded.</Body>
            <Button title="Allow camera" onPress={() => requestPermission()} />
          </View>
        )}
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: t.text }]} nativeID="barcodeLabel">
          Or type a barcode
        </Text>
        <TextInput
          accessibilityLabelledBy="barcodeLabel"
          value={text}
          onChangeText={setText}
          onSubmitEditing={onSubmit}
          keyboardType="number-pad"
          returnKeyType="search"
          placeholder="e.g. 8901719101038"
          placeholderTextColor={t.muted}
          style={[
            styles.input,
            { color: t.text, backgroundColor: t.card, borderColor: error ? t.con : t.card },
          ]}
        />
        {error && <Text style={{ color: t.con }}>{error}</Text>}
        <Button title="Look up" onPress={onSubmit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  camera: { overflow: 'hidden', justifyContent: 'center' },
  cameraMessage: { padding: 24, gap: 12 },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // Plain dark chip, not glass: it is text over a moving camera image and must stay readable.
  hint: {
    flexShrink: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintText: { color: '#ffffff', fontSize: 15 },
  form: { padding: 16, gap: 8 },
  label: { fontSize: 17, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 18 },
});
