// ゲーム進行とUI
import { FRAMES, STYLES, FORMS, RACE_TYPES, ENVS, PLAYER_COLORS, COAT_LABEL, KIND_LABEL } from './data.js';
import * as LG from './logic.js';
import * as ST from './storage.js';
import * as AU from './audio.js';

const app = document.getElementById('app');
const raceEl = document.getElementById('race');
const modalEl = document.getElementById('modal');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('ja-JP');
const BT = LG.BET_TYPES;

let G = null;                 // 進行中のゲーム
let S = null;                 // 設定の下書き
let B = null;                 // ベット画面の状態
let D = null;                 // 飲んだよモーダルの状態
let racePromise = null;

// ───────── 共通部品 ─────────
const nb = (n, cls = '') => { const f = FRAMES[n - 1]; return `<i class="nb ${cls}" style="background:${f.bg};color:${f.fg}">${n}</i>`; };
const selBadges = (sel) => sel.map((n) => nb(n)).join('<span class="arrow">▶</span>');
const horse = (num) => G.race.horses.find((h) => h.num === num);
const betText = (b) => `<span class="bt bt-${b.type}">${BT[b.type].label}</span>${selBadges(b.sel)}`;

function render(html, keepScroll) {
  const y = keepScroll ? window.scrollY : 0;
  app.innerHTML = html;
  window.scrollTo(0, y);
}
function modal(html) { modalEl.innerHTML = `<div class="modal-box">${html}</div>`; modalEl.classList.add('show'); }
function closeModal() { modalEl.classList.remove('show'); modalEl.innerHTML = ''; }
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1900);
}
function save() { if (G && !G.demo) ST.saveJSON('game', G); }
function countUp() {
  document.querySelectorAll('[data-from]').forEach((el) => {
    const a = +el.dataset.from, b = +el.dataset.to, t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(a + (b - a) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && G) keepAwake(); });

// ───────── タイトル ─────────
function viewTitle() {
  const saved = ST.loadJSON('game');
  const led = ST.getLedger();
  const owed = Object.values(led.people).reduce((s, p) => s + p.owed, 0);
  render(`
  <div class="scr title">
    <div class="logo">
      <div class="logo-sub">スマホ1台でみんなで遊べる</div>
      <h1><span>競馬</span>パーティー</h1>
      <div class="logo-run"><span>🏇</span><span>🏇</span><span>🏇</span></div>
      <div class="logo-tag">単勝・馬単・3連単で一攫千金！<br>ベベはお酒だ！🍺</div>
    </div>
    <div class="stack">
      <button class="btn btn-gold big" data-act="toSetup">ゲームをはじめる</button>
      ${saved && saved.phase && saved.phase !== 'final' ?`<button class="btn btn-green" data-act="resume">つづきから（第${saved.turn + 1}レース）</button>` : ''}
      <button class="btn" data-act="toLedger">🍶 お酒帳簿${owed ? `<span class="pill">未消化 ${owed}杯</span>` : ''}</button>
      <button class="btn btn-ghost" data-act="howto">あそびかた</button>
    </div>
    <div class="foot">お酒は20歳になってから。無理せず楽しく！</div>
  </div>`);
}

function howto() {
  modal(`
    <h2>あそびかた</h2>
    <ol class="howto">
      <li>人数・初期コイン・レース数を決める</li>
      <li>出馬表を見て、スマホを回しながら1人ずつベット<br><small>単勝＝1着 / 馬単＝1→2着 / 3連単＝1→2→3着（順番どおり）</small></li>
      <li>全員ベットしたら3Dレース！</li>
      <li>的中したら「賭け金 × オッズ」が払い戻し</li>
      <li>全レース終了後、<b>(トップ − ベベ) ÷ ${LG.COINS_PER_DRINK}</b> 杯をベベが飲む<br><small>${LG.DRINKS_PER_VODKA}杯でウォッカ1カウント。飲めない分は「お酒帳簿」にたまります</small></li>
    </ol>
    <button class="btn btn-gold" data-act="closeModal">OK</button>`);
}

// ───────── 設定 ─────────
function loadSettings() {
  const d = ST.loadJSON('settings') || {};
  S = {
    count: Math.min(8, Math.max(2, d.count | 0 || 4)),
    names: Array.from({ length: 8 }, (_, i) => (d.names && d.names[i]) || ''),
    coins: d.coins || 500, coinsCustom: !!d.coinsCustom,
    turns: d.turns || 3, turnsCustom: !!d.turnsCustom,
  };
}
const COIN_PRESETS = [100, 300, 500, 1000];
const TURN_PRESETS = [2, 3, 4, 5];
function viewSetup() {
  const chips = (arr, cur, custom, act, unit) => arr.map((v) => `<button class="chip ${!custom && cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${fmt(v)}${unit}</button>`).join('') +
    `<button class="chip ${custom ? 'on' : ''}" data-act="${act}" data-v="custom">自由入力</button>`;
  render(`
  <div class="scr setup">
    <header class="bar"><button class="back" data-act="toTitle">‹</button><h2>ゲーム設定</h2></header>
    <section class="card">
      <h3>👥 人数</h3>
      <div class="chips cnt">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<button class="chip sq ${S.count === n ? 'on' : ''}" data-act="setCount" data-v="${n}">${n}</button>`).join('')}</div>
      <div class="names">
        ${Array.from({ length: S.count }, (_, i) => `<label><span class="dot" style="background:${PLAYER_COLORS[i]}">${i + 1}</span><input type="text" maxlength="8" data-name="${i}" value="${esc(S.names[i])}" placeholder="プレイヤー${i + 1}" autocomplete="off"></label>`).join('')}
      </div>
    </section>
    <section class="card">
      <h3>🪙 初期コイン</h3>
      <div class="chips">${chips(COIN_PRESETS, S.coins, S.coinsCustom, 'setCoins', '')}</div>
      ${S.coinsCustom ? `<div class="free"><input type="number" inputmode="numeric" pattern="[0-9]*" id="coinsIn" min="10" max="100000" value="${S.coins}" placeholder="100〜1000"><span>コイン</span></div>` : ''}
    </section>
    <section class="card">
      <h3>🏁 レース数（ターン）</h3>
      <div class="chips">${chips(TURN_PRESETS, S.turns, S.turnsCustom, 'setTurns', '回')}</div>
      ${S.turnsCustom ? `<div class="free"><input type="number" inputmode="numeric" pattern="[0-9]*" id="turnsIn" min="1" max="20" value="${S.turns}" placeholder="2〜5"><span>レース</span></div>` : ''}
    </section>
    <button class="btn btn-gold big" data-act="startGame">この設定でスタート！</button>
  </div>`, true);
}
function readSetupInputs() {
  app.querySelectorAll('[data-name]').forEach((el) => { S.names[+el.dataset.name] = el.value.trim().slice(0, 8); });
  const c = document.getElementById('coinsIn'); if (c) S.coins = parseInt(c.value, 10) || 0;
  const t = document.getElementById('turnsIn'); if (t) S.turns = parseInt(t.value, 10) || 0;
}

function startGame() {
  readSetupInputs();
  if (!(S.coins >= 10 && S.coins <= 100000)) { AU.sfx.error(); return toast('初期コインは10〜100,000で入力してね'); }
  if (!(S.turns >= 1 && S.turns <= 20)) { AU.sfx.error(); return toast('レース数は1〜20で入力してね'); }
  const seen = {};
  const names = Array.from({ length: S.count }, (_, i) => {
    let n = S.names[i] || `プレイヤー${i + 1}`;
    while (seen[n]) n = n.slice(0, 7) + (i + 1);
    seen[n] = 1; return n;
  });
  ST.saveJSON('settings', S);
  G = {
    v: 1, init: S.coins, turns: S.turns,
    players: names.map((name, i) => ({ name, coins: S.coins, color: PLAYER_COLORS[i] })),
    turn: 0, types: LG.pickRaceTypes(S.turns), envs: LG.pickEnvs(S.turns), used: [],
    phase: 'card', race: null, bets: {}, betPos: 0, results: null, relief: [], recorded: false, log: [],
  };
  newRace();
  keepAwake();
  import('./race3d.js').catch(() => {});      // 先読み
  go();
}

function newRace() {
  G.race = LG.genRace(G.turn, G.turns, G.types[G.turn], G.envs[G.turn], G.used);
  G.used = G.used.concat(G.race.horses.map((h) => h.id)).slice(-70);
  G.bets = {}; G.betPos = 0; G.results = null; G.phase = 'card';
  G.order = G.players.map((_, i) => (i + G.turn) % G.players.length);
  // 救済金
  G.relief = [];
  const relief = Math.max(10, Math.round(G.init * 0.1));
  G.players.forEach((p) => { if (p.coins <= 0) { p.coins = relief; G.relief.push(p.name); } });
  G.reliefAmt = relief;
}

function go() {
  save();
  raceEl.classList.remove('show');
  const v = { card: viewCard, handoff: viewHandoff, bet: viewBet, lineup: viewLineup, race: viewRaceGate, payout: viewPayout, final: viewFinal }[G.phase];
  (v || viewTitle)();
}

// ───────── 出馬表 ─────────
function raceHead() {
  const r = G.race, t = RACE_TYPES[r.type], e = ENVS[r.env];
  return `<div class="rhead ${r.isFinal ? 'final' : ''}">
    <div class="rno">第${r.no}レース<small> / 全${G.turns}R</small>${r.isFinal ? '<span class="fin">最終！</span>' : ''}</div>
    <div class="rname">${esc(r.name)}</div>
    <div class="rmeta"><span>${esc(r.dist)}</span><span>${e.icon} ${e.label}</span><span>馬場：${e.going}</span><span class="rtype" style="background:${t.color}">${t.label}</span></div>
  </div>`;
}
function hrow(h, o = {}) {
  const f = FRAMES[h.num - 1];
  const form = FORMS.find((x) => x.key === h.form);
  const tag = o.pick ? 'button' : 'div';
  const si = o.sel ? o.sel.indexOf(h.num) : -1;
  return `<${tag} class="hrow ${si >= 0 ? 'sel' : ''} ${h.friend ? 'friend' : ''}" ${o.pick ? `data-act="pick" data-num="${h.num}"` : ''}>
    <i class="nb big" style="background:${f.bg};color:${f.fg}">${h.num}</i>
    <span class="h-main"><b>${esc(h.name)}${kindIcon(h)}</b>
      <small><span class="st st-${h.style}">${STYLES[h.style].label}</span><span class="fm fm-${h.form}">${form.label}${form.icon}</span>${o.full ? `<span>${COAT_LABEL[h.coat]}</span>${h.kind && h.kind !== 'legend' ? `<span class="kd kd-${h.kind}">${KIND_LABEL[h.kind]}</span>` : ''}` : ''}</small>
      ${o.full ? `<small class="catch">「${esc(h.catch)}」</small>` : ''}
    </span>
    <span class="h-pop p${h.pop}">${h.pop}<small>人気</small></span>
    <span class="h-odds"><b>${h.odds.toFixed(1)}</b><small>勝率 ${(h.p * 100).toFixed(1)}%</small></span>
    ${si >= 0 ? `<span class="mark m${si + 1}">${o.n > 1 ? si + 1 + '着' : '◎'}</span>` : ''}
  </${tag}>`;
}
function kindIcon(h) {
  const k = h.kind || (h.friend ? 'friend' : '');
  return k === 'friend' ? '<em>★</em>' : k === 'player' ? '<em class="ki">⚾</em>' : k === 'team' ? '<em class="ki">🏟</em>' : '';
}
function standings() {
  const ps = G.players.slice().sort((a, b) => b.coins - a.coins);
  return `<div class="stand">${ps.map((p, i) => `<span class="sp"><span class="dot" style="background:${p.color}">${i + 1}</span>${esc(p.name)}<b>${fmt(p.coins)}</b></span>`).join('')}</div>`;
}
function viewCard() {
  const r = G.race, t = RACE_TYPES[r.type];
  const first = G.players[G.order[0]];
  render(`
  <div class="scr cardscr">
    ${raceHead()}
    <div class="rdesc">${t.desc}。単勝オッズと勝率をチェック！</div>
    ${G.relief.length ? `<div class="notice">🆘 ${G.relief.map(esc).join('・')} に救済金 ${fmt(G.reliefAmt)} コイン！</div>` : ''}
    <div class="hlist">${r.horses.map((h) => hrow(h, { full: true })).join('')}</div>
    <h3 class="sub">現在のコイン</h3>
    ${standings()}
    <div class="sticky"><button class="btn btn-gold big" data-act="beginBets">ベット開始！<small>まずは ${esc(first.name)} から</small></button></div>
  </div>`);
}

// ───────── 受け渡し ─────────
function viewHandoff() {
  const p = G.players[G.order[G.betPos]];
  render(`
  <div class="scr handoff">
    <div class="ho-step">${G.betPos + 1} / ${G.players.length} 人目</div>
    <div class="ho-phone">📱</div>
    <div class="ho-name"><span class="dot big" style="background:${p.color}">${esc(p.name.slice(0, 1))}</span><b>${esc(p.name)}</b><span>の番！</span></div>
    <p class="ho-msg">スマホを <b>${esc(p.name)}</b> に渡してね</p>
    <div class="ho-coins">所持コイン <b>${fmt(p.coins)}</b></div>
    <button class="btn btn-gold big" data-act="openBet">${esc(p.name)} です！ベットする</button>
  </div>`);
}

// ───────── ベット ─────────
function betRemain() { return G.players[G.order[G.betPos]].coins - B.slip.reduce((s, b) => s + b.amount, 0); }
function viewBet(keep) {
  const idx = G.order[G.betPos], p = G.players[idx], r = G.race;
  if (!B) B = { tab: 'win', sel: [], amount: 0, slip: [], mode: 'single', form: { 1: [], 2: [], 3: [] }, mamt: {} };
  const n = BT[B.tab].n, remain = betRemain();
  const multi = n > 1 && B.mode === 'multi';
  const ready = B.sel.length === n;
  const odds = ready ? LG.betOdds(r, B.tab, B.sel) : 0;
  const prob = ready ? LG.betProb(r, B.tab, B.sel) : 0;
  const total = B.slip.reduce((s, b) => s + b.amount, 0);
  const guide = n === 1 ? '1着になる馬をタップ' : n === 2 ? '1着 ▶ 2着 の順にタップ' : '1着 ▶ 2着 ▶ 3着 の順にタップ';
  render(`
  <div class="scr bet">
    <header class="bethead">
      <div class="bh-l"><small>第${r.no}R ${esc(r.name)}</small><b><span class="dot" style="background:${p.color}"></span>${esc(p.name)} のベット</b></div>
      <div class="bh-r"><small>残りコイン</small><b id="remain">${fmt(remain)}</b></div>
    </header>
    <div class="tabs">${Object.keys(BT).map((k) => `<button class="tab ${B.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${BT[k].label}</button>`).join('')}</div>
    ${n > 1 ? `<div class="modes"><button class="mode ${multi ? '' : 'on'}" data-act="mode" data-v="single">1点ずつ買う</button><button class="mode ${multi ? 'on' : ''}" data-act="mode" data-v="multi">流し・まとめ買い</button></div>` : ''}
    ${multi ? multiHtml(r, n, remain) : `
    <div class="guide">${guide}<small>${BT[B.tab].hint}</small></div>
    <div class="hlist tight">${r.horses.map((h) => hrow(h, { pick: true, sel: B.sel, n })).join('')}</div>
    <div class="pickbar ${ready ? 'ready' : ''}">
      ${ready ? `<div class="pb-sel">${betText({ type: B.tab, sel: B.sel })}</div><div class="pb-odds"><b>${LG.fmtOdds(odds)}</b>倍<small>的中率 ${(prob * 100).toFixed(prob < 0.01 ? 2 : 1)}%</small></div>`
    : `<div class="pb-empty">${B.sel.length ? selBadges(B.sel) + ` あと${n - B.sel.length}頭` : '馬を選んでください'}</div>`}
    </div>
    <div class="amount">
      <div class="amt-in"><input type="number" inputmode="numeric" pattern="[0-9]*" id="amt" min="0" value="${B.amount || ''}" placeholder="0"><span>コイン</span></div>
      <div class="amt-chips">
        <button class="chip" data-act="amt" data-v="10">+10</button><button class="chip" data-act="amt" data-v="50">+50</button><button class="chip" data-act="amt" data-v="100">+100</button>
        <button class="chip" data-act="amt" data-v="half">半分</button><button class="chip" data-act="amt" data-v="all">全部</button><button class="chip ghost" data-act="amt" data-v="clear">C</button>
      </div>
      <div class="amt-pay" id="amtPay">${payText(odds)}</div>
    </div>
    <button class="btn btn-green" id="addBtn" data-act="addBet" ${ready && B.amount > 0 && B.amount <= remain ? '' : 'disabled'}>＋ このベットを追加</button>`}
    <h3 class="sub">ベット一覧${B.slip.length ? `（合計 ${fmt(total)}）` : ''}</h3>
    <div class="slip">
      ${B.slip.length ? B.slip.map((b, i) => `<div class="slip-row">${betText(b)}<span class="sl-amt">${fmt(b.amount)}<small> × ${LG.fmtOdds(b.odds)}倍</small></span><button class="x" data-act="delBet" data-v="${i}">✕</button></div>`).join('') : '<div class="empty">まだベットがありません</div>'}
    </div>
    <div class="sticky"><button class="btn btn-gold big" data-act="confirmBets">${B.slip.length ? `ベット確定！（${fmt(total)}コイン）` : '見（ケン）で確定'}</button></div>
  </div>`, keep);
}
// 流し・フォーメーション: 各着順に置いた馬の全組み合わせ
function combos() {
  const n = BT[B.tab].n, f = B.form, out = [];
  for (const a of f[1]) for (const b of f[2]) {
    if (a === b) continue;
    if (n === 2) out.push([a, b]);
    else for (const c of f[3]) if (c !== a && c !== b) out.push([a, b, c]);
  }
  return out.map((sel) => ({ sel, key: sel.join('-'), odds: LG.betOdds(G.race, B.tab, sel) })).sort((x, y) => x.odds - y.odds);
}
const MAX_COMBOS = 60;
const multiTotal = (cs) => cs.reduce((t, c) => t + (B.mamt[c.key] || 0), 0);
function multiHtml(r, n, remain) {
  const pos = n === 2 ? [1, 2] : [1, 2, 3];
  const cs = combos();
  const over = cs.length > MAX_COMBOS;
  const total = over ? 0 : multiTotal(cs);
  const cnt = cs.filter((c) => B.mamt[c.key] > 0).length;
  let body;
  if (!cs.length) body = `<div class="pickbar"><div class="pb-empty">1着・2着${n === 3 ? '・3着' : ''}の馬を選ぶと買い目が出ます</div></div>`;
  else if (over) body = `<div class="pickbar"><div class="pb-empty">${cs.length}点は多すぎます（${MAX_COMBOS}点まで）。馬を減らしてね</div></div>`;
  else {
    body = `<div class="cmb-head"><b>${cs.length}<small>点</small></b><span>全点に</span>
        <button class="chip" data-act="mbulk" data-v="10">+10</button><button class="chip" data-act="mbulk" data-v="50">+50</button><button class="chip" data-act="mbulk" data-v="100">+100</button><button class="chip ghost" data-act="mbulk" data-v="clear">C</button></div>
      <div class="cmbs">${cs.map((c) => `<label class="cmb">${selBadges(c.sel)}<span class="cmb-odds">${LG.fmtOdds(c.odds)}<small>倍</small></span>
        <input class="cmb-amt" type="number" inputmode="numeric" pattern="[0-9]*" min="0" data-key="${c.key}" value="${B.mamt[c.key] || ''}" placeholder="0"></label>`).join('')}</div>
      <div class="amt-pay" id="mTotal">${multiTotalText(total, remain)}</div>
      <button class="btn btn-green" id="mAddBtn" data-act="addMulti" ${total > 0 && total <= remain ? '' : 'disabled'}>＋ <span id="mCnt">${cnt}</span>点をまとめて追加</button>`;
  }
  return `
    <div class="guide">各着順に置く馬を選ぶ（複数OK）<small>例：1着を1頭・2着を3頭えらぶと3点。点ごとに金額を入れられます</small></div>
    <div class="flist">
      <div class="frow fhead"><span class="h-main"></span><span class="ftog">${pos.map((k) => `<button class="ft all" data-act="fall" data-pos="${k}">${k}着 全</button>`).join('')}</span></div>
      ${r.horses.map((h) => `<div class="frow">${nb(h.num, 'big')}
        <span class="h-main"><b>${esc(h.name)}${kindIcon(h)}</b><small><span class="fo">${h.odds.toFixed(1)}倍</span><span>${h.pop}人気</span><span class="st st-${h.style}">${STYLES[h.style].label}</span></small></span>
        <span class="ftog">${pos.map((k) => `<button class="ft p${k} ${B.form[k].includes(h.num) ? 'on' : ''}" data-act="ftog" data-pos="${k}" data-num="${h.num}">${k}着</button>`).join('')}</span></div>`).join('')}
    </div>
    ${body}`;
}
function multiTotalText(total, remain) {
  if (total > remain) return `<b class="ng">合計 ${fmt(total)} コイン（${fmt(total - remain)} 足りません）</b>`;
  return `合計 <b>${fmt(total)}</b> コイン`;
}
function onMultiInput(el) {
  B.mamt[el.dataset.key] = Math.max(0, Math.floor(+el.value || 0));
  const cs = combos(), total = multiTotal(cs), remain = betRemain();
  document.getElementById('mTotal').innerHTML = multiTotalText(total, remain);
  document.getElementById('mAddBtn').disabled = !(total > 0 && total <= remain);
  document.getElementById('mCnt').textContent = cs.filter((c) => B.mamt[c.key] > 0).length;
}
function payText(odds) {
  if (!odds || !B.amount) return '&nbsp;';
  return `当たれば <b>${fmt(Math.floor(B.amount * odds))}</b> コイン`;
}
function onAmtInput(el) {
  B.amount = Math.max(0, Math.floor(+el.value || 0));
  const n = BT[B.tab].n, ready = B.sel.length === n;
  const odds = ready ? LG.betOdds(G.race, B.tab, B.sel) : 0;
  document.getElementById('amtPay').innerHTML = payText(odds);
  document.getElementById('addBtn').disabled = !(ready && B.amount > 0 && B.amount <= betRemain());
}

// ───────── 全員のベット確認 ─────────
function viewLineup() {
  const r = G.race;
  render(`
  <div class="scr lineup">
    ${raceHead()}
    <h3 class="sub">みんなのベット</h3>
    <div class="plist">
      ${G.players.map((p, i) => {
    const bets = G.bets[i] || [];
    return `<div class="pcard"><div class="pc-head"><span class="dot" style="background:${p.color}">${esc(p.name.slice(0, 1))}</span><b>${esc(p.name)}</b><span class="pc-tot">${bets.length ? fmt(bets.reduce((s, b) => s + b.amount, 0)) + ' コイン' : '見'}</span></div>
          ${bets.map((b) => `<div class="pc-bet">${betText(b)}<span class="hnames">${b.sel.map((n) => esc(horse(n).name)).join(' ▶ ')}</span><span class="sl-amt">${fmt(b.amount)}<small> × ${LG.fmtOdds(b.odds)}</small></span></div>`).join('') || '<div class="empty">ベットなし</div>'}</div>`;
  }).join('')}
    </div>
    <div class="sticky"><button class="btn btn-red big" data-act="startRace">🏁 レーススタート！</button></div>
  </div>`);
}

// ───────── レース ─────────
function picksForHud() {
  const picks = {};
  G.players.forEach((p, i) => {
    const seen = {};
    (G.bets[i] || []).forEach((b) => { const n = b.sel[0]; if (seen[n]) return; seen[n] = 1; (picks[n] = picks[n] || []).push({ name: p.name, color: p.color }); });
  });
  return picks;
}
async function runRace(replay) {
  AU.unlock(); AU.primeVoice();   // タップ直後に音声を有効化（iOS対策）
  raceEl.classList.add('show');
  let mod;
  try { mod = await import('./race3d.js'); }
  catch (e) { raceEl.classList.remove('show'); toast('3Dの読み込みに失敗。結果へ進みます'); if (!replay) afterRace(); return; }
  try {
    const view = mod.getRaceView(raceEl);
    racePromise = view.run(G.race, { picks: picksForHud(), replay });
    await racePromise;
  } catch (e) {
    console.error(e); toast('3D表示でエラー。結果へ進みます');
  }
  raceEl.classList.remove('show');
  if (replay) viewPayout(true); else afterRace();
}
function afterRace() {
  if (G.phase !== 'race') return;
  const res = LG.settle(G.race, G.bets, G.players);
  res.forEach((r) => { G.players[r.idx].coins = r.after; });
  G.results = res; G.phase = 'payout';
  go();
}
function viewRaceGate() {
  // レース中にリロードされた場合
  render(`<div class="scr handoff"><div class="ho-phone">🏇</div><p class="ho-msg">レースの途中でした</p>
    <button class="btn btn-red big" data-act="rerunRace">レースを見る</button>
    <button class="btn" data-act="skipRace">結果へ進む</button></div>`);
}

// ───────── 払い戻し ─────────
function viewPayout(noAnim) {
  const r = G.race, o = r.order;
  const last = G.turn >= G.turns - 1;
  const top3 = o.slice(0, 3).map((n, i) => `<div class="res-row r${i + 1}"><span class="rk">${i + 1}<small>着</small></span>${nb(n, 'big')}<b>${esc(horse(n).name)}</b><small>${horse(n).pop}番人気</small></div>`).join('');
  const rest = o.slice(3).map((n, i) => `<span class="rest">${i + 4}着 ${nb(n)}${esc(horse(n).name)}</span>`).join('');
  const pay = (type, sel) => `<div class="pay-row"><span class="bt bt-${type}">${BT[type].label}</span>${selBadges(sel)}<b>${LG.fmtOdds(LG.betOdds(r, type, sel))}倍</b></div>`;
  const anyHit = G.results.some((x) => x.payout > 0);
  render(`
  <div class="scr payout">
    <header class="bar"><h2>第${r.no}R ${esc(r.name)} 結果</h2></header>
    <section class="card res">${top3}<div class="rests">${rest}</div></section>
    <section class="card pays"><h3>払い戻し</h3>${pay('win', o.slice(0, 1))}${pay('exacta', o.slice(0, 2))}${pay('trifecta', o.slice(0, 3))}</section>
    <div class="plist">
      ${G.results.map((x) => {
    const p = G.players[x.idx]; const net = x.after - x.before;
    return `<div class="pcard ${x.payout > 0 ? 'hit' : ''}"><div class="pc-head"><span class="dot" style="background:${p.color}">${esc(p.name.slice(0, 1))}</span><b>${esc(p.name)}</b>
          <span class="net ${net > 0 ? 'plus' : net < 0 ? 'minus' : ''}">${net > 0 ? '+' : ''}${fmt(net)}</span></div>
          ${x.bets.map((b) => `<div class="pc-bet ${b.hit ? 'win' : 'miss'}">${betText(b)}<span class="sl-amt">${fmt(b.amount)}</span><span class="judge">${b.hit ? `🎯 的中 +${fmt(b.pay)}` : 'ハズレ'}</span></div>`).join('') || '<div class="empty">ベットなし</div>'}
          <div class="pc-coins">${fmt(x.before)} ▶ <b ${noAnim ? '' : `data-from="${x.before}" data-to="${x.after}"`}>${fmt(noAnim ? x.after : x.before)}</b> コイン</div></div>`;
  }).join('')}
    </div>
    <h3 class="sub">現在の順位</h3>
    ${standings()}
    <div class="sticky two">
      <button class="btn" data-act="replay">🎬 リプレイ</button>
      <button class="btn btn-gold big" data-act="nextTurn">${last ? '最終結果へ 🏆' : `第${r.no + 1}レースへ ▶`}</button>
    </div>
  </div>`);
  if (!noAnim) { countUp(); setTimeout(() => (anyHit ? AU.sfx.coin(4) : AU.sfx.lose()), 250); }
}

// ───────── 最終結果 ─────────
function viewFinal() {
  const ps = G.players.slice().sort((a, b) => b.coins - a.coins);
  const d = LG.calcDrinks(G.players);
  if (!G.recorded) {
    G.recorded = true;
    d.bebes.forEach((name) => ST.addDrinks(name, d.drinks, `差 ${fmt(d.diff)} コイン`));
    save();
    setTimeout(() => AU.sfx.drumroll(1.2), 100); setTimeout(() => AU.sfx.win(), 1500);
  }
  const medal = ['🥇', '🥈', '🥉'];
  const minC = ps[ps.length - 1].coins;
  let drinkHtml;
  if (d.diff === 0) drinkHtml = '<div class="dr-safe">全員同点！お酒なし 🎉</div>';
  else if (d.drinks === 0) drinkHtml = `<div class="dr-safe">差は ${fmt(d.diff)} コイン。${LG.COINS_PER_DRINK}未満なのでセーフ！</div>`;
  else {
    drinkHtml = `
      <div class="dr-calc">( <b>${fmt(ps[0].coins)}</b> − <b>${fmt(minC)}</b> ) ÷ ${LG.COINS_PER_DRINK} ＝</div>
      <div class="dr-num"><b>${fmt(d.drinks)}</b>杯</div>
      <div class="dr-vodka">🍸 ウォッカ <b>${fmt(d.vodka)}</b> カウント${d.rest ? ` ＋ 🍺 お酒 <b>${d.rest}</b> 杯` : ''}</div>
      <div class="dr-who">ベベの <b>${d.bebes.map(esc).join('・')}</b> の帳簿に追加しました</div>`;
  }
  render(`
  <div class="scr final">
    <div class="fin-title">🏆 最終結果 🏆</div>
    <div class="rank">
      ${ps.map((p, i) => `<div class="rank-row ${i === 0 ? 'top' : ''} ${p.coins === minC && d.diff > 0 ? 'bebe' : ''}" style="animation-delay:${(ps.length - i) * 0.18}s">
        <span class="rk">${medal[i] || i + 1 + '位'}</span><span class="dot" style="background:${p.color}">${esc(p.name.slice(0, 1))}</span><b>${esc(p.name)}</b>
        ${p.coins === minC && d.diff > 0 ? '<em class="bebe-tag">ベベ</em>' : ''}<span class="rc">${fmt(p.coins)}<small> コイン</small></span></div>`).join('')}
    </div>
    <section class="card drink"><h3>🍶 ベベのお酒</h3>${drinkHtml}</section>
    <div class="stack">
      <button class="btn btn-gold big" data-act="toLedger">🍶 お酒帳簿を見る</button>
      <button class="btn btn-green" data-act="again">同じメンバーでもう一回</button>
      <button class="btn btn-ghost" data-act="toTitle">タイトルへ</button>
    </div>
    <div class="foot">飲みすぎ注意！飲めない分は帳簿にためておこう</div>
  </div>`);
}

// ───────── お酒帳簿 ─────────
function viewLedger() {
  const led = ST.getLedger();
  const names = Object.keys(led.people).sort((a, b) => led.people[b].owed - led.people[a].owed);
  const hist = led.history.slice(-15).reverse();
  const dt = (t) => { const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
  render(`
  <div class="scr ledger">
    <header class="bar"><button class="back" data-act="ledgerBack">‹</button><h2>🍶 お酒帳簿</h2></header>
    <p class="lead">たまったお酒はここに記録。ゲームをまたいで持ち越し、アプリを閉じても残ります。</p>
    <div class="plist">
      ${names.length ? names.map((n) => {
    const p = led.people[n], v = LG.splitVodka(p.owed);
    return `<div class="lcard ${p.owed ? '' : 'zero'}"><div class="lc-main"><b>${esc(n)}</b>
          <div class="lc-num"><span>${fmt(p.owed)}</span>杯</div>
          <div class="lc-sub">${p.owed ? `🍸 ウォッカ ${v.vodka} カウント${v.rest ? ` ＋ 🍺 ${v.rest}杯` : ''}` : '完飲！えらい 👏'}<small>これまでに飲んだ: ${fmt(p.drunk)}杯</small></div></div>
          ${p.owed ? `<button class="btn btn-red" data-act="drinkOpen" data-name="${esc(n)}">飲んだよ！</button>` : `<button class="btn btn-ghost sm" data-act="delPerson" data-name="${esc(n)}">消す</button>`}</div>`;
  }).join('') : '<div class="empty big">まだ誰もお酒をためていません 🎉</div>'}
    </div>
    ${hist.length ? `<h3 class="sub">りれき</h3><div class="hist">${hist.map((h) => `<div class="hi ${h.d < 0 ? 'neg' : 'pos'}"><span>${dt(h.t)}</span><b>${esc(h.name)}</b><em>${h.d > 0 ? '+' : ''}${h.d}杯</em><small>${esc(h.note || '')}</small></div>`).join('')}</div>` : ''}
    <details class="backup"><summary>バックアップ / 復元</summary>
      <p>ブラウザのサイトデータを完全に消去すると帳簿も消えます。念のためコードを控えておくと復元できます。</p>
      <div class="stack"><button class="btn sm" data-act="exportCode">バックアップコードをコピー</button><button class="btn sm" data-act="importCode">コードから復元</button></div>
    </details>
  </div>`, true);
}
let ledgerFrom = 'title';
function drinkModal() {
  const p = ST.getLedger().people[D.name];
  const left = p.owed - D.n, v = LG.splitVodka(D.n);
  modal(`
    <h2>${esc(D.name)}、飲んだ？</h2>
    <p class="dm-left">残り <b>${fmt(p.owed)}</b> 杯</p>
    <div class="stepper"><button data-act="drinkStep" data-v="-1">−</button><div class="st-num"><b>${D.n}</b><small>杯 飲んだ${v.vodka ? `（ウォッカ${v.vodka}${v.rest ? '＋' + v.rest + '杯' : ''}）` : ''}</small></div><button data-act="drinkStep" data-v="1">＋</button></div>
    <div class="chips center"><button class="chip" data-act="drinkSet" data-v="1">🍺 1杯</button><button class="chip" data-act="drinkSet" data-v="${Math.min(LG.DRINKS_PER_VODKA, p.owed)}">🍸 ウォッカ1（${LG.DRINKS_PER_VODKA}杯分）</button><button class="chip" data-act="drinkSet" data-v="${p.owed}">全部</button></div>
    <p class="dm-after">飲んだあとの残り: <b>${fmt(left)}</b> 杯</p>
    <div class="row2"><button class="btn btn-ghost" data-act="closeModal">やめる</button><button class="btn btn-red" data-act="drinkOk">飲んだよ！</button></div>`);
}

// ───────── アクション ─────────
const actions = {
  toTitle() { if (G && G.phase === 'final') { ST.delKey('game'); G = null; } viewTitle(); },
  toSetup() { loadSettings(); viewSetup(); },
  howto,
  closeModal,
  resume() { G = ST.loadJSON('game'); if (!G) return viewTitle(); B = null; keepAwake(); import('./race3d.js').catch(() => {}); go(); },
  toLedger() { ledgerFrom = G && G.phase === 'final' ? 'final' : 'title'; viewLedger(); },
  ledgerBack() { if (ledgerFrom === 'final' && G) viewFinal(); else viewTitle(); },
  setCount(el) { readSetupInputs(); S.count = +el.dataset.v; viewSetup(); },
  setCoins(el) { readSetupInputs(); if (el.dataset.v === 'custom') S.coinsCustom = true; else { S.coinsCustom = false; S.coins = +el.dataset.v; } viewSetup(); },
  setTurns(el) { readSetupInputs(); if (el.dataset.v === 'custom') S.turnsCustom = true; else { S.turnsCustom = false; S.turns = +el.dataset.v; } viewSetup(); },
  startGame,
  beginBets() { G.phase = 'handoff'; G.betPos = 0; go(); },
  openBet() { B = null; G.phase = 'bet'; go(); },
  tab(el) { B.tab = el.dataset.v; B.sel = B.sel.slice(0, BT[B.tab].n); viewBet(true); },
  mode(el) { B.mode = el.dataset.v; viewBet(true); },
  ftog(el) {
    const k = +el.dataset.pos, num = +el.dataset.num, arr = B.form[k], i = arr.indexOf(num);
    if (i >= 0) arr.splice(i, 1); else arr.push(num);
    AU.sfx.select(); viewBet(true);
  },
  fall(el) {
    const k = +el.dataset.pos;
    B.form[k] = B.form[k].length === 7 ? [] : [1, 2, 3, 4, 5, 6, 7];
    viewBet(true);
  },
  mbulk(el) {
    const cs = combos(), v = el.dataset.v;
    if (v === 'clear') cs.forEach((c) => { B.mamt[c.key] = 0; });
    else {
      if (multiTotal(cs) + cs.length * +v > betRemain()) { AU.sfx.error(); return toast('コインが足りません'); }
      cs.forEach((c) => { B.mamt[c.key] = (B.mamt[c.key] || 0) + +v; });
    }
    viewBet(true);
  },
  addMulti() {
    const cs = combos().filter((c) => B.mamt[c.key] > 0), total = multiTotal(cs);
    if (!cs.length || total > betRemain()) return AU.sfx.error();
    cs.forEach((c) => {
      const same = B.slip.find((b) => b.type === B.tab && b.sel.join() === c.sel.join());
      if (same) same.amount += B.mamt[c.key];
      else B.slip.push({ type: B.tab, sel: c.sel, amount: B.mamt[c.key], odds: c.odds });
    });
    B.form = { 1: [], 2: [], 3: [] }; B.mamt = {};
    AU.sfx.coin(2); toast(`${cs.length}点を追加しました`); viewBet(true);
  },
  pick(el) {
    const num = +el.dataset.num, n = BT[B.tab].n, i = B.sel.indexOf(num);
    if (i >= 0) B.sel.splice(i, 1);
    else if (n === 1) B.sel = [num];
    else if (B.sel.length < n) B.sel.push(num);
    else { AU.sfx.error(); return toast(`${BT[B.tab].label}は${n}頭まで。選び直すなら馬をもう一度タップ`); }
    AU.sfx.select(); viewBet(true);
  },
  amt(el) {
    const v = el.dataset.v, remain = betRemain();
    if (v === 'clear') B.amount = 0;
    else if (v === 'all') B.amount = remain;
    else if (v === 'half') B.amount = Math.floor(remain / 2);
    else B.amount = Math.min(remain, (B.amount || 0) + +v);
    viewBet(true);
  },
  addBet() {
    const n = BT[B.tab].n, remain = betRemain();
    if (B.sel.length !== n || !(B.amount > 0) || B.amount > remain) return AU.sfx.error();
    const same = B.slip.find((b) => b.type === B.tab && b.sel.join() === B.sel.join());
    if (same) same.amount += B.amount;
    else B.slip.push({ type: B.tab, sel: B.sel.slice(), amount: B.amount, odds: LG.betOdds(G.race, B.tab, B.sel) });
    B.sel = []; B.amount = 0; AU.sfx.coin(1); viewBet(true);
  },
  delBet(el) { B.slip.splice(+el.dataset.v, 1); viewBet(true); },
  confirmBets() {
    const p = G.players[G.order[G.betPos]];
    const total = B.slip.reduce((s, b) => s + b.amount, 0);
    const isMulti = BT[B.tab].n > 1 && B.mode === 'multi';
    const pending = isMulti ? multiTotal(combos()) > 0 : B.sel.length === BT[B.tab].n && B.amount > 0;
    modal(`<h2>${esc(p.name)} のベット確定</h2>
      ${B.slip.length ? `<div class="slip">${B.slip.map((b) => `<div class="slip-row">${betText(b)}<span class="sl-amt">${fmt(b.amount)}<small> × ${LG.fmtOdds(b.odds)}倍</small></span></div>`).join('')}</div><p class="dm-after">合計 <b>${fmt(total)}</b> コイン</p>` : '<p>ベットなし（見）で進みます。いいですか？</p>'}
      ${pending ? '<p class="warn">⚠ 選択中のベットがまだ「追加」されていません</p>' : ''}
      <div class="row2"><button class="btn btn-ghost" data-act="closeModal">もどる</button><button class="btn btn-gold" data-act="confirmOk">確定！</button></div>`);
  },
  confirmOk() {
    closeModal();
    G.bets[G.order[G.betPos]] = B.slip; B = null;
    G.betPos += 1;
    G.phase = G.betPos < G.players.length ? 'handoff' : 'lineup';
    AU.sfx.coin(2); go();
  },
  startRace() {
    if (!G.race.order) G.race.order = LG.drawOrder(G.race);
    G.phase = 'race'; save();
    runRace(false);
  },
  rerunRace() { runRace(false); },
  skipRace() { afterRace(); },
  replay() { runRace(true); },
  nextTurn() {
    if (G.turn >= G.turns - 1) { G.phase = 'final'; return go(); }
    G.turn += 1; newRace(); go();
  },
  again() {
    loadSettings();
    S.count = G.players.length; G.players.forEach((p, i) => { S.names[i] = p.name; });
    S.coins = G.init; S.turns = G.turns;
    S.coinsCustom = !COIN_PRESETS.includes(S.coins); S.turnsCustom = !TURN_PRESETS.includes(S.turns);
    ST.saveJSON('settings', S);
    startGame();
  },
  drinkOpen(el) { D = { name: el.dataset.name, n: 1 }; drinkModal(); },
  drinkStep(el) { const p = ST.getLedger().people[D.name]; D.n = Math.max(1, Math.min(p.owed, D.n + +el.dataset.v)); drinkModal(); },
  drinkSet(el) { D.n = Math.max(1, +el.dataset.v); drinkModal(); },
  drinkOk() { const n = ST.drink(D.name, D.n); closeModal(); AU.sfx.win(); toast(`${D.name}、${n}杯 おつかれ！🍻`); viewLedger(); },
  delPerson(el) { ST.removePerson(el.dataset.name); viewLedger(); },
  async exportCode() {
    const code = ST.exportCode();
    try { await navigator.clipboard.writeText(code); toast('バックアップコードをコピーしました'); }
    catch (e) { modal(`<h2>バックアップコード</h2><textarea class="code" readonly>${esc(code)}</textarea><button class="btn btn-gold" data-act="closeModal">閉じる</button>`); }
  },
  importCode() {
    modal(`<h2>コードから復元</h2><p>いまの帳簿は上書きされます。</p><textarea class="code" id="codeIn" placeholder="KP1.…"></textarea>
      <div class="row2"><button class="btn btn-ghost" data-act="closeModal">やめる</button><button class="btn btn-gold" data-act="importOk">復元する</button></div>`);
  },
  importOk() {
    const ok = ST.importCode(document.getElementById('codeIn').value);
    closeModal(); toast(ok ? '復元しました' : 'コードが正しくありません'); viewLedger();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  AU.unlock();
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (!['pick', 'ftog', 'addBet', 'addMulti', 'confirmOk', 'drinkOk'].includes(el.dataset.act)) AU.sfx.click();
  fn(el, e);
});
document.addEventListener('input', (e) => {
  if (!B) return;
  if (e.target.id === 'amt') onAmtInput(e.target);
  else if (e.target.classList.contains('cmb-amt')) onMultiInput(e.target);
});
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });

// ───────── 起動 ─────────
(async function boot() {
  await ST.loadLedger();
  const qs = new URLSearchParams(location.search);
  if (qs.has('demo')) {
    // 開発用: いきなりレースを再生
    loadSettings();
    G = { v: 1, demo: true, init: 500, turns: 3, players: [{ name: 'テストA', coins: 500, color: PLAYER_COLORS[0] }, { name: 'テストB', coins: 500, color: PLAYER_COLORS[1] }], turn: +qs.get('turn') || 0, types: [qs.get('type') || 'duo', 'solo', 'mixed'], envs: [qs.get('env') || 'day', 'sunset', 'night'], used: [], bets: {}, betPos: 0, relief: [] };
    newRace();
    G.bets = { 0: [{ type: 'win', sel: [1], amount: 100, odds: horse(1).odds }], 1: [{ type: 'exacta', sel: [3, 5], amount: 50, odds: LG.betOdds(G.race, 'exacta', [3, 5]) }] };
    G.race.order = LG.drawOrder(G.race); G.phase = 'race';
    render('<div class="scr handoff"><button class="btn btn-red big" data-act="rerunRace">デモレース開始</button></div>');
    window.__G = G;
    return;
  }
  viewTitle();
})();
