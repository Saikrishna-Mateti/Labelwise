import { useLocalSearchParams } from 'expo-router';

import { EntryScreen } from '../../src/features/entry/EntryScreen';

export default function EntryRoute() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  return <EntryScreen barcode={barcode} />;
}
