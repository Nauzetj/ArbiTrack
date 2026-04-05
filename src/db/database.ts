import initSqlJs, { type Database, type SqlValue, type ParamsObject } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let db: Database | null = null;
let SQLModule: any = null;
const DB_LOCAL_STORAGE_KEY = 'arbitrack_db';

/**
 * Convert binary string to Uint8Array safely
 */
function binaryStringToUint8Array(binStr: string) {
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

export const initDB = async (): Promise<void> => {
  if (db) return; // Already initialized

  SQLModule = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  const SQL = SQLModule;

  const savedDbB64 = localStorage.getItem(DB_LOCAL_STORAGE_KEY);
  if (savedDbB64) {
    try {
      const binaryStr = atob(savedDbB64);
      const uInt8Array = binaryStringToUint8Array(binaryStr);
      db = new SQL.Database(uInt8Array);
      console.log('Database loaded from localStorage');
    } catch (e) {
      console.error('Error loading DB from storage, creating new...', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  createTables();
};

const createTables = () => {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      fullName TEXT,
      passwordHash TEXT,
      createdAt TEXT,
      role TEXT DEFAULT 'free',
      planExpiresAt TEXT
    );
  `);

  // Migration: add new columns if they don't exist yet
  try { db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'free'`); } catch(_) {}
  try { db.run(`ALTER TABLE users ADD COLUMN planExpiresAt TEXT`); } catch(_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      userId TEXT PRIMARY KEY,
      bcvAutoSync INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'dark',
      currency TEXT DEFAULT 'VES',
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE,
      tradeType TEXT,
      asset TEXT,
      fiat TEXT,
      totalPrice REAL,
      unitPrice REAL,
      amount REAL,
      commission REAL,
      commissionAsset TEXT,
      counterPartNickName TEXT,
      orderStatus TEXT,
      createTime_utc TEXT,
      createTime_local TEXT,
      cycleId TEXT,
      importedAt TEXT,
      userId TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY,
      cycleNumber INTEGER,
      openedAt TEXT,
      closedAt TEXT,
      status TEXT,
      usdt_vendido REAL,
      usdt_recomprado REAL,
      ves_recibido REAL,
      ves_pagado REAL,
      comision_total REAL,
      ganancia_usdt REAL,
      ganancia_ves REAL,
      tasa_venta_prom REAL,
      tasa_compra_prom REAL,
      diferencial_tasa REAL,
      roi_percent REAL,
      tasa_bcv_dia REAL,
      notas TEXT,
      userId TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bcv_rates (
      fecha TEXT PRIMARY KEY,
      tasa_bcv REAL,
      fuente TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      plan TEXT,
      createdAt TEXT,
      expiresAt TEXT,
      usedAt TEXT,
      usedBy TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id TEXT PRIMARY KEY,
      name TEXT,
      contact TEXT,
      plan TEXT,
      duration TEXT,
      imageData TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT,
      reviewedAt TEXT,
      reviewNote TEXT,
      generatedCode TEXT
    );
  `);
  
  saveToStorage();
};

export const saveToStorage = () => {
  if (!db) return;
  const binaryArray = db.export();
  
  // Safe btoa for larger arrays
  let binaryString = "";
  const CHUNK_SIZE = 0x8000; 
  for (let i = 0; i < binaryArray.length; i += CHUNK_SIZE) {
    binaryString += String.fromCharCode.apply(null, Array.from(binaryArray.slice(i, i + CHUNK_SIZE)));
  }
  
  localStorage.setItem(DB_LOCAL_STORAGE_KEY, btoa(binaryString));
};

export const runQuery = <T>(sql: string, params?: ParamsObject | SqlValue[]): T[] => {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(sql);
  if (params) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results as unknown as T[];
};

export const getDB = () => {
  if (!db) throw new Error("Database not initialized");
  return db;
};

export const execQuery = (sql: string, params: ParamsObject | any[] = []) => {
  if (!db) throw new Error("DB not initialized");
  if (params) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  saveToStorage();
};

export const exportUserDatabase = (userId: string) => {
  if (!db || !SQLModule) throw new Error("Database not initialized");
  
  // Clone the current database
  const currentDbData = db.export();
  const tempDb = new SQLModule.Database(currentDbData);

  // Remove other users' data
  tempDb.run(`DELETE FROM users WHERE id != ?`, [userId]);
  tempDb.run(`DELETE FROM config WHERE userId != ?`, [userId]);
  tempDb.run(`DELETE FROM orders WHERE userId != ?`, [userId]);
  tempDb.run(`DELETE FROM cycles WHERE userId != ?`, [userId]);

  // Export the scrubbed database
  const exportData = tempDb.export();
  tempDb.close(); // Clean up memory
  
  return exportData;
};
