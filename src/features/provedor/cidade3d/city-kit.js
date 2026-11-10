/**
 * city-kit.js — kit para desenhar cidades/bairros/obras em <canvas> com Three.js (WebGL)
 * + texturas procedurais pintadas com Canvas 2D.
 *
 * Técnicas portadas da análise do foundercity.com.br:
 *  - 1 único <canvas> WebGL; Canvas 2D só gera texturas (nenhuma imagem baixada)
 *  - fachadas pintadas em 3 canvases (cor / emissivo = janelas acesas / rugosidade+metal)
 *  - RNG com semente: a mesma cidade sempre se repete
 *  - InstancedMesh + cor por instância para árvores, carros, postes, entorno
 *  - presets de qualidade (alta / media / baixa) e ciclo dia / entardecer / noite
 *
 * Escala: 1 unidade = 1 metro.  Frente de todo prédio = face +Z.
 * Requer import map com "three" e "three/addons/" (ver templates).
 */
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE, mergeGeometries, RoundedBoxGeometry };

/* ============================================================
 * 1. ALEATORIEDADE DETERMINÍSTICA
 * ============================================================ */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const range = (r, a, b) => a + r() * (b - a);
export const irange = (r, a, b) => Math.floor(a + r() * (b - a + 1));
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function weighted(r, pairs) {
  let x = r() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) if ((x -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const ease = {
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
};

/* ============================================================
 * 2. QUALIDADE
 * ============================================================ */
export const QUALITY = {
  alta:  { dpr: 1.75, shadows: true,  shadowMap: 4096, bloom: true,  msaa: true,  trees: 1,   treeDetail: 2, treeShadows: true,  cars: 1,   carShadows: true,  surroundings: 700, lampPools: true,  fpsCap: 0 },
  media: { dpr: 1.5,  shadows: true,  shadowMap: 2048, bloom: false, msaa: true,  trees: .75, treeDetail: 1, treeShadows: true,  cars: .6,  carShadows: false, surroundings: 520, lampPools: true,  fpsCap: 0 },
  baixa: { dpr: 1.25, shadows: false, shadowMap: 1024, bloom: false, msaa: false, trees: .5,  treeDetail: 0, treeShadows: false, cars: .35, carShadows: false, surroundings: 360, lampPools: false, fpsCap: 30 },
};
export function detectQuality() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return 'baixa';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render|softpipe/i.test(name)) return 'baixa';
  } catch { return 'baixa'; }
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
  return mobile ? 'media' : 'alta';
}

/* ============================================================
 * 3. TEXTURAS PROCEDURAIS (Canvas 2D)
 * ============================================================ */
