import { normalizeBarcode } from '../barcode';
import { fetchProduct, USER_AGENT } from '../offClient';

describe('normalizeBarcode', () => {
  test.each([
    ['8901719101038', '8901719101038'], // EAN-13
    ['89012345', '89012345'], // EAN-8
    ['012345678905', '0012345678905'], // UPC-A
    ['08901719101038', '8901719101038'], // GTIN-14 with leading 0
    [' 8901719-101038 ', '8901719101038'],
  ])('%s -> %s', (input, expected) => expect(normalizeBarcode(input)).toBe(expected));

  test.each(['', 'abc', '1234567', '12345678901', '18901719101038', '890171910103x'])(
    'rejects %j',
    (input) => expect(normalizeBarcode(input)).toBeNull(),
  );
});

const respond = (status: number, body: unknown = {}) =>
  jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('fetchProduct', () => {
  test('found: requests only the needed fields with the Labelwise User-Agent', async () => {
    const fetchMock = respond(200, { status: 1, product: { code: '8901719101038' } });
    expect(await fetchProduct('8901719101038', fetchMock)).toEqual({
      status: 'found',
      product: { code: '8901719101038' },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8901719101038\?fields=code,/,
    );
    expect(init.headers['User-Agent']).toBe(USER_AGENT);
    expect(init.method).toBeUndefined(); // GET only
  });

  test('status 0 and HTTP 404 are not found', async () => {
    expect(await fetchProduct('1', respond(200, { status: 0 }))).toEqual({ status: 'not_found' });
    expect(await fetchProduct('1', respond(404, { status: 0 }))).toEqual({ status: 'not_found' });
  });

  test('HTTP errors', async () => {
    expect(await fetchProduct('1', respond(429))).toEqual({
      status: 'error',
      error: 'rate_limited',
    });
    expect(await fetchProduct('1', respond(503))).toEqual({
      status: 'error',
      error: 'server_error',
    });
  });

  test('offline', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    expect(await fetchProduct('1', fetchMock)).toEqual({ status: 'error', error: 'offline' });
  });

  test('timeout aborts the request', async () => {
    const hang = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    expect(await fetchProduct('1', hang as unknown as typeof fetch, 5)).toEqual({
      status: 'error',
      error: 'timeout',
    });
  });
});
