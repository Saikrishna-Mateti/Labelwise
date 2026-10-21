/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import fixtures from '../../scoring/__tests__/fixtures/off-products.json';
import { inr } from '../../scoring/inr';
import { createStore, type Db, type Store } from '../db';
import type { OffProduct } from '../normalize';
import type { OffResult } from '../offClient';
import { CACHE_TTL_MS, resolveProduct, toScoringInput } from '../resolver';

const off = fixtures as Record<string, OffProduct>;
const PARLE_G = '8901719101038';

/** Node's built-in SQLite behind the expo-sqlite methods the store uses. */
function memoryDb(): Db {
  const db = new DatabaseSync(':memory:');
  const args = (p: unknown[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p) as never[];
  return {
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, ...p: unknown[]) => {
      const r = db.prepare(sql).run(...args(p));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async (sql: string, ...p: unknown[]) => db.prepare(sql).get(...args(p)) ?? null,
    getAllAsync: async (sql: string, ...p: unknown[]) => db.prepare(sql).all(...args(p)),
  } as unknown as Db;
}

let store: Store;
let clock: number;
const now = () => clock;

beforeEach(async () => {
  store = createStore(memoryDb());
  await store.init();
  clock = 1_000_000;
});

const offClient = (result: OffResult) => jest.fn().mockResolvedValue(result);

test('found: fetches, caches, tags values as OFF and scores', async () => {
  const fetchProduct = offClient({ status: 'found', product: off[PARLE_G] });
  const r = await resolveProduct(PARLE_G, { store, fetchProduct, now });

  expect(fetchProduct).toHaveBeenCalledWith(PARLE_G);
  if (r.status !== 'ok') throw new Error(r.status);
  expect(r.offError).toBeUndefined();
  expect(r.product.nutrition.sugarsG).toEqual({ value: expect.any(Number), source: 'off' });
  expect(r.product.productType).toEqual({ value: 'solid', source: 'off' });
  expect(inr.score(toScoringInput(r.product)).band).toBe('2 stars');
  expect((await store.getCached(PARLE_G))?.fetchedAt).toBe(clock);
});

test('fresh cache skips the network; stale cache refreshes', async () => {
  await store.putCached(PARLE_G, off[PARLE_G], clock);
  const fetchProduct = offClient({ status: 'found', product: off[PARLE_G] });

  clock += CACHE_TTL_MS - 1;
  expect((await resolveProduct(PARLE_G, { store, fetchProduct, now })).status).toBe('ok');
  expect(fetchProduct).not.toHaveBeenCalled();

  clock += 1;
  await resolveProduct(PARLE_G, { store, fetchProduct, now });
  expect(fetchProduct).toHaveBeenCalledTimes(1);
  expect((await store.getCached(PARLE_G))?.fetchedAt).toBe(clock);
});

test('not found', async () => {
  const fetchProduct = offClient({ status: 'not_found' });
  expect(await resolveProduct('8900000000001', { store, fetchProduct, now })).toEqual({
    status: 'not_found',
    barcode: '8900000000001',
  });
});

test('not found on OFF but entered by the user', async () => {
  await store.putUserEntry('8900000000001', {
    nutrition: { energyKcal: 500, sugarsG: 30, saturatedFatG: 10, sodiumMg: 400 },
    productType: 'solid',
    ingredientsText: 'Wheat flour, sugar, palm oil, emulsifier',
    updatedAt: clock,
  });
  const r = await resolveProduct('8900000000001', {
    store,
    fetchProduct: offClient({ status: 'not_found' }),
    now,
  });
  if (r.status !== 'ok') throw new Error(r.status);
  expect(r.product.off).toBeUndefined();
  expect(r.product.nutrition.energyKcal).toEqual({ value: 500, source: 'user' });
  expect(r.product.ingredientsText?.source).toBe('user');
  expect(inr.score(toScoringInput(r.product)).value).not.toBeNull();
});

test('partial OFF data: user fills the gaps, OFF values are kept', async () => {
  const { nutriments, ...rest } = off[PARLE_G];
  const partial = { ...rest, nutriments: { ...nutriments, sodium_100g: undefined } };
  await store.putUserEntry(PARLE_G, {
    nutrition: { sodiumMg: 300, sugarsG: 1 },
    productType: 'liquid',
    updatedAt: clock,
  });
  const r = await resolveProduct(PARLE_G, {
    store,
    fetchProduct: offClient({ status: 'found', product: partial }),
    now,
  });
  if (r.status !== 'ok') throw new Error(r.status);
  expect(r.product.nutrition.sodiumMg).toEqual({ value: 300, source: 'user' });
  expect(r.product.nutrition.sugarsG?.source).toBe('off');
  expect(r.product.productType).toEqual({ value: 'liquid', source: 'user' });
});

test('offline with a stale cache serves the cache and reports the error', async () => {
  await store.putCached(PARLE_G, off[PARLE_G], clock);
  clock += CACHE_TTL_MS * 2;
  const r = await resolveProduct(PARLE_G, {
    store,
    fetchProduct: offClient({ status: 'error', error: 'offline' }),
    now,
  });
  if (r.status !== 'ok') throw new Error(r.status);
  expect(r.offError).toBe('offline');
  expect(r.product.off?.product_name).toBe(off[PARLE_G].product_name);
  expect(r.product.offFetchedAt).toBe(1_000_000);
});

test('offline without cache or user data is unavailable', async () => {
  expect(
    await resolveProduct(PARLE_G, {
      store,
      fetchProduct: offClient({ status: 'error', error: 'timeout' }),
      now,
    }),
  ).toEqual({ status: 'unavailable', barcode: PARLE_G, error: 'timeout' });
});

test('normalizes the barcode and rejects malformed input without a request', async () => {
  const fetchProduct = offClient({ status: 'not_found' });
  await resolveProduct('012345678905', { store, fetchProduct, now });
  expect(fetchProduct).toHaveBeenCalledWith('0012345678905');
  expect(await resolveProduct('hello', { store, fetchProduct, now })).toEqual({
    status: 'invalid_barcode',
  });
  expect(fetchProduct).toHaveBeenCalledTimes(1);
});

test('scan history: newest first, with cached names, deletable', async () => {
  await store.putCached(PARLE_G, off[PARLE_G], clock);
  await store.addScan(PARLE_G, 1);
  await store.addScan('8900000000001', 2);
  const scans = await store.listScans();
  expect(scans.map((s) => [s.barcode, s.name])).toEqual([
    ['8900000000001', null],
    [PARLE_G, off[PARLE_G].product_name],
  ]);
  await store.deleteScan(scans[0].id);
  expect((await store.listScans()).map((s) => s.barcode)).toEqual([PARLE_G]);
});
