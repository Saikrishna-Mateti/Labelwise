import { useLocalSearchParams } from 'expo-router';

import { ProductScreen } from '../../src/features/product/ProductScreen';

export default function ProductRoute() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  return <ProductScreen barcode={barcode} />;
}
