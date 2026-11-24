import * as THREE from 'three';

export interface PSpawn {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  size?: number;
  color?: number;
  life?: number;
  grav?: number;
  bounce?: number;
  delay?: number;
  dmg?: number;
  spin?: number;
  glow?: boolean;
  drag?: number;
  grow?: number;
  tx?: number;
  ty?: number;
  tz?: number;
  onDone?: () => void;
}

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  r: number;
  g: number;
  b: number;
  age: number;
  life: number;
  grav: number;
  bounce: number;
  delay: number;
  dmg: number;
  rx: number;
  ry: number;
  srx: number;
  sry: number;
  drag: number;
  grow: number;
  rest: boolean;
  sx: number;
  sy: number;
  sz: number;
  tx?: number;
  ty?: number;
  tz?: number;
  onDone?: () => void;
}

const dummy = new THREE.Object3D();
const col = new THREE.Color();

class Pool {
  items: P[] = [];
  mesh: THREE.InstancedMesh;
  constructor(public max: number, glow: boolean) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = glow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
  }

  update(dt: number, solid: (x: number, y: number, z: number) => boolean) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.age += dt;
      if (p.age >= p.life) {
        const cb = p.onDone;
        items[i] = items[items.length - 1];
        items.pop();
        if (cb) cb();
        continue;
      }
      if (p.tx !== undefined) {
        const u = p.age / p.life;
        const e = u * u * (3 - 2 * u);
        p.x = p.sx + (p.tx - p.sx) * e;
        p.y = p.sy + ((p.ty ?? 0) - p.sy) * e + Math.sin(Math.PI * u) * 2;
        p.z = p.sz + ((p.tz ?? 0) - p.sz) * e;
        p.rx += p.srx * dt;
        p.ry += p.sry * dt;
        continue;
      }
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      if (p.rest) continue;
      p.vy -= p.grav * dt;
      if (p.drag > 0) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
        p.vz *= f;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.srx * dt;
      p.ry += p.sry * dt;
      if (p.grav > 0 && p.vy < 0) {
        const hs = p.size * 0.5;
        let hit = false;
        if (p.y - hs <= 0) {
          p.y = hs;
          hit = true;
        } else if (solid(Math.floor(p.x), Math.floor(p.y - hs), Math.floor(p.z))) {
          p.y = Math.floor(p.y - hs) + 1 + hs;
          hit = true;
        }
        if (hit) {
          p.dmg = 0;
          if (Math.abs(p.vy) < 2.5) {
            p.rest = true;
            p.vx = p.vy = p.vz = 0;
          } else {
            p.vy = -p.vy * p.bounce;
            p.vx *= 0.7;
            p.vz *= 0.7;
            p.srx *= 0.5;
            p.sry *= 0.5;
          }
        }
      }
    }
    // render
    const mesh = this.mesh;
    mesh.count = items.length;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const rem = p.life - p.age;
      let s = p.size;
      if (p.tx === undefined) {
        s *= Math.min(1, rem / 0.45);
        if (p.grow) s *= 1 + (p.grow * p.age) / p.life;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.setScalar(Math.max(0.001, s));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }
}

export class Particles {
  solid = new Pool(3800, false);
  glow = new Pool(2600, true);
  group = new THREE.Group();
  constructor() {
    this.group.add(this.solid.mesh, this.glow.mesh);
  }

  spawn(s: PSpawn): boolean {
    const pool = s.glow ? this.glow : this.solid;
    if (pool.items.length >= pool.max) return false;
    col.setHex(s.color ?? 0xffffff);
    const spin = s.spin ?? 6;
    const p: P = {
      x: s.x,
      y: s.y,
      z: s.z,
      vx: s.vx ?? 0,
      vy: s.vy ?? 0,
      vz: s.vz ?? 0,
      size: s.size ?? 0.2,
      r: col.r,
      g: col.g,
      b: col.b,
      age: 0,
      life: s.life ?? 1,
      grav: s.grav ?? 18,
      bounce: s.bounce ?? 0.35,
      delay: s.delay ?? 0,
      dmg: s.dmg ?? 0,
      rx: Math.random() * 6,
      ry: Math.random() * 6,
      srx: (Math.random() - 0.5) * spin,
      sry: (Math.random() - 0.5) * spin,
      drag: s.drag ?? 0,
      grow: s.grow ?? 0,
      rest: false,
      sx: s.x,
      sy: s.y,
      sz: s.z,
      tx: s.tx,
      ty: s.ty,
      tz: s.tz,
      onDone: s.onDone,
    };
    pool.items.push(p);
    return true;
  }

  burst(
    x: number,
    y: number,
    z: number,
    n: number,
    color: number,
    speed: number,
    size: number,
    life: number,
    opts: Partial<PSpawn> = {},
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.spawn({
        x,
        y,
        z,
        vx: Math.cos(a) * s * sp,
        vy: u * sp + speed * 0.2,
        vz: Math.sin(a) * s * sp,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        life: life * (0.6 + Math.random() * 0.6),
        ...opts,
      });
    }
  }

  forEachDanger(cb: (x: number, y: number, z: number, size: number, dmg: number, consume: () => void) => void) {
    for (const p of this.solid.items) {
      if (p.dmg > 0 && !p.rest && p.delay <= 0 && p.tx === undefined && p.vx * p.vx + p.vy * p.vy + p.vz * p.vz > 9) {
        cb(p.x, p.y, p.z, p.size, p.dmg, () => (p.dmg = 0));
      }
    }
  }

  update(dt: number, solid: (x: number, y: number, z: number) => boolean) {
    this.solid.update(dt, solid);
    this.glow.update(dt, solid);
  }

  count() {
    return this.solid.items.length + this.glow.items.length;
  }

  clear() {
    this.solid.clear();
    this.glow.clear();
  }

  dispose() {
    for (const p of [this.solid, this.glow]) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      p.mesh.dispose();
    }
  }
}
