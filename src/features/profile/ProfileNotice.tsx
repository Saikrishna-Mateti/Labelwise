// Allergen warning above the score (DESIGN.md: a hard flag, whatever the score), or a note that
// the profile couldn't be checked.

import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { TYPE, useTheme } from '../../theme';
import { joinAnd } from '../product/productView';
import type { ProfileFlags } from './flags';

export function ProfileNotice({ flags }: { flags: ProfileFlags }) {
  const t = useTheme();
  const { contains, traces, unchecked } = flags;
  if (contains.length || traces.length) {
    const c = t.tiers.rare;
    return (
      <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: c.tint }]}>
        <Icon sf="exclamationmark.triangle.fill" fallback="▲" color={c.fg} size={16} />
        <View style={{ flex: 1, gap: 2 }}>
          {contains.length > 0 && (
            <Text style={[TYPE.headline, { color: c.fg }]}>Contains {joinAnd(contains)}</Text>
          )}
          {traces.length > 0 && (
            <Text style={[TYPE.subheadline, { color: c.fg, fontWeight: '600' }]}>
              May contain {joinAnd(traces)}
            </Text>
          )}
          <Text style={[TYPE.footnote, { color: c.fg }]}>
            From your allergies, as listed on Open Food Facts. Always check the pack.
          </Text>
        </View>
      </View>
    );
  }
  if (!unchecked) return null;
  return (
    <View style={[styles.notice, { backgroundColor: t.fill }]}>
      <Icon sf="info.circle" fallback="i" color={t.textSecondary} size={16} />
      <Text style={[TYPE.footnote, { color: t.textSecondary, flex: 1 }]}>
        There’s no ingredient list on Open Food Facts, so your profile can’t be checked. Check the
        pack.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14 },
});
