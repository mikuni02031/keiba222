// 競馬場: コース形状・芝・ラチ・スタンド・観客・ゲート・空・天候
import * as THREE from '../vendor/three.module.min.js';
import { FRAMES } from './data.js';

export const T = (() => {
  const A = 170, R = 70, W = 24;
  const STR = 2 * A, ARC = Math.PI * R, LAP = 2 * STR + 2 * ARC;
  const U0 = STR + ARC + 80;          // スタート地点
  const FIN = 290;                    // ホームストレッチ上のゴール位置
  const L = LAP + FIN - U0;           // レース距離
  return { A, R, W, STR, ARC, LAP, U0, FIN, L };
})();

// u: 内ラチ沿いの距離, d: 外側へのオフセット
export function pathAt(u, d, out) {
  const { A, R, STR, ARC, LAP } = T;
  u = ((u % LAP) + LAP) % LAP;
  let x, z, tx, tz, nx, nz;
  if (u < STR) { x = -A + u; z = R; tx = 1; tz = 0; nx = 0; nz = 1; }
  else if (u < STR + ARC) {
    const a = (u - STR) / R; const s = Math.sin(a), c = Math.cos(a);
    x = A + R * s; z = R * c; tx = c; tz = -s; nx = s; nz = c;
  } else if (u < 2 * STR + ARC) { const v = u - STR - ARC; x = A - v; z = -R; tx = -1; tz = 0; nx = 0; nz = -1; }
  else {
    const a = (u - 2 * STR - ARC) / R; const s = Math.sin(a), c = Math.cos(a);
    x = -A - R * s; z = -R * c; tx = -c; tz = s; nx = -s; nz = -c;
  }
  out.x = x + nx * d; out.z = z + nz * d; out.tx = tx; out.tz = tz; out.nx = nx; out.nz = nz;
  return out;
}
export const headingOf = (p) => Math.atan2(-p.tz, p.tx);

const ENV = {
  day: { top: '#2a78d4', hor: '#c4e4fb', sun: [0.35, 0.78, -0.5], sunCol: '#fff1d0', sunInt: 3.3, hemiSky: '#cfe6ff', hemiGnd: '#6f8a4a', hemiInt: 1.25, fog: '#c9e3f5', fogNear: 320, fogFar: 1700, exposure: 1.0, cloud: 0.95, turf: '#ffffff' },
  sunset: { top: '#2d3d7c', hor: '#ffae66', sun: [-0.78, 0.2, -0.42], sunCol: '#ffab63', sunInt: 3.6, hemiSky: '#ffc59a', hemiGnd: '#55603c', hemiInt: 0.95, fog: '#f0b287', fogNear: 220, fogFar: 1400, exposure: 1.05, cloud: 0.8, turf: '#ffe9cf' },
  night: { top: '#040817', hor: '#15244a', sun: [-0.15, 0.8, -0.55], sunCol: '#eef3ff', sunInt: 2.9, hemiSky: '#3a4c80', hemiGnd: '#1c2a1c', hemiInt: 0.7, fog: '#0b1430', fogNear: 160, fogFar: 950, exposure: 1.1, cloud: 0.12, turf: '#dfeaff', night: true },
  rain: { top: '#56616e', hor: '#a7b1ba', sun: [0.3, 0.8, -0.4], sunCol: '#dfe6ee', sunInt: 1.2, hemiSky: '#c6ced8', hemiGnd: '#4c5c40', hemiInt: 1.55, fog: '#a3adb6', fogNear: 50, fogFar: 620, exposure: 0.95, cloud: 0.0, turf: '#b9c6b2', rain: true },
};

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, colors, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = 0.25 + Math.random() * 0.4;
    g.fillRect(Math.random() * w, Math.random() * h, size * (0.5 + Math.random()), size * (0.5 + Math.random() * 2));
  }
  g.globalAlpha = 1;
}

// コースに沿った帯状メッシュ
function ribbon(d0, d1, y, uStart, uEnd, stepLen, uvU) {
  const n = Math.ceil((uEnd - uStart) / stepLen);
  const pos = [], uv = [], nor = [], idx = [];
  const p = {};
  for (let i = 0; i <= n; i++) {
    const u = uStart + ((uEnd - uStart) * i) / n;
    pathAt(u, d0, p); pos.push(p.x, y, p.z); uv.push(u / uvU, 0); nor.push(0, 1, 0);
    pathAt(u, d1, p); pos.push(p.x, y, p.z); uv.push(u / uvU, 1); nor.push(0, 1, 0);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// 縦の壁状の帯（ラチの横板など）
function wallRibbon(d, y0, y1, stepLen) {
  const n = Math.ceil(T.LAP / stepLen);
  const pos = [], nor = [], idx = [];
  const p = {};
  for (let i = 0; i <= n; i++) {
    const u = (T.LAP * i) / n;
    pathAt(u, d, p);
    pos.push(p.x, y0, p.z, p.x, y1, p.z); nor.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function buildTrack(scene, renderer, lowSpec) {
  const { A, R, W, LAP, U0, FIN } = T;
  const p = {};
  const api = { env: null };
  const world = new THREE.Group(); scene.add(world);

  // ── 空 ──
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(hor, top, pow(h, 0.55));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.35) * (1.0 - night);
        if (night > 0.5) {
          vec3 g = floor(d * 220.0);
          float st = step(0.9965, hash(g)) * smoothstep(0.05, 0.3, d.y);
          col += vec3(st) * (0.6 + 0.4 * hash(g + 1.0));
          vec3 md = normalize(vec3(-0.5, 0.45, 0.6));
          col += vec3(1.0, 0.97, 0.85) * smoothstep(0.9993, 0.9996, dot(d, md));
        }
        if (d.y < 0.0) col = mix(hor, hor * 0.8, clamp(-d.y * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  // 雲
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = 40 + Math.random() * (w - 80), y = 44 + Math.random() * 44, r = 18 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  }, false);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    const s = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = 900 + Math.random() * 900;
    s.position.set(Math.cos(a) * r, 220 + Math.random() * 330, Math.sin(a) * r);
    const sc = 380 + Math.random() * 420; s.scale.set(sc, sc * 0.42, 1);
    scene.add(s); clouds.push(s);
  }

  // ── 光 ──
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const SM = lowSpec ? 1024 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const sunDir = new THREE.Vector3(0.3, 0.8, -0.5);
  scene.fog = new THREE.Fog(0xcfe6f7, 300, 1500);

  // ── 地面 ──
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c8a34'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ['#447d2e', '#579a3c', '#3f7429', '#64a546'], 2);
  });
  grassTex.repeat.set(140, 140);
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2400, 48), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; world.add(ground);

  const turfTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3f9431'; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = '#358728'; g.fillRect(w / 2, 0, w / 2, h);
    speckle(g, w, h, 16000, ['#2f7d24', '#4aa53a', '#3a8c2c', '#55b043', '#2a7120'], 2);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(60,40,10,0.16)'); gr.addColorStop(0.12, 'rgba(60,40,10,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const turfMat = new THREE.MeshLambertMaterial({ map: turfTex });
  const turf = new THREE.Mesh(ribbon(-1.2, W + 0.8, 0, 0, LAP, 2.5, 24), turfMat);
  turf.receiveShadow = true; world.add(turf);

  const dirtTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b89668'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 6000, ['#a88658', '#c8a678', '#9c7c50', '#d0b084'], 2);
  });
  const dirt = new THREE.Mesh(ribbon(-25, -7, -0.02, 0, LAP, 4, 16), new THREE.MeshLambertMaterial({ map: dirtTex }));
  world.add(dirt);
  // スタンド前エプロン
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(2 * A + 60, 14), new THREE.MeshLambertMaterial({ color: 0x9a9da0 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.03, R + W + 8); world.add(apron);

  // ── ラチ ──
  const railMat = new THREE.MeshLambertMaterial({ color: 0xf6f6f2, side: THREE.DoubleSide });
  const addRail = (d, h, spacing) => {
    world.add(new THREE.Mesh(wallRibbon(d, h - 0.16, h, 3), railMat));
    const top = new THREE.Mesh(ribbon(d - 0.07, d + 0.07, h, 0, LAP, 3, 10), railMat); world.add(top);
    const n = Math.floor(LAP / spacing);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, h, 5), railMat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { pathAt(i * spacing, d, p); m.makeTranslation(p.x, h / 2, p.z); posts.setMatrixAt(i, m); }
    world.add(posts);
  };
  addRail(0, 1.1, 3.5); addRail(W, 1.15, 3.5); addRail(-7, 1.0, 5); addRail(-25, 1.0, 6);

  // ── ゴール ──
  pathAt(FIN, 0, p);
  const goalX = p.x, goalZ = p.z;
  const lineTex = canvasTex(8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.28, W), new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, opacity: 0.75 }));
  line.rotation.x = -Math.PI / 2; line.position.set(goalX, 0.02, goalZ + W / 2); world.add(line);
  const goalTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f5d76e'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff'; g.font = '900 78px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GOAL', w / 2, h / 2 + 4);
  }, false);
  const mkGoalPost = (z) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 10), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 }));
    post.position.y = 3.5; g.add(post);
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.7, roughness: 0.3 }));
    ring.position.y = 7.3; g.add(ring);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 2.6), [new THREE.MeshBasicMaterial({ map: goalTex }), new THREE.MeshBasicMaterial({ map: goalTex }), railMat, railMat, railMat, railMat]);
    sign.position.y = 5.6; g.add(sign);
    g.position.set(goalX, 0, z); world.add(g);
  };
  mkGoalPost(goalZ - 2.4); mkGoalPost(goalZ + W + 2.2);

  // ハロン棒
  const poleTex = canvasTex(16, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#d81e2c'; g.fillRect(0, i * 8, w, 8); } }, false);
  const poleMat = new THREE.MeshLambertMaterial({ map: poleTex });
  for (let k = 1; k <= 7; k++) {
    pathAt(U0 + T.L - k * 100, -1.4, p);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), poleMat);
    pole.position.set(p.x, 1.3, p.z); world.add(pole);
  }

  // ── スタンド ──
  const stand = new THREE.Group(); world.add(stand);
  const crowdTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
    const cols = ['#e8e8e8', '#d94848', '#3d7fd9', '#f0c53a', '#2e2e2e', '#f2f2f2', '#6fbf5f', '#f08a3c', '#b56fd1', '#ffffff', '#1d1d1d', '#e6b8a0'];
    for (let row = 0; row < 16; row++) {
      for (let i = 0; i < 150; i++) {
        const x = (i + (row % 2) * 0.5 + Math.random() * 0.3) * (w / 150), y = row * 16 + 3;
        g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y + 5, 5, 9);
        g.fillStyle = Math.random() < 0.8 ? '#e2b48f' : '#3a2a20'; g.fillRect(x + 0.5, y, 4, 4.5);
      }
    }
  });
  crowdTex.repeat.set(3, 1);
  const crowdMat = new THREE.MeshLambertMaterial({ map: crowdTex });
  const z0 = R + W + 15;
  const tier = (zA, yA, zB, yB, len) => {
    const d = Math.hypot(zB - zA, yB - yA);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, d), crowdMat);
    m.rotation.x = -Math.PI / 2 + Math.atan2(yB - yA, zB - zA);
    m.rotation.y = 0;
    m.position.set(0, (yA + yB) / 2, (zA + zB) / 2);
    // 面を -z（コース側）へ向ける
    m.rotation.set(Math.atan2(zB - zA, yB - yA), Math.PI, 0);
    stand.add(m);
  };
  const SL = 2 * A - 10;
  tier(z0, 1.2, z0 + 24, 12.5, SL);
  tier(z0 + 18, 17, z0 + 38, 28, SL);
  const conc = new THREE.MeshLambertMaterial({ color: 0xd8dade });
  const dark = new THREE.MeshLambertMaterial({ color: 0x6d737c });
  const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); stand.add(m); return m; };
  box(SL, 1.2, 1, 0, 0.6, z0 - 0.5, conc);
  box(SL, 4.5, 2, 0, 14.6, z0 + 19, dark);
  const glassTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#31475c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = Math.random() < 0.45 ? '#ffe9a8' : '#5d83a6'; g.fillRect(x * 16 + 2, y * 32 + 4, 12, 24);
    }
  });
  glassTex.repeat.set(6, 1);
  const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, emissiveMap: glassTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.0, roughness: 0.4 });
  box(SL + 6, 40, 12, 0, 20, z0 + 45, glassMat);
  const roof = box(SL + 14, 1.4, 58, 0, 41, z0 + 24, new THREE.MeshLambertMaterial({ color: 0xf2f3f5 }));
  roof.rotation.x = -0.07;
  for (let x = -SL / 2 + 10; x <= SL / 2 - 10; x += 36) box(1.2, 40, 1.2, x, 20, z0 + 37, conc);
  // 屋根の旗
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ color: [0xe0282e, 0x1b63d6, 0xf6d21a, 0x1f9d42, 0xffffff][i % 5], side: THREE.DoubleSide }));
    f.position.set(-SL / 2 + 20 + i * ((SL - 40) / 8), 46, z0 - 2); stand.add(f);
    box(0.12, 6, 0.12, f.position.x - 1.7, 44.5, z0 - 2, conc);
  }
  // 立ち見の観客（インスタンス、ゴール前で飛び跳ねる）
  const crowdU = { uTime: { value: 0 }, uExcite: { value: 0 } };
  const jumpPatch = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = crowdU.uTime; sh.uniforms.uExcite = crowdU.uExcite;
      sh.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float ph = float(gl_InstanceID) * 12.9898; transformed.y += abs(sin(uTime * (5.0 + fract(ph) * 4.0) + ph)) * uExcite * 0.28;');
    };
  };
  const NP = lowSpec ? 900 : 1700;
  const bodyGeo = new THREE.CylinderGeometry(0.19, 0.24, 1.25, 6); bodyGeo.translate(0, 0.72, 0);
  const headGeo = new THREE.SphereGeometry(0.15, 6, 5); headGeo.translate(0, 1.5, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); jumpPatch(bodyMat);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); jumpPatch(headMat);
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, NP), heads = new THREE.InstancedMesh(headGeo, headMat, NP);
  const mm = new THREE.Matrix4(), cc = new THREE.Color();
  const shirt = [0xf2f2f2, 0xd94848, 0x3d7fd9, 0xf0c53a, 0x30343c, 0x6fbf5f, 0xf08a3c, 0xb56fd1, 0xffffff, 0x222222, 0x46b3c9];
  for (let i = 0; i < NP; i++) {
    const x = -A - 10 + Math.random() * (2 * A + 20), z = R + W + 1.6 + Math.random() * Math.random() * 11;
    const s = 0.9 + Math.random() * 0.2;
    mm.makeScale(s, s, s); mm.setPosition(x, 0, z);
    bodies.setMatrixAt(i, mm); heads.setMatrixAt(i, mm);
    bodies.setColorAt(i, cc.set(shirt[(Math.random() * shirt.length) | 0]));
    heads.setColorAt(i, cc.set(Math.random() < 0.75 ? 0xe2b48f : 0x2a211c));
  }
  bodies.frustumCulled = heads.frustumCulled = false;
  world.add(bodies, heads);

  // ── 内馬場 ──
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x3f86b8, roughness: 0.15, metalness: 0.2 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(46, 20, 1); pond.position.set(-55, 0.0, -8); world.add(pond);
  // ターフビジョン
  const visionCanvas = document.createElement('canvas'); visionCanvas.width = 512; visionCanvas.height = 256;
  const visionTex = new THREE.CanvasTexture(visionCanvas); visionTex.colorSpace = THREE.SRGBColorSpace;
  const vision = new THREE.Group();
  const vFrame = new THREE.Mesh(new THREE.BoxGeometry(30, 15, 1.6), new THREE.MeshLambertMaterial({ color: 0x23272e })); vFrame.position.y = 12; vision.add(vFrame);
  const vScr = new THREE.Mesh(new THREE.PlaneGeometry(28.4, 13.6), new THREE.MeshBasicMaterial({ map: visionTex, fog: false })); vScr.position.set(0, 12, 0.82); vision.add(vScr);
  for (const x of [-10, 10]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 1.2), new THREE.MeshLambertMaterial({ color: 0x3a3f47 })); leg.position.set(x, 3, 0); vision.add(leg); }
  vision.position.set(70, 0, 18); world.add(vision);
  api.setVision = (title, sub) => {
    const g = visionCanvas.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0b3d1e'); gr.addColorStop(1, '#06200f');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f5d76e'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 246, 512, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.font = '900 54px sans-serif'; g.fillText(title, 256, 108, 480);
    g.fillStyle = '#f5d76e'; g.font = '700 34px sans-serif'; g.fillText(sub, 256, 180, 480);
    visionTex.needsUpdate = true;
  };

  // 木
  const NTR = lowSpec ? 130 : 240;
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), NTR);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 5), new THREE.MeshLambertMaterial({ color: 0x5a4030 }), NTR);
  const q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < NTR; i++) {
    let x, z;
    if (i < NTR * 0.82) {
      const u = Math.random() * LAP; const d = W + 14 + Math.random() * Math.random() * 130;
      pathAt(u, d, p); x = p.x; z = p.z;
      if (z > R + W && Math.abs(x) < A + 40) { z = -z - 20; }
    } else { x = -A + Math.random() * 2 * A; z = -30 + Math.random() * 60; if (Math.hypot((x + 55) / 50, (z + 8) / 24) < 1 || (Math.abs(x - 70) < 22 && Math.abs(z - 18) < 14)) { x = -150 + Math.random() * 40; z = 30 + Math.random() * 10; } }
    const hgt = 5 + Math.random() * 7, rad = 2.6 + Math.random() * 2.6;
    pv.set(x, hgt * 0.5, z); sv.set(1, hgt, 1); mm.compose(pv, q, sv); trunk.setMatrixAt(i, mm);
    pv.set(x, hgt + rad * 0.5, z); sv.set(rad, rad * (0.9 + Math.random() * 0.5), rad); mm.compose(pv, q, sv); canopy.setMatrixAt(i, mm);
    canopy.setColorAt(i, cc.setHSL(0.27 + Math.random() * 0.08, 0.45 + Math.random() * 0.2, 0.22 + Math.random() * 0.12));
  }
  world.add(canopy, trunk);

  // 遠景の山
  const mkHills = (rad, hMin, hMax, color) => {
    const n = 96, pos = [], idx = [];
    let hh = hMin;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      hh = Math.max(hMin, Math.min(hMax, hh + (Math.random() - 0.5) * (hMax - hMin) * 0.55));
      const h2 = i === n ? pos[1 + 3] : hh;
      pos.push(Math.cos(a) * rad, -5, Math.sin(a) * rad, Math.cos(a) * rad, h2, Math.sin(a) * rad);
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
    scene.add(m); return m;
  };
  const hills1 = mkHills(2100, 90, 260, 0x6f8fa8), hills2 = mkHills(1700, 40, 130, 0x4f7a5e);

  // ナイター照明塔
  const towers = new THREE.Group(); world.add(towers);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const towerPos = [];
  for (let i = 0; i < 10; i++) { pathAt((LAP / 10) * i + 40, i % 2 ? W + 16 : -32, p); if (p.z > R + W && Math.abs(p.x) < A) continue; towerPos.push([p.x, p.z]); }
  towerPos.forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 34, 6), dark); pole.position.set(x, 17, z); towers.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 0.8), lampMat); lamp.position.set(x, 35, z); lamp.lookAt(0, 0, 0); towers.add(lamp);
  });
  const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(220,235,255,0.35)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
  const glows = [];
  towerPos.forEach(([x, z]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, 35, z); s.scale.set(46, 46, 1); scene.add(s); glows.push(s);
  });

  // ── スターティングゲート ──
  const gate = new THREE.Group();
  pathAt(U0, 0, p); gate.position.set(p.x, 0, p.z); gate.rotation.y = headingOf(p);
  const gGreen = new THREE.MeshStandardMaterial({ color: 0x2c9a58, roughness: 0.6, metalness: 0.1 });
  const gWhite = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
  const gb = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; gate.add(m); return m; };
  const doors = [];
  const zL = (n) => 2.2 + (n - 1) * 1.7;
  for (let n = 0; n <= 7; n++) {
    const z = zL(n + 1) - 0.85;
    gb(3.9, 0.12, 0.1, -0.3, 2.2, z, gGreen); gb(3.9, 0.9, 0.08, -0.3, 1.15, z, gWhite);
    gb(0.12, 2.6, 0.12, 1.65, 1.3, z, gGreen); gb(0.12, 2.6, 0.12, -2.2, 1.3, z, gGreen);
  }
  gb(0.5, 0.5, 7 * 1.7 + 0.4, 1.65, 2.75, zL(4), gGreen);
  gb(0.3, 0.3, 7 * 1.7 + 0.4, -2.2, 2.6, zL(4), gGreen);
  for (let n = 1; n <= 7; n++) {
    const fr = FRAMES[n - 1];
    const tex = canvasTex(64, 64, (g) => { g.fillStyle = fr.bg; g.fillRect(0, 0, 64, 64); g.fillStyle = fr.fg; g.font = '900 46px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 35); }, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: tex }));
    plate.position.set(1.92, 2.75, zL(n)); plate.rotation.y = Math.PI / 2; gate.add(plate);
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(1.72, 0.98, zL(n) + s * 0.8);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.78), gWhite); door.position.z = -s * 0.39; door.castShadow = true;
      hinge.add(door); gate.add(hinge); doors.push({ hinge, s });
    }
  }
  world.add(gate);
  let gateOpen = 0, gateTarget = 0;
  api.setGate = (open, instant) => { gateTarget = open ? 1 : 0; if (instant) gateOpen = gateTarget; };

  // ── 雨 ──
  const NR = lowSpec ? 900 : 1800;
  const rainPos = new Float32Array(NR * 6);
  const rainSeed = new Float32Array(NR * 3);
  for (let i = 0; i < NR * 3; i++) rainSeed[i] = Math.random();
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.38, fog: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // ── 紙吹雪 ──
  const NC = 500;
  const confGeo = new THREE.PlaneGeometry(0.16, 0.1);
  const conf = new THREE.InstancedMesh(confGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }), NC);
  const confData = [];
  for (let i = 0; i < NC; i++) { confData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }); conf.setColorAt(i, cc.setHSL(Math.random(), 0.9, 0.6)); }
  conf.visible = false; conf.frustumCulled = false; scene.add(conf);
  let confOn = false;
  api.confetti = (center) => {
    confOn = true; conf.visible = true;
    confData.forEach((c) => {
      c.p.set(center.x + (Math.random() - 0.5) * 26, 5 + Math.random() * 12, center.z + (Math.random() - 0.5) * 26);
      c.v.set((Math.random() - 0.5) * 2, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 2);
      c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    });
  };
  api.stopConfetti = () => { confOn = false; conf.visible = false; };

  // ── 環境切り替え ──
  api.setEnv = (key) => {
    const e = ENV[key] || ENV.day; api.env = e; api.envKey = key;
    skyU.top.value.set(e.top); skyU.hor.value.set(e.hor); skyU.sunCol.value.set(e.sunCol);
    sunDir.set(e.sun[0], e.sun[1], e.sun[2]).normalize(); skyU.sunDir.value.copy(sunDir); skyU.night.value = e.night ? 1 : 0;
    sun.color.set(e.sunCol); sun.intensity = e.sunInt;
    hemi.color.set(e.hemiSky); hemi.groundColor.set(e.hemiGnd); hemi.intensity = e.hemiInt;
    scene.fog.color.set(e.fog); scene.fog.near = e.fogNear; scene.fog.far = e.fogFar;
    renderer.toneMappingExposure = e.exposure;
    clouds.forEach((c) => { c.material.opacity = e.cloud; c.visible = e.cloud > 0.01; c.material.color.set(key === 'sunset' ? 0xffc9a0 : key === 'night' ? 0x5a6a9a : 0xffffff); });
    turfMat.color.set(e.turf); groundMat.color.set(e.turf);
    const hc = new THREE.Color(e.hor);
    hills1.material.color.copy(hc).lerp(new THREE.Color(e.top), 0.35).multiplyScalar(e.night ? 0.7 : 0.92);
    hills2.material.color.copy(hc).lerp(new THREE.Color(key === 'night' ? 0x0a1420 : 0x3f6a4a), 0.5);
    towers.visible = true; lampMat.color.set(e.night ? 0xffffff : 0x8d949c);
    glows.forEach((g) => { g.visible = !!e.night; });
    glassMat.emissiveIntensity = e.night ? 0.9 : key === 'sunset' ? 0.25 : 0;
    rain.visible = !!e.rain;
    pond.material.color.set(e.night ? 0x14284a : key === 'sunset' ? 0xc98a66 : 0x3f86b8);
  };

  const _f = new THREE.Vector3();
  api.update = (dt, time, focus, camera, excite) => {
    sky.position.copy(camera.position);
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 150);
    crowdU.uTime.value = time; crowdU.uExcite.value = excite;
    gateOpen += (gateTarget - gateOpen) * (1 - Math.exp(-dt * 16));
    doors.forEach((d) => { d.hinge.rotation.y = -d.s * gateOpen * 1.75; });
    if (rain.visible) {
      const cp = camera.position;
      for (let i = 0; i < NR; i++) {
        const x = cp.x + (rainSeed[i * 3] - 0.5) * 60, z = cp.z + (rainSeed[i * 3 + 2] - 0.5) * 60;
        const y = ((rainSeed[i * 3 + 1] * 30 - time * 26) % 30 + 30) % 30 - 4 + cp.y * 0.3;
        rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
        rainPos[i * 6 + 3] = x + 0.12; rainPos[i * 6 + 4] = y - 0.9; rainPos[i * 6 + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (confOn) {
      confData.forEach((c, i) => {
        c.p.addScaledVector(c.v, dt); c.v.x += Math.sin(time * 3 + i) * dt * 2; c.r.x += c.w.x * dt; c.r.y += c.w.y * dt;
        if (c.p.y < 0.05) { c.p.y = 0.05; c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
        q.setFromEuler(c.r); sv.set(1, 1, 1); mm.compose(c.p, q, sv); conf.setMatrixAt(i, mm);
      });
      conf.instanceMatrix.needsUpdate = true;
    }
  };
  api.goal = { x: goalX, z: goalZ };
  return api;
}
