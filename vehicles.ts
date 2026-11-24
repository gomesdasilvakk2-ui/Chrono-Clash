import * as THREE from 'three';

export type VehicleKind = 'skate' | 'bike' | 'unicycle' | 'horse';

export interface VehicleDef {
  kind: VehicleKind;
  name: string;
  emoji: string;
  maxSpeed: number;
  accel: number;
  friction: number;
  jump: number;
  eye: number;
  r: number;
  h: number;
  ram: number;
  shoot: 'all' | 'one' | 'none';
  special: string;
  desc: string;
}

export const VEHICLES: Record<VehicleKind, VehicleDef> = {
  skate: {
    kind: 'skate',
    name: 'Skate',
    emoji: '🛹',
    maxSpeed: 15,
    accel: 22,
    friction: 0.35,
    jump: 9.6,
    eye: 1.85,
    r: 0.45,
    h: 1.85,
    ram: 1,
    shoot: 'all',
    special: 'Botão direito: Ollie alto. Pule em corrimãos para fazer GRIND.',
    desc: 'Altíssima agilidade, saltos altos e grinds em corrimãos.',
  },
  bike: {
    kind: 'bike',
    name: 'Bicicleta Caloi',
    emoji: '🚲',
    maxSpeed: 12,
    accel: 14,
    friction: 1.4,
    jump: 8.2,
    eye: 1.85,
    r: 0.5,
    h: 2.1,
    ram: 2,
    shoot: 'one',
    special: 'Botão direito: Empinar com turbo. Só armas de uma mão ao pedalar.',
    desc: 'Boa velocidade; permite atirar com armas de uma mão enquanto pedala.',
  },
  unicycle: {
    kind: 'unicycle',
    name: 'Monociclo',
    emoji: '🎪',
    maxSpeed: 8.5,
    accel: 10,
    friction: 2.2,
    jump: 7.4,
    eye: 2.35,
    r: 0.45,
    h: 2.3,
    ram: 1,
    shoot: 'none',
    special: 'Botão direito: Ataque giratório de 360°. Difícil de controlar!',
    desc: 'Difícil de controlar, mas tem um ataque giratório de 360°.',
  },
  horse: {
    kind: 'horse',
    name: 'Cavalo',
    emoji: '🐎',
    maxSpeed: 16.5,
    accel: 20,
    friction: 2.0,
    jump: 11.2,
    eye: 2.85,
    r: 0.7,
    h: 2.7,
    ram: 3,
    shoot: 'all',
    special: 'Botão direito: Coice mortal para trás. Quebra madeira e pula cercas.',
    desc: 'Destrói madeira por impacto, pula cercas e desfere coices mortais.',
  },
};

export interface VehicleModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  legs: THREE.Object3D[];
  phase: number;
}

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });

function box(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
}

function wheel(r: number, tube: number, c: number) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 18), mat(c));
  t.rotation.y = Math.PI / 2;
  g.add(t);
  const spoke = box(0.02, r * 2, 0.02, 0xcccccc);
  const spoke2 = box(0.02, 0.02, r * 2, 0xcccccc);
  g.add(spoke, spoke2);
  return g;
}

