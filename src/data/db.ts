// Local SQLite storage. OFF data (cache) and the user's own entries live in separate tables so
// ODbL data and user data never mix.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { NutritionPer100, ProductType } from '../scoring/types';
import type { OffProduct, Serving } from './normalize';

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
  /** Printed serving size, for the per-serving view. Ratings never use it. */
  serving?: Serving;
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
CREATE TABLE IF NOT EXISTS saved (
  barcode TEXT PRIMARY KEY NOT NULL,
  saved_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export function createStore(db: Db) {
  /** Rows of (id, barcode, scannedAt) joined with the cached OFF record and the user's entry. */
  async function withProducts(sql: string, ...params: (string | number)[]): Promise<Scan[]> {
    const rows = await db.getAllAsync<{
      id: number;
      barcode: string;
      scannedAt: number;
      offJson: string | null;
      userJson: string | null;
    }>(
      `SELECT r.id, r.barcode, r.scannedAt, p.json AS offJson, u.json AS userJson
       FROM (${sql}) r
       LEFT JOIN off_products p ON p.barcode = r.barcode
       LEFT JOIN user_entries u ON u.barcode = r.barcode
       ORDER BY r.scannedAt DESC, r.id DESC`,
      ...params,
    );
    return rows.map(({ offJson, userJson, ...r }) => ({
      ...r,
      off: offJson ? (JSON.parse(offJson) as OffProduct) : null,
      user: userJson ? (JSON.parse(userJson) as UserEntry) : null,
    }));
  }

  return {
    init: async () => {
      await db.execAsync(SCHEMA);
      // History keeps one row per product; this clears repeats saved by older versions.
      await db.execAsync(
        'DELETE FROM scans WHERE id NOT IN (SELECT MAX(id) FROM scans GROUP BY barcode)',
      );
    },

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

    /** One history row per product: scanning it again moves it to the top with the new time. */
    async addScan(barcode: string, scannedAt: number): Promise<void> {
      await db.runAsync('DELETE FROM scans WHERE barcode = ?', barcode);
      await db.runAsync(
        'INSERT INTO scans (barcode, scanned_at) VALUES (?, ?)',
        barcode,
        scannedAt,
      );
    },

    listScans(limit = 200): Promise<Scan[]> {
      return withProducts(
        `SELECT s.id, s.barcode, s.scanned_at AS scannedAt FROM scans s
         ORDER BY s.scanned_at DESC, s.id DESC LIMIT ?`,
        limit,
      );
    },

    /** Saved products, newest first; `id` is the row id and `scannedAt` the time it was saved. */
    listSaved(): Promise<Scan[]> {
      return withProducts(
        `SELECT s.rowid AS id, s.barcode, s.saved_at AS scannedAt FROM saved s
         ORDER BY s.saved_at DESC`,
      );
    },

    async isSaved(barcode: string): Promise<boolean> {
      return !!(await db.getFirstAsync('SELECT 1 FROM saved WHERE barcode = ?', barcode));
    },

    async setSaved(barcode: string, saved: boolean, at: number): Promise<void> {
      await (saved
        ? db.runAsync('INSERT OR IGNORE INTO saved (barcode, saved_at) VALUES (?, ?)', barcode, at)
        : db.runAsync('DELETE FROM saved WHERE barcode = ?', barcode));
    },

    /** Empties the history only; cached products and the user's own entries stay. */
    async clearScans(): Promise<void> {
      await db.runAsync('DELETE FROM scans');
    },

    async clearSaved(): Promise<void> {
      await db.runAsync('DELETE FROM saved');
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
