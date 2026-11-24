import * as THREE from 'three';
import { VoxelWorld, W, D } from './world';
import { Rng } from './rng';
import type { Kind } from './blocks';

type Col = number | number[];

export interface Rail {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y: number;
}
export interface MapResult {
  decor: THREE.Group;
  rails: Rail[];
}

interface BO {
  x: number;
  z: number;
  w: number;
  d: number;
  floors?: number;
  fh?: number;
  wall: Kind;
  wc?: Col;
  slab?: Kind;
  sc?: Col;
  roof?: 'flat' | 'parapet' | 'hip' | 'none';
  rk?: Kind;
  rc?: Col;
  rh?: number;
  door?: 'N' | 'S' | 'E' | 'W';
  doorW?: number;
  windows?: boolean;
  wf?: Kind;
  wfc?: Col;
  pillar?: Kind;
  pc?: Col;
  tank?: boolean;
  base?: Kind;
  bc?: Col;
  neonRows?: number[];
  neonCol?: Col;
}

const CX = W / 2;
const CZ = D / 2;

class B {
  rails: Rail[] = [];
  decor = new THREE.Group();
  zones: { x: number; z: number; w: number; d: number }[] = [];
  constructor(
    public w: VoxelWorld,
    public rng: Rng,
  ) {}

