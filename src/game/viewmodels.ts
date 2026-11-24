import * as THREE from 'three';
import { Humanoid } from './humanoid';
import type { Outfit } from './humanoid';

export interface ViewModel {
  group: THREE.Group;
  base: THREE.Vector3;
  ball?: THREE.Mesh;
  stand?: Humanoid;
  spin?: THREE.Object3D[];
}

const lam = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });

function bx(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, e = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c, e));
  m.position.set(x, y, z);
  return m;
}
function cyl(r: number, len: number, c: number, x = 0, y = 0, z = 0, e = 0, r2?: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, len, 10), lam(c, e));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
function sph(r: number, c: number, x = 0, y = 0, z = 0, basic = false) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), basic ? new THREE.MeshBasicMaterial({ color: c }) : lam(c));
  m.position.set(x, y, z);
  return m;
}

const SKIN = 0xe0ac69;

function stand(outfit: Outfit, skin: number, extra?: (h: Humanoid) => void): ViewModel {
  const g = new THREE.Group();
  const h = new Humanoid(outfit, skin, 0.8, false);
  h.arms[0].rotation.x = -1.2;
  h.arms[1].rotation.x = -1.4;
  extra?.(h);
  g.add(h.group);
  h.group.rotation.y = 0.15;
  return { group: g, base: new THREE.Vector3(0.62, -1.15, -1.55), stand: h };
}

