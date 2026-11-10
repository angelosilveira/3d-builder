/**
 * kit-domains.js — peças específicas de negócio sobre o city-kit.
 *   ISP  → provedor de internet (torre, poste, fibra, pulsos de dados, cobertura, status de cliente)
 *   Obra → construtora / imobiliária (lote, torre com unidades por status, piscina, muro)
 * Escala: 1 unidade = 1 metro.
 */
import {
  THREE, mat, MATS, box, cyl, boxGeometry, beamGeometry, mergedMesh, mergeGeometries, rng, range, clamp,
  TEXTURES, NIGHT, Buildings, makeSign, facadeBlock, FACADES,
} from './city-kit.js';

/* ============================== PROVEDOR (ISP) ============================== */
export const ISP_STATUS = { online: '#2fbf71', offline: '#e5484d', instalando: '#f0b43c', lento: '#f08c3c' };

export const ISP = {
  /** torre treliçada estaiada com faixas de balizamento, antenas setoriais, parábolas e luz piscando */
  tower({ h = 36, base = 2.6, top = 0.7, seed = 1 } = {}) {
    const g = new THREE.Group(), red = [], white = [], seg = Math.round(h / 4);
    const leg = (k, y) => { const s = base + (top - base) * (y / h); return new THREE.Vector3(k % 2 ? s : -s, y, k > 1 ? s : -s); };
    const order = [0, 1, 3, 2];
    for (let i = 0; i < seg; i++) {
      const y0 = (i * h) / seg, y1 = ((i + 1) * h) / seg, list = Math.floor(i / 2) % 2 ? white : red;
      for (let a = 0; a < 4; a++) {
        const k = order[a], k2 = order[(a + 1) % 4];
        list.push(beamGeometry(leg(k, y0), leg(k, y1), 0.12));          // montante
        list.push(beamGeometry(leg(k, y1), leg(k2, y1), 0.05));         // anel
        list.push(beamGeometry(leg(k, y0), leg(k2, y1), 0.04));         // diagonal
      }
    }
    g.add(mergedMesh(red, mat('#d9412b', { rough: 0.6 })), mergedMesh(white, mat('#f1efe9', { rough: 0.6 })));
    g.add(box(top * 3.4, 0.25, top * 3.4, MATS.metalDark(), 0, h, 0));
    const ant = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2, x = Math.cos(a) * (top + 0.6), z = Math.sin(a) * (top + 0.6);
      ant.push(new THREE.BoxGeometry(0.35, 2.2, 0.7).rotateY(-a).translate(x, h + 1.4, z));
    }
    g.add(mergedMesh(ant, mat('#e8e8e4', { rough: 0.5 })));
    for (const [y, a] of [[h * 0.72, 0.6], [h * 0.55, 2.4]]) {
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 20).rotateZ(Math.PI / 2), mat('#f4f3ef', { rough: 0.4 }));
      dish.position.set(Math.cos(a) * 1.6, y, Math.sin(a) * 1.6); dish.rotation.y = -a; dish.castShadow = true; g.add(dish);
    }
    g.add(cyl(0.05, 0.05, 3, MATS.metalLight(), 0, h + 0.25, 0, 5));
    const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), beaconMat); beacon.position.y = h + 3.3; g.add(beacon);
    g.userData = { kind: 'isp-tower', footprint: { w: base * 2, d: base * 2 }, height: h + 3.5, top: new THREE.Vector3(0, h + 1.4, 0) };
    g.userData.tick = (dt, t) => { const on = (t % 1.6) < 0.5; beaconMat.color.setScalar(0).setRGB(on ? 3 : 0.4, on ? 0.3 : 0.05, on ? 0.2 : 0.03); };
    return g;
  },
  /** poste de concreto com cruzeta, isoladores e (opcional) CTO — caixa de atendimento */
  pole({ h = 9, cto = false } = {}) {
    const g = new THREE.Group();
    g.add(cyl(0.11, 0.18, h, mat('#b8b4ab', { rough: 0.9 }), 0, 0, 0, 8));
    g.add(mergedMesh([boxGeometry(2.2, 0.12, 0.12, 0, h - 0.7, 0), boxGeometry(0.1, 0.25, 0.1, -0.9, h - 0.58, 0), boxGeometry(0.1, 0.25, 0.1, 0.9, h - 0.58, 0)], mat('#5d636b', { rough: 0.6 })));
    if (cto) {
      g.add(box(0.5, 0.65, 0.25, mat('#2f3338', { rough: 0.5 }), 0, h - 2.6, 0.24));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2fff8a').multiplyScalar(2.5), toneMapped: false }));
      led.position.set(0.15, h - 2.1, 0.38); g.add(led);
    }
    g.userData = { kind: 'pole', footprint: { w: 0.4, d: 0.4 }, height: h, attach: new THREE.Vector3(0, h - 0.4, 0) };
    return g;
  },
  /** cabo pendurado (catenária aproximada) entre dois pontos do mundo */
  cable(a, b, { sag = 0.7, radius = 0.035, color = '#1b1f24' } = {}) {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= sag * 2;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 5), mat(color, { rough: 0.6 }));
    return { mesh, curve };
  },
  /** liga uma sequência de postes já posicionados; retorna as curvas para os pulsos */
  wire(stage, poles, opts = {}) {
    const curves = [], pts = poles.map((p) => { p.updateMatrixWorld(true); return p.localToWorld(p.userData.attach.clone()); });
    for (let i = 0; i < pts.length - 1; i++) { const c = ISP.cable(pts[i], pts[i + 1], opts); stage.scene.add(c.mesh); curves.push(c.curve); }
    return curves;
  },
  /** pulsos de luz viajando pelos cabos (InstancedMesh, brilham com bloom) */
  pulses(stage, curves, { color = '#53e6ff', perCurve = 1, speed = 22, size = 0.22 } = {}) {
    const n = curves.length * perCurve;
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }), n);
    const lens = curves.map((c) => c.getLength()), total = lens.reduce((a, b) => a + b, 0), o = new THREE.Object3D(), p = new THREE.Vector3();
    stage.scene.add(im);
    stage.onTick((dt, t) => {
      for (let k = 0; k < n; k++) {
        let d = (t * speed + (k / n) * total) % total, ci = 0;
        while (d > lens[ci]) { d -= lens[ci]; ci++; }
        curves[ci].getPointAt(clamp(d / lens[ci]), p); o.position.copy(p); o.updateMatrix(); im.setMatrixAt(k, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    return im;
  },
  /** cúpula translúcida de cobertura + ondas expandindo no chão */
  coverage(stage, center, { radius = 120, color = '#3fb6ff', waves = 3, period = 3.5 } = {}) {
    const g = new THREE.Group(); g.position.copy(center).setY(0.25);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
    g.add(dome);
    const edge = new THREE.Mesh(new THREE.RingGeometry(radius - 0.6, radius, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    g.add(edge);
    const rings = Array.from({ length: waves }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })); g.add(m); return m; });
    stage.scene.add(g);
    stage.onTick((dt, t) => rings.forEach((m, i) => { const k = ((t / period + i / waves) % 1); m.scale.setScalar(Math.max(0.01, k * radius)); m.material.opacity = (1 - k) * 0.7; }));
    g.userData = { kind: 'coverage', radius };
    return g;
  },
  /** pino de status de cliente (sprite) — use stage.addLabel para escalar automaticamente */
  pin(stage, text, pos, status = 'online', data) {
    return stage.addLabel(text, pos, { dot: ISP_STATUS[status] || status, data, k: 0.022, min: 1.6, max: 9 });
  },
  /** POP / data center: galpão pequeno com fileiras de LEDs */
  pop({ w = 16, d = 10, h = 5 } = {}) {
    const g = Buildings.warehouse({ w, d, h, solar: false, docks: 1 });
    const leds = []; for (let i = 0; i < 10; i++) leds.push(boxGeometry(0.5, 0.12, 0.05, -w / 2 + 1.5 + i * 1.3, h * 0.55, d / 2 + 0.06));
    g.add(mergedMesh(leds, mat('#53e6ff', { emissive: '#53e6ff', glow: 2.5 }), false));
    g.userData.kind = 'isp-pop';
    return g;
  },
};

