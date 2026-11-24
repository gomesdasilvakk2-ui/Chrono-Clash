import * as THREE from 'three';
import { W, D } from './world';
import { clamp, smooth } from './rng';

const cA = new THREE.Color(0xfff2b0);
const cB = new THREE.Color(0xff8a2a);
const cC = new THREE.Color(0x5a4a45);
const tmp = new THREE.Color();

function cloudColor(t: number, out: THREE.Color) {
  if (t < 5) out.copy(cA).lerp(cB, clamp(t / 4, 0, 1));
  else out.copy(cB).lerp(cC, clamp((t - 5) / 9, 0, 1));
  return out;
}

/** Todos os visuais são função pura de `t` (segundos desde a detonação) → o rebobinar "puxa a fumaça de volta pra ogiva". */
export class NukeFx {
  group = new THREE.Group();
  private fire: THREE.Mesh;
  private stem: THREE.Mesh;
  private caps: THREE.Mesh[] = [];
  private shock: THREE.Mesh;
  private ring: THREE.Mesh;
  light: THREE.PointLight;

  constructor() {
    this.group.position.set(W / 2, 0, D / 2);
    this.group.visible = false;
    const mk = (geo: THREE.BufferGeometry, opacity: number, side: THREE.Side = THREE.FrontSide) =>
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, side, fog: false, depthWrite: false }));
    this.fire = mk(new THREE.SphereGeometry(1, 24, 16), 1);
    this.stem = mk(new THREE.CylinderGeometry(0.7, 1.3, 1, 18, 1, true), 0.95, THREE.DoubleSide);
    for (let i = 0; i < 7; i++) {
      const c = mk(new THREE.SphereGeometry(1, 16, 12), 0.95);
      this.caps.push(c);
      this.group.add(c);
    }
    this.shock = mk(new THREE.SphereGeometry(1, 40, 20), 0.3, THREE.DoubleSide);
    const rg = new THREE.RingGeometry(0.85, 1, 48);
    rg.rotateX(-Math.PI / 2);
    this.ring = mk(rg, 0.5, THREE.DoubleSide);
    this.ring.position.y = 0.4;
    this.light = new THREE.PointLight(0xffaa55, 0, 400, 1.2);
    this.light.position.y = 30;
    this.group.add(this.fire, this.stem, this.shock, this.ring, this.light);
  }

  update(t: number) {
    if (t <= 0.001) {
      this.group.visible = false;
      this.light.intensity = 0;
      return;
    }
    this.group.visible = true;
    const fade = clamp((26 - t) / 9, 0, 1);
    const fs = 3 + 36 * smooth(t / 3);
    this.fire.scale.setScalar(fs);
    this.fire.position.y = fs * 0.6;
    (this.fire.material as THREE.MeshBasicMaterial).color.copy(cloudColor(t * 0.7, tmp));
    (this.fire.material as THREE.MeshBasicMaterial).opacity = clamp(1 - (t - 2) / 5, 0, 1) * fade;

    const sh = 90 * smooth((t - 0.3) / 6.5);
    const sr = 4 + t * 0.35;
    this.stem.scale.set(sr, Math.max(0.01, sh), sr);
    this.stem.position.y = sh / 2;
    (this.stem.material as THREE.MeshBasicMaterial).color.copy(cloudColor(t * 0.85 + 1, tmp));
    (this.stem.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade * (sh > 1 ? 1 : 0);

    const capR = 6 + 28 * smooth((t - 0.6) / 7.5);
    const capY = sh + capR * 0.2;
    this.caps.forEach((c, i) => {
      const a = (i / this.caps.length) * Math.PI * 2;
      const off = i === 0 ? 0 : capR * 0.55;
      c.position.set(Math.cos(a) * off, capY + Math.sin(i * 1.7) * capR * 0.22, Math.sin(a) * off);
      c.scale.setScalar(capR * (i === 0 ? 0.85 : 0.5 + 0.1 * Math.sin(i * 2.3)) * (sh > 1 ? 1 : 0.01));
      const m = c.material as THREE.MeshBasicMaterial;
      cloudColor(t * 0.8 + (i % 3) * 0.4, m.color);
      m.opacity = 0.96 * fade;
    });

    const shr = t * 62;
    this.shock.scale.setScalar(shr);
    (this.shock.material as THREE.MeshBasicMaterial).opacity = 0.32 * clamp(1 - t / 5, 0, 1);
    this.ring.scale.set(t * 46, 1, t * 46);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * clamp(1 - t / 10, 0, 1);
    this.light.intensity = 6 * clamp(1 - t / 7, 0, 1);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
  }
}

export function buildWarhead() {
  const g = new THREE.Group();
  const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c, emissive: 0x220000 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 9, 14), mat(0x3a4048));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 14), mat(0xb71c1c));
  nose.position.y = 6.5;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 1.2, 14), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  band.position.y = 1.5;
  g.add(body, nose, band);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2.4), mat(0xb71c1c));
    const a = (i * Math.PI) / 2;
    fin.position.set(Math.cos(a) * 1.9, -3.8, Math.sin(a) * 1.9);
    fin.rotation.y = -a;
    g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 10), new THREE.MeshBasicMaterial({ color: 0xffa13a, transparent: true, opacity: 0.85 }));
  flame.position.y = -8.2;
  flame.rotation.x = Math.PI;
  g.add(flame);
  // aponta o nariz para baixo
  g.rotation.x = Math.PI;
  return g;
}
