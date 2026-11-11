// プロシージャル3Dサラブレッド + 騎手。外部モデル不使用、全てコードで造形。
import * as THREE from '../vendor/three.module.min.js';

const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const TMP = new THREE.Color();
const WHITE = new THREE.Color(0xf2f0ea);

// ───────── ジオメトリ補助 ─────────
// 楕円断面のロフト。rings: {x,y,rt,rb,rz}（XY平面上の軸、rt=法線+側、rb=法線-側、rz=横幅）
function loft(rings, seg, colorFn) {
  const n = rings.length;
  const pos = [], col = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = rings[Math.max(0, i - 1)], b = rings[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    const r = rings[i];
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const sn = Math.sin(th), cz = Math.cos(th);
      const ru = sn >= 0 ? r.rt : r.rb;
      pos.push(r.x + nx * sn * ru, r.y + ny * sn * ru, cz * r.rz);
      const c = colorFn(i, sn, cz, r);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = (i + 1) * seg + j, c = (i + 1) * seg + ((j + 1) % seg), d = i * seg + ((j + 1) % seg);
      idx.push(a, b, c, a, c, d);
    }
  }
  // キャップ
  const c0 = pos.length / 3; pos.push(rings[0].x, rings[0].y, 0);
  let cc = colorFn(0, 0, 0, rings[0]); col.push(cc.r, cc.g, cc.b);
  const c1 = c0 + 1; pos.push(rings[n - 1].x, rings[n - 1].y, 0);
  cc = colorFn(n - 1, 0, 0, rings[n - 1]); col.push(cc.r, cc.g, cc.b);
  for (let j = 0; j < seg; j++) {
    idx.push(c0, (j + 1) % seg, j);
    idx.push(c1, (n - 1) * seg + j, (n - 1) * seg + ((j + 1) % seg));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const out = g.toNonIndexed();
  g.dispose();
  return out;
}
const R = (x, y, rt, rb, rz) => ({ x, y, rt, rb: rb ?? rt, rz: rz ?? rt });

