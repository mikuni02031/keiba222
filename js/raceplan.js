// レース展開の設計図（着順は事前に確定済み。ここでは「どう走ってその着順になるか」を作る）

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

export function marginLabel(d) {
  if (d < 0.12) return 'ハナ';
  if (d < 0.3) return 'アタマ';
  if (d < 0.6) return 'クビ';
  if (d < 1.5) return '1/2馬身';
  if (d < 2.1) return '3/4馬身';
  if (d < 3.0) return '1馬身';
  if (d < 4.2) return '1馬身半';
  if (d < 5.4) return '2馬身';
  if (d < 8.0) return '3馬身';
  if (d < 11) return '4馬身';
  if (d < 14) return '5馬身';
  return '大差';
}

// 非等間隔 Catmull-Rom (Hermite)
function makeSpline(ts, vs, mEnd) {
  const n = ts.length;
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    m[i] = ((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]) + (vs[i] - vs[i - 1]) / (ts[i] - ts[i - 1])) * 0.5;
  }
  m[0] = 0; m[n - 1] = mEnd;
  return function (t) {
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i];
    const u = (t - ts[i]) / h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

export function buildPlan(race, L) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const plan = tryBuild(race, L, attempt);
    const got = plan.horses.slice().sort((a, b) => a.finishT - b.finishT).map((h) => h.num);
    if (got.every((n, i) => n === race.order[i])) return plan;
  }
  throw new Error('race plan failed');
}