/* ============================== CONSTRUTORA (Obra) ============================== */
export const UNIT_STATUS = { disponivel: '#2fbf71', reservado: '#f0b43c', vendido: '#9aa0a6', obra: '#5b8def' };

export const Obra = {
  /** lote vazio: terra, estacas de divisa e placa com o status */
  lot({ w = 12, d = 25, status = 'disponivel', label } = {}) {
    const g = new THREE.Group(), color = UNIT_STATUS[status] || status;
    g.add(box(w - 0.3, 0.08, d - 0.3, mat('#ffffff', { map: TEXTURES.dirt(), rough: 1 }), 0, 0, 0));
    const stakes = []; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stakes.push(boxGeometry(0.12, 0.9, 0.12, (x * (w - 0.4)) / 2, 0, (z * (d - 0.4)) / 2));
    g.add(mergedMesh(stakes, mat('#c9a46a')));
    g.add(box(0.08, 1.6, 0.08, MATS.metalDark(), 0, 0, d / 2 - 1.2));
    const s = makeSign(label || status.toUpperCase(), { bg: color, fg: '#ffffff', height: 0.6, glow: 0.6 }); s.position.set(0, 1.7, d / 2 - 1.15); g.add(s);
    g.userData = { kind: 'lot', footprint: { w, d }, height: 2.3, status };
    return g;
  },
  /**
   * torre residencial com UNIDADES individuais clicáveis (InstancedMesh, cor por status).
   * status(floor, col) → 'disponivel' | 'reservado' | 'vendido'
   * Clique: hit.instanceId → tower.userData.units[instanceId]
   */
  unitsTower({ floors = 12, cols = 4, unitW = 7, unitD = 14, floorH = 2.9, status = () => 'disponivel', name = 'Torre A', showStatus = true } = {}) {
    const g = new THREE.Group(), w = cols * unitW, d = unitD, h = floors * floorH;
    g.add(facadeBlock(w, h, d, 'residential', { tint: '#f4f1ea' }));
    const units = [], n = floors * cols;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { rough: 0.35, metal: 0.1, transparent: true, opacity: 0.88 }), n);
    const o = new THREE.Object3D(), c = new THREE.Color(); let i = 0;
    for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
      const st = status(f, k);
      o.position.set(-w / 2 + unitW * (k + 0.5), f * floorH + floorH * 0.52, d / 2 + 0.75); o.scale.set(unitW - 0.6, floorH * 0.78, 1.4); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(showStatus ? UNIT_STATUS[st] || st : '#e9e6e0'));
      units.push({ id: `${name}-${String(f + 1).padStart(2, '0')}${k + 1}`, floor: f + 1, col: k + 1, status: st });
      i++;
    }
    im.castShadow = true; g.add(im);
    g.add(box(w + 1, 0.6, d + 1, mat('#cfd3d6', { rough: 0.6 }), 0, h, 0));
    const s = makeSign(name, { height: 1.6 }); s.position.set(0, h + 1.6, d / 2 + 0.6); g.add(s);
    g.userData = { kind: 'units-tower', footprint: { w, d: d + 1.5 }, height: h + 2.5, units, unitsMesh: im };
    /** recolore em tempo real: tower.userData.setStatus(index, 'vendido') */
    g.userData.setStatus = (idx, st) => { units[idx].status = st; im.setColorAt(idx, c.set(UNIT_STATUS[st] || st)); im.instanceColor.needsUpdate = true; };
    return g;
  },
  pool({ w = 8, d = 4 } = {}) {
    const g = new THREE.Group(), t = TEXTURES.water().clone(); t.repeat.set(w / 4, d / 4); t.needsUpdate = true;
    g.add(box(w + 1.2, 0.25, d + 1.2, mat('#e8e2d6', { rough: 0.8 }), 0, 0, 0));
    const water = box(w, 0.06, d, mat('#ffffff', { map: t, rough: 0.05, metal: 0.1 }), 0, 0.22, 0); water.castShadow = false; g.add(water);
    g.userData = { kind: 'pool', footprint: { w: w + 1.2, d: d + 1.2 }, height: 0.3, tick: (dt) => { t.offset.x += dt * 0.02; t.offset.y += dt * 0.013; } };
    return g;
  },
  /** muro de condomínio com portaria na frente (+Z) */
  wall({ w = 120, d = 90, h = 2.4, gate = 10 } = {}) {
    const g = new THREE.Group(), t = 0.25, geos = [];
    geos.push(boxGeometry(w, h, t, 0, 0, -d / 2), boxGeometry(t, h, d, -w / 2, 0, 0), boxGeometry(t, h, d, w / 2, 0, 0));
    geos.push(boxGeometry((w - gate) / 2, h, t, -(w + gate) / 4, 0, d / 2), boxGeometry((w - gate) / 2, h, t, (w + gate) / 4, 0, d / 2));
    g.add(mergedMesh(geos, mat('#e6e0d4', { rough: 0.9 })));
    g.add(box(5, 3, 4, mat('#ffffff', { rough: 0.6 }), gate / 2 + 3, 0, d / 2 - 2.5));
    g.add(box(6.5, 0.25, 5.5, mat('#3a4048'), gate / 2 + 3, 3, d / 2 - 2.5));
    g.userData = { kind: 'wall', footprint: { w, d }, height: h };
    return g;
  },
};
