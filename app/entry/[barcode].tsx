import { useLocalSearchParams } from 'expo-router';

import { EntryScreen } from '../../src/features/entry/EntryScreen';

export default function EntryRoute() {
  const { barcode, scan, from } = useLocalSearchParams<{
    barcode: string;
    scan?: string;
    from?: string;
  }>();
  return (
    <EntryScreen
      barcode={barcode}
      scan={scan === 'camera' ? 'camera' : undefined}
      fromLabel={from === 'label'}
    />
  );
}
