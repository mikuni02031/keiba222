// お酒帳簿の永続化。
// localStorage / IndexedDB / Cache Storage / Cookie の4か所に同じ内容を書き、
// 読み込み時は一番新しいものを採用して残りを修復する（どれか1つでも残っていれば復元できる）。
const KEY = 'keibaParty.ledger.v1';
const DB_NAME = 'keibaParty', STORE = 'kv';
const CACHE_NAME = 'keibaParty-ledger', CACHE_URL = './__ledger.json';
const COOKIE = 'kp_ledger';

const empty = () => ({ rev: 0, updatedAt: 0, people: {}, history: [] });

function valid(d) { return d && typeof d === 'object' && typeof d.rev === 'number' && d.people && typeof d.people === 'object'; }
function norm(d) {
  const out = empty();
  out.rev = d.rev | 0; out.updatedAt = +d.updatedAt || 0;
  Object.keys(d.people).forEach((k) => {
    const p = d.people[k] || {};
    out.people[k] = { owed: Math.max(0, p.owed | 0), drunk: Math.max(0, p.drunk | 0) };
  });
  out.history = Array.isArray(d.history) ? d.history.slice(-60) : [];
  return out;
}

// ── 各ストレージ ──
function lsGet() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
function lsSet(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

function idb() {
  return new Promise((res, rej) => {
    try {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  });
}
async function idbGet() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function idbSet(d) {
  try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put(d, KEY); } catch (e) { /* ignore */ }
}
async function cacheGet() {
  try { if (!('caches' in window)) return null; const c = await caches.open(CACHE_NAME); const r = await c.match(CACHE_URL); return r ? await r.json() : null; } catch (e) { return null; }
}
async function cacheSet(d) {
  try { if (!('caches' in window)) return; const c = await caches.open(CACHE_NAME); await c.put(CACHE_URL, new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } })); } catch (e) { /* ignore */ }
}
function cookieGet() {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    const c = JSON.parse(decodeURIComponent(m[1]));
    const d = empty(); d.rev = c.r | 0; d.updatedAt = +c.t || 0;
    Object.keys(c.p || {}).forEach((k) => { d.people[k] = { owed: c.p[k][0] | 0, drunk: c.p[k][1] | 0 }; });
    return d;
  } catch (e) { return null; }
}
function cookieSet(d) {
  try {
    const c = { r: d.rev, t: d.updatedAt, p: {} };
    Object.keys(d.people).forEach((k) => { c.p[k] = [d.people[k].owed, d.people[k].drunk]; });
    const v = encodeURIComponent(JSON.stringify(c));
    if (v.length > 3800) return;
    document.cookie = `${COOKIE}=${v}; max-age=${60 * 60 * 24 * 365 * 10}; path=/; SameSite=Lax`;
  } catch (e) { /* ignore */ }
}

let ledger = empty();

export async function loadLedger() {
  const cands = [lsGet(), cookieGet(), await idbGet(), await cacheGet()].filter(valid).map(norm);
  let best = empty();
  cands.forEach((c) => { if (c.rev > best.rev || (c.rev === best.rev && c.history.length > best.history.length)) best = c; });
  ledger = best;
  if (best.rev > 0) writeAll();                    // 消えた保存先を修復
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  return ledger;
}
function writeAll() { lsSet(ledger); cookieSet(ledger); idbSet(ledger); cacheSet(ledger); }
function commit() { ledger.rev += 1; ledger.updatedAt = Date.now(); ledger.history = ledger.history.slice(-60); writeAll(); }

export const getLedger = () => ledger;
const person = (name) => (ledger.people[name] = ledger.people[name] || { owed: 0, drunk: 0 });

export function addDrinks(name, n, note) {
  if (n <= 0) return;
  person(name).owed += n;
  ledger.history.push({ t: Date.now(), name, d: n, note: note || '' });
  commit();
}
export function drink(name, n) {
  const p = person(name);
  n = Math.min(n, p.owed);
  if (n <= 0) return 0;
  p.owed -= n; p.drunk += n;
  ledger.history.push({ t: Date.now(), name, d: -n, note: '飲んだ！' });
  commit();
  return n;
}
export function removePerson(name) { delete ledger.people[name]; commit(); }

// バックアップコード（別の端末への引っ越し・全消去への備え）
export function exportCode() {
  const json = JSON.stringify({ r: ledger.rev, t: ledger.updatedAt, p: ledger.people, h: ledger.history.slice(-20) });
  return 'KP1.' + btoa(unescape(encodeURIComponent(json)));
}
export function importCode(code) {
  try {
    const m = String(code).trim().match(/^KP1\.([A-Za-z0-9+/=]+)$/);
    if (!m) return false;
    const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    const d = norm({ rev: Math.max(o.r | 0, ledger.rev) + 1, updatedAt: Date.now(), people: o.p || {}, history: o.h || [] });
    ledger = d; writeAll();
    return true;
  } catch (e) { return false; }
}

// 設定・進行中ゲームの保存（こちらは localStorage のみ）
export function saveJSON(key, v) { try { localStorage.setItem('keibaParty.' + key, JSON.stringify(v)); } catch (e) { /* ignore */ } }
export function loadJSON(key) { try { return JSON.parse(localStorage.getItem('keibaParty.' + key)); } catch (e) { return null; } }
export function delKey(key) { try { localStorage.removeItem('keibaParty.' + key); } catch (e) { /* ignore */ } }
