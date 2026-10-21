/// <reference types="node" />
// Test-only: Node's built-in SQLite behind the expo-sqlite methods the store uses.

import { DatabaseSync } from 'node:sqlite';

import type { Db } from '../data/db';

export function memoryDb(): Db {
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