function tryBuild(race, L, attempt) {
  const rng = mulberry32((race.seed || 1) + attempt * 7919);
  const R = (a, b) => a + rng() * (b - a);
  const order = race.order;
  const byNum = {};
  race.horses.forEach((h) => { byNum[h.num] = h; });

  const vc = R(17.3, 18.1);
  const ta = 1.25;
  const Tw = L / vc + ta;
  const tDecel = Tw + 1.3;
  const sRef = (t) => {
    if (t <= 0) return 0;
    if (t <= tDecel) return vc * (t - ta * (1 - Math.exp(-t / ta)));
    const s1 = vc * (tDecel - ta * (1 - Math.exp(-tDecel / ta)));
    const dt = t - tDecel;
    return s1 + 6.5 * dt + (vc - 6.5) * 3.2 * (1 - Math.exp(-dt / 3.2));
  };

  // 着差
  const winner = byNum[order[0]];
  const gaps = [0];
  let r0 = rng();
  let m2;
  if (winner.odds < 2 && rng() < 0.4) m2 = R(4, 9);
  else if (r0 < 0.38) m2 = R(0.06, 0.5);
  else if (r0 < 0.75) m2 = R(0.5, 2.4);
  else if (r0 < 0.95) m2 = R(2.4, 6);
  else m2 = R(6, 10);
  gaps.push(m2);
  for (let i = 2; i < 7; i++) {
    const r = rng();
    const d = r < 0.3 ? R(0.15, 0.6) : r < 0.75 ? R(0.6, 2.5) : R(2.5, 6);
    gaps.push(gaps[i - 1] + d);
  }

  const styleMid = { nige: 7, senko: 2.5, sashi: -3, oikomi: -8 };
  const styleLate = { nige: 2.8, senko: 1.2, sashi: -1.6, oikomi: -3.2 };
  const safe = attempt >= 2;

  const horses = order.map((num, rank) => {
    const h = byNum[num];
    const dEnd = gaps[rank];
    let mid = styleMid[h.style] + R(-1.6, 1.6);
    if (h.style === 'nige' && h.bigNige) mid += R(5, 8);
    const late = safe ? 0 : styleLate[h.style] * R(0.7, 1.3);
    const startR = rng() < 0.08 ? R(-3.2, -2.2) : R(-1.0, 0.6);
    const p86 = -dEnd * 0.55 + late;
    const p66 = lerp(mid, p86, 0.45) + R(-0.8, 0.8);
    const ts = [0, 0.06, 0.22, 0.45, 0.66, 0.86, 1].map((x) => x * Tw);
    const vs = [0, startR, lerp(startR, mid, 0.8), mid + R(-1, 1), p66, p86, -dEnd];
    let mEnd = 0;
    if (attempt === 0) {
      mEnd = ((vs[6] - vs[5]) / (ts[6] - ts[5])) * 0.4;
      mEnd = Math.max(-1.2, Math.min(1.2, mEnd));
    }
    const spline = attempt >= 3 ? ((t) => -dEnd * Math.min(1, t / Tw)) : makeSpline(ts, vs, mEnd);
    const wA = R(0.2, 0.4), wW = R(0.5, 0.9), wP = R(0, 6.28);
    const gap = (t) => {
      let g;
      if (t <= Tw) g = spline(t);
      else g = -dEnd + mEnd * 0.8 * (1 - Math.exp(-(t - Tw) / 0.8));
      const tau = t / Tw;
      const env = ss(tau / 0.1) * (1 - ss((tau - 0.8) / 0.12));
      return g + wA * Math.sin(wW * t + wP) * env;
    };
    const sAt = (t) => Math.max(0, sRef(t) + gap(t) * ss(t / 1.2 + 0.2));
    const lw = R(0, 6.28), lf = R(0.25, 0.45);
    const wide = (h.style === 'oikomi' ? 0.9 : h.style === 'sashi' ? 0.4 : 0) * R(0.5, 1);
    const latAt = (t) => {
      const s = sAt(t);
      const gate = 2.2 + (num - 1) * 1.7;
      const run = 1.3 + (num - 1) * 1.25;
      const str = 1.6 + (num - 1) * (1.45 + wide * 0.1) + wide;
      let d = lerp(gate, run, ss((s - 12) / 120));
      d = lerp(d, str, ss((s - (L - 300)) / 110));
      return d + Math.sin(t * lf + lw) * 0.12 * ss(s / 40);
    };
    return { num, name: h.name, style: h.style, pop: h.pop, odds: h.odds, rank, dEnd, sAt, latAt, lateStart: startR < -2, finishT: 0 };
  });

  // ゴールタイム
  horses.forEach((h) => {
    let t = Tw * 0.9, prev = h.sAt(t);
    const dt = 1 / 240;
    for (let i = 0; i < 240 * 30; i++) {
      const t2 = t + dt, s2 = h.sAt(t2);
      if (s2 >= L) { h.finishT = t + (dt * (L - prev)) / Math.max(1e-6, s2 - prev); break; }
      t = t2; prev = s2;
    }
    if (!h.finishT) h.finishT = Tw + 30;
  });

  const ranksAt = (t) => horses
    .map((h) => ({ h, key: t >= h.finishT ? 1e6 - h.finishT : h.sAt(t) }))
    .sort((a, b) => b.key - a.key).map((x) => x.h);

  const margins = [];
  for (let i = 1; i < 7; i++) margins.push(marginLabel(gaps[i] - gaps[i - 1]));
  const plan = { L, Tw, vc, horses, sRef, ranksAt, margins, gaps, photo: gaps[1] < 0.3, lastFinish: Math.max(...horses.map((h) => h.finishT)) };
  plan.cues = buildCues(plan, race, rng);
  return plan;
}

