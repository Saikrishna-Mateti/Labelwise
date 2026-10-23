import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import type { ReactElement } from 'react';

import { createStore, getStore, type Store } from '../../data/db';
import type { OffProduct } from '../../data/normalize';
import { fetchProduct } from '../../data/offClient';
import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { memoryDb } from '../../test-utils/memoryDb';
import { EntryScreen } from '../entry/EntryScreen';
import { HistoryScreen } from '../history/HistoryScreen';
import { ProductScreen } from '../product/ProductScreen';
import { ScanScreen } from '../scan/ScanScreen';

jest.mock('../../data/db', () => ({ ...jest.requireActual('../../data/db'), getStore: jest.fn() }));
jest.mock('../../data/offClient', () => ({ fetchProduct: jest.fn() }));

// Reanimated needs native code Jest doesn't have; the swipe itself isn't under test here.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));

const off = fixtures as Record<string, OffProduct>;
let store: Store;

beforeEach(async () => {
  store = createStore(memoryDb());
  await store.init();
  jest.mocked(getStore).mockResolvedValue(store);
  mockPush.mockClear();
});

const renderWithQuery = (ui: ReactElement) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { gcTime: Infinity },
          },
        })
      }
    >
      {ui}
    </QueryClientProvider>,
  );

describe('ProductScreen', () => {
  test('scored product: rating, reasons and attribution', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: off['8901719101038'] });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);

    expect(
      await screen.findByText('Most points lost to saturated fat and energy'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/India rating \(draft\): 2 of 5 stars, estimated, main score/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nutri-Score: Grade E, A (best) to E')).toBeOnTheScreen();
    expect(screen.getByLabelText('Processing: NOVA 4, Ultra-processed')).toBeOnTheScreen();
    // Overall band from Nutri-Score E, and Nutri-Score's own points per nutrient.
    expect(
      screen.getByLabelText('Overall: Bad, from Nutri-Score E. Ultra-processed'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Not a healthy choice for regular consumption.')).toBeOnTheScreen();
    // ICMR-NIN limits: energy and added sugar (25 g on OFF) are over.
    expect(screen.getByLabelText(/^Energy, \d+ kcal, High$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein, 7.1 g')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Salt/)).toBeNull();
    expect(screen.getByLabelText('Sugars, 24.8 g, Added 25 g, High')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Save product'));
    expect(await screen.findByLabelText('Remove from saved')).toBeOnTheScreen();
    expect(await store.isSaved('8901719101038')).toBe(true);
    // Each system explains itself, under a fold: FSSAI values under INR, OFF's points under Nutri-Score.
    await fireEvent.press(screen.getByText('How the ratings were worked out'));
    expect(
      screen.getByText('Saturated fat 6.2 g per 100 g: 6 of 25 points against'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Sugars 24.8 g per 100 g: 7 of 15 points against/)).toBeOnTheScreen();
    expect(screen.getByText(/not medical or dietary advice/)).toBeOnTheScreen();
    expect(screen.getByText('Data © Open Food Facts contributors (ODbL)')).toBeOnTheScreen();
  });

  test('chip says "Not known" when the value for a limit is missing, not "No limit"', async () => {
    const parle = off['8901719101038'];
    const { 'added-sugars_100g': _added, ...nutriments } = parle.nutriments ?? {};
    jest
      .mocked(fetchProduct)
      .mockResolvedValue({ status: 'found', product: { ...parle, nutriments } });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);

    expect(
      await screen.findByLabelText('Sugars, 24.8 g, Added not known, limit not checked'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Saturated fat, 6.2 g, no official limit$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Energy, \d+ kcal, High$/)).toBeOnTheScreen();
    expect(screen.getByText(/Not known means the value needed/)).toBeOnTheScreen();
  });

  test('not enough data names the missing nutrients', async () => {
    const { nutriscore_grade, nutriscore_score, ...maggi } = off['8901058000290'];
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: maggi });
    await renderWithQuery(<ProductScreen barcode="8901058000290" />);

    expect(await screen.findByText('Not enough data to rate this')).toBeOnTheScreen();
    expect(
      screen.getByText(/energy, saturated fat, total sugars and sodium yet/),
    ).toBeOnTheScreen();
  });

  test('not found has its own wording', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'not_found' });
    await renderWithQuery(<ProductScreen barcode="8900000000001" />);
    expect(await screen.findByText('Product not found')).toBeOnTheScreen();
  });

  test('offline without a saved copy offers a retry', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'error', error: 'offline' });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);
    expect(await screen.findByText(/You’re offline/)).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });
});

