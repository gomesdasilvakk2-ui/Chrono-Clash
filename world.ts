import * as THREE from 'three';
import { DEFS, KINDS, kindOf } from './blocks';
import type { Kind } from './blocks';

export const W = 96;
export const D = 96;
export const H = 22;
const N = W * H * D;
const LAYER = W * D;

const KI = {} as Record<Kind, number>;
KINDS.forEach((k, i) => (KI[k] = i + 1));

export interface RayHit {
  dist: number;
  idx: number; // -1 = chão
  nx: number;
  ny: number;
  nz: number;
}
export interface LogEntry {
  idx: number;
  kind: number;
  col: number;
  t: number;
}
export interface Impulse {
  x: number;
  y: number;
  z: number;
}
export type RemoveCb = (
  x: number,
  y: number,
  z: number,
  col: number,
  kind: number,
  imp: Impulse | null,
  fall: boolean,
) => void;

function makeTexture(kind: Kind): THREE.CanvasTexture {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    const v = 205 + Math.floor(Math.random() * 50);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.28)';
  if (kind === 'brick') {
    for (let r = 0; r < 4; r++) {
      g.fillRect(0, r * 8, s, 1);
      const off = r % 2 === 0 ? 0 : 8;
      g.fillRect(off, r * 8, 1, 8);
      g.fillRect(off + 16, r * 8, 1, 8);
    }
  } else if (kind === 'wood') {
    for (let r = 0; r < 4; r++) g.fillRect(0, r * 8, s, 1);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), 8, 1);
  } else if (kind === 'tile') {
    for (let r = 0; r < 4; r++) {
      g.fillRect(r * 8, 0, 1, s);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(r * 8 + 1, 0, 1, s);
      g.fillStyle = 'rgba(0,0,0,0.28)';
    }
  } else if (kind === 'metal') {
    g.fillRect(0, 0, s, 1);
    g.fillRect(0, 0, 1, s);
    g.fillRect(0, 15, s, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28]]) g.fillRect(x, y, 2, 2);
  } else if (kind === 'ice') {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(4, 4, 10, 1);
    g.fillRect(14, 5, 1, 9);
    g.fillStyle = 'rgba(0,60,120,0.12)';
    g.fillRect(0, 0, s, 1);
    g.fillRect(0, 0, 1, s);
  } else if (kind === 'paper') {
    g.fillStyle = 'rgba(90,60,30,0.45)';
    g.fillRect(0, 0, s, 2);
    g.fillRect(0, 0, 2, s);
    g.fillRect(15, 0, 1, s);
    g.fillRect(0, 15, s, 1);
  } else if (kind === 'neon') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(2, 2, s - 4, s - 4);
  } else {
    g.fillRect(0, 0, s, 1);
    g.fillRect(0, 0, 1, s);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, s - 1, s, 1);
    g.fillRect(s - 1, 0, 1, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class VoxelWorld {
  kindArr = new Uint8Array(N);
  hpArr = new Float32Array(N);
  colArr = new Uint32Array(N);
  instArr = new Int32Array(N).fill(-1);
  initKind = new Uint8Array(N);
  initCol = new Uint32Array(N);
  meshes: (THREE.InstancedMesh | null)[] = [];
  instCells: Int32Array[] = [];
  counts: number[] = new Array(KINDS.length + 1).fill(0);
  group = new THREE.Group();
  dirtyKinds = new Set<number>();
  log: LogEntry[] = [];
  clock = 0;
  onRemove: RemoveCb | null = null;
  stabDirty = false;
  stabTimer = 0;
  footDirty = true;
  private foot = new Uint8Array(W * D);
  private tmpM = new THREE.Matrix4();
  private tmpC = new THREE.Color();
  private reach = new Uint8Array(N);
  private queue = new Int32Array(N);
  private textures: THREE.Texture[] = [];
  private geo = new THREE.BoxGeometry(1, 1, 1);

  idx(x: number, y: number, z: number) {
    return (y * D + z) * W + x;
  }
  inb(x: number, y: number, z: number) {
    return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;
  }

  /** Só usar durante a geração */
  set(x: number, y: number, z: number, k: Kind | null, col = 0) {
    if (!this.inb(x, y, z)) return;
    const i = this.idx(x, y, z);
    if (k === null) {
      this.kindArr[i] = 0;
      return;
    }
    this.kindArr[i] = KI[k];
    this.colArr[i] = col || DEFS[k].base;
    this.hpArr[i] = DEFS[k].hp;
  }
  kindAt(x: number, y: number, z: number) {
    if (!this.inb(x, y, z)) return 0;
    return this.kindArr[this.idx(x, y, z)];
  }

  private computeReach() {
    const reach = this.reach;
    reach.fill(0);
    const q = this.queue;
    let qh = 0;
    let qt = 0;
    const ka = this.kindArr;
    for (let i = 0; i < LAYER; i++) {
      if (ka[i]) {
        reach[i] = 1;
        q[qt++] = i;
      }
    }
    const push = (j: number) => {
      if (ka[j] && !reach[j]) {
        reach[j] = 1;
        q[qt++] = j;
      }
    };
    while (qh < qt) {
      const i = q[qh++];
      const x = i % W;
      const z = Math.floor(i / W) % D;
      const y = Math.floor(i / LAYER);
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (z > 0) push(i - W);
      if (z < D - 1) push(i + W);
      if (y > 0) push(i - LAYER);
      if (y < H - 1) push(i + LAYER);
    }
    return reach;
  }

  build() {
    const reach = this.computeReach();
    for (let i = 0; i < N; i++) if (this.kindArr[i] && !reach[i]) this.kindArr[i] = 0;
    this.initKind.set(this.kindArr);
    this.initCol.set(this.colArr);
    const cnt = new Array(KINDS.length + 1).fill(0);
    for (let i = 0; i < N; i++) if (this.kindArr[i]) cnt[this.kindArr[i]]++;
    for (let k = 1; k <= KINDS.length; k++) {
      const cap = cnt[k];
      if (cap === 0) {
        this.meshes[k] = null;
        continue;
      }
      const kind = KINDS[k - 1];
      const map = makeTexture(kind);
      this.textures.push(map);
      const mat =
        kind === 'neon'
          ? new THREE.MeshBasicMaterial({ map, color: 0xffffff })
          : new THREE.MeshLambertMaterial({ map, color: 0xffffff });
      const mesh = new THREE.InstancedMesh(this.geo, mat, cap);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.frustumCulled = false;
      mesh.castShadow = kind !== 'neon';
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes[k] = mesh;
      this.instCells[k] = new Int32Array(cap);
    }
    this.fillInstances();
  }

  private fillInstances() {
    this.counts.fill(0);
    this.instArr.fill(-1);
    for (let i = 0; i < N; i++) if (this.kindArr[i]) this.addInstance(i);
    for (let k = 1; k <= KINDS.length; k++) {
      const m = this.meshes[k];
      if (m) {
        m.count = this.counts[k];
        this.dirtyKinds.add(k);
      }
    }
  }

  private addInstance(i: number) {
    const k = this.kindArr[i];
    const mesh = this.meshes[k];
    if (!mesh) return;
    const n = this.counts[k];
    if (n >= this.instCells[k].length) return;
    this.counts[k]++;
    const x = i % W;
    const z = Math.floor(i / W) % D;
    const y = Math.floor(i / LAYER);
    this.tmpM.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    mesh.setMatrixAt(n, this.tmpM);
    const hash = ((Math.imul(i, 2654435761) >>> 0) % 1000) / 1000;
    const j = k === KINDS.indexOf('neon') + 1 ? 1 : 0.88 + 0.24 * hash;
    this.tmpC.setHex(this.colArr[i]).multiplyScalar(j);
    mesh.setColorAt(n, this.tmpC);
    this.instCells[k][n] = i;
    this.instArr[i] = n;
    mesh.count = this.counts[k];
    this.dirtyKinds.add(k);
  }

  private removeInstance(i: number) {
    const k = this.kindArr[i];
    const mesh = this.meshes[k];
    const n = this.instArr[i];
    if (!mesh || n < 0) return;
    const last = this.counts[k] - 1;
    if (n !== last) {
      const lastIdx = this.instCells[k][last];
      mesh.getMatrixAt(last, this.tmpM);
      mesh.setMatrixAt(n, this.tmpM);
      mesh.getColorAt(last, this.tmpC);
      mesh.setColorAt(n, this.tmpC);
      this.instCells[k][n] = lastIdx;
      this.instArr[lastIdx] = n;
    }
    this.counts[k] = last;
    mesh.count = last;
    this.instArr[i] = -1;
    this.dirtyKinds.add(k);
  }

  removeCell(i: number, imp: Impulse | null, fall = false) {
    const k = this.kindArr[i];
    if (!k) return false;
    const col = this.colArr[i];
    this.log.push({ idx: i, kind: k, col, t: this.clock });
    this.removeInstance(i);
    this.kindArr[i] = 0;
    this.stabDirty = true;
    this.footDirty = true;
    if (this.onRemove) {
      const x = i % W;
      const z = Math.floor(i / W) % D;
      const y = Math.floor(i / LAYER);
      this.onRemove(x, y, z, col, k, imp, fall);
    }
    return true;
  }

  /** 0 = imune, 1 = acertou, 2 = destruído */
  damage(i: number, amt: number, canHeavy: boolean, imp: Impulse | null = null): number {
    const k = this.kindArr[i];
    if (!k) return 0;
    const def = DEFS[kindOf(k)];
    if (def.heavy && !canHeavy) return 0;
    this.hpArr[i] -= amt;
    if (this.hpArr[i] <= 0) {
      this.removeCell(i, imp);
      return 2;
    }
    return 1;
  }

  restoreCell(e: LogEntry) {
    if (this.kindArr[e.idx] !== 0) return false;
    this.kindArr[e.idx] = e.kind;
    this.colArr[e.idx] = e.col;
    this.hpArr[e.idx] = DEFS[kindOf(e.kind)].hp;
    this.addInstance(e.idx);
    this.footDirty = true;
    return true;
  }

  resetToInitial() {
    this.kindArr.set(this.initKind);
    this.colArr.set(this.initCol);
    for (let i = 0; i < N; i++) this.hpArr[i] = this.kindArr[i] ? DEFS[kindOf(this.kindArr[i])].hp : 0;
    this.log = [];
    this.stabDirty = false;
    this.footDirty = true;
    this.fillInstances();
  }

  /** Vaporiza tudo (bomba nuclear). Retorna nada; chama cb para uma fração dos blocos. */
  vaporizeAll(cx: number, cz: number, every: number, cb: (x: number, y: number, z: number, col: number) => void) {
    const list: { i: number; d: number }[] = [];
    for (let i = 0; i < N; i++) {
      if (!this.kindArr[i]) continue;
      const x = (i % W) + 0.5 - cx;
      const z = (Math.floor(i / W) % D) + 0.5 - cz;
      list.push({ i, d: x * x + z * z });
    }
    list.sort((a, b) => a.d - b.d);
    let n = 0;
    for (const e of list) {
      this.log.push({ idx: e.i, kind: this.kindArr[e.i], col: this.colArr[e.i], t: this.clock });
      if (n++ % every === 0) {
        cb(e.i % W, Math.floor(e.i / LAYER), Math.floor(e.i / W) % D, this.colArr[e.i]);
      }
    }
    this.kindArr.fill(0);
    this.instArr.fill(-1);
    for (let k = 1; k <= KINDS.length; k++) {
      this.counts[k] = 0;
      const m = this.meshes[k];
      if (m) m.count = 0;
      this.dirtyKinds.add(k);
    }
    this.footDirty = true;
    this.stabDirty = false;
  }

  collapse() {
    const reach = this.computeReach();
    const list: number[] = [];
    for (let k = 1; k <= KINDS.length; k++) {
      const cells = this.instCells[k];
      for (let n = 0; n < this.counts[k]; n++) if (!reach[cells[n]]) list.push(cells[n]);
    }
    for (const i of list) this.removeCell(i, null, true);
    return list.length;
  }

  tick(dt: number) {
    if (this.stabDirty) {
      this.stabTimer -= dt;
      if (this.stabTimer <= 0) {
        this.stabTimer = 0.18;
        this.stabDirty = false;
        this.collapse();
      }
    }
    if (this.dirtyKinds.size) {
      this.dirtyKinds.forEach((k) => {
        const m = this.meshes[k];
        if (m) {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      });
      this.dirtyKinds.clear();
    }
  }

  solidCell(x: number, y: number, z: number) {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return false;
    return this.kindArr[(y * D + z) * W + x] !== 0;
  }

  solid(x: number, y: number, z: number) {
    if (x < 0 || x >= W || z < 0 || z >= D) return true;
    if (y < 0) return true;
    if (y >= H) return false;
    return this.kindArr[(y * D + z) * W + x] !== 0;
  }

  collidesBox(px: number, py: number, pz: number, r: number, h: number) {
    const x0 = Math.floor(px - r);
    const x1 = Math.floor(px + r - 1e-4);
    const z0 = Math.floor(pz - r);
    const z1 = Math.floor(pz + r - 1e-4);
    const y0 = Math.floor(py + 1e-3);
    const y1 = Math.floor(py + h - 1e-3);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) if (this.solid(x, y, z)) return true;
    return false;
  }

  cellsInBox(px: number, py: number, pz: number, r: number, h: number, cb: (i: number) => void) {
    const x0 = Math.floor(px - r);
    const x1 = Math.floor(px + r - 1e-4);
    const z0 = Math.floor(pz - r);
    const z1 = Math.floor(pz + r - 1e-4);
    const y0 = Math.max(0, Math.floor(py + 1e-3));
    const y1 = Math.floor(py + h - 1e-3);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) if (this.solidCell(x, y, z)) cb(this.idx(x, y, z));
  }

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): RayHit | null {
    let tg = Infinity;
    if (dy < -1e-6 && oy > 0) tg = -oy / dy;
    const limit = Math.min(max, tg);
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    const sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
    const tdy = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
    const tdz = dz !== 0 ? 1 / Math.abs(dz) : Infinity;
    let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
    let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
    let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
    let t = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let step = 0; step < 600; step++) {
      if (x < 0 || x >= W || z < 0 || z >= D) break;
      if (y >= H && dy >= 0) break;
      if (y >= 0 && y < H) {
        const i = (y * D + z) * W + x;
        if (this.kindArr[i]) return { dist: t, idx: i, nx, ny, nz };
      }
      if (tmx < tmy && tmx < tmz) {
        t = tmx;
        if (t > limit) break;
        x += sx;
        tmx += tdx;
        nx = -sx;
        ny = 0;
        nz = 0;
      } else if (tmy < tmz) {
        t = tmy;
        if (t > limit) break;
        y += sy;
        tmy += tdy;
        nx = 0;
        ny = -sy;
        nz = 0;
      } else {
        t = tmz;
        if (t > limit) break;
        z += sz;
        tmz += tdz;
        nx = 0;
        ny = 0;
        nz = -sz;
      }
    }
    if (tg <= max) return { dist: tg, idx: -1, nx: 0, ny: 1, nz: 0 };
    return null;
  }

  footprint(): Uint8Array {
    if (this.footDirty) {
      this.footDirty = false;
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) {
          let h = 0;
          for (let y = H - 1; y >= 0; y--) {
            if (this.kindArr[(y * D + z) * W + x]) {
              h = y + 1;
              break;
            }
          }
          this.foot[z * W + x] = h;
        }
    }
    return this.foot;
  }

  dispose() {
    this.geo.dispose();
    this.textures.forEach((t) => t.dispose());
    for (const m of this.meshes) {
      if (m) {
        (m.material as THREE.Material).dispose();
        m.dispose();
      }
    }
  }
}
