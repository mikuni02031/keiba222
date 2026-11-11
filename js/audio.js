// 効果音は全て WebAudio で合成（音声ファイル不要）+ 実況の読み上げ
let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('keibaParty.muted') === '1'; } catch (e) { /* ignore */ }
let voiceOn = true;
try { voiceOn = localStorage.getItem('keibaParty.voice') !== '0'; } catch (e) { /* ignore */ }

export const isMuted = () => muted;
export const isVoiceOn = () => voiceOn;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('keibaParty.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.9;
  if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
}
export function setVoice(v) {
  voiceOn = v;
  try { localStorage.setItem('keibaParty.voice', v ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!v && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* 音が出なくてもゲームは続行 */ }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.2, slideTo = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, freq, q, vol, type = 'bandpass') {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}
function brass(freq, t0, dur, vol = 0.12) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(500, t0); f.frequency.linearRampToValueAtTime(3200, t0 + 0.06); f.frequency.linearRampToValueAtTime(1500, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.03);
  g.gain.setValueAtTime(vol, t0 + Math.max(0.04, dur - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  for (const det of [-6, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
    o.connect(f); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  f.connect(g); g.connect(master);
}

const N = { G3: 196, C4: 261.6, E4: 329.6, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, C6: 1046.5 };

export const sfx = {
  click() { if (!ctx) return; tone(880, ctx.currentTime, 0.06, 'triangle', 0.12); },
  select() { if (!ctx) return; tone(660, ctx.currentTime, 0.05, 'triangle', 0.12); tone(990, ctx.currentTime + 0.05, 0.07, 'triangle', 0.12); },
  error() { if (!ctx) return; tone(180, ctx.currentTime, 0.18, 'square', 0.08); },
  coin(n = 1) { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < n; i++) { tone(1568, t + i * 0.07, 0.08, 'square', 0.06); tone(2093, t + i * 0.07 + 0.04, 0.16, 'square', 0.06); } },
  lose() { if (!ctx) return; const t = ctx.currentTime; tone(330, t, 0.25, 'sawtooth', 0.07, 220); tone(220, t + 0.22, 0.4, 'sawtooth', 0.07, 130); },
  win() {
    if (!ctx) return; const t = ctx.currentTime;
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => brass(f, t + i * 0.11, i === 3 ? 0.6 : 0.12, 0.1));
  },
  // オリジナルのファンファーレ
  fanfare() {
    if (!ctx) return 0; const t = ctx.currentTime + 0.05, u = 0.2;
    const mel = [[N.G4, 0, 1], [N.G4, 1, 1], [N.G4, 2, 1], [N.C5, 3, 2], [N.E5, 5, 2], [N.G5, 7, 3], [N.E5, 10, 1], [N.G5, 11, 4],
      [N.A5, 16, 1], [N.A5, 17, 1], [N.A5, 18, 1], [N.G5, 19, 2], [N.E5, 21, 2], [N.D5, 23, 1], [N.E5, 24, 1], [N.F5, 25, 1], [N.G5, 26, 2], [N.C6, 28, 7]];
    const har = [[N.E4, 0, 3], [N.G4, 3, 2], [N.C5, 5, 2], [N.E5, 7, 3], [N.C5, 10, 1], [N.E5, 11, 4], [N.F5, 16, 3], [N.E5, 19, 2], [N.C5, 21, 2], [N.B4, 23, 3], [N.D5, 26, 2], [N.E5, 28, 7]];
    mel.forEach(([f, b, l]) => brass(f, t + b * u, l * u * 0.92, 0.11));
    har.forEach(([f, b, l]) => brass(f, t + b * u, l * u * 0.92, 0.06));
    [[N.C4, 0], [N.C4, 3], [N.C4, 7], [N.C4, 11], [N.C4 * 4 / 3, 16], [N.C4, 21], [N.G3, 23], [N.C4, 28]].forEach(([f, b]) => {
      tone(f / 2, t + b * u, 0.5, 'sine', 0.3, f / 2.2); noise(t + b * u, 0.25, 90, 0.8, 0.25, 'lowpass');
    });
    return 35 * u;
  },
  gate() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.25, 1800, 0.7, 0.5); noise(t, 0.4, 140, 0.8, 0.7, 'lowpass');
    tone(520, t, 0.12, 'square', 0.12); tone(783, t + 0.01, 0.1, 'square', 0.08);
    for (let i = 0; i < 6; i++) tone(2400, t + 0.02 + i * 0.045, 0.04, 'square', 0.05);
  },
  hoof(vol = 0.3) {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.07, 150 + Math.random() * 90, 1.2, vol, 'lowpass');
    noise(t, 0.03, 1400 + Math.random() * 600, 2, vol * 0.25);
  },
  goal() {
    if (!ctx) return; const t = ctx.currentTime;
    [N.C5, N.E5, N.G5].forEach((f) => brass(f, t, 0.9, 0.09));
    brass(N.C6, t + 0.15, 1.1, 0.1);
    tone(2093, t, 1.2, 'sine', 0.12); tone(3136, t + 0.02, 0.9, 'sine', 0.06);
  },
  drumroll(dur = 1.6) {
    if (!ctx) return; const t = ctx.currentTime;
    for (let x = 0; x < dur; x += 0.045) noise(t + x, 0.05, 240, 1.5, 0.12 + 0.2 * (x / dur), 'bandpass');
    noise(t + dur, 0.5, 5000, 0.5, 0.3, 'highpass'); tone(110, t + dur, 0.5, 'sine', 0.4, 60);
  },
  shot() { if (!ctx) return; const t = ctx.currentTime; tone(1318, t, 0.1, 'sine', 0.15); tone(1760, t + 0.08, 0.25, 'sine', 0.15); noise(t, 0.1, 3000, 1, 0.08); },
};