  col(c?: Col): number {
    if (c === undefined) return 0;
    if (Array.isArray(c)) return this.rng.pick(c);
    return c;
  }
  set(x: number, y: number, z: number, k: Kind | null, c?: Col) {
    this.w.set(x, y, z, k, this.col(c));
  }
  fill(x: number, y: number, z: number, sx: number, sy: number, sz: number, k: Kind | null, c?: Col) {
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) for (let l = 0; l < sz; l++) this.set(x + i, y + j, z + l, k, c);
  }
  reserve(x: number, z: number, w: number, d: number) {
    this.zones.push({ x, z, w, d });
  }
  blocked(x: number, z: number, w: number, d: number, pad = 1) {
    for (const r of this.zones) {
      if (x - pad < r.x + r.w && x + w + pad > r.x && z - pad < r.z + r.d && z + d + pad > r.z) return true;
    }
    return false;
  }
  perimeter(k: Kind, c: Col, h: number) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < W; x++) {
        this.set(x, y, 0, k, c);
        this.set(x, y, D - 1, k, c);
      }
      for (let z = 0; z < D; z++) {
        this.set(0, y, z, k, c);
        this.set(W - 1, y, z, k, c);
      }
    }
  }
  disc(cx: number, cz: number, r: number, y: number, k: Kind | null, c?: Col) {
    const R = Math.ceil(r);
    const ix = Math.round(cx);
    const iz = Math.round(cz);
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= r * r) this.set(ix + dx, y, iz + dz, k, c);
  }
  column(x: number, z: number, h: number, k: Kind, c?: Col, y0 = 0) {
    for (let y = 0; y < h; y++) this.set(x, y0 + y, z, k, c);
  }
  fence(x1: number, z1: number, x2: number, z2: number, h = 3, k: Kind = 'metal', c: Col = 0x7c8288) {
    if (x1 === x2) {
      const [a, b] = z1 < z2 ? [z1, z2] : [z2, z1];
      for (let z = a; z <= b; z++) {
        for (let y = 0; y < h - 1; y++) if ((z - a) % 2 === 0) this.set(x1, y, z, k, c);
        this.set(x1, h - 1, z, k, c);
      }
    } else {
      const [a, b] = x1 < x2 ? [x1, x2] : [x2, x1];
      for (let x = a; x <= b; x++) {
        for (let y = 0; y < h - 1; y++) if ((x - a) % 2 === 0) this.set(x, y, z1, k, c);
        this.set(x, h - 1, z1, k, c);
      }
    }
  }
  tree(x: number, z: number, h: number, leaf: Col = [0x3f8f3a, 0x4a9e44, 0x357a31], wide = false) {
    this.column(x, z, h, 'wood', 0x6b4423);
    if (wide) {
      this.disc(x, z, 3.6, h, 'leaf', leaf);
      this.disc(x, z, 2.4, h + 1, 'leaf', leaf);
    } else {
      this.disc(x, z, 2.2, h, 'leaf', leaf);
      this.disc(x, z, 2.2, h + 1, 'leaf', leaf);
      this.disc(x, z, 1.2, h + 2, 'leaf', leaf);
    }
  }
  hut(cx: number, cz: number, r: number) {
    const wallH = 3;
    const R = Math.ceil(r) + 1;
    for (let y = 0; y < wallH; y++)
      for (let dx = -R; dx <= R; dx++)
        for (let dz = -R; dz <= R; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist <= r + 0.5 && dist >= r - 0.8) {
            if (dz > 0 && Math.abs(dx) <= 1 && y < 2) continue;
            this.set(cx + dx, y, cz + dz, 'clay', [0xb6753f, 0xa8683a, 0xc08048]);
          }
        }
    const rise = Math.ceil(r) + 2;
    for (let L = 0; L < rise; L++) {
      const rr = (r + 1.2) * (1 - L / rise);
      if (rr < 0.5) break;
      this.disc(cx, cz, rr, wallH + L, 'wood', [0xd9b45a, 0xc9a24a, 0xe0c070]);
    }
    this.reserve(cx - R - 1, cz - R - 1, R * 2 + 3, R * 2 + 3);
  }

  building(o: BO) {
    const fh = o.fh ?? 4;
    const fl = o.floors ?? 1;
    const { x, z, w, d } = o;
    const Ht = fl * fh;
    const door = o.door ?? this.rng.pick(['N', 'S', 'E', 'W'] as const);
    const slab = o.slab ?? o.wall;
    this.reserve(x, z, w, d);
    for (let y = 0; y < Ht; y++)
      for (let i = 0; i < w; i++)
        for (let j = 0; j < d; j++) {
          const edge = i === 0 || j === 0 || i === w - 1 || j === d - 1;
          if (!edge) continue;
          const corner = (i === 0 || i === w - 1) && (j === 0 || j === d - 1);
          if (corner && o.pillar) this.set(x + i, y, z + j, o.pillar, o.pc);
          else if (y === 0 && o.base) this.set(x + i, y, z + j, o.base, o.bc);
          else this.set(x + i, y, z + j, o.wall, o.wc);
        }
    for (let f = 0; f < fl; f++) {
      const yy = f * fh + fh - 1;
      for (let i = 1; i < w - 1; i++) for (let j = 1; j < d - 1; j++) this.set(x + i, yy, z + j, slab, o.sc);
    }
    // janelas
    if (o.windows) {
      for (let f = 0; f < fl; f++) {
        for (const dy of [1, 2]) {
          const y = f * fh + dy;
          for (let k = 2; k <= w - 3; k++)
            if (k % 3 === 1) {
              for (const zz of [z, z + d - 1]) this.set(x + k, y, zz, o.wf ?? null, o.wfc);
            }
          for (let k = 2; k <= d - 3; k++)
            if (k % 3 === 1) {
              for (const xx of [x, x + w - 1]) this.set(xx, y, z + k, o.wf ?? null, o.wfc);
            }
        }
      }
    }
    if (o.neonRows) {
      for (const y of o.neonRows) {
        if (y >= Ht) continue;
        for (let i = 0; i < w; i++)
          for (let j = 0; j < d; j++) {
            const edge = i === 0 || j === 0 || i === w - 1 || j === d - 1;
            if (edge && this.w.kindAt(x + i, y, z + j) !== 0) this.set(x + i, y, z + j, 'neon', o.neonCol);
          }
      }
    }
    // porta
    const dw = o.doorW ?? 2;
    const c0 = Math.floor(((door === 'N' || door === 'S' ? w : d) - dw) / 2);
    for (let y = 0; y < 3; y++)
      for (let s = 0; s < dw; s++) {
        if (door === 'N') this.set(x + c0 + s, y, z, null);
        else if (door === 'S') this.set(x + c0 + s, y, z + d - 1, null);
        else if (door === 'W') this.set(x, y, z + c0 + s, null);
        else this.set(x + w - 1, y, z + c0 + s, null);
      }
    // escadas (alternando lados a cada andar)
    const horiz = door === 'N' || door === 'S';
    const len = horiz ? d : w;
    if (fl > 1 && len >= fh + 2 && (horiz ? w : d) >= 6) {
      for (let f = 0; f < fl - 1; f++) {
        const y0 = f * fh;
        const side = f % 2 === 0;
        for (let s = 0; s < fh; s++) {
          let sx: number;
          let sz: number;
          if (horiz) {
            sx = side ? x + 1 : x + w - 2;
            sz = door === 'S' ? z + 1 + s : z + d - 2 - s;
          } else {
            sz = side ? z + 1 : z + d - 2;
            sx = door === 'E' ? x + 1 + s : x + w - 2 - s;
          }
          for (let h = 0; h <= s; h++) this.set(sx, y0 + h, sz, slab, o.sc);
          if (s < fh - 1) this.set(sx, y0 + fh - 1, sz, null);
        }
      }
    }
    // telhado
    const rk = o.rk ?? slab;
    const rc = o.rc ?? o.sc;
    const roof = o.roof ?? 'flat';
    if (roof === 'parapet') {
      for (let i = 0; i < w; i++)
        for (let j = 0; j < d; j++) {
          if (i === 0 || j === 0 || i === w - 1 || j === d - 1) this.set(x + i, Ht, z + j, rk, rc);
        }
    } else if (roof === 'hip') {
      const rh = o.rh ?? 3;
      for (let k = 0; k < rh; k++) {
        const rw = w - 2 * k;
        const rd = d - 2 * k;
        if (rw <= 0 || rd <= 0) break;
        this.fill(x + k, Ht + k, z + k, rw, 1, rd, rk, rc);
        if (rw <= 2 || rd <= 2) break;
      }
    }
    if (o.tank) {
      const ty = roof === 'parapet' ? Ht + 1 : Ht;
      this.fill(x + 1, ty, z + 1, 2, 2, 2, 'plaster', 0x3b82f6);
      this.set(x + 1, ty + 2, z + 1, 'metal', 0x555555);
    }
  }

  pagoda(cx: number, cz: number, s: number, tiers: number) {
    let y = 0;
    let size = s;
    for (let t = 0; t < tiers; t++) {
      const x0 = cx - Math.floor(size / 2);
      const z0 = cz - Math.floor(size / 2);
      const hgt = t === 0 ? 4 : 3;
      this.reserve(x0 - 2, z0 - 2, size + 4, size + 4);
      for (let yy = 0; yy < hgt; yy++)
        for (let i = 0; i < size; i++)
          for (let j = 0; j < size; j++) {
            const edge = i === 0 || j === 0 || i === size - 1 || j === size - 1;
            if (!edge) continue;
            const corner = (i === 0 || i === size - 1) && (j === 0 || j === size - 1);
            if (t === 0 && j === size - 1 && Math.abs(i - size / 2) < 1.5 && yy < 3) continue;
            this.set(x0 + i, y + yy, z0 + j, corner ? 'wood' : 'wood', corner ? 0xa4161a : [0x8e2a20, 0x9b3225]);
          }
      const roofC = [0x1f6f5c, 0x24806a, 0x1b5f4f];
      this.fill(x0 - 2, y + hgt, z0 - 2, size + 4, 1, size + 4, 'tile', roofC);
      this.fill(x0 - 1, y + hgt + 1, z0 - 1, size + 2, 1, size + 2, 'tile', roofC);
      this.fill(x0, y + hgt + 2, z0, size, 1, size, 'tile', roofC);
      for (const [dx, dz] of [
        [-2, -2],
        [size + 1, -2],
        [-2, size + 1],
        [size + 1, size + 1],
      ])
        this.set(x0 + dx, y + hgt + 1, z0 + dz, 'tile', 0xf2c14e);
      y += hgt + 3;
      size -= 4;
      if (size < 3) break;
    }
    this.column(cx, cz, 5, 'metal', 0xf2c14e, y);
  }

  rail(ax: number, az: number, bx: number, bz: number, y = 0.95) {
    this.rails.push({ ax, az, bx, bz, y });
    this.reserve(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.abs(bx - ax) + 3, Math.abs(bz - az) + 3);
    const len = Math.hypot(bx - ax, bz - az);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, len), new THREE.MeshLambertMaterial({ color: 0xc7ccd1 }));
    bar.position.set((ax + bx) / 2 + 0.5, y, (az + bz) / 2 + 0.5);
    bar.lookAt(bx + 0.5, y, bz + 0.5);
    this.decor.add(bar);
    const steps = Math.max(2, Math.floor(len / 3) + 1);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, y, 0.12), new THREE.MeshLambertMaterial({ color: 0x555a60 }));
      post.position.set(ax + (bx - ax) * t + 0.5, y / 2, az + (bz - az) * t + 0.5);
      this.decor.add(post);
    }
  }

  addRails(n = 4) {
    let placed = 0;
    for (let tries = 0; tries < 80 && placed < n; tries++) {
      const horiz = this.rng.chance(0.5);
      const len = this.rng.int(6, 9);
      const x = this.rng.int(6, W - 16);
      const z = this.rng.int(6, D - 16);
      const ex = horiz ? x + len : x;
      const ez = horiz ? z : z + len;
      let ok = true;
      for (let i = -1; i <= len + 1 && ok; i++)
        for (let k = -1; k <= 1 && ok; k++) {
          const px = horiz ? x + i : x + k;
          const pz = horiz ? z + k : z + i;
          for (let y = 0; y < 3; y++) if (this.w.kindAt(px, y, pz) !== 0) ok = false;
        }
      if (!ok || this.blocked(Math.min(x, ex), Math.min(z, ez), Math.abs(ex - x) + 1, Math.abs(ez - z) + 1, 0)) continue;
      this.rail(x, z, ex, ez);
      placed++;
    }
  }

  // ---------- props de cenário ----------
  freeArea(x: number, z: number, w: number, d: number) {
    if (x < 3 || z < 3 || x + w > W - 3 || z + d > D - 3) return false;
    for (let i = -1; i <= w; i++)
      for (let j = -1; j <= d; j++) for (let y = 0; y < 3; y++) if (this.w.kindAt(x + i, y, z + j) !== 0) return false;
    return true;
  }
  spot(w: number, d: number): [number, number] | null {
    for (let t = 0; t < 40; t++) {
      const x = this.rng.int(4, W - w - 4);
      const z = this.rng.int(4, D - d - 4);
      if (!this.blocked(x, z, w, d, 1) && this.freeArea(x, z, w, d)) return [x, z];
    }
    return null;
  }
  car(x: number, z: number, color: number, alongX: boolean) {
    const L = 5;
    const Wd = 3;
    for (let i = 0; i < L; i++)
      for (let j = 0; j < Wd; j++) {
        const px = alongX ? x + i : x + j;
        const pz = alongX ? z + j : z + i;
        const wheel = (i === 1 || i === L - 2) && (j === 0 || j === Wd - 1);
        this.set(px, 0, pz, 'metal', wheel ? 0x1c1c1f : color);
        if (i === 0 || i === L - 1 || j === 1) this.set(px, 1, pz, 'metal', color);
        else this.set(px, 1, pz, 'ice', 0x9fd3ea);
        if (i >= 1 && i <= L - 2) this.set(px, 2, pz, 'metal', color);
      }
    this.reserve(x, z, alongX ? L : Wd, alongX ? Wd : L);
  }
  crates(x: number, z: number) {
    const cols = [0x9c7a4a, 0x8a6a3c, 0xaa8656];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++)
        if (this.rng.chance(0.85)) {
          this.set(x + i, 0, z + j, 'wood', cols);
          if (this.rng.chance(0.5)) this.set(x + i, 1, z + j, 'wood', cols);
        }
    this.reserve(x, z, 2, 2);
  }
  bush(x: number, z: number) {
    const c = [0x3f8f3a, 0x4a9e44, 0x357a31];
    this.disc(x, z, 1.5, 0, 'leaf', c);
    this.disc(x, z, 1, 1, 'leaf', c);
    this.reserve(x - 1, z - 1, 3, 3);
  }
  bench(x: number, z: number, alongX: boolean) {
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 2; k++) {
        const px = alongX ? x + i : x + k;
        const pz = alongX ? z + k : z + i;
        this.set(px, 0, pz, 'wood', 0x7a5530);
        if (k === 1) this.set(px, 1, pz, 'wood', 0x6b4423);
      }
    this.reserve(x, z, alongX ? 3 : 2, alongX ? 2 : 3);
  }
  scatter(cfg: { cars?: number; crates?: number; bushes?: number; benches?: number; barrels?: number }, carColors: number[]) {
    for (let i = 0; i < (cfg.cars ?? 0); i++) {
      const ax = this.rng.chance(0.5);
      const sp = this.spot(ax ? 5 : 3, ax ? 3 : 5);
      if (sp) this.car(sp[0], sp[1], this.rng.pick(carColors), ax);
    }
    for (let i = 0; i < (cfg.crates ?? 0); i++) {
      const sp = this.spot(2, 2);
      if (sp) this.crates(sp[0], sp[1]);
    }
    for (let i = 0; i < (cfg.bushes ?? 0); i++) {
      const sp = this.spot(3, 3);
      if (sp) this.bush(sp[0] + 1, sp[1] + 1);
    }
    for (let i = 0; i < (cfg.benches ?? 0); i++) {
      const ax = this.rng.chance(0.5);
      const sp = this.spot(ax ? 3 : 2, ax ? 2 : 3);
      if (sp) this.bench(sp[0], sp[1], ax);
    }
    const bc = [0xb33a2e, 0x2b6cb0, 0x2f855a, 0x6b7580];
    for (let i = 0; i < (cfg.barrels ?? 0); i++) {
      const sp = this.spot(1, 1);
      if (sp) {
        this.set(sp[0], 0, sp[1], 'metal', this.rng.pick(bc));
        this.reserve(sp[0], sp[1], 1, 1);
      }
    }
  }
  clouds() {
    for (let i = 0; i < 16; i++) {
      const p = this.outside(50, 150);
      const y = this.rng.range(75, 130);
      const w = this.rng.range(18, 44);
      this.dmesh(new THREE.BoxGeometry(w, 5, w * 0.55), 0xffffff, p.x, y, p.z, true);
      this.dmesh(new THREE.BoxGeometry(w * 0.6, 6, w * 0.4), 0xf4f7fb, p.x + w * 0.2, y + 3, p.z, true);
    }
  }

  // ---------- decoração fora do campo ----------
  dmesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, basic = false) {
    const m = new THREE.Mesh(geo, basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    this.decor.add(m);
    return m;
  }
  outside(rmin: number, rmax: number) {
    const a = this.rng.next() * Math.PI * 2;
    const r = this.rng.range(rmin, rmax);
    let dx = Math.cos(a) * r;
    let dz = Math.sin(a) * r;
    const cheb = Math.max(Math.abs(dx), Math.abs(dz));
    if (cheb < 62) {
      dx *= 62 / cheb;
      dz *= 62 / cheb;
    }
    return { x: CX + dx, z: CZ + dz };
  }
  ringBoxes(n: number, rmin: number, rmax: number, hmin: number, hmax: number, wmin: number, wmax: number, colors: number[], tops?: number[]) {
    for (let i = 0; i < n; i++) {
      const p = this.outside(rmin, rmax);
      const h = this.rng.range(hmin, hmax);
      const w = this.rng.range(wmin, wmax);
      this.dmesh(new THREE.BoxGeometry(w, h, w * this.rng.range(0.8, 1.4)), this.rng.pick(colors), p.x, h / 2, p.z);
      if (tops) this.dmesh(new THREE.BoxGeometry(w + 0.4, 0.8, w * 1.1 + 0.4), this.rng.pick(tops), p.x, h + 0.4, p.z);
    }
  }
  ringCones(n: number, rmin: number, rmax: number, hmin: number, hmax: number, rad: number, colors: number[], seg = 5) {
    for (let i = 0; i < n; i++) {
      const p = this.outside(rmin, rmax);
      const h = this.rng.range(hmin, hmax);
      const r = rad * this.rng.range(0.7, 1.4);
      this.dmesh(new THREE.ConeGeometry(r, h, seg), this.rng.pick(colors), p.x, h / 2, p.z);
    }
  }
}

