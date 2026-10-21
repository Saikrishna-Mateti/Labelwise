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
  /** Cached OFF record and the user's entry, so a history row can show its score. */
  off: OffProduct | null;
  user: UserEntry | null;
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
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
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

    async listScans(limit = 200): Promise<Scan[]> {
      const rows = await db.getAllAsync<{
        id: number;
        barcode: string;
        scannedAt: number;
        offJson: string | null;
        userJson: string | null;
      }>(
        `SELECT s.id, s.barcode, s.scanned_at AS scannedAt, p.json AS offJson, u.json AS userJson
         FROM scans s
         LEFT JOIN off_products p ON p.barcode = s.barcode
         LEFT JOIN user_entries u ON u.barcode = s.barcode
         ORDER BY s.scanned_at DESC, s.id DESC LIMIT ?`,
        limit,
      );
      return rows.map(({ offJson, userJson, ...r }) => ({
        ...r,
        off: offJson ? (JSON.parse(offJson) as OffProduct) : null,
        user: userJson ? (JSON.parse(userJson) as UserEntry) : null,
      }));
    },

    async deleteScan(id: number): Promise<void> {
      await db.runAsync('DELETE FROM scans WHERE id = ?', id);
    },

    async getSetting(key: string): Promise<string | null> {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        key,
      );
      return row?.value ?? null;
    },

    async setSetting(key: string, value: string): Promise<void> {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

async function openStore(): Promise<Store> {
  const { openDatabaseAsync } = await import('expo-sqlite');
  const store = createStore(await openDatabaseAsync('labelwise.db'));
  await store.init();
  return store;
}

let opened: Promise<Store> | undefined;

/** The app's one database, opened on first use. */
export function getStore(): Promise<Store> {
  opened ??= openStore();
  return opened;
}