// 持続音（蹄の地鳴り・歓声）
let amb = null;
export function startAmbience() {
  if (!ctx || amb) return;
  const mk = (type, freq, q) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start(0, Math.random());
    return { s, f, g };
  };
  amb = { rumble: mk('lowpass', 110, 0.7), crowd: mk('bandpass', 850, 0.5), crowdHi: mk('bandpass', 2600, 0.6) };
}
export function setAmbience(rumble, crowd) {
  if (!amb) return;
  const t = ctx.currentTime;
  amb.rumble.g.gain.setTargetAtTime(rumble * 0.9, t, 0.15);
  const wob = 1 + 0.12 * Math.sin(t * 2.1) + 0.08 * Math.sin(t * 5.3);
  amb.crowd.g.gain.setTargetAtTime(crowd * 0.5 * wob, t, 0.2);
  amb.crowdHi.g.gain.setTargetAtTime(crowd * crowd * 0.22 * wob, t, 0.2);
  amb.crowd.f.frequency.setTargetAtTime(750 + crowd * 500, t, 0.3);
}
export function stopAmbience() {
  if (!amb) return;
  const a = amb; amb = null;
  const t = ctx.currentTime;
  Object.values(a).forEach((n) => { n.g.gain.setTargetAtTime(0, t, 0.3); try { n.s.stop(t + 1.5); } catch (e) { /* ignore */ } });
}

// 実況読み上げ
let jaVoice = null, curPri = 0;
function findVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  jaVoice = vs.find((v) => /ja[-_]JP/i.test(v.lang) && /Google|Kyoko|O-ren|Otoya|Nanami|Keita/i.test(v.name)) || vs.find((v) => /^ja/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { findVoice(); speechSynthesis.onvoiceschanged = findVoice; }
export function primeVoice() {
  if (!('speechSynthesis' in window) || !voiceOn || muted) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'ja-JP'; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
export function say(text, pri = 1) {
  if (!('speechSynthesis' in window) || !voiceOn || muted) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      if (pri < 3 && pri <= curPri) return;
      speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text.replace(/！/g, '、').replace(/、$/, ''));
    u.lang = 'ja-JP'; if (jaVoice) u.voice = jaVoice;
    u.rate = 1.45; u.pitch = 1.15; u.volume = 1;
    curPri = pri; u.onend = () => { curPri = 0; };
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
export function hush() { if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } }
