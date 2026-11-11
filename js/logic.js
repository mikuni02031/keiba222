// オッズ生成・出走馬選定・着順抽選・払い戻し計算
import { LEGENDS, FRIENDS, FRIEND_CATCH, FORMS, COATS, RACE_NAMES, FINAL_RACE_NAMES } from './data.js';

export const RETURN_RATE = 0.9;     // 払戻率
export const EXOTIC_CAP = 999.9;    // 馬単・3連単の上限倍率

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const step = (a, b) => Math.round(rnd(a, b) * 10) / 10;
const floor1 = (x) => Math.floor(x * 10 + 1e-9) / 10;

function weighted(items, wf) {
  const tot = items.reduce((s, it) => s + wf(it), 0);
  let r = Math.random() * tot;
  for (const it of items) { r -= wf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

// ゲーム全体のレースタイプ順（かぶりにくく）
const TYPE_W = { solo: 3, duo: 3, trio: 2, normal: 2, mixed: 2, chaos: 1.2, dream: 1.2 };
export function pickRaceTypes(n) {
  const out = [];
  let bag = Object.keys(TYPE_W);
  while (out.length < n) {
    if (!bag.length) bag = Object.keys(TYPE_W).filter((t) => t !== out[out.length - 1]);
    const t = weighted(bag, (k) => TYPE_W[k]);
    bag = bag.filter((k) => k !== t);
    out.push(t);
  }
  return out;
}

export function pickEnvs(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let pool = ['day', 'day', 'sunset', 'night', 'rain'].filter((e) => e !== out[i - 1]);
    if (i === n - 1) pool = ['night', 'sunset'].filter((e) => e !== out[i - 1]);
    if (i === 0) pool = ['day', 'day', 'sunset', 'rain'];
    out.push(pick(pool));
  }
  return out;
}

// タイプごとの「役割」= 強さの範囲
const ROLES = {
  solo: [[96, 100], [72, 93], [72, 93], [72, 93], [72, 93], [72, 93], [72, 93]],
  duo: [[95, 100], [95, 100], [72, 92], [72, 92], [72, 92], [72, 92], [72, 92]],
  trio: [[94, 100], [94, 100], [94, 100], [72, 91], [72, 91], [72, 91], [72, 91]],
  normal: [[96, 100], [93, 96], [93, 96], [72, 92], [72, 92], [72, 92], [72, 92]],
  mixed: [[90, 96], [90, 96], [90, 96], [90, 96], [90, 96], [90, 96], [90, 96]],
  chaos: [[84, 91], [84, 91], [84, 91], [84, 91], [84, 91], [84, 91], [84, 91]],
  dream: [[97, 100], [97, 100], [97, 100], [97, 100], [97, 100], [97, 100], [97, 100]],
};

// 人気順の勝率テンプレート
function tailProbs(mass, n, r, cap) {
  // 減衰率 r の等比で mass を n 頭に配る。先頭が cap 未満、最小が 0.0095 以上になるよう調整
  let probs;
  for (let guard = 0; guard < 60; guard++) {
    let w = [];
    for (let i = 0; i < n; i++) w.push(Math.pow(r, i) * rnd(0.94, 1.06));
    w.sort((a, b) => b - a);
    const s = w.reduce((a, b) => a + b, 0);
    probs = w.map((x) => (x / s) * mass);
    // どちらの違反も「より平坦に」すれば解消する
    if ((probs[n - 1] < 0.0095 || probs[0] > cap * 0.96) && r < 0.995) { r = Math.min(0.995, r + 0.03); continue; }
    break;
  }
  return probs;
}

function genProbs(type) {
  const R = RETURN_RATE;
  let fixed = [];
  let r;
  if (type === 'solo') {
    const o1 = pick([1.2, 1.3, 1.3, 1.4, 1.4, 1.5, 1.5, 1.6, 1.6, 1.7, 1.7, 1.8, 1.8, 1.9]);
    fixed = [o1]; r = rnd(0.62, 0.85);
  } else if (type === 'duo') {
    const o1 = step(2.0, 2.5);
    const o2 = Math.min(2.9, Math.round((o1 + rnd(0.1, 0.5)) * 10) / 10);
    fixed = [o1, o2]; r = rnd(0.62, 0.82);
  } else if (type === 'trio') {
    const o1 = step(2.9, 3.4);
    const o2 = Math.round((o1 + rnd(0.1, 0.5)) * 10) / 10;
    const o3 = Math.round((o2 + rnd(0.1, 0.6)) * 10) / 10;
    fixed = [o1, o2, o3]; r = rnd(0.6, 0.8);
  } else if (type === 'normal') {
    fixed = [step(2.2, 3.2)]; r = rnd(0.72, 0.85);
  } else if (type === 'mixed') {
    fixed = [step(3.3, 4.2)]; r = rnd(0.8, 0.92);
  } else { // chaos / dream
    fixed = [step(4.4, 5.2)]; r = rnd(0.9, 0.97);
  }
  const fp = fixed.map((o) => R / o);
  const mass = 1 - fp.reduce((a, b) => a + b, 0);
  const tail = tailProbs(mass, 7 - fp.length, r, fp[fp.length - 1]);
  const probs = fp.concat(tail);
  const odds = probs.map((p, i) => (i < fixed.length ? fixed[i] : Math.max(1.1, floor1(R / p))));
  return { probs, odds };
}

function rollForm() { return weighted(FORMS, (f) => f.w); }

export function genRace(turn, totalTurns, type, env, usedIds) {
  const roles = ROLES[type].map((r) => ({ min: r[0], max: r[1] }));
  const used = new Set(usedIds || []);
  // 特別出走馬 1〜2頭
  const nFriends = Math.random() < 0.5 ? 1 : 2;
  const friendPool = shuffle(FRIENDS.filter((f) => !used.has(f.id)));
  const friends = (friendPool.length >= nFriends ? friendPool : shuffle(FRIENDS)).slice(0, nFriends);
  const slots = shuffle(roles.map((_, i) => i)).slice(0, nFriends);
  const entries = [];
  const taken = new Set();
  roles.forEach((role, i) => {
    const fi = slots.indexOf(i);
    if (fi >= 0) {
      const f = friends[fi];
      entries.push({
        id: f.id, name: f.name, friend: true,
        rating: rint(Math.max(role.min, 80), role.max),
        style: pick(['nige', 'senko', 'sashi', 'oikomi']),
        bigNige: Math.random() < 0.15,
        coat: pick(COATS), catch: pick(FRIEND_CATCH),
      });
      return;
    }
    let pool = LEGENDS.filter((h) => h.rating >= role.min && h.rating <= role.max && !taken.has(h.id));
    let fresh = pool.filter((h) => !used.has(h.id));
    if (fresh.length) pool = fresh;
    if (!pool.length) pool = LEGENDS.filter((h) => !taken.has(h.id));
    const h = pick(pool);
    taken.add(h.id);
    entries.push({ ...h });
  });
  // 調子と実力順
  entries.forEach((e) => {
    e.form = rollForm().key;
    const f = FORMS.find((x) => x.key === e.form);
    e.eff = e.rating + f.delta + rnd(-0.8, 0.8);
  });
  entries.sort((a, b) => b.eff - a.eff);
  const { probs, odds } = genProbs(type);
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7]);
  const horses = entries.map((e, i) => ({
    num: nums[i], id: e.id, name: e.name, friend: !!e.friend, style: e.style, bigNige: !!e.bigNige,
    coat: e.coat, catch: e.catch, form: e.form, p: probs[i], odds: odds[i], pop: i + 1,
  }));
  horses.sort((a, b) => a.num - b.num);
  const isFinal = turn === totalTurns - 1 && totalTurns > 1;
  const nm = isFinal ? pick(FINAL_RACE_NAMES) : RACE_NAMES[(turn * 5 + Math.floor(Math.random() * 97)) % RACE_NAMES.length];
  return {
    no: turn + 1, name: nm[0], dist: nm[1], type, env, isFinal,
    horses, seed: (Math.random() * 0x7fffffff) | 0, order: null,
  };
}