// ================== MAPAS ==================

function favela(b: B) {
  const rng = b.rng;
  const palette = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa, 0xec407a, 0x26c6da, 0xf4f0e0, 0xff7043];
  b.perimeter('concrete', 0x9a9a9a, 4);
  for (let gx = 4; gx < W - 10; gx += 11)
    for (let gz = 4; gz < D - 10; gz += 11) {
      const w = rng.int(7, 9);
      const d = rng.int(7, 9);
      const ox = gx + rng.int(0, 1);
      const oz = gz + rng.int(0, 1);
      if (b.blocked(ox, oz, w, d, 1) || !rng.chance(0.8)) continue;
      const brick = rng.chance(0.4);
      b.building({
        x: ox,
        z: oz,
        w,
        d,
        floors: rng.pick([1, 2, 2, 3]),
        wall: brick ? 'brick' : 'plaster',
        wc: brick ? [0xa8472f, 0xb5543a, 0x9c4129] : rng.pick(palette),
        slab: 'plaster',
        sc: 0xb8b2a6,
        roof: rng.chance(0.5) ? 'parapet' : 'flat',
        windows: true,
        tank: rng.chance(0.5),
      });
    }
  // postes
  for (let i = 0; i < 12; i++) {
    const x = rng.int(4, W - 5);
    const z = rng.int(4, D - 5);
    if (!b.blocked(x, z, 1, 1, 0)) b.column(x, z, 5, 'wood', 0x5b4636);
  }
  b.addRails();
  // decoração: morro colorido
  const pal = palette;
  b.ringBoxes(46, 70, 100, 8, 34, 6, 12, pal);
  b.ringBoxes(16, 85, 112, 30, 48, 12, 22, [0x6b8f5a, 0x5a7d4e]);
}

function cdd(b: B) {
  const rng = b.rng;
  b.perimeter('brick', [0x8c3b2a, 0x9a4533], 5);
  const qx = 30;
  const qz = 38;
  const qw = 36;
  const qd = 21;
  b.reserve(qx - 1, qz - 1, qw + 2, qd + 2);
  b.fence(qx, qz, qx + qw - 1, qz, 3);
  b.fence(qx, qz + qd - 1, qx + qw - 1, qz + qd - 1, 3);
  b.fence(qx, qz, qx, qz + qd - 1, 3);
  b.fence(qx + qw - 1, qz, qx + qw - 1, qz + qd - 1, 3);
  for (let y = 0; y < 3; y++)
    for (let s = -2; s <= 2; s++) {
      b.set(qx + qw / 2 + s, y, qz, null);
      b.set(qx + qw / 2 + s, y, qz + qd - 1, null);
      b.set(qx, y, qz + Math.floor(qd / 2) + s, null);
      b.set(qx + qw - 1, y, qz + Math.floor(qd / 2) + s, null);
    }
  for (const gx of [qx + 3, qx + qw - 4]) {
    const gz = qz + Math.floor(qd / 2);
    b.column(gx, gz - 3, 3, 'metal', 0xffffff);
    b.column(gx, gz + 3, 3, 'metal', 0xffffff);
    for (let s = -3; s <= 3; s++) b.set(gx, 2, gz + s, 'metal', 0xffffff);
  }
  for (let gx = 4; gx < W - 10; gx += 10)
    for (let gz = 4; gz < D - 10; gz += 10) {
      const w = rng.int(7, 8);
      const d = rng.int(7, 8);
      if (b.blocked(gx, gz, w, d, 1)) continue;
      const r = rng.next();
      if (r < 0.1) {
        // barbearia
        b.building({ x: gx, z: gz, w: 7, d: 7, wall: 'plaster', wc: 0x2b6cb0, roof: 'parapet', rk: 'brick', rc: 0xa8472f, windows: true, wf: 'neon', wfc: 0x9be7ff, door: 'S' });
        b.column(gx - 1, gz + 6, 3, 'plaster', 0xdc2626);
        b.set(gx - 1, 1, gz + 6, 'plaster', 0xffffff);
        continue;
      }
      if (r < 0.2) {
        // barraca do mercado
        for (let i = 0; i < 6; i++) {
          b.set(gx + i, 0, gz, 'wood', 0x6b4423);
          b.set(gx + i, 3, gz - 1 + (i % 2), 'paper', i % 2 ? 0xef4444 : 0xfacc15);
          b.set(gx + i, 3, gz, 'paper', i % 2 ? 0xef4444 : 0xfacc15);
        }
        b.column(gx, gz, 3, 'wood', 0x6b4423);
        b.column(gx + 5, gz, 3, 'wood', 0x6b4423);
        b.reserve(gx, gz - 1, 6, 2);
        continue;
      }
      if (!rng.chance(0.82)) continue;
      b.building({
        x: gx,
        z: gz,
        w,
        d,
        floors: rng.pick([1, 2, 2, 3]),
        wall: 'brick',
        wc: [0xa8472f, 0xb5543a, 0x9c4129, 0xbb5e44],
        slab: 'concrete',
        sc: 0x9a9a9a,
        roof: rng.chance(0.5) ? 'parapet' : 'flat',
        rk: 'brick',
        rc: 0xa8472f,
        windows: true,
        tank: rng.chance(0.3),
      });
    }
  b.addRails();
  b.ringBoxes(40, 70, 100, 18, 44, 8, 14, [0x9a4a38, 0x8a5a46, 0x7a7a7a, 0xb8a28a], [0x555555]);
}

function paris(b: B) {
  const cream = [0xe9dcc3, 0xe3d3b5, 0xefe3cd];
  b.perimeter('stone', 0xd8ccb2, 4);
  b.reserve(CX - 8, CZ - 8, 16, 16);
  // fonte
  for (let a = 0; a < 40; a++) {
    const an = (a / 40) * Math.PI * 2;
    b.set(Math.round(CX + Math.cos(an) * 3.4), 0, Math.round(CZ + Math.sin(an) * 3.4), 'stone', 0xcfc6b4);
  }
  b.disc(CX, CZ, 2.6, 0, 'ice', 0x8fd0ee);
  b.column(CX, CZ, 4, 'stone', 0xcfc6b4);
  // prédios históricos
  const rowsZ = [6, D - 16];
  for (const z of rowsZ)
    for (let x = 6; x < W - 14; x += 16) {
      b.building({
        x,
        z,
        w: 14,
        d: 10,
        floors: 3,
        fh: 4,
        wall: 'stone',
        wc: cream,
        slab: 'stone',
        sc: 0xcbbf9f,
        roof: 'hip',
        rk: 'tile',
        rc: [0x4a5568, 0x3f4b5c],
        rh: 4,
        windows: true,
        wf: 'ice',
        wfc: 0x9cc8e8,
        door: z < CZ ? 'S' : 'N',
        doorW: 3,
      });
    }
  for (const x of [6, W - 16])
    for (let z = 22; z < D - 28; z += 16) {
      if (b.blocked(x, z, 10, 14, 1)) continue;
      b.building({
        x,
        z,
        w: 10,
        d: 14,
        floors: 3,
        fh: 4,
        wall: 'stone',
        wc: cream,
        slab: 'stone',
        sc: 0xcbbf9f,
        roof: 'hip',
        rk: 'tile',
        rc: [0x4a5568, 0x3f4b5c],
        rh: 4,
        windows: true,
        wf: 'ice',
        wfc: 0x9cc8e8,
        door: x < CX ? 'E' : 'W',
        doorW: 3,
      });
    }
  // cafés
  const cafes: [number, number][] = [
    [24, 26],
    [60, 26],
    [24, 62],
    [60, 62],
    [38, 70],
  ];
  for (const [x, z] of cafes) {
    if (b.blocked(x, z, 8, 6, 1)) continue;
    b.building({ x, z, w: 8, d: 6, wall: 'wood', wc: [0x7a4a2a, 0x6b3f22], slab: 'wood', sc: 0x8a5a2b, roof: 'flat', windows: true, wf: 'ice', wfc: 0xbfe0f0, door: z < CZ ? 'S' : 'N', doorW: 3 });
    const fz = z < CZ ? z + 6 : z - 2;
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) b.set(x + i, 3, fz + k, 'paper', i % 2 ? 0xdc2626 : 0xf5f5f5);
    for (let i = 0; i < 3; i++) {
      const tz = z < CZ ? z + 8 : z - 4;
      b.set(x + 1 + i * 3, 0, tz, 'wood', 0x5b3a1e);
      b.set(x + 1 + i * 3, 1, tz, 'wood', 0x5b3a1e);
    }
  }
  // postes de luz e árvores
  for (let x = 12; x < W - 8; x += 12) {
    for (const z of [20, D - 21]) {
      if (b.blocked(x, z, 1, 1, 0)) continue;
      b.column(x, z, 5, 'metal', 0x2d3436);
      b.set(x, 5, z, 'neon', 0xffe28a);
    }
  }
  for (const [x, z] of [
    [30, 48],
    [66, 48],
    [48, 30],
    [48, 66],
    [20, 40],
    [76, 56],
  ] as [number, number][]) {
    if (!b.blocked(x, z, 1, 1, 1)) b.tree(x, z, 3, [0x5a9e4b, 0x4f8f42]);
  }
  b.addRails();
  // Torre Eiffel
  const iron = 0x6b5a4a;
  const ex = CX;
  const ez = -55;
  const leg = (x1: number, z1: number, y1: number, x2: number, z2: number, y2: number, r: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const g = new THREE.CylinderGeometry(r * 0.7, r, len, 5);
    g.rotateX(Math.PI / 2);
    const m = b.dmesh(g, iron, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.lookAt(x2, y2, z2);
  };
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      leg(ex + sx * 16, ez + sz * 16, 0, ex + sx * 6, ez + sz * 6, 38, 1.8);
      leg(ex + sx * 6, ez + sz * 6, 38, ex + sx * 2, ez + sz * 2, 78, 1.1);
    }
  b.dmesh(new THREE.BoxGeometry(17, 2.5, 17), iron, ex, 38, ez);
  b.dmesh(new THREE.BoxGeometry(8, 2, 8), iron, ex, 78, ez);
  b.dmesh(new THREE.ConeGeometry(2.2, 40, 6), iron, ex, 100, ez);
  for (let a = 0; a < 4; a++) {
    const g = new THREE.TorusGeometry(10, 1, 6, 16, Math.PI);
    const m = b.dmesh(g, iron, ex, 14, ez);
    m.rotation.y = (a * Math.PI) / 2;
    m.scale.set(1.4, 1.4, 1);
  }
  b.ringBoxes(34, 72, 110, 14, 26, 10, 18, [0xe3d3b5, 0xd8c9ab, 0xefe3cd], [0x4a5568, 0x3f4b5c]);
}

function antartica(b: B) {
  const rng = b.rng;
  b.perimeter('concrete', 0xcfe3ee, 4);
  const mods: [number, number, number, number, number][] = [
    [22, 22, 12, 9, 0xff6d00],
    [60, 24, 10, 10, 0xf1f5f9],
    [58, 62, 12, 9, 0x2563eb],
    [20, 64, 10, 9, 0xfacc15],
  ];
  for (const [x, z, w, d, c] of mods) {
    b.building({
      x,
      z,
      w,
      d,
      wall: 'metal',
      wc: c,
      slab: 'metal',
      sc: 0x7b8794,
      roof: 'parapet',
      rk: 'metal',
      rc: 0x7b8794,
      windows: true,
      wf: 'neon',
      wfc: 0xffe9a8,
      door: z < CZ ? 'S' : 'N',
      doorW: 3,
    });
  }
  // túneis ligando as bases
  const tunnel = (x1: number, z1: number, x2: number, z2: number) => {
    const horiz = z1 === z2;
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const x0 = Math.min(x1, x2);
    const zz0 = Math.min(z1, z2);
    for (let i = 0; i < len; i++)
      for (let k = -1; k <= 1; k++)
        for (let y = 0; y < 4; y++) {
          const px = horiz ? x0 + i : x1 + k;
          const pz = horiz ? z1 + k : zz0 + i;
          const edge = Math.abs(k) === 1 || y === 3;
          if (edge) b.set(px, y, pz, 'metal', y === 3 ? 0x7b8794 : 0xe5e7eb);
        }
  };
  tunnel(34, 26, 60, 26);
  tunnel(30, 31, 30, 64);
  // geleiras
  for (let n = 0; n < 11; n++) {
    const cx = rng.int(8, W - 9);
    const cz = rng.int(8, D - 9);
    const r = rng.range(5, 9);
    const mh = rng.int(5, 11);
    if (b.blocked(cx - r, cz - r, r * 2, r * 2, 0)) continue;
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
      for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
        const dist = Math.hypot(dx, dz);
        if (dist > r) continue;
        const h = Math.floor((1 - dist / r) * mh + rng.range(-0.6, 0.9));
        for (let y = 0; y < h; y++) b.set(cx + dx, y, cz + dz, 'ice', [0xbfe6f5, 0xa7d8ee, 0xd9f2fb, 0x9ccfe6]);
      }
    b.reserve(cx - r, cz - r, r * 2, r * 2);
  }
  // bandeiras
  for (const [x, z] of [
    [48, 40],
    [50, 56],
  ] as [number, number][]) {
    if (b.blocked(x, z, 1, 1, 0)) continue;
    b.column(x, z, 5, 'metal', 0xdddddd);
    b.set(x + 1, 4, z, 'neon', 0xef4444);
    b.set(x + 2, 4, z, 'neon', 0xef4444);
  }
  b.addRails(3);
  b.ringCones(22, 70, 115, 30, 70, 14, [0xeaf6ff, 0xcfe4f2, 0xbad4e8], 5);
}

function china(b: B) {
  const rng = b.rng;
  b.perimeter('brick', [0x6e6a66, 0x7a7672], 4);
  // pátio do templo
  const x0 = 22;
  const z0 = 22;
  const s = 52;
  b.reserve(x0, z0, s, 3);
  b.reserve(x0, z0 + s - 3, s, 3);
  b.reserve(x0, z0, 3, s);
  b.reserve(x0 + s - 3, z0, 3, s);
  for (let i = 0; i < s; i++)
    for (let y = 0; y < 3; y++) {
      const gate = Math.abs(i - s / 2) < 3;
      for (const [x, z] of [
        [x0 + i, z0],
        [x0 + i, z0 + s - 1],
        [x0, z0 + i],
        [x0 + s - 1, z0 + i],
      ]) {
        if (gate && y < 4) continue;
        b.set(x, y, z, 'wood', [0xa4161a, 0x8e1418]);
      }
    }
  for (let i = 0; i < s; i++)
    for (const [x, z] of [
      [x0 + i, z0],
      [x0 + i, z0 + s - 1],
      [x0, z0 + i],
      [x0 + s - 1, z0 + i],
    ])
      b.set(x, 3, z, 'tile', 0x1f6f5c);
  // portões e leões de pedra
  for (const [gx, gz] of [
    [x0 + s / 2, z0],
    [x0 + s / 2, z0 + s - 1],
  ])
    for (const dx of [-4, 4]) {
      b.column(gx + dx, gz, 4, 'stone', 0xcfc6b4);
      b.set(gx + dx, 4, gz, 'stone', 0xe0d9c6);
    }
  for (const [gx, gz] of [
    [x0, z0 + s / 2],
    [x0 + s - 1, z0 + s / 2],
  ])
    for (const dz of [-4, 4]) {
      b.column(gx, gz + dz, 4, 'stone', 0xcfc6b4);
      b.set(gx, 4, gz + dz, 'stone', 0xe0d9c6);
    }
  // pagode grande e salão
  b.pagoda(CX, 33, 12, 4);
  b.building({ x: CX - 8, z: 56, w: 16, d: 9, wall: 'wood', wc: [0x8e2a20, 0x9b3225], pillar: 'wood', pc: 0xa4161a, slab: 'wood', sc: 0x6b3f22, roof: 'hip', rk: 'tile', rc: [0x1f6f5c, 0x24806a], rh: 4, windows: true, wf: 'paper', wfc: 0xf3ead2, door: 'N', doorW: 4 });
  // lanternas
  for (let i = 0; i < 6; i++) {
    const lx = 30 + i * 7;
    for (const lz of [47, 50]) {
      if (b.blocked(lx, lz, 1, 1, 0)) continue;
      b.column(lx, lz, 3, 'wood', 0x5b3a1e);
      b.set(lx, 3, lz, 'neon', 0xff3b2f);
    }
  }
  // casas fora do pátio
  for (let gx = 4; gx < W - 10; gx += 11)
    for (let gz = 4; gz < D - 9; gz += 10) {
      const w = rng.int(7, 8);
      const d = rng.int(6, 7);
      if (b.blocked(gx, gz, w, d, 1) || !rng.chance(0.8)) continue;
      b.building({
        x: gx,
        z: gz,
        w,
        d,
        floors: rng.pick([1, 1, 2]),
        wall: 'wood',
        wc: [0x8a5a2b, 0x7a4a24, 0x9a6a38],
        pillar: 'wood',
        pc: 0xa4161a,
        slab: 'wood',
        sc: 0x6b3f22,
        roof: 'hip',
        rk: 'tile',
        rc: [0x1f6f5c, 0x2a4d69, 0x24806a],
        rh: 3,
        windows: true,
        wf: 'paper',
        wfc: 0xf3ead2,
      });
    }
  for (let i = 0; i < 14; i++) {
    const x = rng.int(5, W - 6);
    const z = rng.int(5, D - 6);
    if (!b.blocked(x, z, 1, 1, 2)) b.tree(x, z, 3, rng.chance(0.5) ? [0xf8a5c2, 0xf48fb1] : [0x3f8f3a, 0x4a9e44]);
  }
  b.addRails();
  b.ringCones(30, 70, 115, 40, 85, 10, [0x5f8f6a, 0x4d7a5a, 0x6e9a78], 6);
}

function japao(b: B) {
  const rng = b.rng;
  b.perimeter('concrete', 0x3b3a47, 5);
  const neon = [0xff3df2, 0x22e6ff, 0xffe14a, 0x7cff6b];
  for (let gx = 4; gx < W - 11; gx += 12)
    for (let gz = 4; gz < D - 11; gz += 12) {
      if (b.blocked(gx, gz, 9, 9, 1)) continue;
      const r = rng.next();
      if (r < 0.38) {
        const fl = rng.pick([3, 3, 4]);
        const nc = rng.pick(neon);
        b.building({
          x: gx,
          z: gz,
          w: 9,
          d: 9,
          floors: fl,
          wall: 'concrete',
          wc: [0x45434f, 0x3d3b48, 0x4d4b58],
          slab: 'concrete',
          sc: 0x34323f,
          roof: 'parapet',
          windows: true,
          wf: 'neon',
          wfc: [0xffe9a8, 0x9be7ff],
          neonRows: [0, 3, fl * 4 - 2],
          neonCol: nc,
          door: rng.pick(['N', 'S', 'E', 'W'] as const),
          doorW: 3,
        });
      } else if (r < 0.78) {
        const w = rng.int(6, 8);
        const d = rng.int(6, 8);
        b.building({
          x: gx,
          z: gz,
          w,
          d,
          floors: 1,
          fh: 4,
          wall: 'paper',
          wc: 0xf3ead2,
          pillar: 'wood',
          pc: 0x5b3a1e,
          base: 'wood',
          bc: 0x5b3a1e,
          slab: 'wood',
          sc: 0x5b3a1e,
          roof: 'hip',
          rk: 'tile',
          rc: [0x2d3a4a, 0x364658],
          rh: 3,
          door: rng.pick(['N', 'S', 'E', 'W'] as const),
          doorW: 2,
        });
      } else if (rng.chance(0.6)) {
        // torii
        const tx = gx + 1;
        const tz = gz + 3;
        b.column(tx, tz, 5, 'wood', 0xd32f2f);
        b.column(tx + 6, tz, 5, 'wood', 0xd32f2f);
        for (let i = -1; i <= 7; i++) b.set(tx + i, 5, tz, 'wood', 0xb71c1c);
        for (let i = 0; i <= 6; i++) b.set(tx + i, 3, tz, 'wood', 0x111111);
        b.reserve(tx - 1, tz - 1, 9, 3);
      }
    }
  // máquinas de venda
  for (let i = 0; i < 14; i++) {
    const x = rng.int(5, W - 6);
    const z = rng.int(5, D - 6);
    if (b.blocked(x, z, 1, 1, 1)) continue;
    b.set(x, 0, z, 'neon', rng.pick(neon));
    b.set(x, 1, z, 'neon', rng.pick(neon));
    b.set(x, 2, z, 'metal', 0x555555);
  }
  b.addRails();
  // arranha-céus ao fundo
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0d0b1a';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 6)
    for (let x = 0; x < 64; x += 6) {
      if (rng.chance(0.55)) {
        g.fillStyle = rng.chance(0.5) ? '#ffe9a8' : rng.chance(0.5) ? '#7ee8ff' : '#ff7ce8';
        g.fillRect(x + 1, y + 1, 3, 3);
      }
    }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 40; i++) {
    const p = b.outside(70, 115);
    const h = rng.range(30, 95);
    const w = rng.range(9, 16);
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.round(w / 6), Math.round(h / 12));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(p.x, h / 2, p.z);
    b.decor.add(m);
  }
  // letreiros neon
  const texts = ['ラーメン', 'アキバ', 'CHRONO', 'ゲーム', '酒場', 'ネオン'];
  texts.forEach((txt, i) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const gg = c.getContext('2d')!;
    const color = neon[i % neon.length];
    const hex = '#' + color.toString(16).padStart(6, '0');
    gg.fillStyle = 'rgba(10,5,25,0.85)';
    gg.fillRect(0, 0, 256, 96);
    gg.strokeStyle = hex;
    gg.lineWidth = 6;
    gg.strokeRect(6, 6, 244, 84);
    gg.font = 'bold 54px sans-serif';
    gg.textAlign = 'center';
    gg.textBaseline = 'middle';
    gg.shadowColor = hex;
    gg.shadowBlur = 18;
    gg.fillStyle = '#ffffff';
    gg.fillText(txt, 128, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const a = (i / texts.length) * Math.PI * 2 + 0.3;
    const sx = CX + Math.cos(a) * 66;
    const sz = CZ + Math.sin(a) * 66;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    m.position.set(sx, 14 + (i % 3) * 5, sz);
    m.lookAt(CX, 14, CZ);
    b.decor.add(m);
  });
}

function africa(b: B) {
  const rng = b.rng;
  b.perimeter('wood', [0x9c7a4a, 0x8e6e42], 3);
  // posto de safári
  const px = 66;
  const pz = 62;
  b.reserve(px - 2, pz - 2, 14, 14);
  for (const [dx, dz] of [
    [0, 0],
    [9, 0],
    [0, 9],
    [9, 9],
  ])
    b.column(px + dx, pz + dz, 5, 'wood', 0x6b4423);
  b.fill(px - 1, 5, pz - 1, 12, 1, 12, 'wood', 0x7a5530);
  // cabana no topo da palafita
  for (let y = 6; y < 9; y++)
    for (let i = 1; i < 9; i++)
      for (let j = 1; j < 9; j++) {
        const edge = i === 1 || j === 1 || i === 8 || j === 8;
        if (!edge) continue;
        if (i === 1 && j >= 4 && j <= 5 && y < 8) continue;
        if (y === 7 && (i === 4 || i === 5 || j === 4 || j === 5) && !(i === 1 && j >= 4 && j <= 5)) continue;
        b.set(px + i, y, pz + j, 'wood', [0x8a5a2b, 0x7a4a24]);
      }
  for (let k = 0; k < 4; k++) b.fill(px + 1 + k, 9 + k, pz + 1 + k, 8 - 2 * k, 1, 8 - 2 * k, 'wood', [0xd9b45a, 0xc9a24a, 0xe0c070]);
  // escada
  for (let s = 0; s < 5; s++) b.fill(px - 2 - (4 - s), 0, pz + 4, 1, s + 1, 2, 'wood', 0x7a5530);
  // cabanas de barro
  let huts = 0;
  for (let tries = 0; tries < 200 && huts < 13; tries++) {
    const cx = rng.int(8, W - 9);
    const cz = rng.int(8, D - 9);
    const r = rng.pick([3, 3, 4]);
    if (b.blocked(cx - r - 2, cz - r - 2, r * 2 + 5, r * 2 + 5, 2)) continue;
    b.hut(cx, cz, r);
    huts++;
  }
  // curral
  const kx = 22;
  const kz = 66;
  if (!b.blocked(kx - 8, kz - 8, 17, 17, 0)) {
    for (let a = 0; a < 72; a++) {
      const an = (a / 72) * Math.PI * 2;
      if (a % 18 < 2) continue;
      const x = Math.round(kx + Math.cos(an) * 8);
      const z = Math.round(kz + Math.sin(an) * 8);
      for (let y = 0; y < 2; y++) b.set(x, y, z, 'wood', 0x7a5a32);
    }
    b.reserve(kx - 9, kz - 9, 19, 19);
  }
  // acácias e baobás
  for (let i = 0; i < 16; i++) {
    const x = rng.int(5, W - 6);
    const z = rng.int(5, D - 6);
    if (b.blocked(x, z, 1, 1, 4)) continue;
    b.tree(x, z, rng.int(4, 5), [0x6b9a3a, 0x7aa842], true);
    b.reserve(x - 1, z - 1, 3, 3);
  }
  for (const [x, z] of [
    [40, 20],
    [14, 38],
  ] as [number, number][]) {
    if (b.blocked(x - 2, z - 2, 5, 5, 0)) continue;
    b.disc(x, z, 2, 0, 'wood', 0x7a6a50);
    for (let y = 1; y < 6; y++) b.disc(x, z, 2, y, 'wood', 0x7a6a50);
    b.disc(x, z, 4, 6, 'leaf', [0x6b9a3a, 0x5a8a30]);
    b.disc(x, z, 3, 7, 'leaf', [0x6b9a3a, 0x5a8a30]);
    b.reserve(x - 2, z - 2, 5, 5);
  }
  // rochas
  for (let i = 0; i < 8; i++) {
    const x = rng.int(6, W - 7);
    const z = rng.int(6, D - 7);
    if (b.blocked(x, z, 2, 2, 1)) continue;
    b.fill(x, 0, z, 2, 1, 2, 'stone', 0xa89f8c);
    b.set(x, 1, z, 'stone', 0xa89f8c);
  }
  b.addRails(3);
  // colinas e sol gigante
  for (let i = 0; i < 18; i++) {
    const p = b.outside(75, 115);
    const r = rng.range(18, 34);
    const m = b.dmesh(new THREE.SphereGeometry(r, 10, 6), rng.pick([0xb89458, 0xa9854c, 0xc29d5f]), p.x, -r * 0.45, p.z);
    m.scale.y = 0.55;
  }
  b.dmesh(new THREE.SphereGeometry(18, 20, 12), 0xffd27a, CX - 40, 38, -120, true);
}

function ucrania(b: B) {
  const rng = b.rng;
  b.perimeter('concrete', 0x9a9da0, 4);
  const blocks: [number, number, number, number, 'N' | 'S' | 'E' | 'W'][] = [
    [6, 8, 26, 10, 'S'],
    [62, 8, 28, 10, 'S'],
    [6, 76, 26, 10, 'N'],
  ];
  for (const [x, z, w, d, door] of blocks)
    b.building({
      x,
      z,
      w,
      d,
      floors: 4,
      fh: 4,
      wall: 'concrete',
      wc: [0x8d9093, 0x9a9da0, 0x858a8e],
      slab: 'concrete',
      sc: 0x7a7e82,
      roof: 'parapet',
      windows: true,
      wf: 'ice',
      wfc: 0x7fa1b8,
      door,
      doorW: 3,
    });
  // galpão metálico
  b.building({ x: 56, z: 72, w: 24, d: 14, floors: 1, fh: 7, wall: 'metal', wc: [0x6b7580, 0x75808b], slab: 'metal', sc: 0x59626b, roof: 'parapet', door: 'N', doorW: 5, windows: false });
  for (let y = 0; y < 5; y++) for (let s = 0; s < 5; s++) b.set(56 + 9 + s, y, 72, null);
  // chaminés
  for (const [cx, cz] of [
    [40, 26],
    [48, 70],
  ] as [number, number][]) {
    for (let y = 0; y < 18; y++) {
      const c = Math.floor(y / 3) % 2 === 0 ? 0xb33a2e : 0xeeeeee;
      for (let a = 0; a < 24; a++) {
        const an = (a / 24) * Math.PI * 2;
        b.set(Math.round(cx + Math.cos(an) * 2.6), y, Math.round(cz + Math.sin(an) * 2.6), 'concrete', c);
        b.set(Math.round(cx + Math.cos(an) * 2.0), y, Math.round(cz + Math.sin(an) * 2.0), 'concrete', c);
      }
    }
    b.reserve(cx - 4, cz - 4, 9, 9);
  }
  // tubulações
  for (const [x, z, len, horiz] of [
    [10, 40, 20, true],
    [70, 40, 18, true],
    [24, 54, 14, false],
  ] as [number, number, number, boolean][]) {
    for (let i = 0; i < len; i++) {
      const px = horiz ? x + i : x;
      const pz = horiz ? z : z + i;
      if (b.blocked(px, pz, 1, 1, 0)) continue;
      b.set(px, 3, pz, 'metal', 0x6b7580);
      if (i % 6 === 0) b.column(px, pz, 3, 'metal', 0x4a525a);
    }
  }
  // cercas e barris
  b.fence(12, 30, 36, 30, 2);
  b.fence(60, 56, 84, 56, 2);
  for (let i = 0; i < 18; i++) {
    const x = rng.int(5, W - 6);
    const z = rng.int(5, D - 6);
    if (b.blocked(x, z, 1, 1, 1)) continue;
    b.set(x, 0, z, 'metal', rng.chance(0.5) ? 0xb33a2e : 0x2b6cb0);
    if (rng.chance(0.4)) b.set(x, 1, z, 'metal', 0x6b7580);
  }
  b.addRails();
  b.ringBoxes(28, 70, 108, 25, 48, 14, 22, [0x8d9093, 0x7a7e82, 0x9a9da0], [0x555a5e]);
  for (let i = 0; i < 5; i++) {
    const p = b.outside(75, 110);
    const m = b.dmesh(new THREE.CylinderGeometry(3, 4.5, 60, 12), 0x8a8d90, p.x, 30, p.z);
    m.scale.set(1, 1, 1);
    b.dmesh(new THREE.CylinderGeometry(3.2, 3.2, 3, 12), 0xb33a2e, p.x, 52, p.z);
  }
}

