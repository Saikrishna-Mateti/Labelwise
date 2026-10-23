import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { createStore, getStore, type Store } from '../../data/db';
import type { OffProduct } from '../../data/normalize';
import { fetchProduct } from '../../data/offClient';
import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { memoryDb } from '../../test-utils/memoryDb';
import { EntryScreen } from '../entry/EntryScreen';
import { ProductScreen } from '../product/ProductScreen';
import { ScanScreen } from '../scan/ScanScreen';

jest.mock('../../data/db', () => ({ ...jest.requireActual('../../data/db'), getStore: jest.fn() }));
jest.mock('../../data/offClient', () => ({ fetchProduct: jest.fn() }));

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
      await screen.findByText('Most points lost to saturated fat and energy · Ultra-processed'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/India rating \(draft\): 2 of 5 stars, estimated, main score/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nutri-Score: E')).toBeOnTheScreen();
    expect(screen.getByLabelText('Processing: NOVA 4')).toBeOnTheScreen();
    // Overall band from Nutri-Score E, and Nutri-Score's own points per nutrient.
    expect(screen.getByLabelText('Overall: Bad, from Nutri-Score E')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Sugars, 24.8 g per 100 g: 7 of 15 points against'),
    ).toBeOnTheScreen();
    // Each system explains itself, under a fold: FSSAI values under INR, OFF's points under Nutri-Score.
    await fireEvent.press(screen.getByText('How the ratings were worked out'));
    expect(
      screen.getByText('Saturated fat 6.2 g per 100 g: 6 of 25 points against'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Sugars 24.8 g per 100 g: 7 of 15 points against/)).toBeOnTheScreen();
    expect(screen.getByText(/not medical or dietary advice/)).toBeOnTheScreen();
    expect(screen.getByText('Data © Open Food Facts contributors (ODbL)')).toBeOnTheScreen();
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