// 着順抽選（Plackett–Luce。オッズの理論値と一致する）
export function drawOrder(race) {
  let pool = race.horses.map((h) => ({ num: h.num, p: h.p }));
  const order = [];
  while (pool.length) {
    const h = weighted(pool, (x) => x.p);
    order.push(h.num);
    pool = pool.filter((x) => x !== h);
  }
  return order;
}

const horseOf = (race, num) => race.horses.find((h) => h.num === num);

export function betProb(race, type, sel) {
  const p = sel.map((n) => horseOf(race, n).p);
  if (type === 'win') return p[0];
  if (type === 'exacta') return p[0] * (p[1] / (1 - p[0]));
  return p[0] * (p[1] / (1 - p[0])) * (p[2] / (1 - p[0] - p[1]));
}

export function betOdds(race, type, sel) {
  if (type === 'win') return horseOf(race, sel[0]).odds;
  const o = floor1(RETURN_RATE / betProb(race, type, sel));
  return Math.min(EXOTIC_CAP, Math.max(1.1, o));
}

export const BET_TYPES = {
  win: { label: '単勝', n: 1, hint: '1着を当てる' },
  exacta: { label: '馬単', n: 2, hint: '1着→2着を順番どおりに当てる' },
  trifecta: { label: '3連単', n: 3, hint: '1着→2着→3着を順番どおりに当てる' },
};

export function isHit(bet, order) {
  const n = BET_TYPES[bet.type].n;
  for (let i = 0; i < n; i++) if (bet.sel[i] !== order[i]) return false;
  return true;
}

export function settle(race, betsByPlayer, players) {
  // 戻り値: [{idx, before, staked, payout, after, bets:[{...bet, hit, pay}]}]
  return players.map((pl, idx) => {
    const bets = (betsByPlayer[idx] || []).map((b) => {
      const hit = isHit(b, race.order);
      return { ...b, hit, pay: hit ? Math.floor(b.amount * b.odds) : 0 };
    });
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    const payout = bets.reduce((s, b) => s + b.pay, 0);
    return { idx, before: pl.coins, staked, payout, after: pl.coins - staked + payout, bets };
  });
}

export function fmtOdds(o) { return o.toFixed(1); }

// お酒計算: (トップ - ベベ) / 50 を切り捨て。3杯 = ウォッカ1
export const COINS_PER_DRINK = 50;
export const DRINKS_PER_VODKA = 3;
export function calcDrinks(players) {
  const max = Math.max(...players.map((p) => p.coins));
  const min = Math.min(...players.map((p) => p.coins));
  const diff = max - min;
  const drinks = Math.floor(diff / COINS_PER_DRINK);
  return {
    diff, drinks, vodka: Math.floor(drinks / DRINKS_PER_VODKA), rest: drinks % DRINKS_PER_VODKA,
    tops: players.filter((p) => p.coins === max).map((p) => p.name),
    bebes: diff > 0 ? players.filter((p) => p.coins === min).map((p) => p.name) : [],
  };
}
export function splitVodka(n) {
  return { vodka: Math.floor(n / DRINKS_PER_VODKA), rest: n % DRINKS_PER_VODKA };
}