function sanctum(b: B) {
  const rng = b.rng;
  const marble = [0xf5f0e6, 0xece6d8, 0xf8f4ec];
  const gold = 0xf2c14e;
  b.perimeter('stone', marble, 2);
  b.reserve(CX - 16, CZ - 16, 32, 32);
  b.disc(CX, CZ, 14, 0, 'stone', marble);
  b.disc(CX, CZ, 11, 1, 'stone', marble);
  b.disc(CX, CZ, 8, 2, 'stone', [0xfaf5ea, 0xf2ecdd]);
  b.fill(CX - 1, 3, CZ - 1, 3, 2, 3, 'stone', gold);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = Math.round(CX + Math.cos(a) * 22);
    const z = Math.round(CZ + Math.sin(a) * 22);
    b.disc(x, z, 1.9, 0, 'stone', marble);
    for (let y = 1; y < 10; y++) b.disc(x, z, 1.2, y, 'stone', marble);
    b.disc(x, z, 1.9, 10, 'stone', gold);
  }
  for (let t = 0; t < 900; t++) {
    const a = (t / 900) * Math.PI * 2;
    const x = Math.round(CX + Math.cos(a) * 22);
    const z = Math.round(CZ + Math.sin(a) * 22);
    b.set(x, 11, z, 'stone', gold);
    b.set(x, 12, z, 'stone', marble);
  }
  for (const [dx, dz] of [[0, -31], [31, 0], [0, 31], [-31, 0]]) {
    const x = CX + dx;
    const z = CZ + dz;
    b.column(x, z, 3, 'stone', gold);
    b.set(x, 3, z, 'neon', 0xfff1a8);
    b.set(x, 4, z, 'neon', 0xff9ad5);
  }
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + 0.17;
    const x = Math.round(CX + Math.cos(a) * 37);
    const z = Math.round(CZ + Math.sin(a) * 37);
    if (x > 4 && z > 4 && x < W - 5 && z < D - 5) b.tree(x, z, 3, [0xf8a5c2, 0xfbcfe8, 0xffffff]);
  }
  // ilhas flutuantes, orbes e o grande olho
  for (let i = 0; i < 14; i++) {
    const p = b.outside(60, 140);
    const y = rng.range(15, 70);
    const r = rng.range(5, 13);
    const h = r * 1.4;
    const cone = b.dmesh(new THREE.ConeGeometry(r, h, 6), 0xcfc6e8, p.x, y, p.z);
    cone.rotation.x = Math.PI;
    b.dmesh(new THREE.CylinderGeometry(r, r * 0.97, 1.4, 8), 0xa8e6a1, p.x, y + h / 2 + 0.6, p.z);
  }
  for (let i = 0; i < 12; i++) {
    const p = b.outside(55, 120);
    b.dmesh(new THREE.SphereGeometry(rng.range(0.8, 1.8), 10, 8), rng.pick([0xfde68a, 0xf9a8d4, 0xa5f3fc]), p.x, rng.range(20, 60), p.z, true);
  }
  b.dmesh(new THREE.TorusGeometry(34, 1.4, 10, 64), 0xffe9a0, CX, 46, CZ - 92, true);
  b.dmesh(new THREE.TorusGeometry(27, 0.8, 10, 64), 0xffffff, CX, 46, CZ - 92, true);
  b.dmesh(new THREE.SphereGeometry(10, 24, 16), 0xffffff, CX, 46, CZ - 98, true);
  b.dmesh(new THREE.SphereGeometry(6.4, 20, 14), 0x7c3aed, CX, 46, CZ - 90.5, true);
  b.dmesh(new THREE.SphereGeometry(3.2, 16, 12), 0x120a2e, CX, 46, CZ - 85, true);
}

const SCATTER: Record<string, { cfg: Parameters<B['scatter']>[0]; colors: number[] }> = {
  favela: { cfg: { cars: 2, crates: 6, barrels: 6 }, colors: [0xe53935, 0x1e88e5, 0xfdd835, 0xf4f0e0] },
  cdd: { cfg: { cars: 3, crates: 5, barrels: 4, bushes: 2 }, colors: [0xc62828, 0x37474f, 0xf5f5f5, 0x2e7d32] },
  paris: { cfg: { cars: 4, benches: 6, bushes: 8 }, colors: [0x1d3557, 0xf1faee, 0x8d99ae, 0xb23a48] },
  antartica: { cfg: { crates: 6, barrels: 6 }, colors: [0xff6d00] },
  china: { cfg: { bushes: 8, benches: 3, barrels: 2 }, colors: [0x7f1d1d] },
  japao: { cfg: { cars: 4, crates: 3, barrels: 3 }, colors: [0x111827, 0xff3df2, 0x22e6ff, 0xf5f5f5] },
  africa: { cfg: { cars: 2, crates: 5, bushes: 8, barrels: 2 }, colors: [0xc8b273, 0x8d7b4a] },
  ucrania: { cfg: { cars: 3, crates: 8, barrels: 8 }, colors: [0x6b7580, 0x4a525a, 0x8d9093] },
};

export function buildMap(id: string, world: VoxelWorld, rng: Rng): MapResult {
  const b = new B(world, rng);
  b.reserve(CX - 7, CZ - 7, 14, 14);
  switch (id) {
    case 'santuario':
      sanctum(b);
      break;
    case 'cdd':
      cdd(b);
      break;
    case 'paris':
      paris(b);
      break;
    case 'antartica':
      antartica(b);
      break;
    case 'china':
      china(b);
      break;
    case 'japao':
      japao(b);
      break;
    case 'africa':
      africa(b);
      break;
    case 'ucrania':
      ucrania(b);
      break;
    default:
      favela(b);
  }
  const sc = SCATTER[id];
  if (sc) b.scatter(sc.cfg, sc.colors);
  if (id !== 'japao' && id !== 'santuario') b.clouds();
  world.build();
  return { decor: b.decor, rails: b.rails };
}