export function buildViewModel(level: number): ViewModel {
  const g = new THREE.Group();
  const base = new THREE.Vector3(0.3, -0.28, -0.6);
  const vm: ViewModel = { group: g, base };
  switch (level) {
    case 1: {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 10), lam(0xf97316));
      c.rotation.x = -Math.PI / 2;
      c.position.set(0, 0, -0.28);
      g.add(c);
      for (const a of [-0.5, 0, 0.5]) {
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 6), lam(0x22c55e));
        l.rotation.x = Math.PI / 2 + a * 0.3;
        l.rotation.z = a;
        l.position.set(a * 0.04, 0, 0.1);
        g.add(l);
      }
      g.add(bx(0.07, 0.07, 0.09, SKIN, 0, -0.02, 0.02));
      break;
    }
    case 2: {
      g.add(bx(0.04, 0.04, 0.6, 0x7a4a21, 0, 0, -0.2));
      g.add(bx(0.04, 0.06, 0.3, 0x9ca3af, 0, 0, -0.5));
      g.add(bx(0.3, 0.05, 0.06, 0x9ca3af, 0, 0, -0.5));
      g.add(bx(0.07, 0.07, 0.09, SKIN, 0, -0.02, 0.02));
      break;
    }
    case 3: {
      g.add(bx(0.06, 0.07, 0.3, 0x1f2937, 0, 0, -0.16));
      g.add(bx(0.05, 0.13, 0.07, 0x111827, 0, -0.09, -0.03));
      g.add(bx(0.07, 0.07, 0.09, SKIN, 0, -0.1, -0.02));
      break;
    }
    case 4: {
      g.add(bx(0.07, 0.1, 0.45, 0x8b5a2b, 0, -0.02, -0.0));
      g.add(cyl(0.015, 0.6, 0x4b5563, 0, 0.02, -0.5));
      g.add(bx(0.03, 0.03, 0.06, 0x9ca3af, 0.05, 0.03, -0.18));
      break;
    }
    case 5: {
      g.add(bx(0.07, 0.1, 0.5, 0x2d2d33, 0, 0, -0.1));
      g.add(bx(0.06, 0.07, 0.22, 0x8b5a2b, 0, -0.01, -0.42));
      g.add(cyl(0.015, 0.25, 0x4b5563, 0, 0.02, -0.65));
      const mag = bx(0.05, 0.2, 0.07, 0x1f2937, 0, -0.14, -0.15);
      mag.rotation.x = 0.35;
      g.add(mag);
      g.add(bx(0.06, 0.09, 0.14, 0x8b5a2b, 0, -0.02, 0.2));
      break;
    }
    case 6: {
      g.add(bx(0.08, 0.1, 0.8, 0x4b5563, 0, 0, -0.15));
      g.add(cyl(0.02, 0.5, 0x374151, 0, 0.01, -0.8));
      g.add(cyl(0.04, 0.3, 0x111827, 0, 0.1, -0.15));
      g.add(bx(0.03, 0.09, 0.03, 0x111827, 0, -0.07, -0.55));
      g.add(bx(0.06, 0.09, 0.2, 0x374151, 0, -0.01, 0.3));
      break;
    }
    case 7: {
      g.add(cyl(0.075, 1.0, 0x4d7c0f, -0.05, 0.06, -0.35));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 10), lam(0xb91c1c));
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(-0.05, 0.06, -1.0);
      g.add(cone);
      g.add(bx(0.04, 0.12, 0.04, 0x1f2937, -0.05, -0.04, -0.2));
      break;
    }
    case 8: {
      g.add(bx(0.035, 0.07, 1.0, 0xe2e8f0, 0, 0, -0.6, 0x223344));
      g.add(bx(0.22, 0.035, 0.04, 0xfacc15, 0, 0, -0.1));
      g.add(bx(0.04, 0.04, 0.2, 0x7c2d12, 0, 0, 0.02));
      g.add(sph(0.035, 0xfacc15, 0, 0, 0.14));
      break;
    }
    case 9: {
      g.add(cyl(0.02, 0.6, 0x7a4a21, 0, 0, -0.15));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
      tip.rotation.x = -Math.PI / 2;
      tip.position.set(0, 0, -0.58);
      g.add(tip);
      g.add(bx(0.07, 0.07, 0.09, SKIN, 0, -0.02, 0.05));
      break;
    }
    case 10: {
      g.add(sph(0.13, 0x9ca3af, 0, 0, -0.3));
      g.add(sph(0.095, 0xb0b5bd, 0, 0.14, -0.38));
      g.add(bx(0.2, 0.05, 0.03, 0x111111, 0, 0.16, -0.46));
      g.add(bx(0.04, 0.07, 0.03, 0x111111, -0.06, 0.24, -0.38));
      g.add(bx(0.04, 0.07, 0.03, 0x111111, 0.06, 0.24, -0.38));
      const tail = cyl(0.04, 0.3, 0x6b7280, 0, 0.02, -0.08);
      g.add(tail);
      for (const z of [-0.02, -0.12]) g.add(cyl(0.045, 0.04, 0x111111, 0, 0.02, z));
      g.add(sph(0.025, 0xffffff, -0.04, 0.17, -0.47, true));
      g.add(sph(0.025, 0xffffff, 0.04, 0.17, -0.47, true));
      break;
    }
    case 11:
      return stand({ label: '', shirt: 0xcbd5e1, pants: 0xa8b4c4, hat: 'hardhat', hatColor: 0xe5e7eb, shoes: 0x94a3b8 }, 0xd1d5db, (h) => {
        const rapier = bx(0.03, 1.2, 0.03, 0xf1f5f9, 0, -1.05, 0, 0x334455);
        h.arms[1].add(rapier);
      });
    case 12:
      return stand({ label: '', shirt: 0xdc2626, pants: 0xb91c1c, hat: 'none', hair: 0xf59e0b, shoes: 0x7f1d1d }, 0xf97316, (h) => {
        for (const s of [-1, 1]) h.body.add(bx(0.18, 0.3, 0.18, 0xffa31a, s * 0.4, 1.7, 0.05, 0xff7a00));
        h.body.add(bx(0.1, 0.22, 0.34, 0xfacc15, 0, 1.98, -0.08, 0xffaa00));
      });
    case 13:
      return stand({ label: '', shirt: 0xf9a8d4, pants: 0xf472b6, hat: 'wig', hatColor: 0xfbcfe8, stripe: 0x111111, stripeDir: 'v', shoes: 0x111111 }, 0xfbcfe8, (h) => {
        for (const s of [-1, 1]) h.body.add(bx(0.08, 0.14, 0.06, 0xfbcfe8, s * 0.12, 2.05, 0));
      });
    case 14:
      return stand({ label: '', shirt: 0x7c3aed, pants: 0x6d28d9, hat: 'wig', hatColor: 0x111111, shoes: 0x4c1d95 }, 0xc4b5fd, (h) => {
        h.arms[0].rotation.x = -1.5;
        h.arms[1].rotation.x = -1.5;
      });
    case 15:
      return stand({ label: '', shirt: 0xfacc15, pants: 0xeab308, hat: 'wig', hatColor: 0xfde047, stripe: 0x22c55e, stripeDir: 'h', shoes: 0x15803d }, 0xfef08a, (h) => {
        h.arms[0].rotation.x = -1.5;
      });
    case 16: {
      g.add(bx(0.09, 0.09, 0.14, 0xf97316, -0.12, -0.02, -0.12));
      g.add(bx(0.09, 0.09, 0.14, 0xf97316, 0.12, -0.02, -0.12));
      const ball = sph(0.001, 0x7dd3fc, 0, 0.02, -0.35, true);
      g.add(ball);
      vm.ball = ball;
      base.set(0.0, -0.3, -0.6);
      break;
    }
    case 17: {
      g.add(bx(0.14, 0.14, 0.14, 0xfacc15, 0, 0, -0.22));
      g.add(bx(0.1, 0.1, 0.35, 0xffffff, 0, -0.01, 0.02));
      g.add(bx(0.15, 0.03, 0.03, 0xdc2626, 0, 0.08, -0.15));
      break;
    }
    case 18: {
      g.add(bx(0.14, 0.15, 0.22, 0xfbbf24, 0, 0, -0.2, 0x553300));
      g.add(bx(0.1, 0.1, 0.35, 0xb45309, 0, -0.01, 0.05));
      const gems = [0xa855f7, 0x3b82f6, 0xef4444, 0xfacc15, 0x22c55e, 0xf97316];
      gems.forEach((c, i) => g.add(sph(0.022, c, -0.055 + (i % 3) * 0.055, 0.082 - Math.floor(i / 3) * 0.03, -0.29, true)));
      break;
    }
    case 19: {
      g.add(bx(0.025, 0.07, 0.34, 0xfacc15, 0, 0, -0.3, 0x664400));
      g.add(bx(0.05, 0.05, 0.12, 0x1f2937, 0, 0, -0.04));
      g.add(bx(0.1, 0.02, 0.03, 0xfacc15, 0, 0, -0.12));
      break;
    }
    case 21: {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
      orb.position.set(0, 0.03, -0.4);
      g.add(orb);
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      r1.position.copy(orb.position);
      r1.rotation.x = 1.2;
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.008, 6, 28), new THREE.MeshBasicMaterial({ color: 0xc4b5fd }));
      r2.position.copy(orb.position);
      r2.rotation.y = 1.2;
      g.add(r1, r2);
      g.add(sph(0.05, 0xffffff, 0, 0.03, -0.49, true));
      g.add(sph(0.024, 0x111111, 0, 0.03, -0.535, true));
      g.add(bx(0.08, 0.08, 0.12, SKIN, 0, -0.08, -0.12));
      vm.spin = [r1, r2, orb];
      break;
    }
    default: {
      g.add(bx(0.3, 0.1, 0.22, 0x7f1d1d, 0, -0.04, -0.3));
      g.add(cyl(0.06, 0.04, 0xfacc15, 0, 0.02, -0.3));
      g.add(sph(0.035, 0xef4444, 0, 0.05, -0.3, true));
      break;
    }
  }
  return vm;
}

export function disposeViewModel(vm: ViewModel) {
  vm.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((x) => {
          if (!x.userData.shared) x.dispose();
        });
      } else if (mat && !mat.userData.shared) {
        mat.dispose();
      }
    }
  });
}
