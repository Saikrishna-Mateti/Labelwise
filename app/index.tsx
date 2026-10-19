import { StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function Home() {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#fff' : '#111';

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#000' : '#fff' }]}>
      <Text style={[styles.title, { color }]}>Labelwise</Text>
      <Text style={{ color }}>Scanning comes in Milestone 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  title: { fontSize: 28, fontWeight: '700' },
});