describe('EntryScreen', () => {
  test('entering values makes an unrated product scorable and marks them as yours', async () => {
    const { nutriscore_grade, nutriscore_score, ...maggi } = off['8901058000290'];
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: maggi });
    await renderWithQuery(
      <>
        <ProductScreen barcode="8901058000290" />
        <EntryScreen barcode="8901058000290" />
      </>,
    );
    expect(await screen.findByText('Not enough data to rate this')).toBeOnTheScreen();

    const type = (label: string, value: string) =>
      fireEvent.changeText(screen.getByLabelText(label), value);
    await type('Energy (kcal)', '950');
    await fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('Can’t be more than 900 kcal per 100')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await type('Energy (kcal)', '427');
    await type('Total sugars (g)', '2.6');
    await type('Saturated fat (g)', '7.1');
    await fireEvent.press(screen.getByText('Salt (g)'));
    await type('Salt (g)', '3.2');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByLabelText(/India rating \(draft\): .* stars/)).toBeOnTheScreen();
    expect(screen.getByText('1280 mg (yours)')).toBeOnTheScreen();
    expect(mockBack).toHaveBeenCalled();
    expect((await store.getUserEntry('8901058000290'))?.nutrition).toMatchObject({
      energyKcal: 427,
      sodiumMg: 1280,
    });
  });
});

describe('ScanScreen', () => {
  test('typed barcode: rejects bad input, then opens the product and records the scan', async () => {
    await renderWithQuery(<ScanScreen />);
    expect(screen.getByText('Allow camera')).toBeOnTheScreen();

    const input = screen.getByPlaceholderText('e.g. 8901719101038');
    await fireEvent.changeText(input, '12345');
    await fireEvent.press(screen.getByText('Look up'));
    expect(screen.getByText(/Enter the 8, 12 or 13 digits/)).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '012345678905');
    await fireEvent.press(screen.getByText('Look up'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/product/[barcode]',
      params: { barcode: '0012345678905' },
    });
    await screen.findByText('Look up'); // let the history write settle
    expect((await store.listScans()).map((s) => s.barcode)).toEqual(['0012345678905']);
  });
});

describe('HistoryScreen', () => {
  test('lists recent scans with names and the overall band, and saved products', async () => {
    await store.putCached('8901719101038', off['8901719101038'], 1);
    await store.addScan('8901719101038', 1);
    await store.addScan('8900000000001', 2);
    await store.setSaved('8901719101038', true, 3);
    await renderWithQuery(<HistoryScreen />);

    expect(await screen.findByText('Parle - G')).toBeOnTheScreen();
    expect(screen.getByText('Parle')).toBeOnTheScreen();
    expect(screen.getByText('8900000000001')).toBeOnTheScreen();
    expect(screen.getByLabelText('Overall: Bad')).toBeOnTheScreen();
    expect(screen.getByText('Not found or not loaded')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Saved'));
    expect(await screen.findByText('Parle - G')).toBeOnTheScreen();
    expect(screen.queryByText('8900000000001')).toBeNull();
  });

  test('Clear all asks first, then empties the tab it is on and keeps the other', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const confirm = () => {
      const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    };
    await store.putCached('8901719101038', off['8901719101038'], 1);
    await store.addScan('8901719101038', 1);
    await store.setSaved('8901719101038', true, 2);
    await renderWithQuery(<HistoryScreen />);

    expect(
      await screen.findByText('Your scanned and checked products. They stay on this device.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Clear all history'));
    expect(alert.mock.calls[0][0]).toBe('Clear all history?');
    expect(await store.listScans()).toHaveLength(1); // nothing happens until confirmed

    confirm();
    expect(await screen.findByText('No scans yet')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Clear all history')).toBeNull(); // nothing left to clear
    expect(await store.listSaved()).toHaveLength(1);

    await fireEvent.press(screen.getByText('Saved'));
    expect(
      await screen.findByText('Products you bookmarked. They stay on this device.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Remove all saved'));
    confirm();
    expect(await screen.findByText('Nothing saved yet')).toBeOnTheScreen();
    alert.mockRestore();
  });
});
