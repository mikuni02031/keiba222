// 3Dレース演出: カメラワーク・スローモーション・HUD・実況
import * as THREE from '../vendor/three.module.min.js';
import { T, pathAt, headingOf, buildTrack } from './track.js';
import { Horse, numberTexture } from './horse.js';
import { FRAMES, RACE_TYPES, ENVS, STYLES } from './data.js';
import { buildPlan, mulberry32 } from './raceplan.js';
import * as AU from './audio.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ss = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INTRO = { wide: 3.0, dolly: 8.2, hold: 9.6 };

let instance = null;
export function getRaceView(root) {
  if (!instance) { instance = new RaceView(root); window.__rv = instance; }
  return instance;
}

class RaceView {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <canvas class="rc-canvas"></canvas>
      <div class="rc-hud">
        <div class="rc-top"><div class="rc-title"></div><div class="rc-remain"></div></div>
        <div class="rc-order"></div>
        <canvas class="rc-map" width="264" height="120"></canvas>
        <div class="rc-intro"></div>
        <div class="rc-banner"></div>
        <div class="rc-caption"></div>
        <div class="rc-btns">
          <button class="rc-btn" data-rc="voice"></button>
          <button class="rc-btn" data-rc="mute"></button>
          <button class="rc-btn" data-rc="skip">スキップ ⏭</button>
        </div>
        <div class="rc-result"></div>
      </div>`;
    const q = (s) => root.querySelector(s);
    this.el = { canvas: q('.rc-canvas'), title: q('.rc-title'), remain: q('.rc-remain'), order: q('.rc-order'), map: q('.rc-map'), intro: q('.rc-intro'), banner: q('.rc-banner'), caption: q('.rc-caption'), result: q('.rc-result'), btns: q('.rc-btns') };
    this.lowSpec = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.el.canvas, antialias: true, powerPreference: 'high-performance' });
    this.pr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(this.pr);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.4, 6000);
    this.track = buildTrack(this.scene, r, this.lowSpec);
    this.horses = [];
    this.cp = new THREE.Vector3(); this.lt = new THREE.Vector3();
    this.cpS = new THREE.Vector3(); this.ltS = new THREE.Vector3();
    this.cpR = new THREE.Vector3(); this.ltR = new THREE.Vector3();
    this.fov = 40; this.fovS = 40; this.shot = '';
    this.focus = new THREE.Vector3();
    this._p = {}; this._v = new THREE.Vector3();
    // 芝の蹴り上げ
    const ND = 260;
    this.dust = { n: ND, i: 0, pos: new Float32Array(ND * 3).fill(-50), vel: new Float32Array(ND * 3), life: new Float32Array(ND) };
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dust.pos, 3));
    this.dust.mat = new THREE.PointsMaterial({ color: 0x2f4a1c, size: 0.11, sizeAttenuation: true });
    this.dust.pts = new THREE.Points(dg, this.dust.mat); this.dust.pts.frustumCulled = false; this.scene.add(this.dust.pts);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this.el.btns.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      if (b.dataset.rc === 'mute') { AU.setMuted(!AU.isMuted()); this.syncBtns(); }
      if (b.dataset.rc === 'voice') { AU.setVoice(!AU.isVoiceOn()); this.syncBtns(); }
      if (b.dataset.rc === 'skip') this.skip();
    });
    this.el.result.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      if (b.dataset.rc === 'done') this.finish();
    });
    this.syncBtns();
  }

  syncBtns() {
    this.root.querySelector('[data-rc="mute"]').textContent = AU.isMuted() ? '🔇 音OFF' : '🔊 音ON';
    this.root.querySelector('[data-rc="voice"]').textContent = AU.isVoiceOn() ? '🎙 実況ON' : '🎙 実況OFF';
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.aspect = w / h;
  }

  // race: {…, order}, opts: {picks:{num:[{name,color}]}, replay:boolean}
  run(race, opts = {}) {
    this.stop();
    this.race = race; this.opts = opts;
    this.plan = buildPlan(race, T.L);
    const rng = mulberry32(race.seed ^ 0x5bd1e995);
    this.horses.forEach((h) => { this.scene.remove(h.model.root); this.scene.remove(h.label); h.model.dispose(); h.label.material.dispose(); });
    this.horses = this.plan.horses.map((ph) => {
      const info = race.horses.find((x) => x.num === ph.num);
      const frame = FRAMES[ph.num - 1];
      const model = new Horse({ num: ph.num, coat: info.coat, frame, rng });
      this.scene.add(model.root);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(ph.num, frame, true), depthTest: false, transparent: true, fog: false }));
      label.renderOrder = 20; this.scene.add(label);
      return { ph, info, model, label, s: 0, prevS: 0, speed: 0, turn: 0, fin: false };
    }).sort((a, b) => a.ph.num - b.ph.num);
    this.track.setEnv(race.env);
    this.track.setGate(false, true);
    this.track.stopConfetti();
    this.track.setVision(race.name, `第${race.no}レース ${race.dist}`);
    this.dust.mat.color.set(race.env === 'rain' ? 0x4a3d28 : race.env === 'night' ? 0x1c3014 : 0x2f4a1c);
    this.dust.pos.fill(-50);
    this.nominal = parseInt((race.dist.match(/\d+/) || ['2000'])[0], 10);

    // HUD
    const type = RACE_TYPES[race.type], env = ENVS[race.env];
    this.el.title.innerHTML = `<b>第${race.no}R ${esc(race.name)}</b><span>${esc(race.dist)}・${env.icon}${env.label}・${type.label}</span>`;
    this.el.remain.textContent = '';
    this.el.order.innerHTML = this.horses.map((h) => {
      const f = FRAMES[h.ph.num - 1];
      const picks = (opts.picks && opts.picks[h.ph.num]) || [];
      return `<div class="rc-row" data-num="${h.ph.num}"><i style="background:${f.bg};color:${f.fg}">${h.ph.num}</i><span>${esc(h.info.name)}</span>${picks.map((p) => `<em style="background:${p.color}">${esc(p.name.slice(0, 2))}</em>`).join('')}</div>`;
    }).join('');
    this.rows = {};
    this.el.order.querySelectorAll('.rc-row').forEach((r) => { this.rows[r.dataset.num] = r; });
    this.el.order.classList.remove('show');
    this.el.result.classList.remove('show'); this.el.result.innerHTML = '';
    this.el.banner.className = 'rc-banner'; this.el.caption.textContent = ''; this.el.caption.classList.remove('show');
    this.el.intro.innerHTML = ''; this.el.intro.classList.remove('show');
    this.el.btns.style.display = '';
    this.root.classList.remove('finished');

    this.state = 'intro'; this.real = 0; this.raceT = 0; this.timeScale = 1; this.cueIdx = 0;
    this.shot = ''; this.hudT = 0; this.capT = 0; this.afterT = 0; this.goalShown = false; this.revealed = false; this.introIdx = -1;
    this.frameCount = 0; this.frameAcc = 0; this.perfChecked = false;
    this.resize();
    this.placeHorses(0, 0.016);
    this.running = true; this.last = performance.now();
    AU.unlock(); AU.startAmbience(); AU.primeVoice();
    AU.sfx.fanfare();
    return new Promise((res) => {
      this.resolve = res;
      this.raf = requestAnimationFrame((t) => this.tick(t));
    });
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    AU.stopAmbience(); AU.hush();
  }

  finish() {
    const res = this.resolve; this.resolve = null;
    this.stop();
    if (res) res();
  }

  skip() {
    if (this.state === 'result') return;
    AU.hush(); AU.setAmbience(0, 0.15);
    // ゴール後の状態へ飛ばす
    this.state = 'after'; this.raceT = this.plan.lastFinish + 2.5; this.afterT = 99; this.timeScale = 1; this.goalShown = true;
    this.placeHorses(this.raceT, 0.016);
    this.showResult();
  }

  banner(text, cls = '') {
    const b = this.el.banner;
    b.className = 'rc-banner'; void b.offsetWidth;
    b.innerHTML = text; b.className = 'rc-banner show ' + cls;
  }
  caption(text, pri) {
    this.el.caption.textContent = text; this.el.caption.classList.add('show'); this.capT = 3.0;
    AU.say(text, pri);
  }

  placeHorses(t, dt) {
    const p = this._p;
    for (const h of this.horses) {
      h.prevS = h.s;
      h.s = t > 0 ? h.ph.sAt(t) : 0;
      if (dt > 1e-5) h.speed = lerp(h.speed, clamp((h.s - h.prevS) / dt, 0, 25), 0.5);
      const u = T.U0 + h.s;
      const d = h.ph.latAt(Math.max(0, t));
      pathAt(u, d, p);
      h.model.root.position.set(p.x, 0, p.z);
      h.model.root.rotation.y = headingOf(p);
      const um = ((u % T.LAP) + T.LAP) % T.LAP;
      const onTurn = (um > T.STR && um < T.STR + T.ARC) || um > 2 * T.STR + T.ARC ? 1 : 0;
      h.turn += (onTurn - h.turn) * Math.min(1, dt * 2.5);
      h.model.lean.rotation.x = -0.15 * h.turn * clamp(h.speed / 17, 0, 1);
      h.fin = t >= h.ph.finishT;
      const drive = h.fin ? 0 : ss((h.s - (T.L - 310)) / 120);
      h.model.update(dt, t > 0 ? h.speed : 0, drive);
      h.label.position.set(p.x, 3.05, p.z);
    }
  }

  P(u, d, y, out) { pathAt(u, d, this._p); return out.set(this._p.x, y, this._p.z); }

  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    const rdt = clamp((now - this.last) / 1000, 0.001, 0.05);
    this.last = now; this.real += rdt;
    const plan = this.plan, L = T.L;

    // 性能が足りない端末は自動で軽量化
    if (!this.perfChecked && this.real > 1.5) {
      this.frameAcc += rdt; this.frameCount++;
      if (this.frameCount >= 80) {
        const avg = this.frameAcc / this.frameCount;
        if (avg > 0.03) { this.pr = Math.max(1, this.pr * 0.7); this.renderer.setPixelRatio(this.pr); this.resize(); if (avg > 0.045) this.renderer.shadowMap.enabled = false; this.frameAcc = 0; this.frameCount = 0; if (this.pr <= 1) this.perfChecked = true; }
        else this.perfChecked = true;
      }
    }

    // ── 状態遷移 ──
    if (this.state === 'intro') {
      if (this.real >= INTRO.hold) {
        this.state = 'run'; this.raceT = 0;
        this.track.setGate(true); AU.sfx.gate();
        this.banner('スタート！', 'start');
        this.el.intro.classList.remove('show');
        this.el.order.classList.add('show');
      }
    }
    let dtR = 0;
    if (this.state === 'run' || this.state === 'after' || this.state === 'result') {
      const lead = this.leadS || 0;
      const second = plan.horses[1].finishT;
      const slow = lead > L - 13 && this.raceT < second + 0.35;
      const target = slow ? 0.28 : 1;
      this.timeScale += (target - this.timeScale) * Math.min(1, rdt * (slow ? 9 : 3));
      dtR = rdt * this.timeScale;
      this.raceT += dtR;
    }
    this.placeHorses(this.state === 'intro' ? 0 : this.raceT, this.state === 'intro' ? rdt : dtR);

    // 集団の把握
    const sorted = this.horses.slice().sort((a, b) => b.s - a.s);
    const lead = sorted[0], last = sorted[6];
    this.leadS = lead.s;
    const avgS = this.horses.reduce((a, h) => a + h.s, 0) / 7;
    const top3S = (sorted[0].s + sorted[1].s + sorted[2].s) / 3;
    const spread = lead.s - last.s;
    const U0 = T.U0;

    if (this.state === 'run') {
      // 実況
      while (this.cueIdx < plan.cues.length && plan.cues[this.cueIdx].t <= this.raceT) {
        const c = plan.cues[this.cueIdx++];
        if (this.cueIdx < plan.cues.length && plan.cues[this.cueIdx].t <= this.raceT) continue;
        this.caption(c.text, c.pri);
      }
      if (this.raceT >= plan.Tw && !this.goalShown) {
        this.goalShown = true;
        this.banner('ゴール！！', 'goal'); AU.sfx.goal();
      }
      if (this.raceT >= plan.horses[1].finishT + 0.5 && this.goalShown) { this.state = 'after'; this.afterT = 0; }
    } else if (this.state === 'after') {
      this.afterT += rdt;
      const photoWait = plan.photo ? 3.2 : 1.0;
      if (!this.revealed && this.afterT > 0.6 && plan.photo && !this.photoShown) { this.photoShown = true; this.banner('写真判定…', 'photo'); AU.sfx.drumroll(2.4); }
      if (!this.revealed && this.afterT > photoWait) {
        this.revealed = true; this.photoShown = false;
        this.el.order.classList.remove('show');
        const w = plan.horses[0]; const f = FRAMES[w.num - 1];
        this.banner(`<small>1着</small><i style="background:${f.bg};color:${f.fg}">${w.num}</i>${esc(w.name)}`, 'winner');
        this.track.confetti(this.horses.find((h) => h.ph.num === w.num).model.root.position);
        AU.sfx.win(); AU.say(`勝ったのは${w.num}番、${w.name}！`, 5);
      }
      if (this.afterT > photoWait + 4.2) this.showResult();
    }

    // ── カメラ ──
    this.updateCamera(rdt, { lead, sorted, avgS, top3S, spread, U0 });

    // 砂埃・蹄音
    const camP = this.camera.position;
    if (this.state !== 'intro') {
      for (const h of this.horses) {
        if (!h.model.strikes.length) continue;
        const dist = h.model.root.position.distanceTo(camP);
        for (const li of h.model.strikes) {
          if (dist < 70) {
            h.model.hoofWorld(li, this._v);
            for (let k = 0; k < 2; k++) this.spawnDust(this._v, h);
          }
          if (dist < 30 && Math.random() < 0.6) AU.sfx.hoof(clamp(0.5 - dist / 70, 0.05, 0.45));
        }
      }
    }
    this.updateDust(dtR || rdt * 0.5);

    // ラベル
    for (const h of this.horses) {
      const d = h.label.position.distanceTo(camP);
      const sc = clamp(2 * d * Math.tan((this.fov * Math.PI) / 360) * ((this.aspect || 1) < 1 ? 0.036 : 0.06), 0.42, 14);
      h.label.scale.set(sc, sc, 1);
      h.label.position.y = 3.0 + sc * 0.35;
      h.label.visible = this.state !== 'intro';
    }

    // 音
    const packDist = this.focus.distanceTo(camP);
    const running = this.state === 'run' || (this.state === 'after' && this.afterT < 3);
    const prog = clamp(lead.s / L, 0, 1);
    let crowd = 0.12 + 0.2 * prog + 0.68 * ss((lead.s - (L - 320)) / 300);
    if (this.state === 'intro') crowd = 0.14 + 0.1 * ss(this.real / INTRO.hold);
    if (this.state === 'after' || this.state === 'result') crowd = lerp(1, 0.3, ss(this.afterT / 9));
    AU.setAmbience(running ? clamp(1.1 - packDist / 90, 0.12, 1) * Math.max(0.3, this.timeScale) : 0, crowd);

    const excite = this.state === 'intro' ? 0.25 : this.state === 'run' ? 0.25 + 0.75 * ss((lead.s - (L - 330)) / 250) : 1;
    this.track.update(rdt, this.real, this.focus, this.camera, excite);

    // ── HUD ──
    this.hudT -= rdt;
    if (this.capT > 0) { this.capT -= rdt; if (this.capT <= 0) this.el.caption.classList.remove('show'); }
    if (this.hudT <= 0) { this.hudT = 0.2; this.updateHud(sorted); }
    this.drawMap();

    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(rdt, g) {
    const { lead, sorted, avgS, top3S, spread, U0 } = g;
    const L = T.L, cp = this.cp, lt = this.lt, t = this.real;
    let shot, width = 20, damp = 6, minV = 8, maxV = 62, pts = null;
    const port = (this.aspect || 1) < 1;
    const goal = this.track.goal;
    if (this.state === 'intro') {
      if (t < INTRO.wide) {
        shot = 'wide';
        const k = t / INTRO.wide;
        cp.set(lerp(-330, -285, k), lerp(70, 52, k), lerp(-70, -35, k)); lt.set(lerp(20, 50, k), 4, 62); width = 250; minV = 26; maxV = 58;
      } else if (t < INTRO.dolly) {
        shot = 'dolly';
        const k = (t - INTRO.wide) / (INTRO.dolly - INTRO.wide);
        const d = lerp(1.2, 13.4, k);
        this.P(U0 + 6.6, d, 1.75, cp); this.P(U0 + 0.4, d + 0.25, 1.5, lt); width = 5.2; minV = 20; maxV = 70;
        const idx = clamp(Math.round((d - 2.2) / 1.7), 0, 6);
        if (idx !== this.introIdx) { this.introIdx = idx; this.showIntroCard(idx + 1); }
      } else {
        shot = 'gatefront';
        const k = (t - INTRO.dolly) / (INTRO.hold - INTRO.dolly);
        this.P(U0 + lerp(15, 13, k), 7.4, 1.9, cp); this.P(U0, 7.4, 1.5, lt); width = 15;
        if (this.introIdx !== 99) { this.introIdx = 99; this.el.intro.innerHTML = '<div class="rc-ready">ゲートイン完了</div>'; }
      }
    } else if (this.state === 'run' && this.raceT < this.plan.Tw + 0.01 || (this.state === 'run' && lead.s < L + 14)) {
      const s = lead.s;
      if (s < 42) {
        shot = 'start';
        this.P(U0 + 27, -3.2, 1.15, cp); this.P(U0 + avgS * 0.95 + 1, 6.5, 1.3, lt); width = 15; damp = 10; maxV = 58;
      } else if (s < 165) {
        shot = 'back';
        this.P(U0 + avgS + 8, -11, 2.5, cp); this.P(U0 + avgS + 1.5, 6, 1.25, lt); width = spread + 11;
      } else if (s < 300) {
        shot = 'drone';
        this.P(U0 + avgS - 30, 7.5, 15, cp); this.P(U0 + avgS + 9, 6, 0.5, lt); width = 26; minV = 24;
      } else if (s < 440) {
        shot = 'turn';
        cp.set(-T.A + 12, 6.5, 4); this.P(U0 + avgS + 2, 5, 1.2, lt); width = spread + 13;
      } else if (s < 548) {
        shot = 'head';
        this.P(U0 + 632, 9.5, 2.1, cp); this.P(U0 + top3S, 7, 1.3, lt); width = 21; minV = 5;
      } else if (s < 700) {
        shot = 'stretch';
        pts = sorted.filter((h, i) => i < 3 && sorted[0].s - h.s < 9);
        if (port) maxV = 74;
        if (port) { this.P(U0 + top3S + 15, -8, 2.9, cp); this.P(U0 + top3S + 0.5, 6, 1.2, lt); }
        else { this.P(U0 + top3S + 9.5, -11.5, 3.0, cp); this.P(U0 + top3S + 1.2, 6, 1.2, lt); }
      } else if (s < L - 15) {
        shot = 'close';
        const s2 = (sorted[0].s + sorted[1].s) / 2;
        pts = sorted.filter((h, i) => i < 2 || (i < 3 && sorted[0].s - h.s < 2.5));
        if (port) maxV = 74;
        if (port) { this.P(U0 + s2 + 13, -4.5, 2.6, cp); this.P(U0 + s2, 6, 1.25, lt); }
        else { this.P(U0 + s2 + 10.5, -7.5, 2.7, cp); this.P(U0 + s2 - 0.5, 6, 1.25, lt); }
        damp = 8;
      } else {
        shot = 'finish';
        cp.set(goal.x + 9, 1.35, goal.z - 2.4); lt.set(goal.x - 6, 1.3, goal.z + 6.2); width = port ? 11 : 16; maxV = 68; damp = 20;
      }
    } else {
      shot = 'winner';
      const w = this.horses.find((h) => h.ph.num === this.plan.horses[0].num);
      const d = w.ph.latAt(this.raceT);
      this.P(U0 + w.s + 10.5, d - 4.5, 1.25, cp); this.P(U0 + w.s, d, 1.75, lt); width = 7.5; minV = 14; damp = 5;
    }
    // 画角合わせ（縦持ちでも収まるように距離を調整）
    const asp = this.aspect || 1;
    let v;
    if (pts && pts.length) {
      // 映したい馬が必ず画面に収まるよう、向きと画角を合わせる
      let fx = lt.x - cp.x, fz = lt.z - cp.z; const dl = Math.hypot(fx, fz); fx /= dl; fz /= dl;
      const rx = -fz, rz = fx;
      let mn = Infinity, mx = -Infinity, near = Infinity;
      for (const h of pts) {
        const hp = h.model.root.position, ry = h.model.root.rotation.y;
        const hx = Math.cos(ry), hz = -Math.sin(ry);
        for (const o of [1.7, -1.4]) {
          const px = hp.x + hx * o - cp.x, pz = hp.z + hz * o - cp.z;
          const dep = Math.max(1, px * fx + pz * fz);
          near = Math.min(near, dep);
          const a = Math.atan2(px * rx + pz * rz, dep);
          mn = Math.min(mn, a); mx = Math.max(mx, a);
        }
      }
      const c = (mn + mx) / 2;
      let half = (mx - mn) / 2 * 1.15 + 0.05;
      const nfx = fx * Math.cos(c) + rx * Math.sin(c), nfz = fz * Math.cos(c) + rz * Math.sin(c);
      lt.x = cp.x + nfx * dl; lt.z = cp.z + nfz * dl;
      v = (2 * Math.atan(Math.tan(half) / asp) * 180) / Math.PI;
      if (v > maxV) {
        const kk = Math.min(Math.tan(half) / (asp * Math.tan((maxV * Math.PI) / 360)), 2.2);
        cp.sub(lt).multiplyScalar(kk).add(lt); if (cp.y < 1) cp.y = 1;
        v = maxV;
      }
      // 縦方向も馬体＋馬番ラベルが切れない画角を確保
      minV = Math.max(13, Math.min(maxV, (2 * Math.atan(2.5 / near) * 180) / Math.PI));
    } else {
      const D = cp.distanceTo(lt);
      v = (2 * Math.atan(Math.tan(Math.atan(width / (2 * D))) / asp) * 180) / Math.PI;
      if (v > maxV) {
        const D2 = width / (2 * asp * Math.tan((maxV * Math.PI) / 360));
        const kk = Math.min(D2 / D, 2.6);
        cp.sub(lt).multiplyScalar(kk).add(lt); if (cp.y < 1) cp.y = 1;
        v = maxV;
      }
    }
    v = clamp(v, minV, maxV);
    // 走っている馬に対する相対位置で平滑化（追従ショットが遅れて馬が切れるのを防ぐ）
    const anchor = (shot === 'winner' ? this.horses.find((h) => h.ph.num === this.plan.horses[0].num) : lead).model.root.position;
    const moving = this.state !== 'intro';
    const trackCam = shot === 'back' || shot === 'drone' || shot === 'stretch' || shot === 'close' || shot === 'winner';
    const tv = this._v;
    if (shot !== this.shot) {
      this.shot = shot; this.cpS.copy(cp); this.ltS.copy(lt); this.fovS = v;
      this.cpR.copy(cp).sub(anchor); this.ltR.copy(lt).sub(anchor);
    } else {
      const k = 1 - Math.exp(-rdt * damp);
      if (moving && trackCam) { this.cpR.lerp(tv.copy(cp).sub(anchor), k); this.cpS.copy(anchor).add(this.cpR); } else this.cpS.lerp(cp, k);
      if (moving && shot !== 'finish') { this.ltR.lerp(tv.copy(lt).sub(anchor), k); this.ltS.copy(anchor).add(this.ltR); } else this.ltS.lerp(lt, k);
      this.fovS += (v - this.fovS) * k;
    }
    this.focus.copy(this.ltS); this.focus.y = 0;
    this.camera.position.copy(this.cpS);
    // 近接ショットは手持ち風の揺れ
    if (shot === 'stretch' || shot === 'close' || shot === 'start' || shot === 'winner') {
      const a = shot === 'close' ? 0.035 : 0.02;
      this.camera.position.x += Math.sin(t * 13.1) * a; this.camera.position.y += Math.sin(t * 17.3 + 1) * a;
    }
    this.fov = this.fovS;
    this.camera.fov = this.fovS; this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.ltS);
  }

  showIntroCard(num) {
    const h = this.race.horses.find((x) => x.num === num); const f = FRAMES[num - 1];
    this.el.intro.innerHTML = `<div class="rc-card"><i style="background:${f.bg};color:${f.fg}">${num}</i><div><b>${esc(h.name)}</b><span>${h.pop}番人気・単勝 ${h.odds.toFixed(1)}倍・${STYLES[h.style].label}</span></div></div>`;
    this.el.intro.classList.add('show');
  }

  spawnDust(v, h) {
    const d = this.dust, i = d.i; d.i = (d.i + 1) % d.n;
    const head = h.model.root.rotation.y;
    const bx = -Math.cos(head), bz = Math.sin(head);
    d.pos[i * 3] = v.x; d.pos[i * 3 + 1] = 0.05; d.pos[i * 3 + 2] = v.z;
    const sp = 2 + Math.random() * 3;
    d.vel[i * 3] = bx * sp + (Math.random() - 0.5) * 2; d.vel[i * 3 + 1] = 1.8 + Math.random() * 2.8; d.vel[i * 3 + 2] = bz * sp + (Math.random() - 0.5) * 2;
    d.life[i] = 0.9;
  }
  updateDust(dt) {
    const d = this.dust;
    for (let i = 0; i < d.n; i++) {
      if (d.life[i] <= 0) continue;
      d.life[i] -= dt;
      d.vel[i * 3 + 1] -= 9.8 * dt;
      d.pos[i * 3] += d.vel[i * 3] * dt; d.pos[i * 3 + 1] += d.vel[i * 3 + 1] * dt; d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * dt;
      if (d.pos[i * 3 + 1] < 0 || d.life[i] <= 0) { d.life[i] = 0; d.pos[i * 3 + 1] = -50; }
    }
    d.pts.geometry.attributes.position.needsUpdate = true;
  }

  updateHud() {
    if (this.state === 'intro') return;
    const ranks = this.plan.ranksAt(this.raceT);
    const rowH = this.el.order.querySelector('.rc-row').offsetHeight + 3;
    ranks.forEach((h, i) => {
      const row = this.rows[h.num];
      row.style.transform = `translateY(${i * rowH}px)`;
      row.classList.toggle('lead', i === 0);
    });
    this.el.order.style.height = rowH * 7 + 'px';
    const rem = Math.max(0, 1 - this.leadS / T.L) * this.nominal;
    this.el.remain.innerHTML = this.goalShown ? '' : rem > 100 ? `残り <b>${Math.ceil(rem / 100) * 100}</b>m` : '<b>ゴール前！</b>';
  }

  drawMap() {
    const c = this.el.map, g = c.getContext('2d');
    const w = c.width, h = c.height, sc = w / 560, cx = w / 2, cy = h / 2;
    g.clearRect(0, 0, w, h);
    const X = (x) => cx + x * sc, Y = (z) => cy + z * sc;
    const A = T.A, R = T.R + T.W / 2;
    g.beginPath(); g.moveTo(X(-A), Y(R)); g.lineTo(X(A), Y(R)); g.arc(X(A), Y(0), R * sc, Math.PI / 2, -Math.PI / 2, true);
    g.lineTo(X(-A), Y(-R)); g.arc(X(-A), Y(0), R * sc, -Math.PI / 2, Math.PI / 2, true); g.closePath();
    g.lineWidth = 9; g.strokeStyle = 'rgba(40,130,50,.9)'; g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
    g.fillStyle = '#fff'; g.fillRect(X(this.track.goal.x) - 1.5, Y(T.R) - 2, 3, 14);
    const sorted = this.horses.slice().sort((a, b) => a.s - b.s);
    for (const hz of sorted) {
      const f = FRAMES[hz.ph.num - 1], p = hz.model.root.position;
      g.beginPath(); g.arc(X(p.x), Y(p.z), 5.5, 0, Math.PI * 2); g.fillStyle = f.bg; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = f.fg === '#ffffff' ? '#fff' : '#111'; g.stroke();
    }
  }

  showResult() {
    if (this.state === 'result') return;
    this.state = 'result';
    this.root.classList.add('finished');
    this.el.btns.style.display = 'none';
    this.el.caption.classList.remove('show'); this.el.banner.className = 'rc-banner';
    const pl = this.plan;
    const rows = pl.horses.map((h, i) => {
      const f = FRAMES[h.num - 1];
      const margin = i === 0 ? '' : pl.margins[i - 1];
      return `<div class="rr-row r${i + 1}"><span class="rr-rank">${i + 1}<small>着</small></span><i style="background:${f.bg};color:${f.fg}">${h.num}</i><span class="rr-name">${esc(h.name)}</span><span class="rr-mg">${margin}</span><span class="rr-pop">${h.pop}人気</span></div>`;
    }).join('');
    this.el.result.innerHTML = `<div class="rr-box"><div class="rr-head">確 定</div>${rows}<button class="btn btn-gold" data-rc="done">${this.opts.replay ? '戻る' : '払い戻しへ 💰'}</button></div>`;
    this.el.result.classList.add('show');
    AU.sfx.shot();
  }
}