function buildCues(plan, race, rng) {
  const { Tw, horses } = plan;
  const cues = [];
  const nm = (h) => h.name;
  const no = (h) => `${h.num}番${h.name}`;
  const add = (tau, text, pri = 1) => cues.push({ t: tau * Tw, text, pri });
  const at = (tau) => plan.ranksAt(tau * Tw);
  const pickR = (arr) => arr[Math.floor(rng() * arr.length)];

  const late = horses.find((h) => h.lateStart);
  cues.push({ t: 0.05, text: 'スタートしました！', pri: 3 });
  if (late) add(0.045, `おっと${nm(late)}、出遅れた！`, 2);
  else add(0.045, 'そろったスタート！', 1);

  let r = at(0.1);
  add(0.1, `ハナを切ったのは${no(r[0])}！`, 2);
  r = at(0.19);
  add(0.19, `先頭は${nm(r[0])}、2番手に${nm(r[1])}、その後ろ${nm(r[2])}。`, 1);
  const fav = horses.find((h) => h.pop === 1);
  r = at(0.29);
  const fr = r.indexOf(fav) + 1;
  if (fr === 1) add(0.29, `1番人気${nm(fav)}が堂々と先頭！`, 2);
  else if (fr <= 3) add(0.29, `1番人気${nm(fav)}は${fr}番手、絶好位！`, 2);
  else if (fr <= 5) add(0.29, `1番人気${nm(fav)}は中団${fr}番手。`, 2);
  else add(0.29, `1番人気${nm(fav)}は後方${fr}番手、じっくり構えた！`, 2);
  r = at(0.38);
  add(0.38, `最後方に${nm(r[6])}。さあ3コーナーへ！`, 1);
  const r45 = at(0.45);
  r = at(0.5);
  add(0.5, r[0] === r45[0] && r[0] === at(0.19)[0] ? `先頭は依然${nm(r[0])}！` : `先頭は${nm(r[0])}！${nm(r[1])}が続く！`, 1);
  const r60 = at(0.6);
  let mover = null, best = 0;
  r60.forEach((h, i) => { const gain = r45.indexOf(h) - i; if (gain > best) { best = gain; mover = h; } });
  if (mover) add(0.58, `${nm(mover)}が外から上がっていく！`, 2);
  else add(0.58, '馬群が一気に固まってきた！', 1);
  r = at(0.655);
  add(0.655, `さあ最後の直線！先頭は${nm(r[0])}！`, 3);

  let prev = r, lastText = '';
  for (const tau of [0.72, 0.775, 0.83, 0.88, 0.925, 0.965]) {
    const cur = at(tau);
    const t = tau * Tw;
    const gap = cur[0].sAt(t) - cur[1].sAt(t);
    let text, pri = 2;
    let flyer = null;
    cur.slice(0, 3).forEach((h, i) => { if (prev.indexOf(h) - i >= 2) flyer = h; });
    if (cur[0] !== prev[0]) { text = `${nm(cur[0])}がかわした！${nm(cur[0])}先頭！`; pri = 3; }
    else if (flyer) { text = `大外から${nm(flyer)}！${nm(flyer)}が飛んできた！`; pri = 3; }
    else if (gap < 1.0) text = pickR([`${nm(cur[1])}が並びかける！${nm(cur[0])}粘る！`, `${nm(cur[0])}と${nm(cur[1])}、叩き合い！`, `${nm(cur[1])}迫る！${nm(cur[1])}迫る！`]);
    else if (gap > 5) text = pickR([`${nm(cur[0])}が突き放す！これは強い！`, `${nm(cur[0])}独走！後ろは離れた！`]);
    else text = pickR([`${nm(cur[0])}先頭！${nm(cur[1])}が追う！`, `残りわずか！${nm(cur[0])}粘る！`, `${nm(cur[1])}が差を詰める！`]);
    if (text === lastText) text = `${nm(cur[0])}か！${nm(cur[1])}か！`;
    cues.push({ t, text, pri });
    lastText = text; prev = cur;
  }
  const fin = horses.slice().sort((a, b) => a.finishT - b.finishT);
  const g2 = plan.gaps[1];
  let ftxt;
  if (g2 < 0.3) ftxt = `${nm(fin[0])}と${nm(fin[1])}、並んでゴールイン！！これは際どい！`;
  else if (g2 > 5) ftxt = `${nm(fin[0])}圧勝！ゴールイン！！`;
  else ftxt = `${nm(fin[0])}、1着でゴールイン！！`;
  cues.push({ t: Tw + 0.02, text: ftxt, pri: 5 });
  cues.sort((a, b) => a.t - b.t);
  return cues;
}
