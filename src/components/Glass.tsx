// Liquid Glass for floating controls only (never for content). Falls back to a solid translucent
// surface when glass is unavailable (before iOS 26, Android) or Reduce Transparency is on.

import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function GlassButton({
  label,
  onPress,
  selected,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const reduce = useReduceTransparency();
  const glass = !reduce && isGlassEffectAPIAvailable();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={style}
    >
      {glass ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.surface}>
          {children}
        </GlassView>
      ) : (
        <View style={[styles.surface, styles.fallback]}>{children}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  fallback: { backgroundColor: 'rgba(28,28,30,0.85)' },
});