/** O modelo "olha" para -Z */
export function buildVehicleModel(kind: VehicleKind): VehicleModel {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const legs: THREE.Object3D[] = [];
  if (kind === 'skate') {
    group.add(box(0.5, 0.07, 1.5, 0xfacc15, 0, 0.2, 0));
    group.add(box(0.5, 0.075, 0.25, 0x111111, 0, 0.2, -0.65));
    group.add(box(0.5, 0.075, 0.25, 0x111111, 0, 0.2, 0.65));
    for (const z of [-0.5, 0.5])
      for (const x of [-0.2, 0.2]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), mat(0xef4444));
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.1, z);
        group.add(w);
        wheels.push(w);
      }
  } else if (kind === 'bike') {
    const wf = wheel(0.4, 0.045, 0x111111);
    wf.position.set(0, 0.42, -0.6);
    const wb = wheel(0.4, 0.045, 0x111111);
    wb.position.set(0, 0.42, 0.6);
    group.add(wf, wb);
    wheels.push(wf, wb);
    const red = 0xdc2626;
    const bar = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
      const m = box(0.05, 0.05, len, red);
      m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      m.lookAt(x2, y2, z2);
      group.add(m);
    };
    bar(0, 0.42, 0.6, 0, 0.85, 0.15);
    bar(0, 0.42, 0.6, 0, 0.42, 0.0);
    bar(0, 0.42, 0.0, 0, 0.85, 0.15);
    bar(0, 0.85, 0.15, 0, 0.9, -0.5);
    bar(0, 0.9, -0.5, 0, 0.42, -0.6);
    group.add(box(0.5, 0.04, 0.04, 0x111111, 0, 0.98, -0.5));
    group.add(box(0.14, 0.06, 0.3, 0x111111, 0, 0.92, 0.2));
    group.add(box(0.3, 0.04, 0.08, 0x111111, 0, 0.35, 0.0));
  } else if (kind === 'unicycle') {
    const w = wheel(0.42, 0.06, 0x7c3aed);
    w.position.set(0, 0.45, 0);
    group.add(w);
    wheels.push(w);
    group.add(box(0.06, 0.6, 0.06, 0xfacc15, 0.12, 0.85, 0));
    group.add(box(0.06, 0.6, 0.06, 0xfacc15, -0.12, 0.85, 0));
    group.add(box(0.06, 0.9, 0.06, 0xfacc15, 0, 1.25, 0));
    group.add(box(0.2, 0.07, 0.36, 0xef4444, 0, 1.72, 0));
    group.add(box(0.5, 0.04, 0.1, 0x111111, 0, 0.45, 0));
  } else {
    const brown = 0x7a4a21;
    const dark = 0x2b1a0d;
    group.add(box(0.7, 0.8, 1.7, brown, 0, 1.35, 0));
    const neck = box(0.3, 0.95, 0.34, brown, 0, 1.95, -0.95);
    neck.rotation.x = -0.45;
    group.add(neck);
    const head = box(0.28, 0.32, 0.72, brown, 0, 2.38, -1.4);
    head.rotation.x = 0.35;
    group.add(head);
    group.add(box(0.2, 0.2, 0.2, 0xd6b38a, 0, 2.28, -1.72));
    group.add(box(0.06, 0.15, 0.06, dark, -0.1, 2.5, -1.2));
    group.add(box(0.06, 0.15, 0.06, dark, 0.1, 2.5, -1.2));
    const mane = box(0.08, 0.9, 0.2, dark, 0, 2.1, -0.82);
    mane.rotation.x = -0.45;
    group.add(mane);
    const tail = box(0.1, 0.8, 0.1, dark, 0, 1.2, 0.95);
    tail.rotation.x = 0.35;
    group.add(tail);
    group.add(box(0.76, 0.06, 0.6, 0xb91c1c, 0, 1.78, 0.1));
    for (const [x, z] of [
      [-0.22, -0.7],
      [0.22, -0.7],
      [-0.22, 0.7],
      [0.22, 0.7],
    ]) {
      const leg = new THREE.Group();
      leg.position.set(x, 1.0, z);
      const m = box(0.2, 1.0, 0.2, brown, 0, -0.5, 0);
      const hoof = box(0.22, 0.12, 0.24, dark, 0, -1.0, 0);
      leg.add(m, hoof);
      group.add(leg);
      legs.push(leg);
    }
  }
  return { group, wheels, legs, phase: 0 };
}

export function animateVehicle(m: VehicleModel, kind: VehicleKind, dist: number, speed: number, tilt: number) {
  for (const w of m.wheels) w.rotation.x -= dist / (kind === 'skate' ? 0.1 : 0.42);
  if (m.legs.length) {
    m.phase += dist * 1.6;
    const amp = Math.min(1, speed / 8) * 0.9;
    const offs = [0, Math.PI, Math.PI, 0];
    m.legs.forEach((l, i) => (l.rotation.x = Math.sin(m.phase + offs[i]) * amp));
  }
  m.group.rotation.z = tilt;
}
