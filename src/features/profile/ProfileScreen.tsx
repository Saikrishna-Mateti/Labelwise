// Profile (DESIGN.md 5): diet, allergies and health goals. They add flags to a result; scores
// never change. App settings and the About pages live here too.

import { useRouter, type Href } from 'expo-router';
import { Children, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { RADIUS, TYPE, useTheme } from '../../theme';
import { useAppearance, useProfile, type Appearance } from '../queries';
import { ALLERGENS, type Profile } from './flags';

const APPEARANCE: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useProfile();
  const [{ mode }, setAppearance] = useAppearance();
  const set = (patch: (p: Profile) => Partial<Profile>) =>
    setProfile((prev) => ({ ...prev, ...patch(prev) }));
  const pickAppearance = () =>
    Alert.alert('Appearance', undefined, [
      ...(Object.keys(APPEARANCE) as Appearance[]).map((m) => ({
        text: APPEARANCE[m],
        onPress: () => setAppearance(() => ({ mode: m })),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[TYPE.largeTitle, { color: t.text }]}>
          Profile
        </Text>
        <Text style={[TYPE.subheadline, { color: t.textSecondary }]}>
          These highlight what matters to you on each product. Scores stay the same.
        </Text>
      </View>

      <Group title="Diet">
        <SwitchRow
          title="Vegetarian"
          value={profile.vegetarian}
          onChange={(v) => set(() => ({ vegetarian: v }))}
        />
        <SwitchRow
          title="Vegan"
          value={profile.vegan}
          onChange={(v) => set(() => ({ vegan: v }))}
        />
        <SwitchRow
          title="Jain"
          note="Flags onion, garlic and root vegetables"
          value={profile.jain}
          onChange={(v) => set(() => ({ jain: v }))}
        />
      </Group>

      <Group title="Allergies" note="Warns when the pack lists it, or says it may contain it.">
        <View style={styles.chips}>
          {ALLERGENS.map(([tag, label]) => {
            const on = profile.allergies.includes(tag);
            return (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                hitSlop={5}
                onPress={() =>
                  set(({ allergies }) => ({
                    allergies: allergies.includes(tag)
                      ? allergies.filter((a) => a !== tag)
                      : [...allergies, tag],
                  }))
                }
                style={({ pressed }) => [
                  styles.chip,
                  on
                    ? { backgroundColor: t.accentTint, borderColor: t.accent, borderWidth: 1.5 }
                    : { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 },
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {on && <Icon sf="checkmark" fallback="✓" color={t.accent} size={12} />}
                <Text
                  style={[
                    TYPE.subheadline,
                    { color: on ? t.accent : t.text, fontWeight: on ? '600' : '400' },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Group>

      <Group
        title="Health goals"
        note="Not medical advice. Ask a doctor or dietitian about a medical diet."
      >
        <SwitchRow
          title="Diabetes-friendly"
          note="Flags added sugar and refined flour"
          value={profile.diabetes}
          onChange={(v) => set(() => ({ diabetes: v }))}
        />
        <SwitchRow
          title="Low sodium"
          note="Flags high sodium (ICMR-NIN limit)"
          value={profile.lowSodium}
          onChange={(v) => set(() => ({ lowSodium: v }))}
        />
      </Group>

      <Group title="App">
        <LinkRow title="Appearance" value={APPEARANCE[mode]} onPress={pickAppearance} />
        <LinkRow title="How scores work" onPress={() => router.push('/scores' as Href)} />
        <LinkRow title="About and data sources" onPress={() => router.push('/about' as Href)} />
      </Group>
    </ScrollView>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={[TYPE.footnote, styles.groupLabel, { color: t.textSecondary }]}
      >
        {title.toUpperCase()}
      </Text>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        {Children.toArray(children).map((child, i) => (
          <View key={i} style={i > 0 && { borderTopWidth: 1, borderTopColor: t.border }}>
            {child}
          </View>
        ))}
      </View>
      {note && <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{note}</Text>}
    </View>
  );
}

function SwitchRow({
  title,
  note,
  value,
  onChange,
}: {
  title: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: t.text }]}>{title}</Text>
        {note && <Text style={[TYPE.footnote, { color: t.textSecondary }]}>{note}</Text>}
      </View>
      <Switch
        accessibilityLabel={note ? `${title}, ${note}` : title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.border, true: t.accent }}
        ios_backgroundColor={t.border}
      />
    </View>
  );
}

function LinkRow({
  title,
  value,
  onPress,
}: {
  title: string;
  value?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[TYPE.body, { color: t.text, flex: 1 }]}>{title}</Text>
      {value && <Text style={[TYPE.body, { color: t.textSecondary }]}>{value}</Text>}
      <Icon sf="chevron.right" fallback="›" color={t.textTertiary} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 24 },
  groupLabel: { fontWeight: '600', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
  },
});
