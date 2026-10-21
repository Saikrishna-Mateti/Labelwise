// Local SQLite storage. OFF data (cache) and the user's own entries live in separate tables so
// ODbL data and user data never mix.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { NutritionPer100, ProductType } from '../scoring/types';
import type { OffProduct } from './normalize';

/** The parts of expo-sqlite's database used here, so tests can pass another SQLite. */
export type Db = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

export interface CachedProduct {
  product: OffProduct;
  fetchedAt: number;
}

/** What the user typed in for a product (Milestone 4). Never sent anywhere. */
export interface UserEntry {
  nutrition: NutritionPer100;
  productType: ProductType;
  ingredientsText?: string;
  updatedAt: number;
}

export interface Scan {
  id: number;
  barcode: string;
  scannedAt: number;
  /** Product name from the OFF cache, if cached. */
  name: string | null;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS off_products (
  barcode TEXT PRIMARY KEY NOT NULL,
  json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_entries (
  barcode TEXT PRIMARY KEY NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT NOT NULL,
  scanned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scans_scanned_at ON scans (scanned_at);
`;

export function createStore(db: Db) {
  return {
    init: () => db.execAsync(SCHEMA),

    async getCached(barcode: string): Promise<CachedProduct | null> {
      const row = await db.getFirstAsync<{ json: string; fetched_at: number }>(
        'SELECT json, fetched_at FROM off_products WHERE barcode = ?',
        barcode,
      );
      return row
        ? { product: JSON.parse(row.json) as OffProduct, fetchedAt: row.fetched_at }
        : null;
    },

    async putCached(barcode: string, product: OffProduct, fetchedAt: number): Promise<void> {
      await db.runAsync(
        'INSERT OR REPLACE INTO off_products (barcode, json, fetched_at) VALUES (?, ?, ?)',
        barcode,
        JSON.stringify(product),
        fetchedAt,
      );
    },

    async getUserEntry(barcode: string): Promise<UserEntry | null> {
      const row = await db.getFirstAsync<{ json: string }>(
        'SELECT json FROM user_entries WHERE barcode = ?',
        barcode,
      );
      return row ? (JSON.parse(row.json) as UserEntry) : null;
    },

    async putUserEntry(barcode: string, entry: UserEntry): Promise<void> {
      await db.runAsync(
        'INSERT OR REPLACE INTO user_entries (barcode, json, updated_at) VALUES (?, ?, ?)',
        barcode,
        JSON.stringify(entry),
        entry.updatedAt,
      );
    },

    async addScan(barcode: string, scannedAt: number): Promise<void> {
      await db.runAsync(
        'INSERT INTO scans (barcode, scanned_at) VALUES (?, ?)',
        barcode,
        scannedAt,
      );
    },

    listScans(limit = 200): Promise<Scan[]> {
      return db.getAllAsync<Scan>(
        `SELECT s.id, s.barcode, s.scanned_at AS scannedAt,
                json_extract(p.json, '$.product_name') AS name
         FROM scans s LEFT JOIN off_products p ON p.barcode = s.barcode
         ORDER BY s.scanned_at DESC, s.id DESC LIMIT ?`,
        limit,
      );
    },

    async deleteScan(id: number): Promise<void> {
      await db.runAsync('DELETE FROM scans WHERE id = ?', id);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export async function openStore(): Promise<Store> {
  const { openDatabaseAsync } = await import('expo-sqlite');
  const store = createStore(await openDatabaseAsync('labelwise.db'));
  await store.init();
  return store;
}
