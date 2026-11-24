import * as THREE from 'three';

export interface Outfit {
  label: string;
  shirt: number;
  pants: number;
  shoes?: number;
  stripe?: number;
  stripeDir?: 'h' | 'v';
  hat?: 'beret' | 'conic' | 'ushanka' | 'cap' | 'hardhat' | 'safari' | 'hood' | 'wig' | 'headband' | 'none';
  hatColor?: number;
  hair?: number;
  hairStyle?: 'short' | 'long' | 'spiky' | 'pony';
  bald?: boolean;
  coat?: number;
  shorts?: boolean;
  sandals?: boolean;
  tie?: number;
  vest?: number;
  skirt?: number;
  scarf?: number;
  bulky?: boolean;
  goggles?: boolean;
  skin?: number[];
}

export const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e, 0xffdbac];

const geoCache = new Map<string, THREE.BoxGeometry>();
const matCache = new Map<number, THREE.MeshLambertMaterial>();
const tmpC = new THREE.Color();

function material(c: number) {
  let m = matCache.get(c);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    m.userData.shared = true;
    matCache.set(c, m);
  }
  return m;
}

function shade(c: number, f: number) {
  tmpC.setHex(c).multiplyScalar(f);
  return tmpC.getHex();
}

function mk(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, top = false) {
  const key = `${w},${h},${d},${top}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    if (top) g.translate(0, -h / 2, 0);
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  const m = new THREE.Mesh(g, material(color));
  m.position.set(x, y, z);
  return m;
}

let blobGeo: THREE.CircleGeometry | null = null;
let blobMat: THREE.MeshBasicMaterial | null = null;
const HAIRS = ['short', 'short', 'long', 'spiky', 'pony'] as const;

export class Humanoid {
  group = new THREE.Group();
  body = new THREE.Group();
  legs: THREE.Group[] = [];
  knees: THREE.Group[] = [];
  arms: THREE.Group[] = [];
  elbows: THREE.Group[] = [];
  phase = Math.random() * 6;
  dead = 0;
  deadTarget = 0;
  blob: THREE.Mesh;

  constructor(o: Outfit, skin: number, scale = 1, shadow = true) {
    const b = this.body;
    this.group.add(b);
    const bulk = o.bulky ? 1.3 : 1;
    const shoes = o.shoes ?? 0x222222;
    const skinDark = shade(skin, 0.8);
    const hairCol = o.hair ?? 0x2a1b10;

    // pernas: coxa + joelho + canela + pé
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.14, 0.8, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      const pw = 0.23 * (o.bulky ? 1.1 : 1);
      if (o.shorts) {
        leg.add(mk(0.25, 0.42, 0.26, o.pants, 0, 0, 0, true));
        knee.add(mk(0.19, 0.4, 0.2, skin, 0, 0, 0, true));
      } else {
        leg.add(mk(pw, 0.42, 0.25, o.pants, 0, 0, 0, true));
        knee.add(mk(pw * 0.92, 0.4, 0.23, o.pants, 0, 0, 0, true));
      }
      if (o.sandals) {
        knee.add(mk(0.22, 0.06, 0.34, 0x1b1b1b, 0, -0.37, -0.04));
        knee.add(mk(0.2, 0.08, 0.2, skin, 0, -0.33, -0.02));
      } else {
        knee.add(mk(0.25, 0.14, 0.34, shoes, 0, -0.33, -0.04));
        knee.add(mk(0.26, 0.03, 0.35, shade(shoes, 0.5), 0, -0.385, -0.04));
      }
      leg.add(knee);
      b.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
    }

    // tronco
    b.add(mk(0.56 * bulk, 0.7, 0.3 * bulk, o.shirt, 0, 1.15, 0));
    if (o.skirt === undefined && o.coat === undefined) b.add(mk(0.58 * bulk, 0.07, 0.32 * bulk, shade(o.pants, 0.6), 0, 0.83, 0));
    b.add(mk(0.32, 0.05, 0.22, shade(o.shirt, 0.82), 0, 1.5, 0));
    if (o.stripe !== undefined) {
      if (o.stripeDir === 'v') {
        for (const x of [-0.18, 0, 0.18]) b.add(mk(0.07, 0.7, 0.31 * bulk, o.stripe, x * bulk, 1.15, 0));
      } else {
        for (const y of [0.92, 1.08, 1.24, 1.4]) b.add(mk(0.575 * bulk, 0.06, 0.31 * bulk, o.stripe, 0, y, 0));
      }
    }
    if (o.vest !== undefined) b.add(mk(0.585 * bulk, 0.5, 0.32 * bulk, o.vest, 0, 1.22, 0));
    if (o.tie !== undefined) b.add(mk(0.07, 0.42, 0.02, o.tie, 0, 1.22, -0.16));
    if (o.coat !== undefined) {
      b.add(mk(0.62, 0.62, 0.36, o.coat, 0, 0.55, 0));
      b.add(mk(0.58, 0.14, 0.33, o.coat, 0, 1.0, 0));
    }
    if (o.skirt !== undefined) b.add(mk(0.64, 0.28, 0.36, o.skirt, 0, 0.78, 0));
    if (o.scarf !== undefined) b.add(mk(0.38, 0.12, 0.36, o.scarf, 0, 1.52, 0));

    // braços: ombro + cotovelo + mão
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.37 * bulk, 1.47, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -0.33;
      const shortSleeve = !!o.shorts && !o.bulky && o.coat === undefined;
      arm.add(mk(0.17 * bulk, 0.35, 0.19 * bulk, o.shirt, 0, 0, 0, true));
      if (o.coat !== undefined) arm.add(mk(0.19, 0.35, 0.21, o.coat, 0, 0, 0, true));
      elbow.add(mk(shortSleeve ? 0.14 : 0.155 * bulk, 0.32, shortSleeve ? 0.15 : 0.17 * bulk, shortSleeve ? skin : (o.coat ?? o.shirt), 0, 0, 0, true));
      elbow.add(mk(0.13, 0.1, 0.14, skin, 0, -0.33, 0, true));
      arm.add(elbow);
      b.add(arm);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }

    // cabeça e rosto
    b.add(mk(0.32, 0.34, 0.32, skin, 0, 1.68, 0));
    b.add(mk(0.38, 0.09, 0.07, skin, 0, 1.68, 0.01));
    for (const x of [-0.08, 0.08]) {
      b.add(mk(0.08, 0.055, 0.02, 0xffffff, x, 1.71, -0.163));
      b.add(mk(0.04, 0.045, 0.02, 0x111111, x, 1.71, -0.172));
    }
    b.add(mk(0.2, 0.025, 0.02, hairCol, 0, 1.77, -0.165));
    b.add(mk(0.05, 0.07, 0.05, skinDark, 0, 1.66, -0.18));
    b.add(mk(0.1, 0.02, 0.02, 0x6b2f2f, 0, 1.58, -0.165));

    if (!o.bald && o.hat !== 'ushanka' && o.hat !== 'hood' && o.hat !== 'wig') {
      const style = o.hairStyle ?? HAIRS[Math.floor(Math.random() * HAIRS.length)];
      b.add(mk(0.34, 0.1, 0.34, hairCol, 0, 1.87, 0));
      b.add(mk(0.34, 0.05, 0.04, hairCol, 0, 1.82, -0.15));
      if (style === 'long') {
        b.add(mk(0.34, 0.52, 0.08, hairCol, 0, 1.62, 0.14));
        for (const x of [-0.18, 0.18]) b.add(mk(0.04, 0.22, 0.3, hairCol, x, 1.76, 0.0));
      } else if (style === 'spiky') {
        for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [0, 0], [-0.1, 0.1], [0.1, 0.1]]) b.add(mk(0.07, 0.15, 0.07, hairCol, x, 1.98, z));
      } else if (style === 'pony') {
        b.add(mk(0.34, 0.22, 0.08, hairCol, 0, 1.76, 0.13));
        b.add(mk(0.08, 0.32, 0.08, hairCol, 0, 1.68, 0.22));
      } else {
        b.add(mk(0.34, 0.22, 0.08, hairCol, 0, 1.76, 0.13));
      }
    }
    if (o.goggles) {
      b.add(mk(0.36, 0.1, 0.1, 0x111827, 0, 1.71, -0.15));
      b.add(mk(0.3, 0.06, 0.04, 0x38bdf8, 0, 1.71, -0.2));
    }

    const hc = o.hatColor ?? 0x222222;
    switch (o.hat) {
      case 'beret': {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), material(hc));
        cyl.position.set(0.04, 1.89, 0);
        cyl.rotation.z = 0.12;
        b.add(cyl);
        b.add(mk(0.04, 0.06, 0.04, hc, 0.04, 1.94, 0));
        break;
      }
      case 'conic': {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.26, 14), material(hc));
        cone.position.set(0, 1.97, 0);
        b.add(cone);
        break;
      }
      case 'ushanka': {
        b.add(mk(0.38, 0.14, 0.38, hc, 0, 1.9, 0));
        b.add(mk(0.07, 0.24, 0.3, hc, -0.2, 1.74, 0));
        b.add(mk(0.07, 0.24, 0.3, hc, 0.2, 1.74, 0));
        b.add(mk(0.38, 0.2, 0.06, hc, 0, 1.78, 0.17));
        break;
      }
      case 'cap': {
        b.add(mk(0.35, 0.1, 0.35, hc, 0, 1.89, 0));
        b.add(mk(0.3, 0.03, 0.18, hc, 0, 1.83, -0.2));
        break;
      }
      case 'hardhat': {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), material(hc));
        dome.position.set(0, 1.84, 0);
        b.add(dome);
        b.add(mk(0.44, 0.03, 0.44, hc, 0, 1.85, 0));
        break;
      }
      case 'safari': {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16), material(hc));
        brim.position.set(0, 1.86, 0);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 12), material(hc));
        crown.position.set(0, 1.94, 0);
        b.add(brim, crown);
        break;
      }
      case 'hood': {
        b.add(mk(0.44, 0.44, 0.42, hc, 0, 1.7, 0.03));
        b.add(mk(0.36, 0.32, 0.04, skin, 0, 1.68, -0.2));
        b.add(mk(0.46, 0.08, 0.1, 0xeeeeee, 0, 1.86, -0.16));
        break;
      }
      case 'wig': {
        b.add(mk(0.38, 0.14, 0.38, hc, 0, 1.89, 0));
        b.add(mk(0.38, 0.5, 0.1, hc, 0, 1.68, 0.17));
        b.add(mk(0.08, 0.4, 0.3, hc, -0.2, 1.7, 0.03));
        b.add(mk(0.08, 0.4, 0.3, hc, 0.2, 1.7, 0.03));
        break;
      }
      case 'headband': {
        b.add(mk(0.345, 0.06, 0.345, hc, 0, 1.8, 0));
        break;
      }
      default:
        break;
    }

    if (shadow) {
      if (!blobGeo) {
        blobGeo = new THREE.CircleGeometry(0.55, 14);
        blobGeo.rotateX(-Math.PI / 2);
        blobGeo.userData.shared = true;
        blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
        blobMat.userData.shared = true;
      }
      this.blob = new THREE.Mesh(blobGeo, blobMat!);
      this.blob.position.y = 0.03;
      this.group.add(this.blob);
    } else {
      this.blob = new THREE.Mesh();
    }
    this.group.scale.setScalar(scale);
  }

  setDead(d: boolean, instant = false) {
    this.deadTarget = d ? 1 : 0;
    if (instant) this.dead = this.deadTarget;
  }

  animate(dt: number, speed: number) {
    this.dead += (this.deadTarget - this.dead) * Math.min(1, dt * 9);
    if (this.dead > 0.01) {
      this.body.rotation.x = -this.dead * (Math.PI / 2);
      this.body.position.y = this.dead * 0.2;
      this.blob.visible = false;
      this.elbows.forEach((e) => (e.rotation.x = -0.3));
      this.knees.forEach((k) => (k.rotation.x = 0.2));
      return;
    }
    this.blob.visible = true;
    this.phase += dt * (2 + speed * 1.5);
    const amp = Math.min(1, speed / 3.5) * 0.85;
    const c = Math.cos(this.phase);
    const s = Math.sin(this.phase) * amp;
    this.legs[0].rotation.x = s;
    this.legs[1].rotation.x = -s;
    this.knees[0].rotation.x = Math.max(0, -c) * amp * 1.25;
    this.knees[1].rotation.x = Math.max(0, c) * amp * 1.25;
    this.arms[0].rotation.x = -s * 0.9;
    this.arms[1].rotation.x = s * 0.9;
    const bend = -(0.12 + amp * 0.8);
    this.elbows[0].rotation.x = bend;
    this.elbows[1].rotation.x = bend;
    this.body.rotation.x = -0.05 * amp;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04 * amp;
  }

  holdGun() {
    this.arms[0].rotation.x = -1.35;
    this.arms[1].rotation.x = -1.2;
    this.elbows[0].rotation.x = -0.45;
    this.elbows[1].rotation.x = -0.6;
  }
}

export function makeLabel(text: string, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.roundRect(4, 4, 248, 40, 12);
  g.fill();
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 128, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.9, 0.36, 1);
  sp.position.y = 2.35;
  return sp;
}

export function disposeHumanoidCaches() {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
  blobGeo?.dispose();
  blobGeo = null;
  blobMat?.dispose();
  blobMat = null;
}