function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = color.isColor ? color : TMP.set(color);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function merge(geos) {
  let total = 0;
  geos.forEach((g) => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  geos.forEach((g) => {
    pos.set(g.attributes.position.array, o);
    nor.set(g.attributes.normal.array, o);
    col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
function capsule(p0, p1, r0, r1, color, seg = 8) {
  _v0.set(p0[0], p0[1], p0[2]); _v1.set(p1[0], p1[1], p1[2]);
  const dir = _v1.clone().sub(_v0); const len = dir.length(); dir.normalize();
  _q.setFromUnitVectors(_up, dir);
  const parts = [];
  const cyl = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  _m.compose(_v0.clone().add(_v1).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
  cyl.applyMatrix4(_m); parts.push(paint(cyl, color));
  const s0 = new THREE.SphereGeometry(r0, seg, 6); s0.translate(p0[0], p0[1], p0[2]); parts.push(paint(s0, color));
  const s1 = new THREE.SphereGeometry(r1, seg, 6); s1.translate(p1[0], p1[1], p1[2]); parts.push(paint(s1, color));
  return merge(parts);
}
function ball(p, r, color, sx = 1, sy = 1, sz = 1, seg = 10) {
  const s = new THREE.SphereGeometry(r, seg, 8); s.scale(sx, sy, sz); s.translate(p[0], p[1], p[2]);
  return paint(s, color);
}

// ───────── 体型データ ─────────
const PIV = [0, 1.22];          // 胴体ピボット
const TORSO = [
  [-1.06, 1.36, 0.04, 0.04, 0.04], [-1.02, 1.33, 0.17, 0.2, 0.15], [-0.9, 1.29, 0.29, 0.31, 0.25],
  [-0.68, 1.26, 0.33, 0.34, 0.29], [-0.4, 1.26, 0.31, 0.3, 0.275], [-0.1, 1.24, 0.32, 0.33, 0.285],
  [0.22, 1.22, 0.34, 0.38, 0.295], [0.5, 1.22, 0.37, 0.4, 0.285], [0.72, 1.24, 0.36, 0.37, 0.25],
  [0.88, 1.27, 0.28, 0.3, 0.19], [0.98, 1.29, 0.16, 0.18, 0.12], [1.02, 1.3, 0.04, 0.04, 0.04],
];
function torsoAt(x) {
  for (let i = 0; i < TORSO.length - 1; i++) {
    const a = TORSO[i], b = TORSO[i + 1];
    if (x >= a[0] && x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t)];
    }
  }
  return [1.24, 0.3, 0.3, 0.28];
}
const NECK_P = [0.74, 1.4];
const NECK_LEN = 0.84;
const FRONT_P = [0.6, 1.28, 0.15];
const HIND_P = [-0.7, 1.26, 0.17];
const FL = [0.76, 0.3, 0.22];          // 前肢: 上腕〜前腕 / 管 / 繋+蹄
const HL = [0.42, 0.46, 0.34, 0.2];    // 後肢: 大腿 / 脛 / 管 / 繋+蹄
const FRONT_PAST = 18, HIND_BASE = 22, HIND_PAST = 20;
const TAIL_P = [-1.04, 1.42];
const TAIL_SEG = 0.2;

const COATS = {
  bay: { body: 0x7b4423, point: 0x17100b, mane: 0x120d0a, hoof: 0x1d1814, muzzle: 0x241811 },
  darkbay: { body: 0x40261a, point: 0x100b08, mane: 0x0c0907, hoof: 0x14110f, muzzle: 0x18100c },
  black: { body: 0x221c19, point: 0x0c0a09, mane: 0x080707, hoof: 0x0f0e0d, muzzle: 0x0e0c0b },
  chestnut: { body: 0xa9592a, point: 0x9c5127, mane: 0xbd753c, hoof: 0x2a2018, muzzle: 0x6a3a20 },
  grey: { body: 0xc3c3bf, point: 0x7c7c80, mane: 0x8f8f93, hoof: 0x2b2b2b, muzzle: 0x55555a },
  white: { body: 0xf1ede5, point: 0xe7e1d7, mane: 0xf6f3ed, hoof: 0x8a7f72, muzzle: 0xd9b7ae },
};

// ───────── ギャロップ運動学 ─────────
const SIGMA = 0.2;                                   // 接地期の割合
const OFFS = [0.0, 0.09, 0.33, 0.45];                // 後(手前でない側) / 後 / 前 / 前(手前)
function bell(q, pk) {
  return q < pk ? Math.sin((Math.PI / 2) * q / pk) ** 2 : Math.cos((Math.PI / 2) * (q - pk) / (1 - pk)) ** 2;
}
function frontAngles(psi, o) {
  if (psi < SIGMA) {
    const q = psi / SIGMA, s = Math.sin(Math.PI * q);
    o.a = lerp(31, -33, q); o.b = -3 * s; o.c = 12 + 30 * s; o.st = true;
  } else {
    const q = (psi - SIGMA) / (1 - SIGMA);
    o.a = -33 + 64 * ss(q); o.b = -118 * bell(q, 0.38); o.c = 12 - 65 * bell(q, 0.3); o.st = false;
  }
}
function hindAngles(psi, o) {
  if (psi < SIGMA) {
    const q = psi / SIGMA, s = Math.sin(Math.PI * q);
    o.a = lerp(27, -32, q); o.b = lerp(-50, -45, q) - 16 * s; o.c = lerp(38, 30, q) + 14 * s; o.d = 10 + 30 * s; o.st = true;
  } else {
    const q = (psi - SIGMA) / (1 - SIGMA), bl = bell(q, 0.4);
    o.a = -32 + 59 * ss(q); o.b = lerp(-45, -50, q) - 32 * bl; o.c = lerp(30, 38, q) + 62 * bl; o.d = 10 - 70 * bell(q, 0.3); o.st = false;
  }
}
const pitchAt = (ph) => 3.2 * Math.cos(Math.PI * 2 * (ph - 0.03));
const _fa = {}, _ha = {};
// 蹄の位置（胴体ピボット基準・ピッチ適用前）
function frontHoof(o, out) {
  const a1 = o.a * D2R, a2 = a1 + o.b * D2R, a3 = a2 + (FRONT_PAST + o.c) * D2R;
  out.x = FRONT_P[0] + FL[0] * Math.sin(a1) + FL[1] * Math.sin(a2) + FL[2] * Math.sin(a3);
  out.y = FRONT_P[1] - PIV[1] - FL[0] * Math.cos(a1) - FL[1] * Math.cos(a2) - FL[2] * Math.cos(a3);
}
function hindHoof(o, out) {
  const a1 = (HIND_BASE + o.a) * D2R, a2 = a1 + o.b * D2R, a3 = a2 + o.c * D2R, a4 = a3 + (HIND_PAST + o.d) * D2R;
  out.x = HIND_P[0] + HL[0] * Math.sin(a1) + HL[1] * Math.sin(a2) + HL[2] * Math.sin(a3) + HL[3] * Math.sin(a4);
  out.y = HIND_P[1] - PIV[1] - HL[0] * Math.cos(a1) - HL[1] * Math.cos(a2) - HL[2] * Math.cos(a3) - HL[3] * Math.cos(a4);
}
// 接地している蹄が地面ぴったりになる胴体高さテーブル
const BODY_N = 120;
const BODY_Y = (() => {
  const raw = new Array(BODY_N).fill(null);
  const hp = {};
  for (let i = 0; i < BODY_N; i++) {
    const ph = i / BODY_N, p = pitchAt(ph) * D2R;
    let need = -Infinity;
    for (let k = 0; k < 4; k++) {
      const psi = (ph - OFFS[k] + 1) % 1;
      if (k < 2) { hindAngles(psi, _ha); if (!_ha.st) continue; hindHoof(_ha, hp); }
      else { frontAngles(psi, _fa); if (!_fa.st) continue; frontHoof(_fa, hp); }
      const yw = hp.x * Math.sin(p) + hp.y * Math.cos(p);
      need = Math.max(need, -yw);
    }
    if (need > -Infinity) raw[i] = need;
  }
  // 空中期を補間（少しだけ浮く）
  const out = raw.slice();
  for (let i = 0; i < BODY_N; i++) {
    if (raw[i] !== null) continue;
    let a = i, b = i;
    while (raw[(a + BODY_N) % BODY_N] === null) a--;
    while (raw[b % BODY_N] === null) b++;
    const t = (i - a) / (b - a);
    out[i] = lerp(raw[(a + BODY_N) % BODY_N], raw[b % BODY_N], ss(t)) + 0.05 * Math.sin(Math.PI * t);
  }
  let cur = out;
  for (let pass = 0; pass < 3; pass++) {
    const nx = cur.slice();
    for (let i = 0; i < BODY_N; i++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += cur[(i + k + BODY_N) % BODY_N];
      nx[i] = s / 5;
    }
    cur = nx;
  }
  return cur;
})();
function bodyYAt(ph) {
  const f = ph * BODY_N, i = Math.floor(f) % BODY_N, t = f - Math.floor(f);
  return lerp(BODY_Y[i], BODY_Y[(i + 1) % BODY_N], t);
}

// ───────── テクスチャ ─────────
const texCache = {};
export function numberTexture(num, frame, round = false) {
  const key = num + (round ? 'r' : 's');
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (round) {
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fillStyle = frame.bg; g.fill();
    g.lineWidth = 8; g.strokeStyle = frame.fg === '#ffffff' ? '#ffffff' : '#111111'; g.stroke();
  } else {
    g.fillStyle = frame.bg; g.fillRect(0, 0, 128, 128);
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(4, 4, 120, 120);
  }
  g.fillStyle = frame.fg; g.font = '900 88px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache[key] = t;
  return t;
}

let sharedMat = null;
function coatMaterial() {
  if (!sharedMat) sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.0 });
  return sharedMat;
}

// ───────── 馬クラス ─────────
export class Horse {
  constructor({ num, coat = 'bay', frame, rng = Math.random }) {
    this.num = num;
    const C = COATS[coat] || COATS.bay;
    const body = new THREE.Color(C.body), point = new THREE.Color(C.point), mane = new THREE.Color(C.mane);
    const hoofC = new THREE.Color(C.hoof), muzzle = new THREE.Color(C.muzzle);
    const mat = coatMaterial();
    const blaze = coat !== 'white' && coat !== 'grey' && rng() < 0.45;
    const socks = [0, 1, 2, 3].map(() => coat !== 'white' && coat !== 'grey' && rng() < 0.3);
    this.stride = 6.8 * lerp(0.96, 1.04, rng());
    this.phase = rng();
    this.mirror = rng() < 0.5;
    this.gait = 0; this.drive = 0; this.t = rng() * 10;
    this.strikes = [];
    this._prevPsi = [0, 0, 0, 0];
    const mk = (geo, parent, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.position.set(x, y, z); parent.add(m); return m;
    };
    const piv = (parent, x, y, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    this.root = new THREE.Group();
    this.lean = new THREE.Group(); this.root.add(this.lean);
    this.body = piv(this.lean, 0, PIV[1]);
    const px = PIV[0], py = PIV[1];
    const shade = (c, k) => TMP.copy(c).multiplyScalar(k);

    // 胴体 + 鞍 + 騎手の下半身
    const tg = [];
    tg.push(loft(TORSO.map((r) => R(r[0] - px, r[1] - py, r[2], r[3], r[4])), 16, (i, sn) => shade(body, 0.86 + 0.14 * (sn * 0.5 + 0.5))));
    tg.push(loft([R(-0.3, 1.585 - py, 0.02, 0.02, 0.1), R(-0.24, 1.6 - py, 0.05, 0.03, 0.2), R(0.05, 1.6 - py, 0.04, 0.03, 0.22), R(0.3, 1.61 - py, 0.045, 0.03, 0.2), R(0.36, 1.6 - py, 0.02, 0.02, 0.1)], 10, () => TMP.set(0x2a1c14)));
    const silk = new THREE.Color(frame.bg), sleeve = new THREE.Color(frame.sleeve);
    const breech = new THREE.Color(0xf4f4f0), boot = new THREE.Color(0x121212), skin = new THREE.Color(0xe8b48c);
    const HX = -0.02, HY = 1.86 - py;
    for (const s of [1, -1]) {
      tg.push(capsule([HX, HY, 0.12 * s], [0.36, 1.7 - py, 0.27 * s], 0.085, 0.07, breech));
      tg.push(capsule([0.36, 1.7 - py, 0.27 * s], [0.2, 1.37 - py, 0.325 * s], 0.062, 0.05, boot));
      tg.push(capsule([0.2, 1.36 - py, 0.325 * s], [0.36, 1.35 - py, 0.33 * s], 0.045, 0.04, boot));
    }
    tg.push(ball([HX - 0.02, HY, 0], 0.15, breech, 1, 0.85, 1.05));
    this.torso = mk(merge(tg), this.body);

    // ゼッケン（胴の曲面に沿わせる）
    const clothTex = numberTexture(num, frame, false);
    const clothMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const NX = 4, NT = 6, x0 = -0.2, x1 = 0.34, t0 = -42 * D2R, t1 = 62 * D2R;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= NX; i++) {
        const x = lerp(x0, x1, i / NX); const tr = torsoAt(x);
        for (let j = 0; j <= NT; j++) {
          const th = lerp(t0, t1, j / NT); const sn = Math.sin(th), cs = Math.cos(th);
          pos.push(x - px, tr[0] - py + (sn >= 0 ? tr[1] : tr[2]) * sn * 1.03 + 0.004, s * (tr[3] * cs + 0.014));
          uv.push(s > 0 ? i / NX : 1 - i / NX, j / NT);
        }
      }
      for (let i = 0; i < NX; i++) for (let j = 0; j < NT; j++) {
        const a = i * (NT + 1) + j, b = a + NT + 1;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      if (s < 0) { const nr = g.attributes.normal; for (let k = 0; k < nr.count; k++) nr.setXYZ(k, -nr.getX(k), -nr.getY(k), -nr.getZ(k)); }
      const m = new THREE.Mesh(g, clothMat); this.body.add(m);
    }

    // 首 + たてがみ
    this.neck = piv(this.body, NECK_P[0] - px, NECK_P[1] - py);
    const ng = [];
    ng.push(loft([R(-0.2, -0.03, 0.25, 0.27, 0.17), R(0.05, 0, 0.215, 0.25, 0.155), R(0.3, 0, 0.17, 0.2, 0.125), R(0.55, 0.01, 0.14, 0.16, 0.1), R(0.76, 0.02, 0.12, 0.13, 0.086), R(0.9, 0.025, 0.1, 0.1, 0.07)], 12, (i, sn) => shade(body, 0.86 + 0.14 * (sn * 0.5 + 0.5))));
    ng.push(loft([R(-0.02, 0.2, 0.03, 0.03, 0.015), R(0.1, 0.235, 0.06, 0.04, 0.028), R(0.32, 0.19, 0.065, 0.04, 0.03), R(0.56, 0.165, 0.06, 0.04, 0.028), R(0.78, 0.15, 0.055, 0.03, 0.026), R(0.9, 0.13, 0.03, 0.02, 0.015)], 8, () => mane));
    mk(merge(ng), this.neck);

    // 頭
    this.head = piv(this.neck, NECK_LEN, 0.03);
    const hg = [];
    hg.push(loft([R(-0.11, 0, 0.09, 0.1, 0.08), R(0.02, 0, 0.115, 0.15, 0.105), R(0.16, -0.01, 0.105, 0.15, 0.1), R(0.32, -0.015, 0.085, 0.105, 0.075), R(0.46, -0.02, 0.07, 0.08, 0.062), R(0.56, -0.02, 0.063, 0.072, 0.058), R(0.62, -0.02, 0.035, 0.04, 0.035)], 12,
      (i, sn) => {
        if (blaze && sn > 0.72 && i >= 1 && i <= 5) return WHITE;
        if (i >= 5) return muzzle;
        if (i === 4) return TMP.copy(body).lerp(muzzle, 0.5);
        return shade(body, 0.88 + 0.12 * (sn * 0.5 + 0.5));
      }));
    for (const s of [1, -1]) {
      const ear = new THREE.ConeGeometry(0.036, 0.14, 6); ear.rotateZ(0.35); ear.translate(-0.06, 0.15, 0.055 * s);
      hg.push(paint(ear, body));
      hg.push(ball([0.12, 0.05, 0.097 * s], 0.022, 0x050505));
    }
    hg.push(loft([R(0.365, -0.016, 0.086, 0.103, 0.076), R(0.375, -0.016, 0.092, 0.11, 0.082), R(0.395, -0.017, 0.09, 0.107, 0.08), R(0.405, -0.017, 0.082, 0.098, 0.072)], 10, () => TMP.set(0x15100c)));
    hg.push(loft([R(-0.08, 0.1, 0.03, 0.02, 0.03), R(0.0, 0.125, 0.035, 0.02, 0.04), R(0.1, 0.11, 0.02, 0.012, 0.025)], 6, () => mane));
    mk(merge(hg), this.head);

    // 尻尾
    this.tail = [];
    let tp = piv(this.body, TAIL_P[0] - px, TAIL_P[1] - py);
    const tr = [0.05, 0.075, 0.07, 0.055, 0.04, 0.012];
    for (let k = 0; k < 5; k++) {
      const g = loft([R(0.01, 0, tr[k] * 0.7), R(0, 0, tr[k]), R(-TAIL_SEG * 0.5, 0, (tr[k] + tr[k + 1]) / 2), R(-TAIL_SEG, 0, tr[k + 1]), R(-TAIL_SEG - 0.02, 0, tr[k + 1] * 0.5)].map((r) => ({ ...r, rz: r.rt * 0.8 })), 7, () => mane);
      mk(g, tp);
      this.tail.push(tp);
      tp = piv(tp, -TAIL_SEG, 0);
    }

    // 脚
    const legCol = (i, nRings, sock) => (ii) => {
      if (ii >= nRings) return hoofC;
      return TMP.copy(body).lerp(sock ? WHITE : point, i);
    };
    const limb = (spec, colorFn) => loft(spec.map((r) => R(0, r[0], r[1], r[2] ?? r[1], r[3] ?? r[1])), 9, colorFn);
    this.legs = [];
    // 0,1 = 後肢  2,3 = 前肢 （sideは後で mirror 対応）
    const sides = this.mirror ? [1, -1, 1, -1] : [-1, 1, -1, 1];
    for (let k = 0; k < 4; k++) {
      const s = sides[k], sock = socks[k];
      const L = { hind: k < 2 };
      if (k >= 2) {
        L.p0 = piv(this.body, FRONT_P[0] - px, FRONT_P[1] - py, FRONT_P[2] * s);
        mk(limb([[0.04, 0.09, 0.1, 0.07], [0, 0.13, 0.15, 0.1], [-0.25, 0.11, 0.12, 0.085], [-0.5, 0.066, 0.07, 0.06], [-0.7, 0.05, 0.05, 0.048], [-0.76, 0.056, 0.052, 0.052]], (i) => TMP.copy(body).lerp(point, i >= 4 ? 0.9 : i === 3 ? 0.45 : 0)), L.p0);
        L.p1 = piv(L.p0, 0, -FL[0]);
        mk(limb([[0.02, 0.05], [0, 0.054], [-0.14, 0.037, 0.039, 0.033], [-0.27, 0.038, 0.04, 0.036], [-0.3, 0.044]], () => (sock ? TMP.copy(point).lerp(WHITE, 0.0) : point)), L.p1);
        L.p2 = piv(L.p1, 0, -FL[1]);
        mk(limb([[0.02, 0.04], [0, 0.044], [-0.1, 0.038], [-0.13, 0.052, 0.05, 0.05], [-0.22, 0.07, 0.058, 0.062]], (i) => (i >= 3 ? hoofC : sock ? WHITE : point)), L.p2);
      } else {
        L.p0 = piv(this.body, HIND_P[0] - px, HIND_P[1] - py, HIND_P[2] * s);
        mk(limb([[0.06, 0.12, 0.14, 0.09], [0, 0.19, 0.21, 0.13], [-0.2, 0.15, 0.16, 0.11], [-0.42, 0.088, 0.09, 0.07]], () => body), L.p0);
        L.p1 = piv(L.p0, 0, -HL[0]);
        mk(limb([[0.03, 0.08], [0, 0.092, 0.088, 0.072], [-0.23, 0.066, 0.06, 0.052], [-0.42, 0.048, 0.048, 0.044], [-0.46, 0.054, 0.056, 0.048]], (i) => TMP.copy(body).lerp(point, i >= 3 ? 0.9 : i === 2 ? 0.4 : 0)), L.p1);
        L.p2 = piv(L.p1, 0, -HL[1]);
        mk(limb([[0.02, 0.05], [0, 0.054], [-0.17, 0.038, 0.04, 0.034], [-0.31, 0.04, 0.042, 0.037], [-0.34, 0.046]], () => point), L.p2);
        L.p3 = piv(L.p2, 0, -HL[2]);
        mk(limb([[0.02, 0.04], [0, 0.044], [-0.09, 0.038], [-0.12, 0.052, 0.05, 0.05], [-0.2, 0.07, 0.058, 0.062]], (i) => (i >= 3 ? hoofC : sock ? WHITE : point)), L.p3);
      }
      L.side = s;
      this.legs.push(L);
    }

    // 騎手の上半身
    this.jock = piv(this.body, HX, HY);
    const jg = [];
    jg.push(capsule([0, 0, 0], [0.5, 0.14, 0], 0.15, 0.17, silk, 10));
    const cap = new THREE.Color(frame.bg);
    jg.push(ball([0.655, 0.275, 0], 0.115, cap, 1.08, 1, 1));
    jg.push(ball([0.7, 0.225, 0], 0.088, skin));
    jg.push(ball([0.745, 0.25, 0], 0.07, 0x101418, 0.5, 0.42, 1.15));
    const peak = new THREE.BoxGeometry(0.1, 0.012, 0.16); peak.rotateZ(-0.25); peak.translate(0.775, 0.285, 0);
    jg.push(paint(peak, cap));
    for (const s of [1, -1]) {
      jg.push(capsule([0.48, 0.1, 0.17 * s], [0.56, -0.15, 0.22 * s], 0.065, 0.055, sleeve));
      jg.push(capsule([0.56, -0.15, 0.22 * s], [0.84, -0.2, 0.1 * s], 0.055, 0.045, sleeve));
      jg.push(ball([0.87, -0.205, 0.1 * s], 0.05, 0xf4f4f0));
    }
    jg.push(capsule([0.87, -0.2, 0.1], [0.55, -0.42, 0.3], 0.012, 0.008, 0x111111, 5));
    this.jockMesh = mk(merge(jg), this.jock);

    this._h = { x: 0, y: 0 };
    this.setPose(0);
  }

  // speed[m/s], drive 0..1（追い出しの激しさ）
  update(dt, speed, drive = 0) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 5);
    this.gait += (Math.min(1, speed / 9) - this.gait) * k;
    this.drive += (drive - this.drive) * (1 - Math.exp(-dt * 3));
    const prev = this.phase;
    this.phase = (this.phase + (speed * dt) / this.stride) % 1;
    this.strikes.length = 0;
    if (this.gait > 0.5) {
      for (let i = 0; i < 4; i++) {
        const a = (prev - OFFS[i] + 1) % 1, b = (this.phase - OFFS[i] + 1) % 1;
        if (b < a) this.strikes.push(i);
      }
    }
    this.setPose(dt);
  }

  // 接地した蹄のワールド座標
  hoofWorld(i, out) {
    const L = this.legs[i];
    const psi = (this.phase - OFFS[i] + 1) % 1;
    if (L.hind) { hindAngles(psi, _ha); hindHoof(_ha, this._h); } else { frontAngles(psi, _fa); frontHoof(_fa, this._h); }
    out.set(this._h.x, 0.02, (L.hind ? HIND_P[2] : FRONT_P[2]) * L.side);
    return this.root.localToWorld(out);
  }

  setPose() {
    const e = this.gait, ph = this.phase, t = this.t, dr = this.drive;
    const two = Math.PI * 2;
    // 胴体
    const idle = 1 - e;
    this.body.position.y = lerp(PIV[1] + 0.006 * Math.sin(t * 1.7), bodyYAt(ph), e);
    this.body.rotation.z = pitchAt(ph) * D2R * e;
    // 首・頭
    const nod = Math.cos(two * (ph - 0.5));
    const neckG = 38 - dr * 5 - (4.5 + dr * 3) * nod;
    const neckS = 58 + 3 * Math.sin(t * 0.9) + 2 * Math.sin(t * 2.3);
    this.neck.rotation.z = lerp(neckS, neckG, e) * D2R;
    const headG = -70 + dr * 3 + 4 * nod;
    const headS = -96 + 4 * Math.sin(t * 1.3 + 1);
    this.head.rotation.z = lerp(headS, headG, e) * D2R;
    // 尻尾
    for (let k = 0; k < 5; k++) {
      const g = (k === 0 ? 16 : 7) + 9 * Math.sin(two * ph * 1 - k * 0.9 + 1) + 3 * Math.sin(t * 5 - k);
      const s = (k === 0 ? 62 : 6) + (k > 0 ? 6 * Math.sin(t * 1.4 - k * 0.6) : 0);
      this.tail[k].rotation.z = lerp(s, g, e) * D2R;
      this.tail[k].rotation.y = idle * 0.12 * Math.sin(t * 1.4 - k * 0.5);
    }
    // 脚
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      const psi = (ph - OFFS[i] + 1) % 1;
      if (L.hind) {
        hindAngles(psi, _ha);
        L.p0.rotation.z = (HIND_BASE + _ha.a * e) * D2R;
        L.p1.rotation.z = lerp(-62, _ha.b, e) * D2R;
        L.p2.rotation.z = lerp(48, _ha.c, e) * D2R;
        L.p3.rotation.z = (HIND_PAST + _ha.d * e) * D2R;
      } else {
        frontAngles(psi, _fa);
        L.p0.rotation.z = _fa.a * e * D2R;
        L.p1.rotation.z = _fa.b * e * D2R;
        L.p2.rotation.z = (FRONT_PAST + _fa.c * e) * D2R;
      }
    }
    // 騎手
    const pump = Math.sin(two * (ph - 0.35));
    this.jock.rotation.z = (-2 + (3 + dr * 7) * pump) * D2R * e;
    this.jock.position.x = -0.02 + (0.015 + dr * 0.05) * pump * e;
    this.jock.position.y = 1.86 - PIV[1] + (0.02 + dr * 0.02) * Math.cos(two * (ph - 0.2)) * e;
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== sharedMat) o.material.dispose(); } });
  }
}
