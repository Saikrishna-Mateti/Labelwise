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

/** Primary (one per screen), secondary (tinted) or tertiary (text only), per DESIGN.md. */
export function Button({
  title,
  onPress,
  disabled,
  secondary,
  tertiary,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
}) {
  const t = useTheme();
  const fill = disabled ? t.fill : tertiary ? 'transparent' : secondary ? t.accentTint : t.accent;
  const color = disabled ? t.textTertiary : secondary || tertiary ? t.accent : t.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tertiary && styles.tertiary,
        { backgroundColor: fill, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color, fontWeight: tertiary ? '400' : '600' }]}>
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
  const t = useTheme();
  return (
    <View style={styles.message}>
      <Text accessibilityRole="header" style={[styles.messageTitle, { color: t.text }]}>
        {title}
      </Text>
      <Text style={[styles.messageBody, { color: t.textSecondary }]}>{body}</Text>
      <View style={styles.messageActions}>{children}</View>
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

/** ODbL attribution, required wherever OFF data is shown: link first, licence line under it. */
export function OffAttribution({ barcode }: { barcode?: string }) {
  const t = useTheme();
  const url = barcode
    ? `https://world.openfoodfacts.org/product/${barcode}`
    : 'https://world.openfoodfacts.org';
  return (
    <View style={styles.attribution}>
      <Pressable
        accessibilityRole="link"
        accessibilityHint="Opens in your browser"
        onPress={() => Linking.openURL(url)}
        style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.small, styles.underline, { color: t.link }]}>
          {barcode ? 'View this product on Open Food Facts' : 'openfoodfacts.org'}
        </Text>
        <Icon sf="arrow.up.right.square" fallback="↗" color={t.link} size={15} />
      </Pressable>
      <Small>Data © Open Food Facts contributors (ODbL)</Small>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 40, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiary: { minHeight: 44 },
  buttonText: { fontSize: 17 },
  message: { gap: 8, paddingTop: 16 },
  messageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  messageBody: { fontSize: 15, lineHeight: 20, textAlign: 'center' },
  messageActions: { gap: 12, paddingTop: 16 },
  attribution: { gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
});
