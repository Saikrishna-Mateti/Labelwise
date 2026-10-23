import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? { borderColor: t.primary, borderWidth: 1 } : { backgroundColor: t.primary },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? t.primary : t.onPrimary }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Full-page explanation: not found, offline, not enough data, and so on. */
export function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.message}>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {children}
    </View>
  );
}

export function Skeleton() {
  const t = useTheme();
  const block = (height: number, width: `${number}%`) => (
    <View style={{ height, width, borderRadius: 8, backgroundColor: t.skeleton }} />
  );
  return (
    <View
      accessible
      accessibilityLabel="Loading product"
      style={[styles.screen, { backgroundColor: t.bg, flex: 1 }]}
    >
      {block(28, '70%')}
      {block(18, '40%')}
      {block(120, '100%')}
      {block(18, '90%')}
      {block(18, '80%')}
      {block(18, '85%')}
    </View>
  );
}

export function Link({ title, url }: { title: string; url: string }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="link"
      style={[styles.small, { color: t.link }]}
      onPress={() => Linking.openURL(url)}
    >
      {title}
    </Text>
  );
}

/** SF Symbol on iOS; the text fallback elsewhere. Decorative: put the meaning in nearby text. */
export function Icon({
  sf,
  fallback,
  color,
  size = 20,
}: {
  sf: string;
  fallback: string;
  color: string;
  size?: number;
}) {
  if (Platform.OS === 'ios') {
    return (
      <Image
        source={`sf:${sf}`}
        tintColor={color}
        style={{ width: size, height: size }}
        accessible={false}
      />
    );
  }
  return (
    <Text
      accessible={false}
      style={{ color, fontSize: size * 0.8, width: size, textAlign: 'center' }}
    >
      {fallback}
    </Text>
  );
}

export function Small({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.small, { color: t.muted }]}>{children}</Text>;
}

export const DISCLAIMER = 'Scores are for information only and are not medical or dietary advice.';

/** ODbL attribution, required wherever OFF data is shown. */
export function OffAttribution({ barcode }: { barcode?: string }) {
  return (
    <View style={styles.attribution}>
      <Small>Data © Open Food Facts contributors (ODbL)</Small>
      <Link
        title={barcode ? 'View this product on Open Food Facts' : 'openfoodfacts.org'}
        url={
          barcode
            ? `https://world.openfoodfacts.org/product/${barcode}`
            : 'https://world.openfoodfacts.org'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  message: { gap: 12, paddingTop: 24 },
  attribution: { gap: 4 },
});
