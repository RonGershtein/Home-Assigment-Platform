// backend מקומי למצב הדגמה: אותו API כמו db.js, נשמר ב-localStorage
import { demoSeed } from "./demoSeed";

const DB_KEY = "homesync-demo-db:v1";
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = demoSeed();
  save(db);
  return db;
}

function save(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {}
}

let db = null;
const getDb = () => (db ??= load());

function commit(name) {
  save(db);
  listeners.forEach((fn) => fn(name));
}

export function onLocalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const now = () => new Date().toISOString();

export function localTable(name) {
  return {
    async list() {
      return [...(getDb()[name] ?? [])];
    },
    async create(values) {
      const rows = (Array.isArray(values) ? values : [values]).map((v) => ({
        id: crypto.randomUUID(),
        created_at: now(),
        updated_at: now(),
        ...v,
      }));
      getDb()[name] = [...rows, ...(getDb()[name] ?? [])];
      commit(name);
      return Array.isArray(values) ? rows : rows[0];
    },
    async update(id, patch) {
      let out = null;
      getDb()[name] = (getDb()[name] ?? []).map((r) => (r.id === id ? (out = { ...r, ...patch, updated_at: now() }) : r));
      commit(name);
      return out;
    },
    async remove(ids) {
      const set = new Set(Array.isArray(ids) ? ids : [ids]);
      getDb()[name] = (getDb()[name] ?? []).filter((r) => !set.has(r.id));
      // מחיקת חשבון מוחקת גם את היסטוריית היתרות שלו (כמו on delete cascade)
      if (name === "accounts") getDb().account_snapshots = (getDb().account_snapshots ?? []).filter((s) => !set.has(s.account_id));
      commit(name);
    },
    async upsert(values, key) {
      const arr = Array.isArray(values) ? values : [values];
      const rows = getDb()[name] ?? [];
      for (const v of arr) {
        const i = rows.findIndex((r) => r[key] === v[key]);
        if (i >= 0) rows[i] = { ...rows[i], ...v, updated_at: now() };
        else rows.unshift({ id: crypto.randomUUID(), created_at: now(), updated_at: now(), ...v });
      }
      getDb()[name] = rows;
      commit(name);
    },
  };
}

export function resetDemo() {
  db = demoSeed();
  save(db);
  listeners.forEach((fn) => fn("*"));
}