const TEX = new Map();
export function canvasTexture(key, w, h, draw, { srgb = true, repeat = true } = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h, rng(hashStr(key)));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
export function noiseTexture(key, base, amount = 0.2, size = 256, extra) {
  return canvasTexture('noise:' + key, size, size, (g, w, h, r) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h * 0.18; i++) {
      const v = Math.floor((r() - 0.5) * 255 * amount);
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2));
    }
    extra?.(g, w, h, r);
  });
}
const gridLines = (step, a) => (g, w, h) => {
  g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 1;
  for (let x = 0; x <= w; x += step) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
  for (let y = 0; y <= h; y += step) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); }
};
export const TEXTURES = {
  asphalt: () => noiseTexture('asphalt', '#4a4f57', 0.22),
  concrete: () => noiseTexture('concrete', '#d9d5cd', 0.12),
  roof: () => noiseTexture('roof', '#b7b3ab', 0.18),
  paving: () => noiseTexture('paving', '#d6d1c7', 0.1, 256, gridLines(32, 0.12)),
  gravel: () => noiseTexture('gravel', '#b4b1aa', 0.35),
  dirt: () => noiseTexture('dirt', '#9c7c58', 0.3),
  grass: () => noiseTexture('grass', '#7a9a5a', 0.3, 256, (g, w, h, r) => {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '60,90,45' : '140,160,90'},0.12)`;
      g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 26, 0, Math.PI * 2); g.fill();
    }
  }),
  wood: () => noiseTexture('wood', '#a87850', 0.15, 128, (g, w, h, r) => {
    for (let y = 0; y < h; y += 8) { g.fillStyle = `rgba(60,35,20,${0.15 + r() * 0.2})`; g.fillRect(0, y, w, 1); }
  }),
  water: () => noiseTexture('water', '#3d8fb8', 0.12, 256, (g, w, h, r) => {
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
    for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4, x + 16, y); g.stroke(); }
  }),
  solar: () => canvasTexture('solar', 128, 128, (g) => {
    g.fillStyle = '#c9d0d8'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) {
      const gr = g.createLinearGradient(x, y, x + 16, y + 16);
      gr.addColorStop(0, '#2a3f66'); gr.addColorStop(1, '#16233d');
      g.fillStyle = gr; g.fillRect(x + 1, y + 1, 14, 14);
    }
  }),
  /** treliça amarela com X (andaime / guindaste) — usar com alphaTest */
  lattice: (color = '#f0b43c') => canvasTexture('lattice:' + color, 64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.strokeStyle = color;
    g.lineWidth = 5; g.strokeRect(2.5, 2.5, 59, 59);
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, 4); g.lineTo(60, 60); g.moveTo(60, 4); g.lineTo(4, 60); g.stroke();
  }),
  stripes: (a, b, n = 6) => canvasTexture(`stripes:${a}:${b}:${n}`, 64, 64, (g) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, (i * 64) / n, 64, 64 / n + 1); }
  }),
  radial: (inner = 'rgba(255,226,170,1)', outer = 'rgba(255,226,170,0)') => canvasTexture(`radial:${inner}:${outer}`, 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { repeat: false }),
};

/* ============================================================
 * 4. FACHADAS (cor + emissivo + rugosidade/metal)
 * ============================================================ */
export const FACADES = {};
const FPX = 64; // pixels por andar na textura
const LIT_COLORS = ['#ffd59a', '#ffcf8a', '#ffe2b8', '#fff0d6', '#ffd9a8', '#f6e7ff', '#e4eeff'];

export const paint = {
  shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
  },
  jitter(hex, r, a = 0.07) { return paint.shade(hex, 1 - a + r() * a * 2); },
  vgrad(g, x, y, w, h, c1, c2, r) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, r ? paint.jitter(c1, r, 0.08) : c1);
    gr.addColorStop(1, r ? paint.jitter(c2, r, 0.08) : c2);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  },
  /** canal G = rugosidade, canal B = metal (padrão glTF, lido por roughnessMap/metalnessMap) */
  rm(m, rough, metal, x, y, w, h) {
    m.fillStyle = `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`; m.fillRect(x, y, w, h);
  },
  /** janela acesa no mapa emissivo (só pinta se a célula estiver acesa) */
  window(e, cell, x, y, w, h, r) {
    if (!cell.lit) return;
    const gr = e.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, cell.litColor); gr.addColorStop(1, paint.shade(cell.litColor, 0.55));
    e.globalAlpha = cell.k * (0.85 + r() * 0.15); e.fillStyle = gr; e.fillRect(x, y, w, h);
    if (r() < 0.25) { e.globalAlpha = 1; e.fillStyle = '#000'; e.fillRect(x, y, w, h * (0.2 + r() * 0.4)); } // persiana
    e.globalAlpha = 1;
  },
};

/**
 * Registra um estilo de fachada.
 * spec: { cellW (m), floorH (m), cols, rows, lit (0..1), glow (fator noturno), paint({c,e,m,r}, cell) }
 * cell: { x, y, w, h, col, row, lit, litColor, k, ground (true no térreo) }
 */
export function defineFacade(key, spec) {
  FACADES[key] = { key, cellW: 1.8, floorH: 3.2, cols: 8, rows: 16, lit: 0.5, glow: 1, ...spec };
}

const FT = new Map();
export function facadeTextures(key) {
  if (FT.has(key)) return FT.get(key);
  const s = FACADES[key] || FACADES.officeWhite;
  const cw = Math.round((FPX * s.cellW) / s.floorH), ch = FPX, W = cw * s.cols, H = ch * s.rows;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cc = mk(), ec = mk(), mc = mk();
  const c = cc.getContext('2d'), e = ec.getContext('2d'), m = mc.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  m.fillStyle = 'rgb(0,230,0)'; m.fillRect(0, 0, W, H);
  const r = rng(hashStr(key) ^ 0x9e3779b9);
  const run = { left: 0, on: false, color: LIT_COLORS[0], k: 1 };
  for (let row = 0; row < s.rows; row++) {
    run.left = 0;
    const bias = r() < 0.18 ? -0.35 : r() < 0.15 ? 0.3 : 0; // andares mais/menos ocupados
    for (let col = 0; col < s.cols; col++) {
      if (run.left <= 0) { // janelas acendem em "sequências", não pixel a pixel
        run.on = r() < clamp(s.lit + bias);
        run.left = 1 + Math.floor(r() * (run.on ? 5 : 4));
        run.color = pick(r, LIT_COLORS); run.k = 0.5 + r() * 0.5;
      }
      run.left--;
      s.paint({ c, e, m, r }, { x: col * cw, y: row * ch, w: cw, h: ch, col, row, lit: run.on, litColor: run.color, k: run.k, ground: row === s.rows - 1 });
    }
  }
  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const out = { map: tex(cc, true), emissiveMap: tex(ec, true), rmMap: tex(mc, false), spec: s };
  FT.set(key, out);
  return out;
}

/* ---------- estilos de fachada prontos ---------- */
defineFacade('glassBlue', { cellW: 1.6, floorH: 3.4, cols: 12, rows: 24, lit: 0.5, paint({ c, e, m, r }, q) {
  const sp = Math.round(q.h * 0.2);
  paint.vgrad(c, q.x, q.y, q.w, q.h - sp, '#5a7d99', '#2f4b63', r);
  c.fillStyle = '#26323d'; c.fillRect(q.x, q.y + q.h - sp, q.w, sp);
  c.fillStyle = '#8fa0ae'; c.fillRect(q.x, q.y + q.h - sp, q.w, 1);
  c.fillStyle = '#b9c5cf'; c.fillRect(q.x, q.y, 2, q.h);
  paint.rm(m, 0.08, 0.6, q.x, q.y, q.w, q.h - sp); paint.rm(m, 0.45, 0.4, q.x, q.y + q.h - sp, q.w, sp); paint.rm(m, 0.5, 0.3, q.x, q.y, 2, q.h);
  paint.window(e, q, q.x + 2, q.y + 1, q.w - 2, q.h - sp - 1, r);
} });
defineFacade('glassSilver', { cellW: 1.8, floorH: 3.4, cols: 12, rows: 24, lit: 0.45, paint({ c, e, m, r }, q) {
  const sp = Math.round(q.h * 0.14);
  paint.vgrad(c, q.x, q.y, q.w, q.h - sp, '#a9bec8', '#7593a3', r);
  c.fillStyle = '#d7dde0'; c.fillRect(q.x, q.y + q.h - sp, q.w, sp);
  c.fillStyle = '#eef1f2'; c.fillRect(q.x, q.y, 2, q.h);
  paint.rm(m, 0.07, 0.7, q.x, q.y, q.w, q.h - sp); paint.rm(m, 0.35, 0.5, q.x, q.y + q.h - sp, q.w, sp);
  paint.window(e, q, q.x + 2, q.y, q.w - 2, q.h - sp, r);
} });
defineFacade('glassDark', { cellW: 1.6, floorH: 3.4, cols: 12, rows: 24, lit: 0.32, paint({ c, e, m, r }, q) {
  const sp = Math.round(q.h * 0.16);
  paint.vgrad(c, q.x, q.y, q.w, q.h - sp, '#33414f', '#1a232d', r);
  c.fillStyle = '#1a2129'; c.fillRect(q.x, q.y + q.h - sp, q.w, sp);
  c.fillStyle = '#56616d'; c.fillRect(q.x, q.y, 1, q.h); c.fillRect(q.x, q.y + q.h - sp, q.w, 1);
  paint.rm(m, 0.06, 0.65, q.x, q.y, q.w, q.h);
  paint.window(e, q, q.x + 1, q.y, q.w - 1, q.h - sp, r);
} });
defineFacade('officeWhite', { cellW: 2.4, floorH: 3.2, cols: 10, rows: 24, lit: 0.5, glow: 0.9, paint({ c, e, m, r }, q) {
  const band = Math.round(q.h * 0.36);
  c.fillStyle = '#ece9e3'; c.fillRect(q.x, q.y + q.h - band, q.w, band);
  c.fillStyle = '#c9c5bd'; c.fillRect(q.x, q.y + q.h - band, q.w, 2);
  paint.vgrad(c, q.x, q.y, q.w, q.h - band, '#3c4d5c', '#24313d', r);
  c.fillStyle = '#d9dde0'; c.fillRect(q.x, q.y, 2, q.h - band);
  paint.rm(m, 0.85, 0, q.x, q.y + q.h - band, q.w, band); paint.rm(m, 0.1, 0.5, q.x, q.y, q.w, q.h - band);
  paint.window(e, q, q.x + 2, q.y, q.w - 2, q.h - band, r);
} });
defineFacade('officeWarm', { cellW: 3.2, floorH: 3.3, cols: 8, rows: 24, lit: 0.5, paint({ c, e, m, r }, q) {
  c.fillStyle = paint.jitter('#dbc9ae', r, 0.03); c.fillRect(q.x, q.y, q.w, q.h);
  paint.rm(m, 0.9, 0, q.x, q.y, q.w, q.h);
  const ww = Math.round(q.w * 0.64), wh = Math.round(q.h * 0.58), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.12);
  c.fillStyle = '#a8977c'; c.fillRect(wx - 1, wy - 1, ww + 2, wh + 3);
  paint.vgrad(c, wx, wy, ww, wh, '#41505c', '#2a3540', r);
  c.fillStyle = '#e8dcc6'; c.fillRect(wx - 1, wy + wh, ww + 2, 2);
  paint.rm(m, 0.1, 0.45, wx, wy, ww, wh);
  paint.window(e, q, wx, wy, ww, wh, r);
} });
defineFacade('brick', { cellW: 3.6, floorH: 3.4, cols: 6, rows: 16, lit: 0.55, paint({ c, e, m, r }, q) {
  c.fillStyle = '#c4b3a2'; c.fillRect(q.x, q.y, q.w, q.h);
  for (let y = 0; y < q.h; y += 5) {
    const o = (y / 5) % 2 ? 6 : 0;
    for (let x = -o; x < q.w; x += 12) { c.fillStyle = paint.jitter(r() < 0.5 ? '#9a4a36' : '#8b4030', r, 0.1); c.fillRect(q.x + Math.max(0, x), q.y + y, Math.min(11, q.w - Math.max(0, x)), 4); }
  }
  paint.rm(m, 0.92, 0, q.x, q.y, q.w, q.h);
  const ww = Math.round(q.w * 0.62), wh = Math.round(q.h * 0.6), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.16);
  c.fillStyle = '#bdb4a8'; c.fillRect(wx - 2, wy - 4, ww + 4, 4);
  c.fillStyle = '#1d2125'; c.fillRect(wx, wy, ww, wh);
  paint.vgrad(c, wx + 2, wy + 2, ww - 4, wh - 4, '#3b4954', '#27313a', r);
  paint.rm(m, 0.15, 0.3, wx, wy, ww, wh);
  paint.window(e, q, wx + 2, wy + 2, ww - 4, wh - 4, r);
} });
/** residencial claro — aceita tint (material.color) */
defineFacade('residential', { cellW: 3.0, floorH: 2.9, cols: 8, rows: 20, lit: 0.45, paint({ c, e, m, r }, q) {
  c.fillStyle = paint.jitter('#f3f0ea', r, 0.02); c.fillRect(q.x, q.y, q.w, q.h);
  paint.rm(m, 0.92, 0, q.x, q.y, q.w, q.h);
  const ww = Math.round(q.w * 0.56), wh = Math.round(q.h * 0.5), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.2);
  c.fillStyle = '#cfcac0'; c.fillRect(wx - 2, wy + wh, ww + 4, 3);
  paint.vgrad(c, wx, wy, ww, wh, '#56697a', '#33424f', r);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(wx + ww / 2 - 1, wy, 2, wh);
  paint.rm(m, 0.12, 0.35, wx, wy, ww, wh);
  paint.window(e, q, wx, wy, ww, wh, r);
} });
/** casa — janela com moldura; porta é malha separada */
defineFacade('house', { cellW: 3.2, floorH: 2.8, cols: 6, rows: 4, lit: 0.6, paint({ c, e, m, r }, q) {
  c.fillStyle = '#f6f2ea'; c.fillRect(q.x, q.y, q.w, q.h);
  paint.rm(m, 0.95, 0, q.x, q.y, q.w, q.h);
  if (q.col % 2) return; // parede cega intercalada
  const ww = Math.round(q.w * 0.5), wh = Math.round(q.h * 0.42), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.22);
  c.fillStyle = '#ffffff'; c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  paint.vgrad(c, wx, wy, ww, wh, '#4f6475', '#2f3d49', r);
  c.fillStyle = '#ffffff'; c.fillRect(wx + ww / 2 - 1, wy, 2, wh); c.fillRect(wx, wy + wh / 2 - 1, ww, 2);
  paint.rm(m, 0.1, 0.3, wx, wy, ww, wh);
  paint.window(e, q, wx, wy, ww, wh, r);
} });
/** loja — térreo com vitrine, andares com janelas */
defineFacade('shop', { cellW: 3.0, floorH: 3.4, cols: 6, rows: 6, lit: 0.6, paint({ c, e, m, r }, q) {
  c.fillStyle = '#ebe5da'; c.fillRect(q.x, q.y, q.w, q.h);
  paint.rm(m, 0.9, 0, q.x, q.y, q.w, q.h);
  if (q.ground) {
    const vh = Math.round(q.h * 0.72);
    c.fillStyle = '#2b3036'; c.fillRect(q.x, q.y + q.h - vh, q.w, vh);
    paint.vgrad(c, q.x + 3, q.y + q.h - vh + 3, q.w - 6, vh - 3, '#6b8496', '#3a4a57', r);
    paint.rm(m, 0.08, 0.4, q.x, q.y + q.h - vh, q.w, vh);
    paint.window(e, { ...q, lit: true, k: 1, litColor: '#ffe7c0' }, q.x + 3, q.y + q.h - vh + 3, q.w - 6, vh - 3, r);
    return;
  }
  const ww = Math.round(q.w * 0.5), wh = Math.round(q.h * 0.5), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.22);
  paint.vgrad(c, wx, wy, ww, wh, '#4f6475', '#2f3d49', r);
  paint.window(e, q, wx, wy, ww, wh, r);
} });
/** entorno — poucas janelas grandes, usada em caixas genéricas instanciadas (UV 0..1 por face) */
defineFacade('surround', { cellW: 3.2, floorH: 3.2, cols: 5, rows: 5, lit: 0.42, paint({ c, e, m, r }, q) {
  c.fillStyle = '#ebe8e1'; c.fillRect(q.x, q.y, q.w, q.h);
  const ww = Math.round(q.w * 0.6), wh = Math.round(q.h * 0.5), wx = q.x + Math.round((q.w - ww) / 2), wy = q.y + Math.round(q.h * 0.22);
  c.fillStyle = '#c9ccd0'; c.fillRect(wx, wy, ww, wh);
  paint.window(e, q, wx, wy, ww, wh, r);
} });
/** galpão — painéis de concreto com faixa de janelas alta */
defineFacade('warehouse', { cellW: 4, floorH: 9, cols: 8, rows: 2, lit: 0.35, glow: 0.6, paint({ c, e, m, r }, q) {
  c.fillStyle = paint.jitter('#dcd8d0', r, 0.03); c.fillRect(q.x, q.y, q.w, q.h);
  c.fillStyle = '#bdb8ae'; c.fillRect(q.x, q.y, 2, q.h);
  paint.rm(m, 0.95, 0, q.x, q.y, q.w, q.h);
  const wy = q.y + Math.round(q.h * 0.12), wh = Math.round(q.h * 0.14);
  paint.vgrad(c, q.x + 3, wy, q.w - 6, wh, '#5e6f7c', '#3b4955', r);
  paint.window(e, q, q.x + 3, wy, q.w - 6, wh, r);
} });

/* ============================================================
 * 5. MATERIAIS (cache + registro para ciclo dia/noite)
 * ============================================================ */
export const NIGHT = { glow: new Set(), lamps: new Set(), dim: new Set() }; // materiais controlados pelo horário
/** escurece um material rumo ao azul-noite (chão, entorno). k = quanto escurece na noite total */
export function dimAtNight(m, k = 0.6) { if (m.userData.dim) return m; m.userData.dim = true; NIGHT.dim.add({ mat: m, base: m.color.clone(), k }); return m; }
const DIM_TONE = new THREE.Color('#1f2a40');
const FM = new Map();
export function facadeMaterial(key, tint) {
  const id = key + '|' + (tint || '');
  if (FM.has(id)) return FM.get(id);
  const t = facadeTextures(key);
  const m = new THREE.MeshStandardMaterial({
    map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0,
    roughnessMap: t.rmMap, metalnessMap: t.rmMap, roughness: 1, metalness: 1,
    color: tint ? new THREE.Color(tint) : 0xffffff,
  });
  m.userData.glow = t.spec.glow;
  NIGHT.glow.add(m); dimAtNight(m, 0.4); FM.set(id, m);
  return m;
}
const MC = new Map();
/** material sólido em cache. opts: rough, metal, map, emissive, glow (registra no ciclo noturno), transparent, opacity, side, alphaTest */
export function mat(color, o = {}) {
  const id = JSON.stringify([color, o.rough, o.metal, o.map?.uuid, o.emissive, o.glow, o.lamp, o.transparent, o.opacity, o.side, o.alphaTest]);
  if (MC.has(id)) return MC.get(id);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, map: o.map || null,
    emissive: o.emissive || 0x000000, emissiveIntensity: o.emissive ? (o.glow || o.lamp ? 0 : 1) : 0,
    transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, alphaTest: o.alphaTest ?? 0,
    depthWrite: o.transparent ? false : true,
  });
  if (o.glow) { m.userData.glow = o.glow; NIGHT.glow.add(m); }
  if (o.lamp) { m.userData.lamp = o.lamp; NIGHT.lamps.add({ mat: m, mode: 'emissive', k: o.lamp }); }
  MC.set(id, m);
  return m;
}
export const MATS = {
  roof: () => dimAtNight(mat('#ffffff', { map: TEXTURES.roof(), rough: 0.95 }), 0.45),
  concrete: () => mat('#ffffff', { map: TEXTURES.concrete(), rough: 0.95 }),
  metalDark: () => mat('#3a3f45', { rough: 0.5, metal: 0.6 }),
  metalLight: () => mat('#c9ced3', { rough: 0.45, metal: 0.6 }),
  glass: () => mat('#9fc4d8', { rough: 0.05, metal: 0.3, transparent: true, opacity: 0.35 }),
  wood: () => mat('#ffffff', { map: TEXTURES.wood(), rough: 0.8 }),
  greenRoof: () => mat('#ffffff', { map: TEXTURES.grass(), rough: 1 }),
};

/* ============================================================
 * 6. PRIMITIVAS GEOMÉTRICAS
 * ============================================================ */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base no y=0
export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg).translate(0, h / 2, 0), material);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
}
/** geometria de cilindro entre dois pontos (para treliças/vigas — mesclar depois) */
export function beamGeometry(a, b, radius = 0.08, seg = 5) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(radius, radius, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
/** caixa como geometria posicionada (para mesclar várias em 1 draw call) */
export function boxGeometry(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}
export function mergedMesh(geos, material, shadows = true) {
  const m = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), material);
  m.castShadow = m.receiveShadow = shadows;
  return m;
}

/** caixa com UV em escala de metro: cada face recebe nº inteiro de janelas/andares */
export function facadeBoxGeometry(w, h, d, spec, uOff = 0) {
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const floors = Math.max(1, Math.round(h / spec.floorH));
  const cx = Math.max(1, Math.round(w / spec.cellW)), cz = Math.max(1, Math.round(d / spec.cellW));
  for (let i = 0; i < pos.count; i++) {
    const nx = nor.getX(i), nz = nor.getZ(i), x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const v = ((y / h) * floors) / spec.rows;
    if (Math.abs(nx) > 0.5) uv.setXY(i, uOff + (((nx > 0 ? d / 2 - z : z + d / 2) / d) * cz) / spec.cols, v);
    else if (Math.abs(nz) > 0.5) uv.setXY(i, uOff + (((nz > 0 ? x + w / 2 : w / 2 - x) / w) * cx) / spec.cols, v);
  }
  return g;
}
/** bloco de fachada: laterais com a fachada, topo/base com laje */
export function facadeBlock(w, h, d, style, { tint, uOff = 0, roof } = {}) {
  const spec = FACADES[style] || FACADES.officeWhite;
  const F = facadeMaterial(style, tint), R = roof || MATS.roof();
  const m = new THREE.Mesh(facadeBoxGeometry(w, h, d, spec, uOff), [F, F, R, R, F, F]);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function facadeCylinder(radius, h, style, { tint, seg = 40 } = {}) {
  const spec = FACADES[style] || FACADES.glassSilver;
  const g = new THREE.CylinderGeometry(radius, radius, h, seg, 1, true).translate(0, h / 2, 0);
  const uv = g.attributes.uv, floors = Math.max(1, Math.round(h / spec.floorH)), cols = Math.max(1, Math.round((2 * Math.PI * radius) / spec.cellW));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * cols) / spec.cols, (uv.getY(i) * floors) / spec.rows);
  const m = new THREE.Mesh(g, facadeMaterial(style, tint));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ---------- letreiro e etiquetas (Canvas 2D → textura) ---------- */
export function makeSign(text, { bg = '#1f2a2e', fg = '#ffffff', height = 1.4, glow = 0.9, font = '600 72px system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font; const tw = Math.ceil(g.measureText(text).width);
  c.width = tw + 80; c.height = 120;
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 18); g.fill();
  g.font = font; g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 40, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6, transparent: true });
  m.userData.glow = glow; NIGHT.glow.add(m);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((height * c.width) / c.height, height), m);
  mesh.userData.width = (height * c.width) / c.height;
  return mesh;
}
/** sprite de etiqueta (pílula) — use stage.addLabel para escalar por distância */
export function makeLabel(text, { bg = '#ffffff', fg = '#1d2622', dot = null, font = '600 40px system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font; const tw = Math.ceil(g.measureText(text).width), pad = 28, dotW = dot ? 40 : 0;
  c.width = tw + pad * 2 + dotW; c.height = 76 + 18;
  g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, c.width - 8, 68, 34); g.fill();
  g.shadowColor = 'transparent';
  g.beginPath(); g.moveTo(c.width / 2 - 10, 70); g.lineTo(c.width / 2, 88); g.lineTo(c.width / 2 + 10, 70); g.fill();
  if (dot) { g.fillStyle = dot; g.beginPath(); g.arc(pad + 12, 38, 11, 0, Math.PI * 2); g.fill(); }
  g.font = font; g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, pad + dotW, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.center.set(0.5, 0); s.userData.aspect = c.width / c.height; s.renderOrder = 10;
  return s;
}

/* ============================================================
 * 7. ARQUÉTIPOS DE PRÉDIO  (todos: base em y=0, frente = +Z)
 * ============================================================ */
function roofClutter(g, w, d, y, r, { parapet = true, ac = true, tank = false } = {}) {
  const geos = [];
  if (parapet) {
    const t = 0.35, h = 0.9;
    geos.push(boxGeometry(w, h, t, 0, y, d / 2 - t / 2), boxGeometry(w, h, t, 0, y, -d / 2 + t / 2), boxGeometry(t, h, d - 2 * t, w / 2 - t / 2, y, 0), boxGeometry(t, h, d - 2 * t, -w / 2 + t / 2, y, 0));
  }
  if (ac) for (let i = 0, n = irange(r, 1, 4); i < n; i++) geos.push(boxGeometry(range(r, 1.2, 2), range(r, 0.8, 1.2), range(r, 1, 1.6), range(r, -w / 3, w / 3), y, range(r, -d / 3, d / 3)));
  if (geos.length) g.add(mergedMesh(geos, mat('#d4d0c8', { rough: 0.9 })));
  if (tank) {
    const tx = range(r, -w / 4, w / 4), tz = range(r, -d / 4, d / 4);
    g.add(cyl(1.3, 1.3, 2.2, MATS.metalLight(), tx, y + 1.2, tz, 14));
    g.add(mergedMesh([0, 1, 2, 3].map((k) => boxGeometry(0.15, 1.2, 0.15, tx + (k % 2 ? 0.9 : -0.9), y, tz + (k > 1 ? 0.9 : -0.9))), MATS.metalDark()));
  }
}
const meta = (g, kind, w, d, h, extra = {}) => { g.userData = { kind, footprint: { w, d }, height: h, ...extra }; return g; };

export const Buildings = {
  /** torre de vidro; setback>0 cria escalonamento (0.15 = recua 15% por estágio) */
  tower({ w = 16, d = 16, floors = 22, style = 'glassBlue', tint, setback = 0, crown = true, seed = 1 } = {}) {
    const r = rng(seed), spec = FACADES[style] || FACADES.glassBlue, g = new THREE.Group();
    const tiers = setback ? [Math.ceil(floors * 0.55), Math.ceil(floors * 0.3)] : [floors];
    if (setback) tiers.push(Math.max(1, floors - tiers[0] - tiers[1]));
    let y = 0, cw = w, cd = d;
    for (const n of tiers) {
      const h = n * spec.floorH, b = facadeBlock(cw, h, cd, style, { tint, uOff: r() });
      b.position.y = y; g.add(b);
      g.add(box(cw + 0.4, 0.5, cd + 0.4, mat('#cfd3d6', { rough: 0.6, metal: 0.3 }), 0, y + h, 0));
      y += h + 0.5; cw *= 1 - setback; cd *= 1 - setback;
    }
    if (crown) {
      g.add(box(cw * 0.55, 3.2, cd * 0.55, mat('#d8dadc', { rough: 0.7 }), 0, y, 0));
      g.add(cyl(0.12, 0.2, 9, MATS.metalLight(), 0, y + 3.2, 0, 6));
      y += 3.2;
    } else roofClutter(g, cw, cd, y, r);
    return meta(g, 'tower', w, d, y);
  },
  roundTower({ radius = 8, floors = 26, style = 'glassSilver', tint, ring = '#3f7bff', seed = 1 } = {}) {
    const spec = FACADES[style], h = floors * spec.floorH, g = new THREE.Group();
    g.add(facadeCylinder(radius, h, style, { tint }));
    const cap = new THREE.Mesh(new THREE.CircleGeometry(radius, 40).rotateX(-Math.PI / 2).translate(0, h, 0), MATS.roof());
    cap.receiveShadow = true; g.add(cap);
    const neon = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.05, 0.18, 6, 64).rotateX(Math.PI / 2).translate(0, h - 0.6, 0), mat(ring, { emissive: ring, glow: 2 }));
    g.add(neon);
    g.add(cyl(radius * 0.5, radius * 0.5, 2.6, mat('#d8dadc'), 0, h, 0, 24));
    return meta(g, 'roundTower', radius * 2, radius * 2, h + 2.6);
  },
  office({ w = 22, d = 16, floors = 6, style = 'officeWhite', tint, seed = 1, greenRoof = false } = {}) {
    const r = rng(seed), spec = FACADES[style], h = floors * spec.floorH, g = new THREE.Group();
    g.add(facadeBlock(w, h, d, style, { tint, uOff: r(), roof: greenRoof ? MATS.greenRoof() : undefined }));
    g.add(box(w * 0.4, 0.3, 2.2, mat('#2c3338', { rough: 0.5 }), 0, 3.4, d / 2 + 1.1)); // marquise
    roofClutter(g, w, d, h, r, { ac: !greenRoof, tank: r() < 0.4 });
    return meta(g, 'office', w, d, h);
  },
  apartment({ w = 20, d = 13, floors = 10, style = 'residential', tint, balconies = true, seed = 1 } = {}) {
    const r = rng(seed), spec = FACADES[style], h = floors * spec.floorH, g = new THREE.Group();
    g.add(facadeBlock(w, h, d, style, { tint, uOff: r() }));
    if (balconies) {
      const slabs = [], rails = [], n = Math.max(1, Math.floor(w / 5));
      for (let f = 1; f < floors; f++) for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5), y = f * spec.floorH;
        slabs.push(boxGeometry(3.2, 0.2, 1.4, x, y, d / 2 + 0.7));
        rails.push(boxGeometry(3.2, 1.0, 0.06, x, y + 0.2, d / 2 + 1.37));
      }
      g.add(mergedMesh(slabs, mat('#e9e6e0', { rough: 0.8 })));
      g.add(mergedMesh(rails, MATS.glass(), false));
    }
    roofClutter(g, w, d, h, r, { tank: true });
    return meta(g, 'apartment', w, d, h);
  },
  house({ w = 9, d = 11, floors = 1, wall = '#efe6d6', roof = '#b0563d', garage = false, chimney = true, seed = 1 } = {}) {
    const r = rng(seed), h = floors * 2.8, g = new THREE.Group(), rh = Math.min(w, d) * 0.32;
    g.add(facadeBlock(w, h, d, 'house', { tint: wall, uOff: r() * 0.5 }));
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.5, 0), new THREE.Vector2(w / 2 + 0.5, 0), new THREE.Vector2(0, rh)]);
    const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false }).translate(0, h, -(d + 0.8) / 2);
    const rm = new THREE.Mesh(rg, mat(roof, { rough: 0.8 })); rm.castShadow = rm.receiveShadow = true; g.add(rm);
    g.add(box(1.1, 2.1, 0.08, MATS.wood(), w * 0.22, 0, d / 2 + 0.02));
    if (chimney) g.add(box(0.7, rh + 0.6, 0.7, mat('#a9a097'), -w * 0.25, h, -d * 0.15));
    if (garage) {
      g.add(box(4.2, 2.6, 6, mat(wall, { rough: 0.9 }), w / 2 + 2.1, 0, d / 2 - 3));
      g.add(box(3.2, 2.2, 0.06, mat('#d7d3cb', { rough: 0.6, metal: 0.3 }), w / 2 + 2.1, 0, d / 2 + 0.01));
    }
    return meta(g, 'house', w + (garage ? 4.2 : 0), d, h + rh);
  },
  shop({ w = 10, d = 12, floors = 2, awning = '#c0392b', sign = null, signColor = '#1f2a2e', seed = 1 } = {}) {
    const r = rng(seed), spec = FACADES.shop, h = floors * spec.floorH, g = new THREE.Group();
    g.add(facadeBlock(w, h, d, 'shop', { uOff: r() }));
    const aw = box(w * 0.9, 0.12, 1.8, mat('#ffffff', { map: TEXTURES.stripes(awning, '#f4f1ea', 8), rough: 0.9 }), 0, 3.0, d / 2 + 0.9);
    aw.rotation.x = 0.25; g.add(aw);
    if (sign) { const s = makeSign(sign, { bg: signColor, height: 1.1 }); s.position.set(0, 3.9, d / 2 + 0.05); g.add(s); }
    roofClutter(g, w, d, h, r);
    return meta(g, 'shop', w, d, h);
  },
  warehouse({ w = 40, d = 26, h = 9, solar = true, docks = 3, seed = 1 } = {}) {
    const r = rng(seed), g = new THREE.Group();
    g.add(facadeBlock(w, h, d, 'warehouse', { uOff: r() }));
    if (solar) {
      const geos = [], rows = Math.floor((d - 4) / 3.2), cols = Math.floor((w - 4) / 2.2);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const pg = new THREE.BoxGeometry(2, 0.08, 2.8).rotateX(-0.25).translate(-w / 2 + 2 + i * 2.2 + 1, h + 0.5, -d / 2 + 2 + j * 3.2 + 1.4);
        geos.push(pg);
      }
      if (geos.length) g.add(mergedMesh(geos, mat('#ffffff', { map: TEXTURES.solar(), rough: 0.3, metal: 0.4 })));
    }
    const dk = [];
    for (let i = 0; i < docks; i++) dk.push(boxGeometry(3.2, 3.8, 0.1, -w / 2 + (w / (docks + 1)) * (i + 1), 0.6, d / 2 + 0.03));
    if (dk.length) g.add(mergedMesh(dk, mat('#3a4048', { rough: 0.6, metal: 0.3 })));
    return meta(g, 'warehouse', w, d, h);
  },
  factory({ w = 34, d = 24, h = 10, seed = 1 } = {}) {
    const g = Buildings.warehouse({ w, d, h, solar: false, docks: 2, seed });
    const teeth = Math.floor(w / 6), geos = [];
    for (let i = 0; i < teeth; i++) {
      const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6, 0), new THREE.Vector2(0, 3)]);
      geos.push(new THREE.ExtrudeGeometry(s, { depth: d - 1, bevelEnabled: false }).translate(-w / 2 + i * 6, h, -(d - 1) / 2));
    }
    g.add(mergedMesh(geos, mat('#c8c4bb', { rough: 0.9 })));
    g.add(cyl(1.1, 1.5, h + 18, mat('#ffffff', { map: TEXTURES.stripes('#c0392b', '#f2efe9', 10) }), w / 2 - 4, 0, -d / 2 + 4, 16));
    return meta(g, 'factory', w, d, h + 18);
  },
  crane({ h = 42, jib = 28, color = '#f0b43c', seed = 1 } = {}) {
    const g = new THREE.Group(), lat = mat('#ffffff', { map: TEXTURES.lattice(color), alphaTest: 0.45, side: THREE.DoubleSide, rough: 0.6 });
    const mast = box(1.6, h, 1.6, lat); mast.material = lat.clone(); mast.material.map = TEXTURES.lattice(color).clone();
    mast.material.map.repeat.set(1, h / 1.6); mast.material.map.needsUpdate = true; g.add(mast);
    const top = new THREE.Group(); top.position.y = h;
    const jm = box(jib, 1.4, 1.4, lat.clone(), jib / 2 - 6, 0, 0); jm.material.map = TEXTURES.lattice(color).clone(); jm.material.map.repeat.set(jib / 1.4, 1); top.add(jm);
    top.add(box(4, 2.2, 2.4, mat('#9aa0a6', { rough: 0.7 }), -8, -1, 0));
    top.add(box(2.4, 2, 2.2, mat(color, { rough: 0.6 }), 0, -2.2, 1.8));
    const hook = new THREE.Group(); hook.position.x = jib * 0.6;
    hook.add(cyl(0.03, 0.03, 16, MATS.metalDark(), 0, -16, 0, 4));
    hook.add(box(0.6, 0.6, 0.6, MATS.metalDark(), 0, -16.6, 0));
    top.add(hook); g.add(top);
    g.userData.tick = (dt) => { top.rotation.y += dt * 0.12; };
    return meta(g, 'crane', 2, 2, h + 1.4, { tick: g.userData.tick });
  },
  /** obra: estrutura até `progress`, andaime nos 2 últimos andares e guindaste opcional */
  construction({ w = 16, d = 16, floors = 8, progress = 0.5, crane = true, seed = 1 } = {}) {
    const r = rng(seed), fh = 3.1, built = Math.max(1, Math.round(floors * clamp(progress))), g = new THREE.Group();
    g.add(box(w + 6, 0.06, d + 6, mat('#ffffff', { map: TEXTURES.dirt() }), 0, 0, 0));
    const cols = [], slabs = [], nx = Math.max(2, Math.round(w / 5)), nz = Math.max(2, Math.round(d / 5));
    for (let f = 0; f < built; f++) {
      slabs.push(boxGeometry(w, 0.3, d, 0, f * fh + fh - 0.3, 0));
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) cols.push(boxGeometry(0.45, fh - 0.3, 0.45, -w / 2 + (w / nx) * i, f * fh, -d / 2 + (d / nz) * j));
    }
    g.add(mergedMesh([...slabs, ...cols], MATS.concrete()));
    const filled = Math.max(0, built - 2); // andares já fechados com fachada
    if (filled > 0) g.add(facadeBlock(w - 0.6, filled * fh, d - 0.6, 'residential', { uOff: r() }));
    const sh = (built - filled) * fh + 1.2, sc = box(w + 1.2, sh, d + 1.2, mat('#ffffff', { map: TEXTURES.lattice('#e8a33a'), alphaTest: 0.45, side: THREE.DoubleSide }), 0, filled * fh, 0);
    sc.material = sc.material.clone(); sc.material.map = sc.material.map.clone(); sc.material.map.repeat.set((w + 1.2) / 1.6, sh / 1.6); g.add(sc);
    let height = built * fh + 1.2;
    if (crane) { const c = Buildings.crane({ h: Math.max(30, floors * fh + 12), jib: w + 14, seed }); c.position.set(w / 2 + 3, 0, -d / 2 - 3); g.add(c); height = Math.max(height, c.userData.height); }
    return meta(g, 'construction', w, d, height, { progress, floors, built });
  },
};

/* ============================================================
 * 8. LAYOUT DA CIDADE (grade de quadras e lotes)
 * ============================================================ */
export function gridLayout({ cols = 4, rows = 4, block = 48, road = 12, sidewalk = 3, blocksX, blocksZ } = {}) {
  const bx = blocksX || Array(cols).fill(block), bz = blocksZ || Array(rows).fill(block);
  const axis = (arr) => {
    const total = arr.reduce((a, b) => a + b, 0) + road * (arr.length + 1), roads = [], blocks = [];
    let p = -total / 2;
    roads.push({ center: p + road / 2, width: road, index: 0 }); p += road;
    arr.forEach((b, i) => { blocks.push({ center: p + b / 2, size: b }); p += b; roads.push({ center: p + road / 2, width: road, index: i + 1 }); p += road; });
    return { total, roads, blocks };
  };
  const X = axis(bx), Z = axis(bz), blocks = [];
  X.blocks.forEach((a, i) => Z.blocks.forEach((b, j) => blocks.push({ x: a.center, z: b.center, w: a.size, d: b.size, i, j })));
  return { width: X.total, depth: Z.total, road, sidewalk, roadsV: X.roads, roadsH: Z.roads, blocks };
}
/**
 * Divide a quadra em 2 fileiras de `n` lotes (frente para a rua de cima e de baixo).
 * Cada lote: { x, z, w, d, rot } — rot já gira o prédio para encarar a rua.
 */
export function splitBlock(block, { n = 3, sidewalk = 3 } = {}) {
  const iw = block.w - sidewalk * 2, id = block.d - sidewalk * 2, lw = iw / n, ld = id / 2, lots = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
    lots.push({ x: block.x - iw / 2 + lw * (i + 0.5), z: block.z + (row === 0 ? id / 4 : -id / 4), w: lw, d: ld, rot: row === 0 ? 0 : Math.PI, block });
  }
  return lots;
}
/** coloca um prédio no lote (centraliza, gira para a rua e recua um pouco da calçada) */
export function placeOnLot(obj, lot, setback = 1) {
  const fd = obj.userData.footprint?.d ?? lot.d;
  const off = Math.max(0, lot.d / 2 - fd / 2 - setback);
  obj.position.set(lot.x, 0.18, lot.z + (lot.rot === 0 ? off : -off));
  obj.rotation.y = lot.rot;
  return obj;
}

/* ============================================================
 * 9. CHÃO, RUAS, FAIXAS
 * ============================================================ */
export function buildGround(stage, layout, { groundColor = '#d6d4cc', parks = [] } = {}) {
  const { scene } = stage, g = new THREE.Group(); g.name = 'ground';
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), dimAtNight(new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 }), 0.62));
  far.position.y = -0.05; far.receiveShadow = true; g.add(far);
  const asphaltTex = TEXTURES.asphalt().clone(); asphaltTex.repeat.set(layout.width / 18, layout.depth / 18); asphaltTex.needsUpdate = true;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(layout.width, layout.depth).rotateX(-Math.PI / 2), dimAtNight(new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }), 0.35));
  asphalt.receiveShadow = true; g.add(asphalt);
  const parkSet = new Set(parks.map(([i, j]) => `${i},${j}`));
  for (const b of layout.blocks) {
    const park = parkSet.has(`${b.i},${b.j}`);
    const t = (park ? TEXTURES.grass() : TEXTURES.paving()).clone(); t.repeat.set(b.w / 8, b.d / 8); t.needsUpdate = true;
    const slab = box(b.w, 0.18, b.d, dimAtNight(mat('#ffffff', { map: t, rough: 0.95 }), 0.45), b.x, 0, b.z);
    slab.castShadow = false; g.add(slab);
    if (park) b.park = true;
    else { // miolo da quadra em concreto (fica sob os prédios)
      const inner = box(b.w - layout.sidewalk * 2, 0.02, b.d - layout.sidewalk * 2, MATS.concrete(), b.x, 0.18, b.z);
      inner.castShadow = false; g.add(inner);
    }
  }
  // faixas tracejadas + faixas de pedestre (1 draw call cada)
  const dashes = [], zebra = [], dash = 3, gap = 4;
  for (const rd of layout.roadsH) for (let x = -layout.width / 2; x < layout.width / 2; x += dash + gap) {
    const cx = x + dash / 2; if (layout.roadsV.some((v) => Math.abs(cx - v.center) < v.width / 2 + 2)) continue;
    dashes.push([cx, rd.center, 0]);
  }
  for (const rd of layout.roadsV) for (let z = -layout.depth / 2; z < layout.depth / 2; z += dash + gap) {
    const cz = z + dash / 2; if (layout.roadsH.some((h) => Math.abs(cz - h.center) < h.width / 2 + 2)) continue;
    dashes.push([rd.center, cz, Math.PI / 2]);
  }
  for (const v of layout.roadsV) for (const h of layout.roadsH) {
    const n = Math.floor(h.width / 1.1);
    for (let k = 0; k < n; k++) {
      const off = -h.width / 2 + 0.55 + k * 1.1;
      for (const s of [-1, 1]) {
        const zx = v.center + s * (v.width / 2 + 1.6), zz = h.center + s * (h.width / 2 + 1.6);
        if (Math.abs(zx) < layout.width / 2 - 2) zebra.push([zx, h.center + off, Math.PI / 2]);
        if (Math.abs(zz) < layout.depth / 2 - 2) zebra.push([v.center + off, zz, 0]);
      }
    }
  }
  const inst = (list, w, d, color) => {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat(color, { rough: 0.8 }), list.length);
    const o = new THREE.Object3D();
    list.forEach(([x, z, ry], i) => { o.position.set(x, 0.02, z); o.rotation.set(0, ry, 0); o.scale.set(w, 1, d); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.receiveShadow = true; return im;
  };
  // zebra: listras orientadas ao longo da via cruzada
  g.add(inst(dashes, dash, 0.18, '#e9e4d6'));
  const zb = inst(zebra, 0.55, 3.2, '#f2efe6'); g.add(zb);
  scene.add(g);
  return g;
}

/* ============================================================
 * 10. ÁRVORES, POSTES, CARROS, ENTORNO (InstancedMesh)
 * ============================================================ */
const GREENS = ['#6f9a52', '#5f8a48', '#83a862', '#4f7a3e', '#8fb06b', '#6d8f4c'];
export function streetTreePoints(layout, { spacing = 11, seed = 5, inset = 1.4 } = {}) {
  const r = rng(seed), pts = [];
  for (const b of layout.blocks) {
    if (b.park) continue;
    const hw = b.w / 2 - inset, hd = b.d / 2 - inset;
    for (let x = -hw + 4; x <= hw - 4; x += spacing) { pts.push({ x: b.x + x, z: b.z + hd }); pts.push({ x: b.x + x, z: b.z - hd }); }
    for (let z = -hd + 4; z <= hd - 4; z += spacing) { pts.push({ x: b.x + hw, z: b.z + z }); pts.push({ x: b.x - hw, z: b.z + z }); }
  }
  return pts.map((p) => ({ ...p, x: p.x + range(r, -0.4, 0.4), z: p.z + range(r, -0.4, 0.4) }));
}
export function scatterPoints({ x = 0, z = 0, w = 40, d = 40 }, n, seed = 9) {
  const r = rng(seed); return Array.from({ length: n }, () => ({ x: x + range(r, -w / 2, w / 2), z: z + range(r, -d / 2, d / 2) }));
}
export function addTrees(stage, points, { seed = 3, y = 0.18, scale = 1 } = {}) {
  const q = stage.quality, r = rng(seed);
  const pts = points.filter((_, i) => ((i * 2654435761) % 1000) / 1000 < q.trees);
  const crownGeo = q.treeDetail === 2 ? new THREE.SphereGeometry(1, 12, 9) : new THREE.IcosahedronGeometry(1, q.treeDetail);
  const crowns = new THREE.InstancedMesh(crownGeo, mat('#ffffff', { rough: 0.95 }), pts.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 6).translate(0, 0.5, 0), mat('#6b5240', { rough: 1 }), pts.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  pts.forEach((p, i) => {
    const tall = r() < 0.25, s = (p.s ?? 1) * scale, th = range(r, 1.8, 2.8) * s, cr = (tall ? range(r, 1.1, 1.5) : range(r, 1.6, 2.6)) * s;
    o.position.set(p.x, y, p.z); o.rotation.set(0, 0, 0); o.scale.set(s * 1.4, th, s * 1.4); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    o.position.set(p.x, y + th + cr * (tall ? 1.6 : 0.8), p.z); o.rotation.set(0, r() * 6, 0); o.scale.set(cr, tall ? cr * 2.3 : cr * 1.05, cr); o.updateMatrix();
    crowns.setMatrixAt(i, o.matrix); crowns.setColorAt(i, c.set(pick(r, GREENS)));
  });
  crowns.castShadow = trunks.castShadow = q.treeShadows; crowns.receiveShadow = true;
  stage.scene.add(crowns, trunks);
  return { crowns, trunks, count: pts.length };
}
export function lampPoints(layout, { spacing = 22, inset = 0.8 } = {}) {
  const pts = [];
  for (const b of layout.blocks) {
    const hw = b.w / 2 - inset, hd = b.d / 2 - inset;
    for (let x = -hw + 2; x <= hw; x += spacing) { pts.push({ x: b.x + x, z: b.z + hd, ry: 0 }); pts.push({ x: b.x + x, z: b.z - hd, ry: Math.PI }); }
    for (let z = -hd + spacing / 2; z <= hd - 2; z += spacing) { pts.push({ x: b.x + hw, z: b.z + z, ry: Math.PI / 2 }); pts.push({ x: b.x - hw, z: b.z + z, ry: -Math.PI / 2 }); }
  }
  return pts;
}
export function addStreetLamps(stage, points, { height = 6.5, color = '#ffe2b0', y = 0.18 } = {}) {
  const q = stage.quality, o = new THREE.Object3D();
  const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.1, height, 6).translate(0, height / 2, 0).toNonIndexed(), new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, height, 0.65).toNonIndexed()]);
  const poles = new THREE.InstancedMesh(poleGeo, mat('#3b4046', { rough: 0.5, metal: 0.5 }), points.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.14, 0.7).translate(0, height - 0.1, 1.3), mat('#fff6e0', { emissive: color, lamp: 2.2 }), points.length);
  points.forEach((p, i) => { o.position.set(p.x, y, p.z); o.rotation.set(0, p.ry || 0, 0); o.updateMatrix(); poles.setMatrixAt(i, o.matrix); heads.setMatrixAt(i, o.matrix); });
  poles.castShadow = q.shadows;
  stage.scene.add(poles, heads);
  let pools = null;
  if (q.lampPools) { // "poças" de luz no chão: plano aditivo com gradiente radial (bem mais barato que PointLight)
    const pm = new THREE.MeshBasicMaterial({ map: TEXTURES.radial(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color });
    NIGHT.lamps.add({ mat: pm, mode: 'opacity', k: 0.55 });
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pm, points.length);
    points.forEach((p, i) => { o.position.set(p.x, y + 0.04, p.z); o.rotation.set(0, p.ry || 0, 0); o.translateZ(1.3); o.scale.set(11, 1, 11); o.updateMatrix(); pools.setMatrixAt(i, o.matrix); });
    pools.renderOrder = 2; stage.scene.add(pools);
  }
  return { poles, heads, pools };
}

const CAR_COLORS = [['#f2f1ed', 0.28], ['#b9bec4', 0.2], ['#1d2026', 0.15], ['#5d636b', 0.12], ['#263a5e', 0.06], ['#a8322b', 0.08], ['#3f6ea8', 0.05], ['#cdbb98', 0.03], ['#e0b23a', 0.03]];
/** tráfego com faixas, distância entre carros e semáforos (ciclo de 17 s) */
export function addTraffic(stage, layout, { density = 1, seed = 4242, cycle = 17 } = {}) {
  const q = stage.quality, r = rng(seed), off = layout.road / 4, lanes = [];
  const W2 = layout.width / 2, D2 = layout.depth / 2, phase = new Map();
  const ph = (a, b) => { const k = a + '|' + b; if (!phase.has(k)) phase.set(k, r() * cycle); return phase.get(k); };
  const mk = (axis, dir, fixed, min, max, own, cross) => {
    const L = max - min, stops = [];
    for (const c of cross) {
      const p = c.center - dir * (c.width / 2 + 1.4), s = dir === 1 ? p - min : max - p;
      if (s > 2 && s < L - 2) stops.push({ s, key: axis === 'x' ? ph(own, c.index) : ph(c.index, own) });
    }
    stops.sort((a, b) => a.s - b.s);
    return { axis, dir, fixed, min, max, L, stops, cars: [] };
  };
  for (const h of layout.roadsH) for (const dir of [1, -1]) lanes.push(mk('x', dir, h.center + dir * off, -W2, W2, h.index, layout.roadsV));
  for (const v of layout.roadsV) for (const dir of [1, -1]) lanes.push(mk('z', dir, v.center - dir * off, -D2, D2, v.index, layout.roadsH));
  const cars = [];
  for (const ln of lanes) {
    const n = Math.max(1, Math.round((ln.L / 42) * density * q.cars));
    for (let k = 0; k < n; k++) { const car = { lane: ln, s: (k / n) * ln.L + range(r, 0, 6), v: 4, vmax: range(r, 9, 13), color: weighted(r, CAR_COLORS) }; ln.cars.push(car); cars.push(car); }
  }
  const body = new THREE.InstancedMesh(new RoundedBoxGeometry(4.2, 1.0, 1.9, 2, 0.3).translate(0, 0.85, 0), mat('#ffffff', { rough: 0.35, metal: 0.4 }), cars.length);
  const cabin = new THREE.InstancedMesh(new RoundedBoxGeometry(2.3, 0.8, 1.7, 2, 0.25).translate(-0.25, 1.65, 0), mat('#1d2630', { rough: 0.15, metal: 0.6 }), cars.length);
  const wg = []; for (const [x, z] of [[1.3, 0.85], [1.3, -0.85], [-1.3, 0.85], [-1.3, -0.85]]) wg.push(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10).rotateX(Math.PI / 2).translate(x, 0.38, z).toNonIndexed());
  const wheels = new THREE.InstancedMesh(mergeGeometries(wg), mat('#202326', { rough: 0.9 }), cars.length);
  const lg = [], col = [];
  const addL = (x, z, c) => { const g = new THREE.BoxGeometry(0.06, 0.18, 0.4).translate(x, 0.95, z).toNonIndexed(); const cc = new THREE.Color(c); const arr = []; for (let i = 0; i < g.attributes.position.count; i++) arr.push(cc.r, cc.g, cc.b); g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3)); lg.push(g); };
  addL(2.1, 0.6, '#fff4dc'); addL(2.1, -0.6, '#fff4dc'); addL(-2.1, 0.6, '#ff2a1a'); addL(-2.1, -0.6, '#ff2a1a');
  const lm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  NIGHT.lamps.add({ mat: lm, mode: 'color', k: 1.4, base: 0.5 });
  const lights = new THREE.InstancedMesh(mergeGeometries(lg), lm, cars.length);
  const c = new THREE.Color(); cars.forEach((car, i) => body.setColorAt(i, c.set(car.color)));
  body.castShadow = cabin.castShadow = q.carShadows;
  const meshes = [body, cabin, wheels, lights];
  stage.scene.add(...meshes);
  const o = new THREE.Object3D();
  const green = (axis, t, key) => { const i = (t + key) % cycle; return axis === 'x' ? i < 7 : i >= 8.5 && i < 15.5; };
  stage.onTick((dt, t) => {
    let i = 0;
    for (const ln of lanes) {
      const n = ln.cars.length;
      for (let k = 0; k < n; k++) {
        const car = ln.cars[k], lead = ln.cars[(k + 1) % n];
        let target = car.vmax;
        if (n > 1) { const gap = (lead.s - car.s + ln.L) % ln.L; if (gap < 16) target = Math.min(target, Math.max(0, (gap - 7) * 1.3)); }
        for (const st of ln.stops) { const d = st.s - car.s; if (d > 0 && d < 26) { if (!green(ln.axis, t, st.key)) target = Math.min(target, Math.max(0, (d - 1) * 0.9)); break; } }
        car.v += clamp(target - car.v, -14 * dt, 4 * dt); car.s += car.v * dt;
        if (car.s > ln.L) car.s -= ln.L;
        const p = ln.dir === 1 ? ln.min + car.s : ln.max - car.s, fade = clamp(Math.min(car.s, ln.L - car.s) / 5);
        if (ln.axis === 'x') { o.position.set(p, 0, ln.fixed); o.rotation.set(0, ln.dir === 1 ? 0 : Math.PI, 0); }
        else { o.position.set(ln.fixed, 0, p); o.rotation.set(0, ln.dir === 1 ? -Math.PI / 2 : Math.PI / 2, 0); }
        o.scale.setScalar(fade || 0.0001); o.updateMatrix();
        for (const m of meshes) m.setMatrixAt(i, o.matrix);
        i++;
      }
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  });
  return { lanes, cars, meshes };
}

/** entorno: quadras brancas genéricas ao redor da área principal (1 draw call por tipo) */
export function addSurroundings(stage, { exclude = { w: 300, d: 300 }, radius, cell = 60, seed = 31337 } = {}) {
  const r = rng(seed), R = radius ?? stage.quality.surroundings, pads = [], bld = [], trees = [], n = Math.ceil(R / cell);
  const WHITES = ['#f1efe9', '#ebe9e2', '#e6e4de', '#eeece6', '#e8e5dc', '#e3e2dd'];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * cell + cell / 2, z = j * cell + cell / 2, dist = Math.hypot(x, z);
    if (dist > R || (Math.abs(x) < exclude.w / 2 + cell / 2 && Math.abs(z) < exclude.d / 2 + cell / 2)) continue;
    pads.push({ x, z });
    if (r() < 0.16) { for (let k = 0; k < 8; k++) trees.push({ x: x + range(r, -18, 18), z: z + range(r, -18, 18), s: range(r, 2.4, 4) }); continue; }
    const near = Math.max(0, 1 - (dist - 200) / 600), k = 1 + Math.floor(r() * 4);
    for (let b = 0; b < k; b++) {
      const h = r() < 0.12 * near ? range(r, 36, 70) : range(r, 6, 14 + 20 * near);
      bld.push({ x: x + (k === 1 ? 0 : b % 2 ? 11 : -11), z: z + (k === 1 ? 0 : b > 1 ? 11 : -11), w: k === 1 ? range(r, 22, 34) : range(r, 13, 19), d: k === 1 ? range(r, 22, 34) : range(r, 13, 19), h, c: pick(r, WHITES) });
    }
  }
  const ft = facadeTextures('surround');
  const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ft.map, emissiveMap: ft.emissiveMap, emissive: '#ffe7c4', emissiveIntensity: 0, roughness: 0.9 });
  bm.userData.glow = 0.55; NIGHT.glow.add(bm); dimAtNight(bm, 0.5);
  const o = new THREE.Object3D(), c = new THREE.Color();
  const I = (geo, m, list, f) => { const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((it, idx) => { f(it, o); o.updateMatrix(); im.setMatrixAt(idx, o.matrix); if (it.c) im.setColorAt(idx, c.set(it.c)); }); im.receiveShadow = true; stage.scene.add(im); return im; };
  I(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), dimAtNight(new THREE.MeshStandardMaterial({ color: '#e4e2db', roughness: 1 }), 0.62), pads, (p, o) => { o.position.set(p.x, 0, p.z); o.scale.set(cell - 14, 0.12, cell - 14); });
  const bi = I(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bm, bld, (b, o) => { o.position.set(b.x, 0.12, b.z); o.scale.set(b.w, b.h, b.d); });
  bi.castShadow = stage.quality.shadows;
  I(new THREE.SphereGeometry(1, 8, 6), dimAtNight(new THREE.MeshStandardMaterial({ roughness: 1 }), 0.6), trees.map((t) => ({ ...t, c: pick(r, ['#b9c7ad', '#adbe9f', '#c3cfb6']) })), (t, o) => { o.position.set(t.x, t.s * 1.4, t.z); o.scale.set(t.s, t.s * 1.15, t.s); });
  return { buildings: bld.length };
}

/* ============================================================
 * 11. PALETAS DE HORÁRIO
 * ============================================================ */
export const PALETTES = {
  dia:        { top: '#dfe3dd', mid: '#ebe9e1', bottom: '#f3f1ea', sunDir: [-0.45, 0.8, 0.42], sunColor: '#fff3e2', sunI: 2.5, hemiSky: '#e3ebe6', hemiGround: '#a39a86', hemiI: 1.0, env: 0.85, glow: 0,    lamps: 0,   fog: '#e9e7df', bloom: 0.05, exposure: 1.0, night: 0 },
  entardecer: { top: '#24365c', mid: '#7f7894', bottom: '#f0b083', sunDir: [-0.64, 0.32, 0.5], sunColor: '#ffae72', sunI: 2.6, hemiSky: '#a7b3dc', hemiGround: '#8a6553', hemiI: 0.8, env: 0.7,  glow: 0.72, lamps: 0.9, fog: '#dba889', bloom: 0.42, exposure: 1.0, night: 0.55 },
  noite:      { top: '#04070f', mid: '#0b1529', bottom: '#1b2a48', sunDir: [0.35, 0.78, -0.42], sunColor: '#9fb6ff', sunI: 0.55, hemiSky: '#2f4270', hemiGround: '#0b0f18', hemiI: 0.5, env: 0.14, glow: 1.45, lamps: 1.8, fog: '#172440', bloom: 0.8, exposure: 1.0, night: 1 },
};
const COLOR_KEYS = ['top', 'mid', 'bottom', 'sunColor', 'hemiSky', 'hemiGround', 'fog'];
const NUM_KEYS = ['sunI', 'hemiI', 'env', 'glow', 'lamps', 'bloom', 'exposure', 'night'];
const toState = (p) => { const s = {}; COLOR_KEYS.forEach((k) => (s[k] = new THREE.Color(p[k]))); NUM_KEYS.forEach((k) => (s[k] = p[k])); s.sunDir = new THREE.Vector3(...p.sunDir).normalize(); return s; };

/* ============================================================
 * 12. BAKE: mesclar geometria estática por material
 * ============================================================ */
export const REDUCED_MOTION = () => matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('noanim');
const PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });
/**
 * Junta todas as malhas comuns dos `roots` em 1 malha por material (em coordenadas do mundo).
 * Cada root fica na cena só com uma caixa invisível do tamanho dele → clique e flyTo continuam funcionando.
 * Ignora: InstancedMesh, Sprite, objetos com userData.tick (animados) ou userData.noBake.
 */
export function bakeStatic(scene, roots, { name = 'baked' } = {}) {
  const buckets = new Map(), box3 = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  const take = (geo, m, mtx) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {}; g.applyMatrix4(mtx); g.clearGroups();
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(g);
  };
  for (const root of roots) {
    let dynamic = false; root.traverse((o) => { if (o !== root && o.userData.tick) dynamic = true; });
    if (dynamic || root.userData.tick || root.userData.noBake) continue;
    root.updateMatrixWorld(true);
    const remove = [];
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.noBake) return;
      if (Array.isArray(o.material)) {
        const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        for (const gr of o.geometry.groups) {
          const sub = new THREE.BufferGeometry();
          for (const [k, a] of Object.entries(base.attributes)) sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
          take(sub, o.material[gr.materialIndex], o.matrixWorld);
        }
      } else take(o.geometry, o.material, o.matrixWorld);
      remove.push(o);
    });
    box3.setFromObject(root); box3.getSize(size); box3.getCenter(ctr);
    remove.forEach((o) => o.parent.remove(o));
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), PROXY_MAT);
    root.worldToLocal(proxy.position.copy(ctr)); proxy.rotation.y = -root.rotation.y; root.add(proxy);
    root.userData.baked = true;
  }
  const group = new THREE.Group(); group.name = name;
  for (const [m, list] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.castShadow = !m.transparent; mesh.receiveShadow = true; group.add(mesh);
  }
  scene.add(group);
  return group;
}

/* ============================================================
 * 13. STAGE: renderer, câmera, controles, luzes, loop, clique
 * ============================================================ */
export function createStage(container, opts = {}) {
  const qName = opts.quality || new URLSearchParams(location.search).get('q') || detectQuality();
  const quality = { name: qName, ...(QUALITY[qName] || QUALITY.media) };
  const renderer = new THREE.WebGLRenderer({ antialias: quality.msaa, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.info.autoReset = false;
  renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement; el.style.display = 'block'; el.style.touchAction = 'none'; el.dataset.engine = 'three.js r' + THREE.REVISION;
  container.appendChild(el);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 30, 1, 1, 8000);
  const controls = new MapControls(camera, el);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.22, minDistance: 25, maxDistance: 1200, zoomToCursor: true, screenSpacePanning: false });

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 512;
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace; scene.background = skyTex;
  const hemi = new THREE.HemisphereLight(); const sun = new THREE.DirectionalLight();
  sun.castShadow = quality.shadows; sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog('#e9e7df', 600, 2400);

  let composer = null, bloom = null;
  if (quality.bloom) {
    composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.82); composer.addPass(bloom); composer.addPass(new OutputPass());
  }

  /* --- horário --- */
  let env = toState(PALETTES[opts.time || 'dia']), envFrom = null, envTo = null, envT = 1, envDur = 1, timeName = opts.time || 'dia';
  const center = new THREE.Vector3();
  function applyEnv(p) {
    const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#' + p.top.getHexString()); gr.addColorStop(0.55, '#' + p.mid.getHexString()); gr.addColorStop(1, '#' + p.bottom.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 4, 512); skyTex.needsUpdate = true;
    sun.position.copy(p.sunDir).multiplyScalar(600).add(center); sun.target.position.copy(center);
    sun.color.copy(p.sunColor); sun.intensity = p.sunI;
    hemi.color.copy(p.hemiSky); hemi.groundColor.copy(p.hemiGround); hemi.intensity = p.hemiI;
    scene.environmentIntensity = p.env; scene.fog.color.copy(p.fog); renderer.toneMappingExposure = p.exposure;
    for (const m of NIGHT.glow) m.emissiveIntensity = p.glow * (m.userData.glow ?? 1);
    for (const L of NIGHT.lamps) {
      if (L.mode === 'emissive') L.mat.emissiveIntensity = p.lamps * L.k;
      else if (L.mode === 'opacity') L.mat.opacity = clamp(p.lamps * L.k);
      else if (L.mode === 'color') L.mat.color.setScalar((L.base ?? 0) + p.lamps * L.k);
    }
    for (const D of NIGHT.dim) D.mat.color.copy(D.base).lerp(DIM_TONE, p.night * D.k);
    if (bloom) bloom.strength = p.bloom;
  }
  function lerpEnv(a, b, k) {
    const s = {}; COLOR_KEYS.forEach((key) => (s[key] = a[key].clone().lerp(b[key], k))); NUM_KEYS.forEach((key) => (s[key] = a[key] + (b[key] - a[key]) * k));
    s.sunDir = a.sunDir.clone().lerp(b.sunDir, k).normalize(); return s;
  }

  /* --- loop, tweens, eventos --- */
  const ticks = new Set(), tweens = new Set(), listeners = {}, labels = [];
  const emit = (n, d) => (listeners[n] || []).forEach((f) => f(d));
  let t = 0, acc = 0, frames = 0;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    let dt = clock.getDelta();
    if (quality.fpsCap) { acc += dt; if (acc < 1 / quality.fpsCap) return; dt = acc; acc = 0; }
    dt = Math.min(dt, 0.05); t += dt;
    if (envT < 1) { envT = Math.min(1, envT + dt / envDur); env = lerpEnv(envFrom, envTo, ease.inOutCubic(envT)); applyEnv(env); }
    for (const tw of tweens) { tw.e += dt; const k = tw.d > 0 ? clamp(tw.e / tw.d) : tw.e >= 0 ? 1 : 0; tw.f(tw.ease(k)); if (k >= 1) { tweens.delete(tw); tw.done?.(); } }
    controls.update(dt);
    for (const f of ticks) f(dt, t);
    for (const L of labels) {
      L.sprite.getWorldPosition(tmp); const dist = tmp.distanceTo(camera.position), s = clamp(dist * L.k, L.min, L.max);
      L.sprite.scale.set(s * L.sprite.userData.aspect, s, 1);
      L.sprite.material.opacity = L.fade ? clamp((L.fade - dist) / 120) : 1; L.sprite.visible = L.sprite.material.opacity > 0.02;
    }
    renderer.info.reset();
    composer ? composer.render() : renderer.render(scene, camera);
    frames++;
  });
  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); bloom.resolution.set(w, h); }
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();

  /* --- clique / hover (raycast com limiar de arraste de 6 px) --- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickRoots = [];
  let down = null, hoverQueued = false, lastMove = null;
  function cast(ev) {
    const rc = el.getBoundingClientRect();
    ndc.set(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(pickRoots, true)) {
      let o = h.object; while (o && !o.userData.pick) o = o.parent;
      if (o) return { data: o.userData.pick, object: o, point: h.point, instanceId: h.instanceId };
    }
    return null;
  }
  el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  el.addEventListener('pointerup', (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 6) return; emit('pick', cast(e));
  });
  el.addEventListener('pointermove', (e) => {
    lastMove = e; if (hoverQueued || e.pointerType === 'touch') return; hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; const h = cast(lastMove); el.style.cursor = h ? 'pointer' : ''; emit('hover', h); });
  });

  const stage = {
    THREE, scene, camera, controls, renderer, quality,
    get time() { return timeName; }, get frames() { return frames; }, get elapsed() { return t; },
    onTick(f) { ticks.add(f); return () => ticks.delete(f); },
    on(n, f) { (listeners[n] ||= []).push(f); return stage; },
    tween(d, f, { ease: e = ease.inOutCubic, delay = 0, done } = {}) { const tw = { d, f, ease: e, e: -delay, done }; tweens.add(tw); return tw; },
    setTime(name, { duration = 1.2 } = {}) {
      const target = toState(PALETTES[name] || PALETTES.dia); timeName = name;
      if (!duration) { env = target; envT = 1; applyEnv(env); return; }
      envFrom = env; envTo = target; envT = 0; envDur = duration;
    },
    /** adiciona objeto e liga os ticks dele (guindaste girando, antena piscando…) */
    add(obj, data) {
      scene.add(obj);
      obj.traverse((o) => { if (o.userData.tick) ticks.add(o.userData.tick); });
      if (data) stage.pickable(obj, data);
      return obj;
    },
    pickable(obj, data) { obj.userData.pick = data; pickRoots.push(obj); return obj; },
    /** remove da cena e desliga ticks e clique (use ao recriar objetos) */
    remove(obj) {
      obj.parent?.remove(obj);
      obj.traverse((o) => { if (o.userData.tick) ticks.delete(o.userData.tick); const i = pickRoots.indexOf(o); if (i >= 0) pickRoots.splice(i, 1); });
    },
    addLabel(text, pos, o = {}) {
      const s = makeLabel(text, o); s.position.copy(pos); (o.parent || scene).add(s);
      const L = { sprite: s, k: o.k ?? 0.03, min: o.min ?? 2.2, max: o.max ?? 26, fade: o.fade ?? 0 };
      labels.push(L); if (o.data) stage.pickable(s, o.data); return s;
    },
    /** enquadra uma área {width, depth} ou layout */
    frame(area, { dist = 1.15, dir = [1, 1.05, 1.1] } = {}) {
      const size = Math.max(area.width, area.depth); center.set(area.x || 0, 0, area.z || 0);
      controls.target.copy(center);
      camera.position.copy(center).add(new THREE.Vector3(...dir).normalize().multiplyScalar(size * dist / Math.tan((camera.fov * Math.PI) / 360) * 0.5));
      controls.maxDistance = size * 4;
      const sc = sun.shadow.camera, half = size * 0.62 + 30; Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 1600 }); sc.updateProjectionMatrix();
      scene.fog.near = size * 1.1; scene.fog.far = size * 4.2; applyEnv(env); controls.update();
    },
    /** voa até um ponto mantendo a direção atual da câmera */
    flyTo(point, { distance = 80, duration = 1.3, done } = {}) {
      const t0 = controls.target.clone(), p0 = camera.position.clone();
      const dir = p0.clone().sub(t0).normalize(), t1 = point.clone(), p1 = point.clone().add(dir.multiplyScalar(distance));
      return stage.tween(duration, (k) => { controls.target.lerpVectors(t0, t1, k); camera.position.lerpVectors(p0, p1, k); }, { done });
    },
    /** animação de inauguração: prédio sobe do chão + anel de poeira */
    animateBuild(obj, { duration = 1.6, delay = 0 } = {}) {
      if (REDUCED_MOTION()) return;
      obj.scale.y = 0.001;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff3dc', transparent: true, opacity: 0, depthWrite: false }));
      ring.position.copy(obj.position).setY(0.3); scene.add(ring);
      const R = Math.max(obj.userData.footprint?.w ?? 10, obj.userData.footprint?.d ?? 10);
      stage.tween(duration, (k) => { obj.scale.y = Math.max(0.001, k); ring.scale.setScalar(R * (0.5 + k)); ring.material.opacity = (1 - k) * 0.8; }, { ease: ease.outCubic, delay, done: () => scene.remove(ring) });
    },
    /** mescla prédios estáticos por material (centenas de draw calls → dezenas). Ver bakeStatic. */
    bake(roots, opts) { return bakeStatic(scene, roots, opts); },
    stats() { return { fps: null, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: quality.name }; },
    // Ajuste local: também solta o observador de tamanho, os controles e o gerador de ambiente.
    dispose() { renderer.setAnimationLoop(null); resizeObserver.disconnect(); controls.dispose(); pmrem.dispose(); composer?.dispose?.(); renderer.dispose(); el.remove(); },
  };
  applyEnv(env);
  return stage;
}
