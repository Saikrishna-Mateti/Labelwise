import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage } from 'expo-text-extractor';
import { Alert, type AlertButton } from 'react-native';
import type { ReactElement } from 'react';

import { createStore, getStore, type Store } from '../../data/db';
import type { OffProduct } from '../../data/normalize';
import { fetchProduct, searchCategory } from '../../data/offClient';
import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { memoryDb } from '../../test-utils/memoryDb';
import { EntryScreen } from '../entry/EntryScreen';
import { HistoryScreen } from '../history/HistoryScreen';
import { ProductScreen } from '../product/ProductScreen';
import { ScanScreen } from '../scan/ScanScreen';

jest.mock('../../data/db', () => ({ ...jest.requireActual('../../data/db'), getStore: jest.fn() }));
jest.mock('../../data/offClient', () => ({ fetchProduct: jest.fn(), searchCategory: jest.fn() }));

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

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-text-extractor', () => ({ isSupported: true, extractTextFromImage: jest.fn() }));

const off = fixtures as Record<string, OffProduct>;
let store: Store;

beforeEach(async () => {
  store = createStore(memoryDb());
  await store.init();
  jest.mocked(getStore).mockResolvedValue(store);
  mockPush.mockClear();
  // Poor and Bad products load alternatives on their own; none unless a test says so.
  jest.mocked(searchCategory).mockResolvedValue({ status: 'ok', codes: [] });
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

const goodCandidate = (code: string, name: string): OffProduct => ({
  code,
  product_name: name,
  brands: 'Test',
  nutriscore_grade: 'b',
  nutriments: {
    'energy-kcal_100g': 380,
    fat_100g: 7,
    carbohydrates_100g: 66,
    proteins_100g: 13,
    sugars_100g: 1,
    'saturated-fat_100g': 1.2,
    sodium_100g: 0.006,
    fiber_100g: 10,
  },
});
const parleInBiscuits = {
  ...fixtures['8901719101038'],
  compared_to_category: 'en:biscuits',
} as OffProduct;

describe('ProductScreen', () => {
  test('scored product: score ring, chips, nutrition levels, ratings and footer', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: off['8901719101038'] });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);

    // Parle-G: Nutri-Score E (Bad, 0-24), India rating 2 stars, NOVA 4.
    expect(await screen.findByLabelText(/^Score 4 of 100, eat rarely\./)).toBeOnTheScreen();
    expect(screen.getByLabelText('High saturated fat')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ultra-processed')).toBeOnTheScreen();
    expect(
      screen.getByText('Combines Nutri-Score E, India rating 2★ (draft) and NOVA 4'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Energy, \d+ kcal, High$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Saturated fat, 6.2 g, High')).toBeOnTheScreen();
    expect(screen.getByLabelText('Added sugar, 25 g, High')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein, 7.1 g, Good')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Save product'));
    expect(await screen.findByLabelText('Remove from saved')).toBeOnTheScreen();
    expect(await store.isSaved('8901719101038')).toBe(true);

    // "How it's scored" opens All ratings: one line per rating, details on request.
    await fireEvent.press(screen.getByText('How it’s scored'));
    expect(screen.getByLabelText(/^Nutri-Score, grade E\./)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^India rating, 2 of 5 stars\./)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Processing, NOVA 4\. NOVA 4: ultra-processed/),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('Saturated fat 6.2 g per 100 g: 6 of 25 points against'),
    ).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Show details'));
    expect(
      screen.getByText('Saturated fat 6.2 g per 100 g: 6 of 25 points against'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/The score is Labelwise’s own/)).toBeOnTheScreen();
    expect(screen.getByText(/not medical or dietary advice/)).toBeOnTheScreen();
    expect(screen.getByText(/Data © Open Food Facts contributors \(ODbL\)/)).toBeOnTheScreen();
  });

  test('a missing value reads Unknown, never a level', async () => {
    const parle = off['8901719101038'];
    const { 'added-sugars_100g': _added, ...nutriments } = parle.nutriments ?? {};
    jest
      .mocked(fetchProduct)
      .mockResolvedValue({ status: 'found', product: { ...parle, nutriments } });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);
    expect(await screen.findByLabelText('Added sugar, Not listed, Unknown')).toBeOnTheScreen();
  });

  test('per serving view scales the amounts and drops the levels', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({
      status: 'found',
      product: { ...off['8901719101038'], serving_quantity: 56.4, serving_quantity_unit: 'g' },
    });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);

    await fireEvent.press(await screen.findByText('Per serving (56.4 g)'));
    // 24.8 g sugars per 100 g x 56.4 / 100 = 14 g.
    expect(screen.getByLabelText('Sugars, 14 g')).toBeOnTheScreen();
    expect(screen.getByText(/Levels always use per 100 g/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Per 100 g'));
    expect(screen.getByLabelText('Sugars, 24.8 g, High')).toBeOnTheScreen();
  });

  test('no serving size on file means no toggle', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: off['8901719101038'] });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);
    await screen.findByLabelText(/^Score/);
    expect(screen.queryByText(/^Per serving/)).not.toBeOnTheScreen();
  });

  test('better alternatives load on their own and open the chosen product', async () => {
    const better = goodCandidate('8900000000002', 'Plain oat biscuits');
    jest.mocked(fetchProduct).mockImplementation(async (code) => ({
      status: 'found',
      product: code === better.code ? better : parleInBiscuits,
    }));
    jest.mocked(searchCategory).mockResolvedValue({ status: 'ok', codes: [better.code!] });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);

    const card = await screen.findByLabelText(
      /^Plain oat biscuits, Test, score \d+ of 100, (great choice|fine in moderation)$/,
    );
    expect(jest.mocked(searchCategory).mock.calls[0].slice(0, 2)).toEqual([
      'en:biscuits',
      ['a', 'b'],
    ]);
    expect(screen.getByText('Biscuits sold in India that score higher.')).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/product/[barcode]',
      params: { barcode: '8900000000002' },
    });
  });

  test('with nothing good among biscuits, alternatives are other sweet snacks', async () => {
    const bar = goodCandidate('8900000000003', 'Nut bar');
    jest.mocked(fetchProduct).mockImplementation(async (code) => ({
      status: 'found',
      product: code === bar.code ? bar : parleInBiscuits,
    }));
    jest.mocked(searchCategory).mockImplementation(async (category) => ({
      status: 'ok',
      codes: category === 'en:sweet-snacks' ? [bar.code!] : [],
    }));
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);
    expect(
      await screen.findByText(
        'Nothing in biscuits scores Good or better, so these are other sweet snacks.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Nut bar, Test, score/)).toBeOnTheScreen();
  });

  test('ingredients list each additive with its EFSA-based concern', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: off['8902080104581'] });
    await renderWithQuery(<ProductScreen barcode="8902080104581" />);
    await fireEvent.press(await screen.findByLabelText('Ingredients, 3 additives'));
    expect(
      screen.getByLabelText(/^Phosphoric acid, INS 338 · .*, Higher concern,/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Some concern')).toBeOnTheScreen();
    expect(screen.getByText('Low concern')).toBeOnTheScreen();
  });

  test('not enough data names the missing nutrients', async () => {
    const { nutriscore_grade, nutriscore_score, ...maggi } = off['8901058000290'];
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: maggi });
    await renderWithQuery(<ProductScreen barcode="8901058000290" />);

    expect(await screen.findByText('Not enough data to score this')).toBeOnTheScreen();
    expect(
      screen.getByText(/energy, saturated fat, total sugars and sodium yet/),
    ).toBeOnTheScreen();
  });

  test('not found offers the label scan first', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'not_found' });
    await renderWithQuery(<ProductScreen barcode="8900000000001" />);
    expect(await screen.findByText('We couldn’t find this product')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Scan the label instead'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/entry/[barcode]',
      params: { barcode: '8900000000001', scan: 'camera' },
    });
    await fireEvent.press(screen.getByText('Type the values'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/entry/[barcode]',
      params: { barcode: '8900000000001' },
    });
    expect(screen.getByText('Add it to Open Food Facts')).toBeOnTheScreen();
  });

  test('offline without a saved copy offers a retry', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'error', error: 'offline' });
    await renderWithQuery(<ProductScreen barcode="8901719101038" />);
    expect(await screen.findByText('You’re offline')).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });
});

describe('EntryScreen', () => {
  test('scanning a label fills the form for checking and saves nothing yet', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'not_found' });
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///label.jpg' }],
    } as ImagePicker.ImagePickerResult);
    jest
      .mocked(extractTextFromImage)
      .mockResolvedValue(['Per 100 g', 'Energy 450 kcal', 'Protein 7.1 g', 'Sodium 320 mg']);
    await renderWithQuery(<EntryScreen barcode="8900000000001" />);

    await fireEvent.press(await screen.findByText('Scan label'));

    expect(await screen.findByText(/Filled 3 values from the photo/)).toBeOnTheScreen();
    expect(screen.getByDisplayValue('450')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('7.1')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('320')).toBeOnTheScreen();
    expect(await store.getUserEntry('8900000000001')).toBeNull();
  });

  test('a cancelled or unreadable photo leaves the form alone', async () => {
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'not_found' });
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as ImagePicker.ImagePickerResult);
    await renderWithQuery(<EntryScreen barcode="8900000000001" />);
    await fireEvent.press(await screen.findByText('Scan label'));
    expect(screen.queryByText(/Filled/)).not.toBeOnTheScreen();

    jest.mocked(ImagePicker.launchCameraAsync).mockRejectedValue(new Error('no camera'));
    await fireEvent.press(screen.getByText('Scan label'));
    expect(await screen.findByText(/Couldn’t read that photo/)).toBeOnTheScreen();
  });

  test('entering values makes an unrated product scorable and marks them as yours', async () => {
    const { nutriscore_grade, nutriscore_score, ...maggi } = off['8901058000290'];
    jest.mocked(fetchProduct).mockResolvedValue({ status: 'found', product: maggi });
    await renderWithQuery(
      <>
        <ProductScreen barcode="8901058000290" />
        <EntryScreen barcode="8901058000290" />
      </>,
    );
    expect(await screen.findByText('Not enough data to score this')).toBeOnTheScreen();

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

    // No Nutri-Score, so no 0-100 score, but the India rating now works from the user's values.
    expect(await screen.findByText('No score yet')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^All ratings, – · [\d.]+★ · NOVA 4$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Sodium, 1,280 mg, your value, High')).toBeOnTheScreen();
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
  test('lists recent scans with names and the score, and saved products', async () => {
    await store.putCached('8901719101038', off['8901719101038'], 1);
    await store.addScan('8901719101038', 1);
    await store.addScan('8900000000001', 2);
    await store.setSaved('8901719101038', true, 3);
    await renderWithQuery(<HistoryScreen />);

    expect(await screen.findByText('Parle - G')).toBeOnTheScreen();
    expect(screen.getByText('Parle')).toBeOnTheScreen();
    expect(screen.getByText('8900000000001')).toBeOnTheScreen();
    expect(screen.getByLabelText('Score 4 of 100, eat rarely')).toBeOnTheScreen();
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
    await fireEvent.press(await screen.findByLabelText('Clear all history'));
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
    await fireEvent.press(await screen.findByLabelText('Remove all saved'));
    confirm();
    expect(await screen.findByText('Nothing saved yet')).toBeOnTheScreen();
    alert.mockRestore();
  });
});
