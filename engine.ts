import * as THREE from 'three';
import { VoxelWorld, W, D, H } from './world';
import type { Impulse, LogEntry } from './world';
import { DEFS, kindOf } from './blocks';
import { Rng, clamp, lerp, smooth } from './rng';
import { buildMap } from './mapgen';
import type { Rail } from './mapgen';
import { getMap } from './maps';
import type { MapDef } from './maps';
import { Particles } from './particles';
import { Humanoid, makeLabel, SKINS } from './humanoid';
import type { Outfit } from './humanoid';
import { VEHICLES, buildVehicleModel, animateVehicle } from './vehicles';
import type { VehicleKind, VehicleDef, VehicleModel } from './vehicles';
import { Sfx } from './audio';
import { NukeFx, buildWarhead } from './nuke';
import { buildViewModel, disposeViewModel } from './viewmodels';
import type { ViewModel } from './viewmodels';
import { WEAPONS, TRUTH, TRUTH_POWERS } from './weapons';
import { markConquered, grantTruth, loadProgress, NEEDED } from './progress';
import type { WeaponDef } from './weapons';
import { tickWeapon, tickEffects, vehicleSpecial, disposeEffects } from './combat';

export type Phase = 'intro' | 'playing' | 'nuke' | 'ended' | 'rewinding';
export type Difficulty = 'easy' | 'normal' | 'insane';

export interface GameOptions {
  mapId: string;
  difficulty: Difficulty;
  training: boolean;
  touch: boolean;
  truth?: boolean;
}

export interface HudState {
  phase: Phase;
  level: number;
  kills: number;
  civKills: number;
  civStreak: number;
  hp: number;
  cd: number;
  charge: number;
  chargeLabel: string;
  markedT: number;
  vehicle: { name: string; emoji: string; special: string; shoot: string } | null;
  nearVehicle: string | null;
  timeStop: number;
  nukeCount: number;
  nukeT: number;
  matchTime: number;
  rewind: number;
  dead: boolean;
  respawnT: number;
  introT: number;
  locked: boolean;
  lockFailed: boolean;
  paused: boolean;
  botsAlive: number;
  botsTotal: number;
  muted: boolean;
  training: boolean;
  zoom: number;
  mapName: string;
  canShoot: boolean;
  truth: boolean;
  truthPower: number;
  truthCds: number[];
  gravMode: number;
  wormhole: { dist: number; ang: number } | null;
  altar: number;
  conquered: number;
}

export interface Callbacks {
  onHud: (h: HudState) => void;
  onFeed: (text: string, tone: 'kill' | 'bad' | 'info' | 'good') => void;
  onAnnounce: (text: string, color: string, ms?: number) => void;
  onWormhole?: () => void;
}

export interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  onGround: boolean;
  r: number;
  h: number;
}

export interface Actor extends Body {
  id: number;
  kind: 'bot' | 'civ';
  name: string;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  model: Humanoid;
  ai: 'roam' | 'idle' | 'flee' | 'engage';
  aiT: number;
  dir: THREE.Vector2;
  dirT: number;
  blockedT: number;
  speedNow: number;
  fireCd: number;
  burst: number;
  burstT: number;
  losT: number;
  sees: boolean;
  fleeFrom: THREE.Vector3;
  frozenT: number;
  stunT: number;
  markedT: number;
  respawnT: number;
  ideal: number;
  strafe: number;
  label?: THREE.Sprite;
  barBg?: THREE.Sprite;
  barFg?: THREE.Sprite;
  mark?: THREE.Mesh;
}

export interface Vehicle {
  kind: VehicleKind;
  def: VehicleDef;
  model: VehicleModel;
  pos: THREE.Vector3;
  yaw: number;
  rider: boolean;
  marker: THREE.Mesh;
}

export interface Ballistic {
  drop: number;
  drag: number;
  pierce: number;
  head: number;
  blockAmt: number;
  range: number;
  weapon: string;
  traveled: number;
  ricochets: number;
  falloff: number;
}

export interface Projectile {
  kind: 'enemy' | 'rocket' | 'pedro' | 'fire' | 'bullet';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  mesh: THREE.Object3D;
  dmg: number;
  owner: 'player' | 'bot';
  bot?: Actor;
  target?: Actor | null;
  speed: number;
  ballistic?: Ballistic;
}

export interface Rift {
  pos: THREE.Vector3;
  yaw: number;
  t: number;
  max: number;
  radius: number;
  mesh: THREE.Group;
}

export interface Bomb {
  pos: THREE.Vector3;
  t: number;
  actor?: Actor;
  pulse: number;
}

export interface Input {
  pressed: boolean;
  held: boolean;
  secPressed: boolean;
  secHeld: boolean;
}

export interface WeaponState {
  cd: number;
  cdMax: number;
  cd2: number;
  windup: number;
  charge: number;
  chargeMax: number;
  swing: number;
  kick: number;
  barrage: number;
  oraT: number;
  heat: number;
  guard: boolean;
  zoom: number;
  warnT: number;
  slashHit: Set<Actor>;
  burnT: number;
  tickT: number;
}

export interface PlayerState extends Body {
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawnT: number;
  invuln: number;
  level: number;
  kills: number;
  civKills: number;
  civStreak: number;
  markedT: number;
  vehicle: Vehicle | null;
  boostT: number;
  spinT: number;
  spinAng: number;
  spinHit: Set<Actor>;
  kickT: number;
  dashT: number;
  dashDir: THREE.Vector3;
  grind: { rail: Rail; dx: number; dz: number } | null;
  specialCd: number;
  bob: number;
}

export interface ScanOpt {
  range: number;
  dmg: number;
  weapon: string;
  pierce?: number;
  head?: number;
  blockAmt?: number;
  heavy?: boolean;
  tracer?: number;
  through?: boolean;
  radius?: number;
  width?: number;
  onActorHit?: (a: Actor, head: boolean) => void;
}

interface Snap {
  t: number;
  px: number;
  py: number;
  pz: number;
  yaw: number;
  pitch: number;
  veh: number;
  nc: number;
  lvl: number;
  a: Float32Array;
  v: Float32Array;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  w: number;
}

const GRAV = 24;
const CX = W / 2;
const CZ = D / 2;

const DIFFS = {
  easy: { bots: 6, dmg: 6, interval: 1.6, spread: 0.1, speed: 3.6, sight: 45 },
  normal: { bots: 9, dmg: 10, interval: 1.05, spread: 0.06, speed: 4.3, sight: 58 },
  insane: { bots: 13, dmg: 15, interval: 0.65, spread: 0.032, speed: 5.1, sight: 75 },
};

const BOT_NAMES = [
  'Zé Pelicano', 'xX_Pedro_Xx', 'Karen_do_Zap', 'MC Baguete', 'TioDaPamonha', 'Gigachad_BR', 'Naruto_Corredor',
  'Sigma_Jorge', 'NoobMaster69', 'Dona_Maria', 'Seu_Madruga', 'LagTotal', 'Capivara_Lord', 'Lampião_Gamer',
];
const BOT_SHIRTS = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];

const cellXYZ = (i: number) => ({ x: i % W, z: Math.floor(i / W) % D, y: Math.floor(i / (W * D)) });

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class Game {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world = new VoxelWorld();
  particles = new Particles();
  sfx = new Sfx();
  map: MapDef;
  opts: GameOptions;
  cb: Callbacks;
  rt = new Rng((Date.now() & 0xffffff) + 7);
  diff: (typeof DIFFS)['normal'];
  radar: HTMLCanvasElement | null;

  player: PlayerState;
  actors: Actor[] = [];
  bots: Actor[] = [];
  civs: Actor[] = [];
  vehicles: Vehicle[] = [];
  projectiles: Projectile[] = [];
  rifts: Rift[] = [];
  bombs: Bomb[] = [];
  burning = new Map<number, number>();
  rails: Rail[] = [];
  tracers: Tracer[] = [];
  ws: WeaponState;

  phase: Phase = 'intro';
  introT = 3.2;
  matchTime = 0;
  time = 0;
  timeStop = 0;
  nukeCount = -1;
  nukeT = 0;
  nuke = new NukeFx();
  warhead: THREE.Group;
  hist: Snap[] = [];
  histT = 0;
  rw: { t: number; dur: number; nukeT0: number; restored: number; log: LogEntry[]; inflight: number; hist: Snap[]; } | null = null;
  rwProgress = 0;

  keys: Record<string, boolean> = {};
  mouseL = false;
  mouseR = false;
  firePulse = false;
  secPulse = false;
  locked = false;
  lockedOnce = false;
  lockFailed = false;
  touch = false;
  touchMove = { x: 0, y: 0 };
  touchJump = false;
  userPaused = false;
  autoPaused = false;
  truthMode = false;
  truthGiven = false;
  truthPower = 0;
  truthCd = [0, 0, 0, 0];
  gravMode = 0;
  wormholeOn = false;
  wormhole: THREE.Group | null = null;
  wormholeParts: { rings: THREE.Mesh[]; disc: THREE.Mesh } | null = null;
  wormholePos = new THREE.Vector3();
  sanctum = false;
  altar: THREE.Group | null = null;
  altarParts: THREE.Object3D[] = [];
  conqueredCount = 0;

  vm: ViewModel | null = null;
  shakeAmt = 0;
  hitT = 0;
  hurtT = 0;
  flash = 0;
  fov = 75;
  camY = 1.6;
  hudT = 0;
  fallCount = 0;
  fallSfxT = 0;
  bobPhase = 0;
  sky!: THREE.Mesh;
  groundMat!: THREE.MeshLambertMaterial;
  groundBase = new THREE.Color();
  weather: THREE.Points | null = null;
  weatherSpeed = 0;
  decor: THREE.Group | null = null;
  sun!: THREE.DirectionalLight;
  raf = 0;
  last = 0;
  disposed = false;
  footCanvas: HTMLCanvasElement;
  footCtx: CanvasRenderingContext2D;
  radarT = 0;
  fps = 60;
  suppressDebris = false;
  nextId = 1;
  resizeObs: ResizeObserver | null = null;

  constructor(container: HTMLElement, radar: HTMLCanvasElement | null, opts: GameOptions, cb: Callbacks) {
    this.container = container;
    this.radar = radar;
    this.opts = opts;
    this.cb = cb;
    this.map = getMap(opts.mapId);
    this.diff = DIFFS[opts.difficulty];
    this.touch = opts.touch;
    this.sanctum = this.map.id === 'santuario';
    this.truthMode = !!opts.truth;
    this.conqueredCount = loadProgress().conquered.length;

    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.touch, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.touch ? 1.25 : 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.05, 900);
    this.scene.add(this.camera);

    this.footCanvas = document.createElement('canvas');
    this.footCanvas.width = W;
    this.footCanvas.height = D;
    this.footCtx = this.footCanvas.getContext('2d')!;

    this.buildEnvironment();

    this.world.onRemove = this.onBlockRemoved;
    const res = buildMap(opts.mapId, this.world, new Rng(opts.mapId.length * 7919 + 1234));
    this.rails = res.rails;
    this.decor = res.decor;
    this.scene.add(this.world.group, res.decor, this.particles.group, this.nuke.group);
    if (this.sanctum) this.buildAltar();

    this.warhead = buildWarhead();
    this.warhead.visible = false;
    this.scene.add(this.warhead);

    this.player = {
      pos: new THREE.Vector3(CX, 0, CZ),
      vel: new THREE.Vector3(),
      onGround: true,
      r: 0.4,
      h: 1.75,
      yaw: 0,
      pitch: 0,
      hp: 100,
      maxHp: 100,
      dead: false,
      respawnT: 0,
      invuln: 0,
      level: 1,
      kills: 0,
      civKills: 0,
      civStreak: 0,
      markedT: 0,
      vehicle: null,
      boostT: 0,
      spinT: 0,
      spinAng: 0,
      spinHit: new Set(),
      kickT: 0,
      dashT: 0,
      dashDir: new THREE.Vector3(0, 0, -1),
      grind: null,
      specialCd: 0,
      bob: 0,
    };
    this.ws = this.newWeaponState();
    const spot = this.sanctum ? this.findSpot(null, 0, CX + 6, CZ + 28, 3) : this.findSpot(null, 0, CX, CZ, 12);
    this.player.pos.copy(spot);
    this.player.yaw = Math.atan2(-(CX - spot.x), -(CZ - spot.z));
    this.camY = spot.y + 1.62;

    this.spawnActors();
    this.spawnVehicles();
    this.rebuildViewModel();
    this.bindInput();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);

    this.sfx.muted = false;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.pushHud(true);
  }

  // ================= Setup =================
  newWeaponState(): WeaponState {
    return {
      cd: 0, cdMax: 0.3, cd2: 0, windup: 0, charge: 0, chargeMax: 1, swing: 0, kick: 0, barrage: 0, oraT: 0, heat: 0,
      guard: false, zoom: 0, warnT: 0, slashHit: new Set(), burnT: 0, tickT: 0,
    };
  }

  buildEnvironment() {
    const m = this.map;
    const fogCol = new THREE.Color(m.fog);
    this.scene.fog = new THREE.FogExp2(m.fog, m.fogD);
    this.scene.background = fogCol;

    const geo = new THREE.SphereGeometry(450, 24, 14);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color(m.sky[0]);
    const bot = new THREE.Color(m.sky[1]);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 450;
      const t = clamp(y * 1.6 + 0.05, 0, 1);
      c.copy(bot).lerp(top, Math.pow(t, 0.75));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    if (m.night) {
      const n = 350;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * 1.3 + 0.15;
        arr[i * 3] = Math.cos(a) * Math.cos(e) * 420;
        arr[i * 3 + 1] = Math.sin(e) * 420;
        arr[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 420;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
      this.sky.add(stars);
    }

    // chão
    const tc = document.createElement('canvas');
    tc.width = tc.height = 32;
    const g = tc.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 90; i++) {
      const v = 214 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 2, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    const tex = new THREE.CanvasTexture(tc);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const tex2 = tex.clone();
    tex2.needsUpdate = true;
    tex.repeat.set(W / 4, D / 4);
    tex2.repeat.set(300, 300);
    this.groundBase.setHex(m.ground);
    this.groundMat = new THREE.MeshLambertMaterial({ color: m.ground, map: tex });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.groundMat);
    field.rotation.x = -Math.PI / 2;
    field.position.set(CX, 0, CZ);
    field.receiveShadow = true;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: m.ground2, map: tex2 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(CX, -0.04, CZ);
    outer.receiveShadow = true;
    this.scene.add(field, outer);

    // luzes
    this.scene.add(new THREE.AmbientLight(0xffffff, m.ambient * 0.55));
    this.scene.add(new THREE.HemisphereLight(m.sky[0], m.ground, 0.38));
    const sun = new THREE.DirectionalLight(m.sunColor, m.sunI);
    sun.position.set(CX + 55, 120, CZ + 40);
    sun.target.position.set(CX, 0, CZ);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.touch ? 1024 : 2048, this.touch ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -75;
    sc.right = 75;
    sc.top = 75;
    sc.bottom = -75;
    sc.near = 20;
    sc.far = 320;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.06;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // clima
    if (m.weather !== 'none') {
      const n = Math.floor((m.weather === 'rain' ? 1100 : 800) * (this.touch ? 0.55 : 1));
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 80;
        arr[i * 3 + 1] = Math.random() * 40;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const color = m.weather === 'snow' ? 0xffffff : m.weather === 'rain' ? 0x9bb8ff : m.weather === 'petals' ? 0xffb3d1 : 0xe0c58a;
      const size = m.weather === 'snow' ? 0.28 : m.weather === 'rain' ? 0.12 : 0.22;
      this.weather = new THREE.Points(gg, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }));
      this.weather.frustumCulled = false;
      this.weatherSpeed = m.weather === 'snow' ? 4 : m.weather === 'rain' ? 34 : m.weather === 'petals' ? 1.6 : 0.5;
      this.scene.add(this.weather);
    }
  }

  findSpot(from: THREE.Vector3 | null, minD: number, cx = CX, cz = CZ, radius = 0, r = 0.6, h = 2.2): THREE.Vector3 {
    for (let i = 0; i < 160; i++) {
      let x: number;
      let z: number;
      if (radius > 0) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * radius;
        x = cx + Math.cos(a) * rr;
        z = cz + Math.sin(a) * rr;
      } else {
        x = 4 + Math.random() * (W - 8);
        z = 4 + Math.random() * (D - 8);
      }
      if (this.world.collidesBox(x, 0, z, r + 0.2, h)) continue;
      if (from && Math.hypot(x - from.x, z - from.z) < minD) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(CX, 0, CZ);
  }

  makeActor(kind: 'bot' | 'civ', outfit: Outfit, name: string): Actor {
    const palette = outfit.skin ?? SKINS;
    const skin = this.rt.pick(palette);
    const model = new Humanoid(outfit, skin, 1);
    const a: Actor = {
      id: this.nextId++,
      kind,
      name,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      onGround: true,
      r: 0.36,
      h: 1.8,
      yaw: Math.random() * 6,
      hp: 100,
      maxHp: 100,
      alive: true,
      model,
      ai: 'roam',
      aiT: this.rt.range(1, 4),
      dir: new THREE.Vector2(Math.cos(Math.random() * 6), Math.sin(Math.random() * 6)),
      dirT: this.rt.range(1, 3),
      blockedT: 0,
      speedNow: 0,
      fireCd: this.rt.range(0.5, 2),
      burst: 0,
      burstT: 0,
      losT: Math.random() * 0.3,
      sees: false,
      fleeFrom: new THREE.Vector3(),
      frozenT: 0,
      stunT: 0,
      markedT: 0,
      respawnT: 0,
      ideal: this.rt.range(9, 16),
      strafe: Math.random() < 0.5 ? 1 : -1,
    };
    if (kind === 'bot') {
      a.label = makeLabel(name, '#ffffff');
      model.group.add(a.label);
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
      bg.scale.set(0.96, 0.1, 1);
      bg.position.y = 2.1;
      const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e, depthWrite: false }));
      fg.center.set(0, 0.5);
      fg.scale.set(0.9, 0.065, 1);
      fg.position.set(-0.45, 2.1, 0);
      model.group.add(bg, fg);
      a.barBg = bg;
      a.barFg = fg;
      const mk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 2.1, 10),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false }),
      );
      mk.position.y = 1.05;
      mk.renderOrder = 999;
      mk.visible = false;
      model.group.add(mk);
      a.mark = mk;
    }
    this.scene.add(model.group);
    return a;
  }

  spawnActors() {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const nBots = this.sanctum ? 5 : this.diff.bots;
    for (let i = 0; i < nBots; i++) {
      const outfit: Outfit = {
        label: '',
        shirt: this.rt.pick(BOT_SHIRTS),
        pants: this.rt.pick([0x1e293b, 0x334155, 0x78350f, 0x1e3a8a]),
        hat: this.rt.chance(0.4) ? 'cap' : 'none',
        hatColor: this.rt.pick(BOT_SHIRTS),
        hair: this.rt.pick([0x111111, 0x3b2412, 0xd4a017]),
        stripe: this.rt.chance(0.3) ? 0xffffff : undefined,
        stripeDir: 'h',
      };
      const a = this.makeActor('bot', outfit, this.sanctum ? 'Eco do Vazio' : names[i % names.length]);
      a.pos.copy(this.findSpot(this.player.pos, 22));
      this.bots.push(a);
    }
    const civN = this.sanctum ? 0 : this.touch ? 8 : this.map.id === 'antartica' ? 9 : 14;
    for (let i = 0; i < civN; i++) {
      const outfit = this.rt.pick(this.map.civs);
      const a = this.makeActor('civ', outfit, 'Civil');
      a.r = 0.34;
      a.pos.copy(this.findSpot(this.player.pos, 8));
      this.civs.push(a);
    }
    this.actors = [...this.bots, ...this.civs];
    this.actors.forEach((a) => this.syncActor(a, 0));
  }

  spawnVehicles() {
    const kinds: VehicleKind[] = ['skate', 'bike', 'unicycle', 'horse', 'skate', 'horse', 'bike'];
    for (const kind of kinds) {
      const def = VEHICLES[kind];
      const model = buildVehicleModel(kind);
      const pos = this.findSpot(null, 0, CX, CZ, 0, 1.0, 3);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      marker.position.y = kind === 'horse' ? 3.5 : 2.6;
      model.group.add(marker);
      const v: Vehicle = { kind, def, model, pos, yaw: Math.random() * 6, rider: false, marker };
      this.scene.add(model.group);
      model.group.position.copy(pos);
      model.group.rotation.y = v.yaw;
      this.vehicles.push(v);
    }
  }

  rebuildViewModel() {
    if (this.vm) {
      this.camera.remove(this.vm.group);
      disposeViewModel(this.vm);
    }
    this.vm = buildViewModel(this.truthMode ? 21 : this.player.level);
    this.vm.group.position.copy(this.vm.base);
    this.camera.add(this.vm.group);
  }

  // ================= Input =================
  onKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys[e.code] = true;
    if (e.code === 'KeyF') this.firePulse = true;
    if (e.code === 'KeyQ') this.secPulse = true;
    if (e.code === 'KeyE') this.toggleVehicle();
    if (this.truthMode) {
      if (e.code === 'Digit1') this.selectPower(0);
      if (e.code === 'Digit2') this.selectPower(1);
      if (e.code === 'Digit3') this.selectPower(2);
      if (e.code === 'Digit4') this.selectPower(3);
      if (e.code === 'KeyC') this.cyclePower();
    }
    if (e.code === 'KeyR') {
      if (this.phase === 'playing' || this.phase === 'nuke' || this.phase === 'ended') this.startRewind();
    }
    if (e.code === 'KeyM') {
      this.sfx.setMuted(!this.sfx.muted);
      this.pushHud(true);
    }
    if (this.opts.training && (this.phase === 'playing' || this.phase === 'nuke' || this.phase === 'intro')) {
      if (e.code === 'KeyN') this.setLevel(this.player.level + 1, 'treino');
      if (e.code === 'KeyB') this.setLevel(this.player.level - 1, 'treino');
    }
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  onMouseDown = (e: MouseEvent) => {
    if (e.target !== this.canvas) return;
    this.sfx.init();
    if (!this.locked && !this.lockFailed) {
      this.requestLock();
      return;
    }
    if (e.button === 0) {
      this.mouseL = true;
      this.firePulse = true;
    }
    if (e.button === 2) {
      this.mouseR = true;
      this.secPulse = true;
    }
  };
  onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseL = false;
    if (e.button === 2) this.mouseR = false;
  };
  onMouseMove = (e: MouseEvent) => {
    if (!this.locked || this.phase === 'rewinding') return;
    const s = 0.0022 * (this.fov / 75);
    this.player.yaw -= e.movementX * s;
    this.player.pitch = clamp(this.player.pitch - e.movementY * s, -1.5, 1.5);
  };
  onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) this.lockedOnce = true;
    if (!this.locked) {
      this.mouseL = false;
      this.mouseR = false;
    }
    this.pushHud(true);
  };
  onLockError = () => {
    this.lockFailed = true;
    this.pushHud(true);
  };
  onCtx = (e: Event) => e.preventDefault();
  onBlur = () => {
    this.keys = {};
    this.mouseL = false;
    this.mouseR = false;
  };

  bindInput() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    this.container.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('blur', this.onBlur);
  }

  requestLock() {
    this.sfx.init();
    if (document.pointerLockElement === this.canvas) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          this.lockFailed = true;
          this.pushHud(true);
        });
      }
    } catch {
      this.lockFailed = true;
    }
  }

  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  get paused() {
    if (this.phase === 'ended' || this.phase === 'rewinding') return false;
    return this.userPaused || this.autoPaused || (this.lockedOnce && !this.locked && !this.lockFailed);
  }

  jumpHeld() {
    return !!this.keys.Space || this.touchJump;
  }
  addLook(dx: number, dy: number) {
    if (this.phase === 'rewinding' || this.paused) return;
    const s = 0.0058 * (this.fov / 75);
    this.player.yaw -= dx * s;
    this.player.pitch = clamp(this.player.pitch - dy * s, -1.5, 1.5);
  }
  touchFire(down: boolean) {
    this.sfx.init();
    this.mouseL = down;
    if (down) this.firePulse = true;
  }
  touchSec(down: boolean) {
    this.sfx.init();
    this.mouseR = down;
    if (down) this.secPulse = true;
  }
  clearTouch() {
    this.mouseL = false;
    this.mouseR = false;
    this.touchJump = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
  }
  setUserPaused(v: boolean) {
    this.userPaused = v;
    if (v) this.clearTouch();
    this.pushHud(true);
  }
  setAutoPaused(v: boolean) {
    this.autoPaused = v;
    if (v) this.clearTouch();
    this.pushHud(true);
  }
  toggleMute() {
    this.sfx.setMuted(!this.sfx.muted);
    this.pushHud(true);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ================= Utilidades =================
  eyeHeight() {
    const p = this.player;
    return p.vehicle ? p.vehicle.def.eye : 1.62;
  }
  eye() {
    const p = this.player;
    return new THREE.Vector3(p.pos.x, p.pos.y + this.eyeHeight(), p.pos.z);
  }
  aim() {
    const p = this.player;
    const cp = Math.cos(p.pitch);
    return new THREE.Vector3(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
  }
  announce(t: string, color = '#ffffff', ms = 1800) {
    this.cb.onAnnounce(t, color, ms);
  }
  feed(t: string, tone: 'kill' | 'bad' | 'info' | 'good' = 'info') {
    this.cb.onFeed(t, tone);
  }
  shake(a: number) {
    this.shakeAmt = Math.min(1.5, Math.max(this.shakeAmt, a));
  }
  hitMarker() {
    this.hitT = 0.22;
    this.sfx.hit();
  }

  canShoot(w: WeaponDef) {
    const v = this.player.vehicle;
    if (!v) return true;
    if (v.def.shoot === 'none') return false;
    if (v.def.shoot === 'one') return w.oneHand;
    return true;
  }

  activeWeapon(): WeaponDef {
    if (this.truthMode) return TRUTH;
    return WEAPONS[Math.min(this.player.level, 19) - 1];
  }

  noise(pos: THREE.Vector3, radius: number) {
    for (const c of this.civs) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < radius) {
        c.ai = 'flee';
        c.aiT = 5 + Math.random() * 3;
        c.fleeFrom.copy(pos);
      }
    }
  }

  tracer(a: THREE.Vector3, b: THREE.Vector3, color: number, width = 0.03, life = 0.08) {
    const len = a.distanceTo(b);
    if (len < 0.05) return;
    const geo = Game.tracerGeo;
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    _v.copy(b).sub(a).normalize();
    _q.setFromUnitVectors(_up, _v);
    mesh.quaternion.copy(_q);
    mesh.scale.set(width, len, width);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life, max: life, w: width });
  }
  static tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);

  spark(x: number, y: number, z: number, color: number, n = 6, speed = 4) {
    this.particles.burst(x, y, z, n, color, speed, 0.09, 0.4, { glow: true, grav: 10 });
  }

  ignite(idx: number) {
    const k = this.world.kindArr[idx];
    if (!k || !DEFS[kindOf(k)].flammable) return;
    if (this.burning.has(idx) || this.burning.size > 320) return;
    this.burning.set(idx, 0);
  }

  // ================= Mundo / blocos =================
  onBlockRemoved = (x: number, y: number, z: number, col: number, _k: number, imp: Impulse | null, fall: boolean) => {
    this.burning.delete(this.world.idx(x, y, z));
    if (this.suppressDebris) return;
    const j = () => Math.random() - 0.5;
    this.particles.spawn({
      x: x + 0.5,
      y: y + 0.5,
      z: z + 0.5,
      vx: (imp?.x ?? 0) + j() * 3,
      vy: (imp?.y ?? 0) + Math.random() * 3,
      vz: (imp?.z ?? 0) + j() * 3,
      size: 0.5 + Math.random() * 0.35,
      color: col,
      life: 3.5 + Math.random() * 3,
      grav: 20,
      bounce: 0.3,
      spin: 10,
      delay: fall ? Math.random() * 0.35 : 0,
      dmg: fall ? 55 : 0,
    });
    if (!fall && Math.random() < 0.45) {
      this.particles.spawn({ x: x + 0.5, y: y + 0.5, z: z + 0.5, vx: j() * 2, vy: 1 + Math.random() * 2, vz: j() * 2, size: 0.6, color: 0xcfc8bc, life: 0.8, grav: -1, drag: 1.5, grow: 1.2 });
    }
    if (fall) this.fallCount++;
  };

  damageBlocksSphere(c: THREE.Vector3, radius: number, maxAmt: number, heavy: boolean, outward = 6, bias = 0.6) {
    const R = Math.ceil(radius);
    const cx = Math.floor(c.x);
    const cy = Math.floor(c.y);
    const cz = Math.floor(c.z);
    for (let y = cy - R; y <= cy + R; y++)
      for (let z = cz - R; z <= cz + R; z++)
        for (let x = cx - R; x <= cx + R; x++) {
          if (!this.world.solidCell(x, y, z)) continue;
          const dx = x + 0.5 - c.x;
          const dy = y + 0.5 - c.y;
          const dz = z + 0.5 - c.z;
          const dc = Math.hypot(dx, dy, dz);
          if (dc > radius) continue;
          const amt = (1 - dc / radius) * maxAmt + bias;
          const inv = dc > 0.01 ? 1 / dc : 0;
          this.world.damage(this.world.idx(x, y, z), amt, heavy, { x: dx * inv * outward, y: dy * inv * outward + 3, z: dz * inv * outward });
        }
  }

  explode(pos: THREE.Vector3, radius: number, dmg: number, owner: 'player' | 'bot', opt: { heavy?: boolean; fire?: boolean; weapon?: string; color?: number; blockDmg?: number } = {}) {
    const col = opt.color ?? 0xffa030;
    this.particles.burst(pos.x, pos.y, pos.z, 26, col, radius * 3.4, 0.55, 0.7, { glow: true, grav: 2, grow: 1.4, drag: 2 });
    this.particles.burst(pos.x, pos.y, pos.z, 12, 0x3a3a3a, radius * 2.2, 0.7, 1.4, { grav: -1.2, drag: 1.5, grow: 1 });
    this.particles.spawn({ x: pos.x, y: pos.y, z: pos.z, size: radius * 1.5, color: 0xffffff, life: 0.22, grav: 0, glow: true, grow: 0.8, spin: 0 });
    this.sfx.explosion(radius > 5);
    const dEye = this.player.pos.distanceTo(pos);
    this.shake(clamp(1.3 - dEye / 40, 0.05, 1.3) * (radius / 5 + 0.4));
    this.noise(pos, 70);
    const weapon = opt.weapon ?? 'Explosão';
    for (const a of this.actors) {
      if (!a.alive) continue;
      const cy = a.pos.y + 0.9;
      const d = Math.hypot(a.pos.x - pos.x, cy - pos.y, a.pos.z - pos.z);
      if (d < radius + 0.6) {
        const f = 1 - d / (radius + 0.6);
        const inv = d > 0.01 ? 1 / d : 0;
        a.vel.x += (a.pos.x - pos.x) * inv * 12 * f;
        a.vel.z += (a.pos.z - pos.z) * inv * 12 * f;
        a.vel.y = Math.max(a.vel.y, 6 * f);
        a.stunT = 0.4;
        this.damageActor(a, dmg * (0.35 + 0.65 * f), { by: owner, weapon });
      }
    }
    const p = this.player;
    if (!p.dead) {
      const d = Math.hypot(p.pos.x - pos.x, p.pos.y + 1 - pos.y, p.pos.z - pos.z);
      if (d < radius + 0.5) {
        const f = 1 - d / (radius + 0.5);
        if (owner === 'player') this.hurtPlayer(dmg * 0.3 * f, 'sua própria explosão');
        else this.hurtPlayer(dmg * f, 'uma explosão');
        const inv = d > 0.01 ? 1 / d : 0;
        p.vel.x += (p.pos.x - pos.x) * inv * 14 * f;
        p.vel.z += (p.pos.z - pos.z) * inv * 14 * f;
        p.vel.y = Math.max(p.vel.y, 8 * f);
      }
    }
    this.damageBlocksSphere(pos, radius, opt.blockDmg ?? 14, !!opt.heavy);
    if (opt.fire) {
      const R = Math.ceil(radius + 1);
      for (let y = -R; y <= R; y++)
        for (let z = -R; z <= R; z++)
          for (let x = -R; x <= R; x++) {
            if (x * x + y * y + z * z > (radius + 1) * (radius + 1)) continue;
            const cx = Math.floor(pos.x) + x;
            const cy = Math.floor(pos.y) + y;
            const cz = Math.floor(pos.z) + z;
            if (this.world.solidCell(cx, cy, cz)) this.ignite(this.world.idx(cx, cy, cz));
          }
    }
  }

  // ================= Raios =================
  rayActors(o: THREE.Vector3, d: THREE.Vector3, maxT: number, extra = 0) {
    const out: { actor: Actor; t: number; head: boolean }[] = [];
    for (const a of this.actors) {
      if (!a.alive) continue;
      const ox = o.x - a.pos.x;
      const oz = o.z - a.pos.z;
      const R = a.r + extra;
      const A = d.x * d.x + d.z * d.z;
      let t: number;
      if (A < 1e-9) {
        if (ox * ox + oz * oz > R * R) continue;
        t = d.y !== 0 ? ((d.y > 0 ? a.pos.y : a.pos.y + a.h) - o.y) / d.y : 0;
        if (t < 0) continue;
      } else {
        const Bq = ox * d.x + oz * d.z;
        const C = ox * ox + oz * oz - R * R;
        const disc = Bq * Bq - A * C;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-Bq - sq) / A;
        const t2 = (-Bq + sq) / A;
        if (t2 < 0) continue;
        t = Math.max(0, t1);
        let y = o.y + d.y * t;
        if (y < a.pos.y - extra || y > a.pos.y + a.h + extra) {
          t = t2;
          y = o.y + d.y * t;
          if (y < a.pos.y - extra || y > a.pos.y + a.h + extra) continue;
        }
      }
      if (t > maxT) continue;
      const y = o.y + d.y * t;
      out.push({ actor: a, t, head: y > a.pos.y + a.h * 0.8 });
    }
    out.sort((x, y) => x.t - y.t);
    return out;
  }

  hitscan(o: THREE.Vector3, d: THREE.Vector3, opt: ScanOpt) {
    const origin = o.clone();
    let remaining = opt.range;
    let pierce = opt.pierce ?? 0;
    let hitActor: Actor | null = null;
    const end = origin.clone().addScaledVector(d, opt.range);
    for (let iter = 0; iter < 24; iter++) {
      const vh = this.world.raycast(origin.x, origin.y, origin.z, d.x, d.y, d.z, remaining);
      const maxT = vh ? vh.dist : remaining;
      const hits = this.rayActors(origin, d, maxT, opt.radius ?? 0);
      let stopped = false;
      for (const h of hits) {
        this.damageActor(h.actor, opt.dmg * (h.head ? (opt.head ?? 1.8) : 1), { by: 'player', weapon: opt.weapon, head: h.head });
        hitActor = hitActor ?? h.actor;
        opt.onActorHit?.(h.actor, h.head);
        if (!opt.through) {
          end.copy(origin).addScaledVector(d, h.t);
          stopped = true;
          break;
        }
      }
      if (stopped) break;
      if (vh) {
        const px = origin.x + d.x * vh.dist;
        const py = origin.y + d.y * vh.dist;
        const pz = origin.z + d.z * vh.dist;
        end.set(px, py, pz);
        let res = 0;
        let col = 0xcccccc;
        if (vh.idx >= 0) {
          col = this.world.colArr[vh.idx];
          res = this.world.damage(vh.idx, opt.blockAmt ?? 1, !!opt.heavy, { x: d.x * 3, y: 2, z: d.z * 3 });
        }
        this.spark(px, py, pz, col, res === 0 ? 5 : 3, 3.5);
        if (res === 2 && pierce > 0) {
          pierce--;
          origin.set(px + d.x * 0.05, py + d.y * 0.05, pz + d.z * 0.05);
          remaining -= vh.dist + 0.05;
          if (remaining <= 0) break;
          continue;
        }
        break;
      } else {
        end.copy(origin).addScaledVector(d, remaining);
        break;
      }
    }
    if (opt.tracer !== undefined) {
      const start = o.clone().addScaledVector(d, 0.6);
      start.y -= 0.12;
      start.x += Math.cos(this.player.yaw) * 0.14;
      start.z += -Math.sin(this.player.yaw) * 0.14;
      this.tracer(start, end, opt.tracer, opt.width ?? 0.025, 0.07);
    }
    return { end, hitActor };
  }

  // ================= Dano / Mortes =================
  damageActor(a: Actor, dmg: number, src: { by: 'player' | 'bot' | 'world'; bot?: Actor; weapon?: string; head?: boolean; vehicle?: boolean }) {
    if (!a.alive || dmg <= 0) return;
    a.hp -= dmg;
    if (src.by === 'player' && a.kind === 'bot') this.hitMarker();
    if (a.kind === 'bot') {
      a.sees = true;
      if (a.ai === 'roam') a.ai = 'engage';
    } else {
      a.ai = 'flee';
      a.aiT = 6;
      a.fleeFrom.copy(this.player.pos);
    }
    this.particles.burst(a.pos.x, a.pos.y + 1.2, a.pos.z, 5, 0xff5555, 3, 0.1, 0.35, { glow: true, grav: 12 });
    if (a.hp <= 0) this.killActor(a, src);
    else if (a.barFg) a.barFg.scale.x = 0.9 * clamp(a.hp / a.maxHp, 0.001, 1);
  }

  killActor(a: Actor, src: { by: 'player' | 'bot' | 'world'; bot?: Actor; weapon?: string; head?: boolean }) {
    a.alive = false;
    a.hp = 0;
    a.model.setDead(true);
    a.respawnT = a.kind === 'bot' ? 5 : 14;
    if (a.label) a.label.visible = false;
    if (a.barBg) a.barBg.visible = false;
    if (a.barFg) a.barFg.visible = false;
    if (a.mark) a.mark.visible = false;
    a.markedT = 0;
    this.particles.burst(a.pos.x, a.pos.y + 1, a.pos.z, 14, 0xfacc15, 5, 0.14, 0.6, { glow: true, grav: 10 });
    if (a.kind === 'bot') {
      if (src.by === 'player') this.onPlayerKill(a, src.weapon ?? '', !!src.head);
      else this.feed(`💀 ${a.name} foi eliminado`, 'info');
    } else {
      if (src.by === 'player') this.civKilledByPlayer(a);
      else if (src.by === 'bot' && src.bot) {
        src.bot.markedT = 15;
        this.feed(`⚠ ${src.bot.name} matou um civil e está MARCADO PARA MORRER`, 'good');
      }
    }
  }

  onPlayerKill(a: Actor, weapon: string, head: boolean) {
    const p = this.player;
    p.kills++;
    p.civStreak = 0;
    p.hp = Math.min(p.maxHp, p.hp + 25);
    this.sfx.kill();
    this.feed(`🔫 Você eliminou ${a.name}${weapon ? ` com ${weapon}` : ''}${head ? ' (HEADSHOT)' : ''}`, 'kill');
    if (this.phase === 'playing' || this.phase === 'nuke') {
      if (p.level < 20) this.setLevel(p.level + 1, 'kill');
    }
  }

  civKilledByPlayer(_a: Actor) {
    const p = this.player;
    p.civKills++;
    p.civStreak++;
    p.markedT = 15;
    this.sfx.bad();
    this.feed('☠ Você matou um civil inocente! Karma negativo.', 'bad');
    this.announce('MARCADO PARA MORRER', '#ff3b3b', 2600);
    if (p.vehicle) {
      this.dismount();
      this.feed('Karma negativo: você caiu do veículo.', 'bad');
    }
    if (p.civStreak >= 3) {
      p.civStreak = 0;
      this.announce('PUNIÇÃO EXTREMA — ARMA REGREDIU', '#ff7a3b', 3000);
      this.setLevel(p.level - 1, 'punição');
    }
  }

  hurtPlayer(dmg: number, from: string) {
    const p = this.player;
    if (p.dead || p.invuln > 0 || this.phase === 'ended' || this.phase === 'rewinding' || dmg <= 0) return;
    p.hp -= dmg;
    this.hurtT = 1;
    this.sfx.hurt();
    this.shake(0.25);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.respawnT = 3;
      this.dismount();
      this.releaseWeaponHolds();
      this.feed(`💀 Você foi eliminado por ${from}`, 'bad');
      this.announce('VOCÊ MORREU', '#ff3b3b', 2200);
    }
  }

  releaseWeaponHolds() {
    this.ws.windup = 0;
    this.ws.charge = 0;
    this.ws.barrage = 0;
    this.ws.guard = false;
  }

  respawnPlayer() {
    const p = this.player;
    const spot = this.findSpot(this.bots.filter((b) => b.alive).map((b) => b.pos)[0] ?? null, 30);
    p.pos.copy(spot);
    p.vel.set(0, 0, 0);
    p.hp = p.maxHp;
    p.dead = false;
    p.invuln = 2.5;
    p.pitch = 0;
    this.camY = spot.y + 1.62;
  }

  setLevel(l: number, _why: string) {
    if (this.truthMode || this.sanctum) return;
    const p = this.player;
    const nl = clamp(l, 1, 20);
    if (nl === p.level) return;
    const up = nl > p.level;
    p.level = nl;
    this.ws = this.newWeaponState();
    this.rebuildViewModel();
    const w = WEAPONS[nl - 1];
    if (up) this.sfx.levelUp();
    this.announce(`${up ? '⬆' : '⬇'} NÍVEL ${nl} — ${w.icon} ${w.name}`, w.color, 2200);
    if (nl === 20 && (this.phase === 'playing' || this.phase === 'intro') && this.nukeCount < 0 && !this.wormholeOn) this.onLevel20();
  }

  // ================= Veículos =================
  nearestVehicle() {
    const p = this.player;
    let best: Vehicle | null = null;
    let bd = 3.6;
    for (const v of this.vehicles) {
      if (v.rider) continue;
      const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
      if (d < bd && Math.abs(v.pos.y - p.pos.y) < 2.5) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  toggleVehicle() {
    const p = this.player;
    if (p.dead || this.phase === 'rewinding' || this.phase === 'ended') return;
    if (p.vehicle) {
      this.dismount();
      return;
    }
    if (p.markedT > 0) {
      this.feed('Karma negativo: você não pode usar veículos agora!', 'bad');
      this.sfx.bad();
      return;
    }
    const v = this.nearestVehicle();
    if (!v) return;
    p.vehicle = v;
    v.rider = true;
    p.r = v.def.r;
    p.h = v.def.h;
    p.grind = null;
    this.feed(`${v.def.emoji} Montou em ${v.def.name}. ${v.def.special}`, 'info');
    this.sfx.tick();
    if (this.world.collidesBox(p.pos.x, p.pos.y, p.pos.z, p.r, p.h)) {
      p.pos.y += 0.5;
      if (this.world.collidesBox(p.pos.x, p.pos.y, p.pos.z, p.r, p.h)) {
        p.pos.y -= 0.5;
        p.vehicle = null;
        v.rider = false;
        p.r = 0.4;
        p.h = 1.75;
        this.feed('Sem espaço para montar aqui.', 'info');
      }
    }
  }

  dismount() {
    const p = this.player;
    const v = p.vehicle;
    if (!v) return;
    v.rider = false;
    v.pos.copy(p.pos);
    v.yaw = p.yaw;
    p.vehicle = null;
    p.r = 0.4;
    p.h = 1.75;
    p.grind = null;
    p.spinT = 0;
    p.boostT = 0;
  }

  // ================= Movimento =================
  ramCells(b: Body, power: number, dx: number, dz: number) {
    const list: number[] = [];
    let blocked = false;
    this.world.cellsInBox(b.pos.x, b.pos.y, b.pos.z, b.r, b.h, (i) => {
      if (DEFS[kindOf(this.world.kindArr[i])].ram <= power) list.push(i);
      else blocked = true;
    });
    if (blocked || list.length === 0) return 0;
    for (const i of list) this.world.removeCell(i, { x: dx * 7, y: 3, z: dz * 7 });
    this.sfx.noise(0.25, 900, 150, 0.5, 'lowpass');
    this.shake(0.3);
    return list.length;
  }

  moveBody(b: Body, dx: number, dy: number, dz: number, step = true, ram?: { power: number; speed: number }) {
    const w = this.world;
    let rammed = 0;
    const axis = (ax: 'x' | 'z', d: number) => {
      if (d === 0) return;
      b.pos[ax] += d;
      if (w.collidesBox(b.pos.x, b.pos.y, b.pos.z, b.r, b.h)) {
        if (ram && ram.speed > 6.5) {
          const l = Math.hypot(dx, dz) || 1;
          const n = this.ramCells(b, ram.power, dx / l, dz / l);
          if (n > 0 && !w.collidesBox(b.pos.x, b.pos.y, b.pos.z, b.r, b.h)) {
            rammed += n;
            return;
          }
        }
        if (step && b.onGround && !w.collidesBox(b.pos.x, b.pos.y + 1, b.pos.z, b.r, b.h)) {
          b.pos.y += 1;
          return;
        }
        b.pos[ax] -= d;
        b.vel[ax] = 0;
      }
    };
    axis('x', dx);
    axis('z', dz);
    b.onGround = false;
    if (dy !== 0) {
      b.pos.y += dy;
      if (dy < 0) {
        if (b.pos.y <= 0) {
          b.pos.y = 0;
          b.vel.y = 0;
          b.onGround = true;
        } else if (w.collidesBox(b.pos.x, b.pos.y, b.pos.z, b.r, b.h)) {
          b.pos.y = Math.floor(b.pos.y) + 1;
          b.vel.y = 0;
          b.onGround = true;
        }
      } else if (w.collidesBox(b.pos.x, b.pos.y, b.pos.z, b.r, b.h)) {
        b.pos.y = Math.ceil(b.pos.y + b.h) - b.h - 0.002;
        b.vel.y = 0;
      }
    }
    const CEIL = H + 4;
    if (b.pos.y + b.h > CEIL) {
      b.pos.y = CEIL - b.h;
      if (b.vel.y > 0) b.vel.y = 0;
    }
    return rammed;
  }

  teleportPlayer(dest: THREE.Vector3) {
    const p = this.player;
    for (let i = 0; i < 12; i++) {
      if (!this.world.collidesBox(dest.x, dest.y, dest.z, p.r, p.h)) break;
      dest.y += 0.5;
    }
    this.particles.burst(p.pos.x, p.pos.y + 1, p.pos.z, 16, 0x7dd3fc, 6, 0.12, 0.5, { glow: true, grav: 0 });
    p.pos.copy(dest);
    p.vel.set(0, 0, 0);
    this.camY = p.pos.y + this.eyeHeight();
    this.particles.burst(p.pos.x, p.pos.y + 1, p.pos.z, 16, 0xffffff, 6, 0.12, 0.5, { glow: true, grav: 0 });
  }

  updatePlayer(dt: number) {
    const p = this.player;
    const k = this.keys;
    const ls = 2.3 * dt;
    if (k.ArrowLeft) p.yaw += ls;
    if (k.ArrowRight) p.yaw -= ls;
    if (k.ArrowUp) p.pitch = clamp(p.pitch + ls, -1.5, 1.5);
    if (k.ArrowDown) p.pitch = clamp(p.pitch - ls, -1.5, 1.5);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.dead) {
      p.respawnT -= dt;
      p.vel.y = clamp(p.vel.y - this.grav() * dt, -40, 40);
      this.moveBody(p, 0, p.vel.y * dt, 0, false);
      if (p.respawnT <= 0 && this.phase !== 'ended') this.respawnPlayer();
      return;
    }
    if (this.phase === 'ended') return;
    p.markedT = Math.max(0, p.markedT - dt);
    p.boostT = Math.max(0, p.boostT - dt);
    p.specialCd = Math.max(0, p.specialCd - dt);
    p.kickT = Math.max(0, p.kickT - dt);
    p.hp = Math.min(p.maxHp, p.hp + dt * 1.2);

    const fwdIn = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + this.touchMove.y;
    const rightIn = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.touchMove.x;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    let wx = fx * fwdIn + rx * rightIn;
    let wz = fz * fwdIn + rz * rightIn;
    const wl = Math.hypot(wx, wz);
    const mag = Math.min(1, wl);
    if (wl > 0) {
      wx = (wx / wl) * mag;
      wz = (wz / wl) * mag;
    }
    const tSprint = this.touch && mag > 0.92;
    if (p.vehicle) this.rideStep(dt, wx, wz, wl > 0.08, rx, rz);
    else this.walkStep(dt, wx, wz, !!(k.ShiftLeft || k.ShiftRight) || tSprint);
    const sp = Math.hypot(p.vel.x, p.vel.z);
    p.bob += sp * dt * (p.vehicle ? 0.5 : 0.9);
  }

  walkStep(dt: number, wx: number, wz: number, sprint: boolean) {
    const p = this.player;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vel.x = p.dashDir.x * 34;
      p.vel.z = p.dashDir.z * 34;
      p.vel.y = Math.max(0, p.vel.y - this.grav() * dt * 0.2);
      this.moveBody(p, p.vel.x * dt, p.vel.y * dt, p.vel.z * dt, true);
      return;
    }
    let speed = 6.4 * (sprint ? 1.45 : 1) * (p.markedT > 0 ? 0.5 : 1);
    if (this.ws.windup > 0) speed *= 0.25;
    const rate = p.onGround ? 14 : 3.2;
    const kk = 1 - Math.exp(-rate * dt);
    p.vel.x += (wx * speed - p.vel.x) * kk;
    p.vel.z += (wz * speed - p.vel.z) * kk;
    if (this.jumpHeld() && p.onGround) p.vel.y = 7.6;
    p.vel.y = clamp(p.vel.y - this.grav() * dt, -40, 40);
    this.moveBody(p, p.vel.x * dt, p.vel.y * dt, p.vel.z * dt, true);
  }

  rideStep(dt: number, wx: number, wz: number, hasIn: boolean, rx: number, rz: number) {
    const p = this.player;
    const v = p.vehicle!;
    const d = v.def;
    const max = d.maxSpeed * (p.boostT > 0 ? 1.45 : 1);
    if (hasIn) {
      p.vel.x += wx * d.accel * dt;
      p.vel.z += wz * d.accel * dt;
    } else {
      const f = Math.max(0, 1 - d.friction * dt);
      p.vel.x *= f;
      p.vel.z *= f;
    }
    if (d.kind === 'unicycle') {
      const wob = Math.sin(this.time * 2.6) * 3.4 + Math.sin(this.time * 5.3) * 1.5;
      p.vel.x += rx * wob * dt;
      p.vel.z += rz * wob * dt;
    }
    let sp = Math.hypot(p.vel.x, p.vel.z);
    if (sp > max) {
      p.vel.x *= max / sp;
      p.vel.z *= max / sp;
      sp = max;
    }

    // grind (skate)
    if (d.kind === 'skate') {
      if (p.grind) {
        const g = p.grind;
        const gs = Math.max(sp, 13);
        p.pos.x += g.dx * gs * dt;
        p.pos.z += g.dz * gs * dt;
        p.pos.y = g.rail.y;
        p.vel.set(g.dx * gs, 0, g.dz * gs);
        this.particles.burst(p.pos.x, p.pos.y - 0.2, p.pos.z, 2, 0xffd36a, 3, 0.07, 0.3, { glow: true, grav: 10 });
        const ax = g.rail.ax + 0.5;
        const az = g.rail.az + 0.5;
        const bx = g.rail.bx + 0.5;
        const bz = g.rail.bz + 0.5;
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
        const t = ((p.pos.x - ax) * (bx - ax) + (p.pos.z - az) * (bz - az)) / l2;
        if (this.jumpHeld()) {
          p.grind = null;
          p.vel.y = d.jump * 1.1;
        } else if (t < -0.02 || t > 1.02) {
          p.grind = null;
          p.vel.y = 4;
        }
        v.pos.copy(p.pos);
        v.yaw = p.yaw;
        return;
      }
      if (!p.onGround) {
        for (const r of this.rails) {
          const ax = r.ax + 0.5;
          const az = r.az + 0.5;
          const bx = r.bx + 0.5;
          const bz = r.bz + 0.5;
          const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
          const t = clamp(((p.pos.x - ax) * (bx - ax) + (p.pos.z - az) * (bz - az)) / l2, 0, 1);
          const cx = ax + (bx - ax) * t;
          const cz = az + (bz - az) * t;
          if (Math.hypot(p.pos.x - cx, p.pos.z - cz) < 0.95 && p.pos.y > r.y - 0.5 && p.pos.y < r.y + 0.9 && p.vel.y <= 1.5) {
            const l = Math.sqrt(l2);
            let dx = (bx - ax) / l;
            let dz = (bz - az) / l;
            if (dx * p.vel.x + dz * p.vel.z < 0 || (sp < 1 && dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw) < 0)) {
              dx = -dx;
              dz = -dz;
            }
            p.grind = { rail: r, dx, dz };
            this.announce('GRIND! 🛹', '#fde047', 1000);
            this.sfx.tick();
            break;
          }
        }
      }
    }

    if (this.jumpHeld() && p.onGround) p.vel.y = d.jump;
    p.vel.y = clamp(p.vel.y - this.grav() * dt, -40, 40);
    const rammed = this.moveBody(p, p.vel.x * dt, p.vel.y * dt, p.vel.z * dt, true, { power: d.ram, speed: sp });
    if (rammed > 0) {
      p.vel.x *= 0.78;
      p.vel.z *= 0.78;
    }
    this.runOver(sp);
    v.pos.copy(p.pos);
    v.yaw = p.yaw;
    if (p.spinT > 0) {
      p.spinT -= dt;
      p.spinAng += (Math.PI * 2 * dt) / 0.6;
    } else p.spinAng = 0;
  }

  runOver(sp: number) {
    if (sp < 4.5) return;
    const p = this.player;
    const v = p.vehicle!;
    for (const a of this.actors) {
      if (!a.alive) continue;
      if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < p.r + a.r + 0.3 && a.pos.y < p.pos.y + 1.4 && a.pos.y + a.h > p.pos.y) {
        this.damageActor(a, 30 + sp * 9, { by: 'player', weapon: v.def.name, vehicle: true });
        a.vel.x += p.vel.x * 0.8;
        a.vel.z += p.vel.z * 0.8;
        a.vel.y = 5;
        a.stunT = 0.5;
        p.vel.x *= 0.93;
        p.vel.z *= 0.93;
        this.shake(0.2);
      }
    }
  }

  // ================= Atores =================
  syncActor(a: Actor, dt: number) {
    a.model.group.position.copy(a.pos);
    a.model.group.rotation.y = a.yaw;
    a.model.animate(dt, a.alive ? a.speedNow : 0);
    if (a.kind === 'bot' && a.alive && a.ai === 'engage') a.model.holdGun();
    if (a.mark) a.mark.visible = a.alive && a.markedT > 0;
    if (a.label && a.alive) {
      const m = a.markedT > 0;
      a.label.material.color.setHex(m ? 0xff6b6b : 0xffffff);
    }
  }

  moveActor(a: Actor, wx: number, wz: number, speed: number, dt: number) {
    const kk = 1 - Math.exp(-10 * dt);
    a.vel.x += (wx * speed - a.vel.x) * kk;
    a.vel.z += (wz * speed - a.vel.z) * kk;
    a.vel.y = clamp(a.vel.y - this.grav() * dt, -40, 40);
    const ox = a.pos.x;
    const oz = a.pos.z;
    this.moveBody(a, a.vel.x * dt, a.vel.y * dt, a.vel.z * dt, true);
    const moved = Math.hypot(a.pos.x - ox, a.pos.z - oz) / Math.max(dt, 1e-4);
    a.speedNow = moved;
    if ((wx !== 0 || wz !== 0) && moved < speed * 0.3) a.blockedT += dt;
    else a.blockedT = 0;
    if (a.blockedT > 0.2 && a.onGround) a.vel.y = 7.4;
  }

  respawnActor(a: Actor) {
    a.pos.copy(this.findSpot(this.player.pos, a.kind === 'bot' ? 25 : 10));
    a.vel.set(0, 0, 0);
    a.hp = a.maxHp;
    a.alive = true;
    a.model.setDead(false, true);
    a.ai = 'roam';
    a.markedT = 0;
    a.frozenT = 0;
    a.stunT = 0;
    if (a.label) a.label.visible = true;
    if (a.barBg) a.barBg.visible = true;
    if (a.barFg) {
      a.barFg.visible = true;
      a.barFg.scale.x = 0.9;
    }
  }

  los(a: Actor) {
    const p = this.player;
    const ox = a.pos.x;
    const oy = a.pos.y + 1.5;
    const oz = a.pos.z;
    const tx = p.pos.x - ox;
    const ty = p.pos.y + 1.2 - oy;
    const tz = p.pos.z - oz;
    const dist = Math.hypot(tx, ty, tz);
    const hit = this.world.raycast(ox, oy, oz, tx / dist, ty / dist, tz / dist, dist);
    return !hit || hit.dist >= dist - 0.7;
  }

  botShoot(a: Actor) {
    const p = this.player;
    const o = new THREE.Vector3(a.pos.x, a.pos.y + 1.45, a.pos.z);
    const t = new THREE.Vector3(p.pos.x, p.pos.y + (p.vehicle ? 1.3 : 1.0), p.pos.z);
    const dist = o.distanceTo(t);
    const sp = this.diff.spread * dist;
    t.x += (Math.random() - 0.5) * sp;
    t.y += (Math.random() - 0.5) * sp * 0.6;
    t.z += (Math.random() - 0.5) * sp;
    const dir = t.sub(o).normalize();
    o.addScaledVector(dir, 0.6);
    const mesh = new THREE.Mesh(Game.bulletGeo, Game.bulletMat);
    mesh.position.copy(o);
    this.scene.add(mesh);
    this.projectiles.push({ kind: 'enemy', pos: o, vel: dir.clone().multiplyScalar(54), life: 2.5, mesh, dmg: this.diff.dmg, owner: 'bot', bot: a, speed: 54 });
    const d2 = a.pos.distanceTo(p.pos);
    if (d2 < 70) this.sfx.shot('enemy');
  }
  static bulletGeo = new THREE.SphereGeometry(0.1, 6, 5);
  static bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false });

  updateBot(a: Actor, dt: number) {
    const p = this.player;
    const live = this.phase === 'playing' || this.phase === 'nuke';
    if (!a.alive) {
      a.respawnT -= dt;
      if (a.respawnT <= 0 && live) this.respawnActor(a);
      return;
    }
    if (this.sanctum && !this.truthGiven) {
      a.yaw = Math.atan2(-(p.pos.x - a.pos.x), -(p.pos.z - a.pos.z));
      this.moveActor(a, 0, 0, 0, dt);
      return;
    }
    a.markedT = Math.max(0, a.markedT - dt);
    if (a.frozenT > 0 || a.stunT > 0) {
      a.frozenT -= dt;
      a.stunT -= dt;
      this.moveActor(a, 0, 0, 0, dt);
      return;
    }
    const dx = p.pos.x - a.pos.x;
    const dz = p.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    a.losT -= dt;
    if (a.losT <= 0) {
      a.losT = 0.28;
      a.sees = !p.dead && dist < this.diff.sight && this.los(a);
    }
    const hunting = !p.dead && (a.sees || (p.markedT > 0 && dist < 130));
    let wx = 0;
    let wz = 0;
    const slow = a.markedT > 0 ? 0.5 : 1;
    let speed = 3 * slow;
    if (hunting) {
      a.ai = 'engage';
      a.yaw = Math.atan2(-dx, -dz);
      const nx = dx / dist;
      const nz = dz / dist;
      const fwd = dist > a.ideal + 3 ? 1 : dist < a.ideal - 4 ? -0.7 : 0.15;
      if (Math.sin(this.time * 0.7 + a.id * 1.9) > 0.2) a.strafe = 1;
      else if (Math.sin(this.time * 0.7 + a.id * 1.9) < -0.2) a.strafe = -1;
      wx = nx * fwd - nz * a.strafe * 0.75;
      wz = nz * fwd + nx * a.strafe * 0.75;
      speed = this.diff.speed * slow;
      if (a.sees && dist < this.diff.sight) {
        a.fireCd -= dt;
        if (a.fireCd <= 0) {
          a.burst = 3;
          a.burstT = 0;
          a.fireCd = this.diff.interval * (0.7 + Math.random() * 0.7);
        }
        if (a.burst > 0) {
          a.burstT -= dt;
          if (a.burstT <= 0) {
            this.botShoot(a);
            a.burst--;
            a.burstT = 0.11;
          }
        }
      }
    } else {
      if (a.ai === 'engage') a.ai = 'roam';
      a.dirT -= dt;
      if (a.dirT <= 0) {
        a.dirT = 1.5 + Math.random() * 3;
        const ang = Math.random() * Math.PI * 2;
        a.dir.set(Math.cos(ang), Math.sin(ang));
      }
      wx = a.dir.x;
      wz = a.dir.y;
      a.yaw = Math.atan2(-wx, -wz);
    }
    const l = Math.hypot(wx, wz);
    if (l > 1) {
      wx /= l;
      wz /= l;
    }
    this.moveActor(a, wx, wz, speed, dt);
    if (a.blockedT > 1) {
      a.blockedT = 0;
      a.dirT = 0;
      a.strafe = -a.strafe;
    }
    if (a.barFg) a.barFg.scale.x = 0.9 * clamp(a.hp / a.maxHp, 0.001, 1);
  }

  updateCiv(a: Actor, dt: number) {
    const live = this.phase === 'playing' || this.phase === 'nuke';
    if (!a.alive) {
      a.respawnT -= dt;
      if (a.respawnT <= 0 && live) this.respawnActor(a);
      return;
    }
    if (a.frozenT > 0 || a.stunT > 0) {
      a.frozenT -= dt;
      a.stunT -= dt;
      this.moveActor(a, 0, 0, 0, dt);
      return;
    }
    let wx = 0;
    let wz = 0;
    let speed = 0;
    if (a.ai === 'flee') {
      a.aiT -= dt;
      let ax = a.pos.x - a.fleeFrom.x;
      let az = a.pos.z - a.fleeFrom.z;
      const l = Math.hypot(ax, az) || 1;
      ax /= l;
      az /= l;
      const w = Math.sin(this.time * 3 + a.id) * 0.3;
      wx = ax - az * w;
      wz = az + ax * w;
      speed = 5.4;
      if (a.blockedT > 0.35) {
        a.blockedT = 0;
        const ang = Math.atan2(az, ax) + (Math.random() < 0.5 ? 1 : -1) * 1.2;
        a.fleeFrom.x = a.pos.x - Math.cos(ang) * 5;
        a.fleeFrom.z = a.pos.z - Math.sin(ang) * 5;
      }
      if (a.aiT <= 0) {
        a.ai = 'roam';
        a.aiT = 2;
      }
      a.yaw = Math.atan2(-wx, -wz);
    } else {
      a.aiT -= dt;
      if (a.aiT <= 0) {
        if (Math.random() < 0.3) {
          a.ai = 'idle';
          a.aiT = 1.5 + Math.random() * 3;
        } else {
          a.ai = 'roam';
          a.aiT = 2 + Math.random() * 4;
          const ang = Math.random() * Math.PI * 2;
          a.dir.set(Math.cos(ang), Math.sin(ang));
        }
      }
      if (a.ai === 'roam') {
        wx = a.dir.x;
        wz = a.dir.y;
        speed = 1.8;
        a.yaw = Math.atan2(-wx, -wz);
        if (a.blockedT > 0.4) {
          a.blockedT = 0;
          const ang = Math.random() * Math.PI * 2;
          a.dir.set(Math.cos(ang), Math.sin(ang));
        }
      }
    }
    this.moveActor(a, wx, wz, speed, dt);
  }

  updateActors(dt: number) {
    if (dt <= 0) return;
    for (const a of this.bots) this.updateBot(a, dt);
    for (const a of this.civs) this.updateCiv(a, dt);
  }

  // ================= Projetéis =================
  addProjectile(p: Projectile) {
    this.scene.add(p.mesh);
    this.projectiles.push(p);
  }

  removeProjectile(i: number) {
    const p = this.projectiles[i];
    this.scene.remove(p.mesh);
    if (p.kind === 'pedro' || p.kind === 'rocket' || p.kind === 'fire') {
      p.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && p.kind !== 'rocket') {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.projectiles.splice(i, 1);
  }

  projExplode(p: Projectile, at: THREE.Vector3) {
    if (p.kind === 'rocket') this.explode(at, 5.6, 170, 'player', { heavy: true, blockDmg: 16, weapon: 'Bazuca' });
    else if (p.kind === 'pedro') this.explode(at, 4.2, 150, 'player', { heavy: false, blockDmg: 12, weapon: '"Pedro"', color: 0xcbd5e1 });
    else if (p.kind === 'fire') this.explode(at, 2.8, 60, 'player', { fire: true, blockDmg: 4, weapon: "Magician's Red", color: 0xff7a1a });
  }

  updateProjectiles(dt: number) {
    if (dt <= 0) return;
    const pl = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.kind === 'bullet') {
        if (p.life <= 0 || this.stepBullet(p, dt)) this.removeProjectile(i);
        continue;
      }
      if (p.kind === 'pedro') {
        if (!p.target || !p.target.alive) {
          let best: Actor | null = null;
          let bd = 1e9;
          for (const b of this.bots) {
            if (!b.alive) continue;
            const d = b.pos.distanceTo(p.pos);
            if (d < bd) {
              bd = d;
              best = b;
            }
          }
          p.target = best && bd < 70 ? best : null;
        }
        if (p.target) {
          _v.set(p.target.pos.x, p.target.pos.y + 1, p.target.pos.z).sub(p.pos).normalize().multiplyScalar(p.speed);
          p.vel.lerp(_v, 1 - Math.exp(-4.5 * dt));
          p.vel.setLength(p.speed);
        }
        p.mesh.rotation.y += dt * 22;
        p.mesh.rotation.z += dt * 5;
      }
      if (p.kind === 'fire') {
        this.particles.spawn({ x: p.pos.x, y: p.pos.y, z: p.pos.z, size: 0.25, color: 0xffa21a, life: 0.35, grav: -2, glow: true, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
      }
      if (p.kind === 'rocket') {
        this.particles.spawn({ x: p.pos.x, y: p.pos.y, z: p.pos.z, size: 0.35, color: 0xcccccc, life: 0.8, grav: -0.5, grow: 1.2, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
        this.particles.spawn({ x: p.pos.x, y: p.pos.y, z: p.pos.z, size: 0.25, color: 0xffaa33, life: 0.2, grav: 0, glow: true });
      }
      const len = p.vel.length() * dt;
      const dir = _v.copy(p.vel).normalize();
      if (p.life <= 0) {
        if (p.kind !== 'enemy') this.projExplode(p, p.pos.clone());
        this.removeProjectile(i);
        continue;
      }
      let dead = false;
      const hit = this.world.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, len);
      const dirC = dir.clone();
      if (p.owner === 'bot') {
        // contra o jogador
        if (!pl.dead) {
          const cx = pl.pos.x;
          const cz = pl.pos.z;
          const t = clamp(((cx - p.pos.x) * dirC.x + (pl.pos.y + 1 - p.pos.y) * dirC.y + (cz - p.pos.z) * dirC.z), 0, len);
          const qx = p.pos.x + dirC.x * t;
          const qy = p.pos.y + dirC.y * t;
          const qz = p.pos.z + dirC.z * t;
          if (Math.hypot(qx - cx, qz - cz) < pl.r + 0.15 && qy > pl.pos.y - 0.1 && qy < pl.pos.y + pl.h + 0.1) {
            this.hurtPlayer(p.dmg, p.bot?.name ?? 'um bot');
            dead = true;
          }
        }
        if (!dead) {
          for (const c of this.civs) {
            if (!c.alive) continue;
            if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < c.r + 0.2 && p.pos.y > c.pos.y && p.pos.y < c.pos.y + c.h) {
              this.damageActor(c, 999, { by: 'bot', bot: p.bot });
              dead = true;
              break;
            }
          }
        }
        if (!dead && hit) {
          this.spark(p.pos.x + dirC.x * hit.dist, p.pos.y + dirC.y * hit.dist, p.pos.z + dirC.z * hit.dist, 0xffe066, 3, 2);
          dead = true;
        }
        if (dead) {
          this.removeProjectile(i);
          continue;
        }
      } else {
        let hitActor: Actor | null = null;
        for (const a of this.actors) {
          if (!a.alive) continue;
          if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < a.r + 0.5 && p.pos.y > a.pos.y - 0.3 && p.pos.y < a.pos.y + a.h + 0.3) {
            hitActor = a;
            break;
          }
        }
        if (hitActor) {
          this.projExplode(p, p.pos.clone());
          this.removeProjectile(i);
          continue;
        }
        if (hit) {
          const at = new THREE.Vector3(p.pos.x + dirC.x * Math.max(0, hit.dist - 0.1), p.pos.y + dirC.y * Math.max(0, hit.dist - 0.1), p.pos.z + dirC.z * Math.max(0, hit.dist - 0.1));
          this.projExplode(p, at);
          this.removeProjectile(i);
          continue;
        }
      }
      p.pos.addScaledVector(dirC, len);
      p.mesh.position.copy(p.pos);
      if (p.kind === 'rocket') {
        _q.setFromUnitVectors(_up, dirC);
        p.mesh.quaternion.copy(_q);
      }
    }
  }

  // ================= Veículos (visual) =================
  updateVehicles(dt: number) {
    const p = this.player;
    for (const v of this.vehicles) {
      v.marker.visible = !v.rider;
      v.marker.rotation.y += dt * 2;
      v.marker.position.y = (v.kind === 'horse' ? 3.5 : 2.6) + Math.sin(this.time * 3 + v.pos.x) * 0.15;
      const speed = v.rider ? Math.hypot(p.vel.x, p.vel.z) : 0;
      let tilt = 0;
      if (v.rider && v.kind === 'unicycle') tilt = Math.sin(this.time * 2.6) * 0.12 * (0.4 + speed / 6);
      if (v.rider && v.kind === 'skate' && p.grind) tilt = 0.25;
      animateVehicle(v.model, v.kind, speed * dt, speed, tilt);
      v.model.group.position.copy(v.pos);
      v.model.group.rotation.y = v.yaw;
      if (v.kind === 'horse' && p.kickT > 0 && v.rider) v.model.legs.slice(2).forEach((l) => (l.rotation.x = -1.2));
      if (v.kind === 'unicycle' && v.rider && p.spinT > 0) v.model.group.rotation.y = v.yaw + p.spinAng;
    }
  }

  // ================= Nuke =================
  startNuke() {
    this.phase = 'nuke';
    this.nukeCount = 10;
    this.sfx.siren(true);
    this.announce('☢️ BOMBA NUCLEAR TÁTICA ARMADA ☢️', '#ff3b3b', 3500);
    this.feed('☢️ KILLSTREAK: nível 20! A sirene soou — o mapa será vaporizado em 10s.', 'bad');
    this.warhead.visible = true;
  }

  updateWarhead(nc: number) {
    if (nc < 0 || nc > 10) {
      this.warhead.visible = false;
      return;
    }
    this.warhead.visible = true;
    const prog = 1 - nc / 10;
    const e = prog * prog;
    this.warhead.position.set(CX + Math.sin(this.time * 2) * 0.4, lerp(210, 7, e), CZ);
    this.warhead.rotation.y += 0.05;
  }

  detonate() {
    this.phase = 'ended';
    this.nukeCount = -1;
    this.nukeT = 0.001;
    this.sfx.siren(false);
    this.sfx.explosion(true);
    this.warhead.visible = false;
    this.flash = 1;
    this.shake(1.5);
    this.world.clock = this.matchTime;
    this.world.vaporizeAll(CX, CZ, 3, (x, y, z, col) => {
      const dx = x + 0.5 - CX;
      const dz = z + 0.5 - CZ;
      const d = Math.hypot(dx, dz) || 1;
      const sp = 22 + Math.random() * 38;
      this.particles.spawn({ x: x + 0.5, y: y + 0.5, z: z + 0.5, vx: (dx / d) * sp, vy: 8 + Math.random() * 34, vz: (dz / d) * sp, size: 0.5 + Math.random() * 0.5, color: col, life: 3 + Math.random() * 2.5, grav: 7, bounce: 0.2, spin: 12 });
    });
    for (const a of this.actors) {
      if (a.alive) {
        a.alive = false;
        a.model.setDead(true);
        if (a.label) a.label.visible = false;
        if (a.barBg) a.barBg.visible = false;
        if (a.barFg) a.barFg.visible = false;
        if (a.mark) a.mark.visible = false;
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) this.removeProjectile(i);
    this.rifts.forEach((r) => this.scene.remove(r.mesh));
    this.rifts = [];
    this.bombs = [];
    this.burning.clear();
    this.dismount();
    this.announce('☢️ DETONADA ☢️', '#ffb347', 1800);
  }

  // ================= Rewind =================
  record(dt: number) {
    this.histT -= dt;
    if (this.histT > 0) return;
    this.histT = 0.05;
    const p = this.player;
    const a = new Float32Array(this.actors.length * 6);
    this.actors.forEach((x, i) => {
      a[i * 6] = x.pos.x;
      a[i * 6 + 1] = x.pos.y;
      a[i * 6 + 2] = x.pos.z;
      a[i * 6 + 3] = x.yaw;
      a[i * 6 + 4] = x.alive ? 1 : 0;
      a[i * 6 + 5] = x.speedNow;
    });
    const v = new Float32Array(this.vehicles.length * 4);
    this.vehicles.forEach((x, i) => {
      v[i * 4] = x.pos.x;
      v[i * 4 + 1] = x.pos.y;
      v[i * 4 + 2] = x.pos.z;
      v[i * 4 + 3] = x.yaw;
    });
    this.hist.push({
      t: this.matchTime,
      px: p.pos.x,
      py: p.pos.y,
      pz: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      veh: p.vehicle ? this.vehicles.indexOf(p.vehicle) : -1,
      nc: this.nukeCount,
      lvl: p.level,
      a,
      v,
    });
    if (this.hist.length > 4200) this.hist.shift();
  }

  startRewind() {
    if (this.phase === 'rewinding') return;
    this.sfx.siren(false);
    this.releaseWeaponHolds();
    this.timeStop = 0;
    this.clearWormhole();
    const dur = clamp((this.hist.length * 0.05) / 9, 3.2, 6.5);
    this.rw = { t: 0, dur, nukeT0: this.nukeT, restored: 0, log: this.world.log.slice(), inflight: 0, hist: this.hist.slice() };
    this.phase = 'rewinding';
    for (let i = this.projectiles.length - 1; i >= 0; i--) this.removeProjectile(i);
    this.rifts.forEach((r) => this.scene.remove(r.mesh));
    this.rifts = [];
    this.bombs = [];
    this.burning.clear();
    this.particles.clear();
    this.dismountSilent();
    this.sfx.rewind(dur);
    this.announce('⏪ REVERTENDO O TEMPO...', '#7dd3fc', dur * 1000);
    this.world.stabDirty = false;
  }

  dismountSilent() {
    const p = this.player;
    if (p.vehicle) {
      p.vehicle.rider = false;
      p.vehicle = null;
    }
    p.r = 0.4;
    p.h = 1.75;
    p.grind = null;
  }

  applySnap(s: Snap) {
    const p = this.player;
    p.pos.set(s.px, s.py, s.pz);
    p.yaw = s.yaw;
    p.pitch = s.pitch;
    p.level = s.lvl;
    const veh = s.veh >= 0 ? this.vehicles[s.veh] : null;
    if (veh !== p.vehicle) {
      if (p.vehicle) p.vehicle.rider = false;
      p.vehicle = veh;
      if (veh) veh.rider = true;
    }
    this.actors.forEach((a, i) => {
      a.pos.set(s.a[i * 6], s.a[i * 6 + 1], s.a[i * 6 + 2]);
      a.yaw = s.a[i * 6 + 3];
      a.alive = s.a[i * 6 + 4] > 0.5;
      a.speedNow = s.a[i * 6 + 5];
      a.model.setDead(!a.alive, true);
      if (a.label) a.label.visible = a.alive;
      if (a.barBg) a.barBg.visible = a.alive;
      if (a.barFg) {
        a.barFg.visible = a.alive;
        a.barFg.scale.x = 0.9;
      }
      if (a.mark) a.mark.visible = false;
    });
    this.vehicles.forEach((v, i) => {
      v.pos.set(s.v[i * 4], s.v[i * 4 + 1], s.v[i * 4 + 2]);
      v.yaw = s.v[i * 4 + 3];
    });
    this.updateWarhead(s.nc);
  }

  updateRewind(dt: number) {
    const r = this.rw;
    if (!r) return;
    r.t += dt;
    const prog = clamp(r.t / r.dur, 0, 1);
    this.rwProgress = prog;
    const h = r.hist;
    if (h.length) {
      const idx = Math.max(0, Math.min(h.length - 1, Math.floor((1 - prog) * (h.length - 1))));
      this.applySnap(h[idx]);
      this.matchTime = h[idx].t;
    }
    if (r.nukeT0 > 0) {
      this.nukeT = r.nukeT0 * clamp(1 - prog / 0.5, 0, 1);
      this.nuke.update(this.nukeT);
    }
    const N = r.log.length;
    const target = Math.floor(clamp((prog - 0.06) / 0.82, 0, 1) * N);
    while (r.restored < target) {
      const e = r.log[N - 1 - r.restored];
      r.restored++;
      if (N > 1500 && r.restored % 4 !== 0 && r.restored % 3 !== 0) {
        this.world.restoreCell(e);
        continue;
      }
      const c = cellXYZ(e.idx);
      r.inflight++;
      this.particles.spawn({
        x: c.x + 0.5 + (Math.random() - 0.5) * 18,
        y: c.y + 0.5 + 3 + Math.random() * 12,
        z: c.z + 0.5 + (Math.random() - 0.5) * 18,
        tx: c.x + 0.5,
        ty: c.y + 0.5,
        tz: c.z + 0.5,
        size: 0.75,
        color: e.col,
        life: 0.5 + Math.random() * 0.35,
        spin: 14,
        onDone: () => {
          this.world.restoreCell(e);
          r.inflight--;
        },
      });
    }
    this.world.stabDirty = false;
    for (const a of this.actors) this.syncActor(a, dt);
    this.flash = Math.max(0, this.flash - dt * 2);
    if (prog >= 1 && r.inflight <= 0) this.finishRewind();
  }

  finishRewind() {
    const p = this.player;
    this.world.resetToInitial();
    this.world.clock = 0;
    this.particles.clear();
    this.nukeT = 0;
    this.nuke.update(0);
    this.clearWormhole();
    this.gravMode = 0;
    this.truthCd = [0, 0, 0, 0];
    this.nukeCount = -1;
    this.warhead.visible = false;
    this.groundMat.color.copy(this.groundBase);
    this.dismountSilent();
    p.level = 1;
    p.kills = 0;
    p.civKills = 0;
    p.civStreak = 0;
    p.hp = p.maxHp;
    p.dead = false;
    p.markedT = 0;
    p.vel.set(0, 0, 0);
    p.invuln = 3;
    for (const v of this.vehicles) v.rider = false;
    for (const a of this.actors) {
      a.hp = a.maxHp;
      a.alive = true;
      a.markedT = 0;
      a.frozenT = 0;
      a.stunT = 0;
      a.ai = 'roam';
      a.model.setDead(false, true);
      a.vel.set(0, 0, 0);
      if (a.label) a.label.visible = true;
      if (a.barBg) a.barBg.visible = true;
      if (a.barFg) {
        a.barFg.visible = true;
        a.barFg.scale.x = 0.9;
      }
    }
    this.ws = this.newWeaponState();
    this.rebuildViewModel();
    this.hist = [];
    this.histT = 0;
    this.matchTime = 0;
    this.rw = null;
    this.rwProgress = 0;
    this.phase = 'intro';
    this.introT = 3.2;
    this.camY = p.pos.y + 1.62;
    this.sfx.resume();
    this.announce('🕒 LOBBY — TEMPO RESTAURADO', '#7dd3fc', 2400);
  }

  // ================= Verdade, minhoca, gravidade, balística =================
  grav() {
    return GRAV * (this.gravMode === 0 ? 1 : this.gravMode === 1 ? 0.22 : -0.55);
  }

  selectPower(i: number) {
    this.truthPower = clamp(i, 0, 3);
    const pw = TRUTH_POWERS[this.truthPower];
    this.announce(`${pw.icon} ${pw.name}`, '#fde68a', 900);
    this.sfx.tick();
  }
  cyclePower() {
    this.selectPower((this.truthPower + 1) % 4);
  }

  cycleGravity() {
    this.gravMode = (this.gravMode + 1) % 3;
    const names = ['GRAVIDADE NORMAL', 'GRAVIDADE LUNAR 🌙', 'GRAVIDADE INVERTIDA 🙃'];
    this.announce(names[this.gravMode], '#a5b4fc', 1600);
    this.sfx.stop();
    this.flash = Math.max(this.flash, 0.25);
    const kick = this.gravMode === 2 ? 3 : 0;
    this.player.vel.y += kick;
    for (const a of this.actors) a.vel.y += kick;
  }

  localRewind(sec: number) {
    const idx = this.hist.length - 1 - Math.round(sec / 0.05);
    if (idx < 0) {
      this.feed('Ainda não há tempo gravado suficiente para retroceder.', 'info');
      return false;
    }
    const s = this.hist[idx];
    this.hist.length = idx + 1;
    this.applySnap(s);
    this.matchTime = s.t;
    const p = this.player;
    p.vel.set(0, 0, 0);
    p.dead = false;
    p.hp = Math.max(p.hp, p.maxHp * 0.6);
    this.camY = p.pos.y + this.eyeHeight();
    for (const a of this.actors) if (a.alive && a.hp <= 0) a.hp = a.maxHp;
    const log = this.world.log;
    let n = 0;
    while (log.length && log[log.length - 1].t >= s.t) {
      const e = log.pop()!;
      n++;
      if (n > 500 && n % 2 === 0) {
        this.world.restoreCell(e);
        continue;
      }
      const c = cellXYZ(e.idx);
      this.particles.spawn({
        x: c.x + 0.5 + (Math.random() - 0.5) * 10,
        y: c.y + 2.5 + Math.random() * 8,
        z: c.z + 0.5 + (Math.random() - 0.5) * 10,
        tx: c.x + 0.5,
        ty: c.y + 0.5,
        tz: c.z + 0.5,
        size: 0.7,
        color: e.col,
        life: 0.55 + Math.random() * 0.3,
        spin: 14,
        onDone: () => {
          this.world.restoreCell(e);
        },
      });
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) this.removeProjectile(i);
    this.burning.clear();
    this.flash = Math.max(this.flash, 0.5);
    this.sfx.rewind(0.9);
    this.announce('⏪ RETROCEDER', '#7dd3fc', 1200);
    return true;
  }

  static pBulletGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
  static bulletMats = new Map<number, THREE.MeshBasicMaterial>();

  fireBullet(
    o: THREE.Vector3,
    d: THREE.Vector3,
    opt: { speed: number; drop?: number; drag?: number; dmg: number; head: number; pierce: number; blockAmt: number; range: number; weapon: string; color: number; falloff?: number },
  ) {
    let mat = Game.bulletMats.get(opt.color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: opt.color, fog: false });
      Game.bulletMats.set(opt.color, mat);
    }
    const p = this.player;
    const mesh = new THREE.Mesh(Game.pBulletGeo, mat);
    const pos = o.clone().addScaledVector(d, 0.9);
    pos.y -= 0.1;
    pos.x += Math.cos(p.yaw) * 0.14;
    pos.z += -Math.sin(p.yaw) * 0.14;
    mesh.position.copy(pos);
    mesh.scale.set(0.045, 1.4, 0.045);
    _q.setFromUnitVectors(_up, d);
    mesh.quaternion.copy(_q);
    this.addProjectile({
      kind: 'bullet',
      pos,
      vel: d.clone().multiplyScalar(opt.speed),
      life: opt.range / opt.speed + 0.6,
      mesh,
      dmg: opt.dmg,
      owner: 'player',
      speed: opt.speed,
      ballistic: { drop: opt.drop ?? 9.8, drag: opt.drag ?? 0.15, pierce: opt.pierce, head: opt.head, blockAmt: opt.blockAmt, range: opt.range, weapon: opt.weapon, traveled: 0, ricochets: 0, falloff: opt.falloff ?? 0.35 },
    });
    this.particles.spawn({
      x: o.x + Math.cos(p.yaw) * 0.25,
      y: o.y - 0.15,
      z: o.z - Math.sin(p.yaw) * 0.25,
      vx: Math.cos(p.yaw) * 2.6 + (Math.random() - 0.5),
      vy: 2.6 + Math.random(),
      vz: -Math.sin(p.yaw) * 2.6 + (Math.random() - 0.5),
      size: 0.05,
      color: 0xd4a520,
      life: 2.2,
      grav: 20,
      bounce: 0.5,
      spin: 30,
    });
  }

  stepBullet(p: Projectile, dt: number): boolean {
    const b = p.ballistic!;
    p.vel.y -= b.drop * dt;
    p.vel.multiplyScalar(Math.max(0, 1 - b.drag * dt));
    const sp = p.vel.length();
    if (sp < 30) return true;
    const len = sp * dt;
    const dir = p.vel.clone().multiplyScalar(1 / sp);
    const hit = this.world.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, len);
    const maxT = hit ? hit.dist : len;
    const hits = this.rayActors(p.pos, dir, maxT, 0.04);
    if (hits.length) {
      const h = hits[0];
      const f = 1 - clamp(b.traveled / b.range, 0, 1) * b.falloff;
      const hp = p.pos.clone().addScaledVector(dir, h.t);
      this.damageActor(h.actor, p.dmg * f * (h.head ? b.head : 1), { by: 'player', weapon: b.weapon, head: h.head });
      this.spark(hp.x, hp.y, hp.z, 0xff5555, 4, 3);
      return true;
    }
    if (hit) {
      const px = p.pos.x + dir.x * hit.dist;
      const py = p.pos.y + dir.y * hit.dist;
      const pz = p.pos.z + dir.z * hit.dist;
      const dot = dir.x * hit.nx + dir.y * hit.ny + dir.z * hit.nz;
      const cosA = Math.abs(dot);
      let col = 0xcccccc;
      let thin = false;
      let hard = hit.idx < 0;
      if (hit.idx >= 0) {
        const def = DEFS[kindOf(this.world.kindArr[hit.idx])];
        col = this.world.colArr[hit.idx];
        thin = def.thin;
        hard = def.heavy;
      }
      if (hard && cosA < 0.4 && b.ricochets < 2) {
        p.vel.set(dir.x - 2 * dot * hit.nx, dir.y - 2 * dot * hit.ny, dir.z - 2 * dot * hit.nz).multiplyScalar(sp * 0.55);
        p.pos.set(px + hit.nx * 0.06, py + hit.ny * 0.06, pz + hit.nz * 0.06);
        b.ricochets++;
        p.dmg *= 0.6;
        this.spark(px, py, pz, 0xfff2b0, 8, 5);
        this.sfx.tone(2200, 1100, 0.12, 'triangle', 0.08);
        p.mesh.position.copy(p.pos);
        return false;
      }
      if (hit.idx >= 0 && thin && b.pierce > 0) {
        this.world.damage(hit.idx, 99, false, { x: dir.x * 4, y: 2, z: dir.z * 4 });
        b.pierce--;
        p.vel.multiplyScalar(0.8);
        p.dmg *= 0.75;
        p.pos.set(px + dir.x * 0.1, py + dir.y * 0.1, pz + dir.z * 0.1);
        this.spark(px, py, pz, col, 4, 3);
        p.mesh.position.copy(p.pos);
        return false;
      }
      let res = 0;
      if (hit.idx >= 0) res = this.world.damage(hit.idx, b.blockAmt, false, { x: dir.x * 3, y: 2, z: dir.z * 3 });
      this.spark(px, py, pz, col, res === 0 ? 5 : 3, 3.5);
      if (res !== 2) this.particles.spawn({ x: px + hit.nx * 0.04, y: py + hit.ny * 0.04, z: pz + hit.nz * 0.04, size: 0.13, color: 0x1a1a1a, life: 10, grav: 0, spin: 0 });
      return true;
    }
    p.pos.addScaledVector(dir, len);
    b.traveled += len;
    p.mesh.position.copy(p.pos);
    _q.setFromUnitVectors(_up, dir);
    p.mesh.quaternion.copy(_q);
    p.mesh.scale.set(0.045, clamp(sp * 0.0075, 0.8, 3.2), 0.045);
    return b.traveled > b.range;
  }

  onLevel20() {
    if (this.wormholeOn || this.nukeCount >= 0) return;
    const prog = markConquered(this.map.id);
    this.conqueredCount = prog.conquered.length;
    if (prog.conquered.length >= NEEDED) this.startWormhole();
    else {
      this.feed(`🏆 Mapa conquistado! ${prog.conquered.length}/${NEEDED} — conquiste mais ${NEEDED - prog.conquered.length} mapa(s) diferente(s) para abrir o Buraco de Minhoca.`, 'good');
      this.startNuke();
    }
  }

  startWormhole() {
    this.phase = 'nuke';
    this.nukeCount = -1;
    this.wormholeOn = true;
    const sp = this.findSpot(this.player.pos, 12, this.player.pos.x, this.player.pos.z, 22, 1.8, 5);
    this.wormholePos.set(sp.x, sp.y + 2.7, sp.z);
    const g = new THREE.Group();
    const rings: THREE.Mesh[] = [];
    const defs: [number, number][] = [[2.5, 0x7dd3fc], [3.0, 0xc084fc], [3.5, 0xffffff]];
    for (const [r, c] of defs) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 8, 48), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      rings.push(m);
      g.add(m);
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const cx = cv.getContext('2d')!;
    const grd = cx.createRadialGradient(128, 128, 4, 128, 128, 128);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.25, '#9be7ff');
    grd.addColorStop(0.65, '#6d28d9');
    grd.addColorStop(1, 'rgba(10,0,40,0)');
    cx.fillStyle = grd;
    cx.fillRect(0, 0, 256, 256);
    cx.strokeStyle = 'rgba(255,255,255,0.6)';
    cx.lineWidth = 5;
    for (let arm = 0; arm < 5; arm++) {
      cx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const a = (arm * Math.PI * 2) / 5 + t * 5;
        const r = 8 + t * 116;
        const x = 128 + Math.cos(a) * r;
        const y = 128 + Math.sin(a) * r;
        if (t === 0) cx.moveTo(x, y);
        else cx.lineTo(x, y);
      }
      cx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 40),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    g.add(disc, new THREE.PointLight(0xa78bfa, 6, 36, 1.4));
    g.position.copy(this.wormholePos);
    this.scene.add(g);
    this.wormhole = g;
    this.wormholeParts = { rings, disc };
    this.sfx.tone(120, 900, 1.2, 'sawtooth', 0.2);
    this.sfx.tone(900, 120, 1.4, 'sine', 0.2, 0.5);
    this.announce('🌀 BURACO DE MINHOCA ABERTO!', '#c4b5fd', 4200);
    this.feed('🌀 Três mapas conquistados! Um buraco de minhoca surgiu no lugar da bomba. Entre nele!', 'good');
  }

  wormholeInfo() {
    const p = this.player;
    const dx = this.wormholePos.x - p.pos.x;
    const dz = this.wormholePos.z - p.pos.z;
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    return { dist: Math.hypot(dx, dz), ang: Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) };
  }

  updateWormhole(dt: number) {
    const w = this.wormhole;
    const parts = this.wormholeParts;
    if (!w || !parts) return;
    parts.rings.forEach((r, i) => {
      r.rotation.z += dt * (1.2 + i * 0.7) * (i % 2 ? -1 : 1);
      r.rotation.x = Math.sin(this.time * (1 + i * 0.4)) * 0.18;
      r.rotation.y = Math.cos(this.time * (0.8 + i * 0.3)) * 0.18;
    });
    parts.disc.rotation.z -= dt * 1.6;
    w.lookAt(this.player.pos.x, w.position.y, this.player.pos.z);
    const c = this.wormholePos;
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 3;
      const px = c.x + Math.cos(a) * r;
      const py = Math.max(0.3, c.y + Math.sin(a) * r * 0.9);
      const pz = c.z + (Math.random() - 0.5) * 1.5;
      this.particles.spawn({ x: px, y: py, z: pz, vx: (c.x - px) * 1.8, vy: (c.y - py) * 1.8, vz: (c.z - pz) * 1.8, size: 0.16, color: Math.random() < 0.5 ? 0x9be7ff : 0xc084fc, life: 0.55, grav: 0, glow: true });
    }
    const p = this.player;
    if (!p.dead && Math.hypot(p.pos.x - c.x, p.pos.y + 1 - c.y, p.pos.z - c.z) < 2.6) this.enterWormhole();
  }

  clearWormhole() {
    this.wormholeOn = false;
    if (this.wormhole) {
      this.scene.remove(this.wormhole);
      this.wormhole.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      this.wormhole = null;
      this.wormholeParts = null;
    }
  }

  enterWormhole() {
    if (!this.wormholeOn) return;
    this.wormholeOn = false;
    this.flash = 1;
    this.sfx.tone(900, 40, 1.0, 'sawtooth', 0.3);
    this.announce('🌀 ATRAVESSANDO O BURACO DE MINHOCA…', '#e9d5ff', 2500);
    this.cb.onWormhole?.();
  }

  buildAltar() {
    const g = new THREE.Group();
    g.position.set(CX + 0.5, 6.6, CZ + 0.5);
    const basic = (c: number) => new THREE.MeshBasicMaterial({ color: c, fog: false });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshBasicMaterial({ color: 0xfde68a, wireframe: true, fog: false }));
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 40), basic(0xffffff));
    r1.rotation.x = 1.2;
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 6, 40), basic(0xc4b5fd));
    r2.rotation.y = 1.2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), basic(0xffffff));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), basic(0x120a2e));
    pupil.position.z = 0.36;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.6, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    beam.position.y = 24;
    g.add(core, r1, r2, eye, pupil, beam, new THREE.PointLight(0xffe9a0, 6, 40, 1.2));
    this.altar = g;
    this.altarParts = [core, r1, r2];
    this.scene.add(g);
  }

  updateAltar(dt: number) {
    const g = this.altar;
    if (!g) return;
    this.altarParts.forEach((m, i) => (m.rotation.y += dt * (0.8 + i * 0.5)));
    g.position.y = 6.6 + Math.sin(this.time * 1.6) * 0.25;
    const p = this.player;
    if (!this.truthGiven && !p.dead && Math.hypot(p.pos.x - (CX + 0.5), p.pos.z - (CZ + 0.5)) < 6.2 && p.pos.y > 2.4) this.giveTruth();
  }

  giveTruth() {
    this.truthGiven = true;
    this.truthMode = true;
    grantTruth();
    if (this.altar) {
      this.particles.burst(this.altar.position.x, this.altar.position.y, this.altar.position.z, 40, 0xfde68a, 12, 0.3, 1.2, { glow: true, grav: -2 });
      this.scene.remove(this.altar);
      this.altar = null;
    }
    this.ws = this.newWeaponState();
    this.rebuildViewModel();
    this.flash = 1;
    this.sfx.levelUp();
    this.sfx.stop();
    this.announce('👁️ VOCÊ RECEBEU A VERDADE', '#fde68a', 4500);
    this.feed('👁️ A VERDADE: ataque = raio que atravessa tudo · botão dir./Q usa o poder · 1-4 / C troca o poder.', 'good');
    this.feed('Os Ecos do Vazio despertaram. Teste seus poderes!', 'info');
  }

  // ================= Loop =================
  loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (dt <= 0) return;
    this.fps = lerp(this.fps, 1 / dt, 0.05);
    this.time += dt;
    if (this.phase === 'rewinding') {
      this.updateRewind(dt);
      this.particles.update(dt, (x, y, z) => this.world.solidCell(x, y, z));
      this.world.tick(dt);
    } else if (!this.paused) {
      this.update(dt);
    }
    this.updateTracers(dt);
    this.updateCamera(dt);
    this.updateWeather(dt);
    this.drawRadar(dt);
    this.renderer.render(this.scene, this.camera);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.pushHud(false);
    }
    this.updateCssVars(dt);
  };

  update(dt: number) {
    const p = this.player;
    if (this.phase === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) {
        this.phase = 'playing';
        this.announce('EVOLUA OU MORRA!', '#facc15', 1600);
      }
    } else this.matchTime += dt;
    this.world.clock = this.matchTime;

    let wdt = dt;
    if (this.timeStop > 0) {
      this.timeStop -= dt;
      wdt = 0;
      if (this.timeStop <= 0) {
        this.timeStop = 0;
        this.announce('O TEMPO VOLTA A FLUIR', '#ffffff', 1200);
        this.sfx.resume();
      }
    }

    this.updatePlayer(dt);
    const inp: Input = {
      pressed: this.firePulse,
      held: this.mouseL || !!this.keys.KeyF,
      secPressed: this.secPulse,
      secHeld: this.mouseR || !!this.keys.KeyQ,
    };
    this.firePulse = false;
    this.secPulse = false;
    if (this.phase !== 'intro') {
      this.updateActors(wdt);
      this.updateProjectiles(wdt);
    }
    if (p.vehicle && inp.secPressed && !p.dead && this.phase !== 'intro') vehicleSpecial(this, inp);
    tickWeapon(this, dt, inp);
    tickEffects(this, wdt);
    for (const a of this.actors) this.syncActor(a, a.alive && wdt === 0 ? 0 : dt);
    this.updateVehicles(dt);
    if (this.wormholeOn) this.updateWormhole(dt);
    if (this.sanctum) this.updateAltar(dt);
    for (let i = 0; i < 4; i++) this.truthCd[i] = Math.max(0, this.truthCd[i] - dt);
    if (this.vm?.spin) this.vm.spin.forEach((o, i) => (o.rotation.y += dt * (1.5 + i)));

    // nuke
    if (this.phase === 'nuke' && this.nukeCount >= 0) {
      this.nukeCount -= dt;
      this.updateWarhead(this.nukeCount);
      if (this.nukeCount > 0) {
        const w = this.warhead.position;
        this.particles.spawn({ x: w.x, y: w.y + 7, z: w.z, size: 2.2, color: 0xbbbbbb, life: 1.8, grav: -0.5, drag: 1, grow: 1.5 });
        if (Math.floor(this.nukeCount + dt) !== Math.floor(this.nukeCount) && this.nukeCount < 5) this.sfx.tick();
      }
      if (this.nukeCount <= 0) this.detonate();
    }
    if (this.phase === 'ended') {
      this.nukeT += dt;
      this.nuke.update(this.nukeT);
      this.groundMat.color.copy(this.groundBase).multiplyScalar(1 - 0.75 * smooth(this.nukeT / 3));
      this.flash = Math.max(0, 1 - this.nukeT * 0.6);
      if (this.nukeT > 10.5) this.startRewind();
    }

    this.world.tick(dt);
    this.particles.update(wdt, (x, y, z) => this.world.solidCell(x, y, z));
    if (wdt > 0) this.debrisDamage();

    this.fallSfxT -= dt;
    if (this.fallCount > 0) {
      if (this.fallCount > 6 && this.fallSfxT <= 0) {
        this.fallSfxT = 0.8;
        this.sfx.explosion(false);
        this.shake(0.5);
      }
      this.fallCount = Math.max(0, this.fallCount - dt * 60);
    }

    if (this.phase === 'playing' || this.phase === 'nuke' || this.phase === 'ended') this.record(dt);
  }

  debrisDamage() {
    const p = this.player;
    this.particles.forEachDanger((x, y, z, size, dmg, consume) => {
      for (const a of this.actors) {
        if (!a.alive) continue;
        if (Math.abs(x - a.pos.x) < a.r + size * 0.5 && Math.abs(z - a.pos.z) < a.r + size * 0.5 && y > a.pos.y - 0.2 && y < a.pos.y + a.h + 0.3) {
          this.damageActor(a, dmg, { by: 'player', weapon: 'Desabamento' });
          consume();
          return;
        }
      }
      if (!p.dead && Math.abs(x - p.pos.x) < p.r + size * 0.5 && Math.abs(z - p.pos.z) < p.r + size * 0.5 && y > p.pos.y - 0.2 && y < p.pos.y + p.h + 0.3) {
        this.hurtPlayer(dmg * 0.6, 'um desabamento');
        consume();
      }
    });
  }

  updateTracers(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        const f = t.life / t.max;
        t.mesh.scale.x = t.mesh.scale.z = t.w * f;
        (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * f;
      }
    }
  }

  updateWeather(dt: number) {
    if (!this.weather) return;
    const pos = this.weather.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const c = this.camera.position;
    const sp = this.weatherSpeed;
    const sway = this.map.weather === 'petals' || this.map.weather === 'snow';
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= sp * dt;
      if (sway) arr[i] += Math.sin(this.time + i) * dt * 0.8;
      if (this.map.weather === 'dust') arr[i] += dt * 2;
      let dx = arr[i] - c.x;
      let dz = arr[i + 2] - c.z;
      if (arr[i + 1] < c.y - 14 || Math.abs(dx) > 40 || Math.abs(dz) > 40) {
        dx = (Math.random() - 0.5) * 80;
        dz = (Math.random() - 0.5) * 80;
        arr[i] = c.x + dx;
        arr[i + 2] = c.z + dz;
        arr[i + 1] = c.y + (Math.random() * 26 - 6);
      }
    }
    pos.needsUpdate = true;
  }

  updateCamera(dt: number) {
    const p = this.player;
    const cam = this.camera;
    this.hitT = Math.max(0, this.hitT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 1.6);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.6);
    this.sky.position.copy(cam.position);

    if (this.phase === 'ended' || (this.phase === 'rewinding' && this.nukeT > 0.05)) {
      const a = 0.7 + this.nukeT * 0.07;
      const rad = 150 + this.nukeT * 3;
      cam.position.set(CX + Math.cos(a) * rad, 40 + Math.sin(this.nukeT * 0.3) * 4, CZ + Math.sin(a) * rad);
      cam.lookAt(CX, 62, CZ);
      this.fov = lerp(this.fov, 62, 0.1);
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
      if (this.vm) this.vm.group.visible = false;
      return;
    }

    const eyeH = p.dead ? 0.35 : this.eyeHeight();
    const targetY = p.pos.y + eyeH;
    this.camY += (targetY - this.camY) * Math.min(1, dt * 20);
    if (Math.abs(this.camY - targetY) > 2.5) this.camY = targetY;
    const bobAmt = p.onGround && !p.dead ? Math.sin(p.bob * 2) * 0.035 * clamp(Math.hypot(p.vel.x, p.vel.z) / 6, 0, 1.2) : 0;
    cam.position.set(p.pos.x, this.camY + bobAmt, p.pos.z);
    const sh = this.shakeAmt * 0.06;
    let roll = 0;
    if (p.vehicle?.kind === 'unicycle') roll = Math.sin(this.time * 2.6) * 0.08 * (0.4 + Math.hypot(p.vel.x, p.vel.z) / 6);
    if (p.grind) roll += 0.08;
    if (p.dead) roll += 0.9;
    const recoil = this.ws.kick * 0.03;
    cam.rotation.set(p.pitch + recoil + (Math.random() - 0.5) * sh, p.yaw + p.spinAng + (Math.random() - 0.5) * sh, roll, 'YXZ');

    // FOV
    const w = this.activeWeapon();
    let tf = 75 + clamp(Math.hypot(p.vel.x, p.vel.z) / 16, 0, 1) * (p.vehicle ? 10 : 4);
    if (p.dashT > 0) tf += 18;
    if (this.ws.zoom > 0.01) tf = lerp(tf, w.key === 'sniper' ? 22 : 45, this.ws.zoom);
    this.fov = lerp(this.fov, tf, 1 - Math.exp(-12 * dt));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();

    // viewmodel
    if (this.vm) {
      const vm = this.vm;
      vm.group.visible = !p.dead && this.ws.zoom < 0.6;
      const sp = Math.hypot(p.vel.x, p.vel.z);
      const bob = Math.sin(p.bob * 2);
      vm.group.position.set(
        vm.base.x + bob * 0.012 * clamp(sp / 6, 0, 1),
        vm.base.y + Math.abs(bob) * 0.012 * clamp(sp / 6, 0, 1) - this.ws.swing * 0.04,
        vm.base.z + this.ws.kick * 0.12,
      );
      vm.group.rotation.set(-this.ws.swing * 0.9 + this.ws.kick * 0.15, this.ws.swing * 0.3, 0);
      if (vm.ball) {
        const ch = this.ws.charge > 0 ? 1 - this.ws.charge / this.ws.chargeMax : 0;
        vm.ball.scale.setScalar(Math.max(0.001, ch * 160));
      }
      if (vm.stand) {
        const lunge = clamp(this.ws.kick, 0, 1);
        vm.stand.arms[1].rotation.x = -1.4 - lunge * 0.4 + Math.sin(this.time * 30) * lunge * 0.3;
        vm.stand.group.position.z = -lunge * 0.4;
        vm.stand.group.position.y = Math.sin(this.time * 2) * 0.05;
        vm.stand.animate(dt, 0);
        vm.stand.arms[0].rotation.x = -1.2 - lunge * 0.3;
      }
    }
    this.ws.kick = Math.max(0, this.ws.kick - dt * 6);
    this.ws.swing = Math.max(0, this.ws.swing - dt * 5);
  }

  updateCssVars(dt: number) {
    const s = this.container.style;
    s.setProperty('--flash', this.flash.toFixed(3));
    s.setProperty('--hurt', clamp(this.hurtT, 0, 1).toFixed(3));
    s.setProperty('--hit', clamp(this.hitT / 0.22, 0, 1).toFixed(3));
    this.flash = Math.max(0, this.flash - dt * (this.phase === 'ended' ? 0 : 1.8));
  }

  // ================= Radar =================
  drawRadar(dt: number) {
    const cv = this.radar;
    if (!cv) return;
    this.radarT -= dt;
    if (this.radarT > 0) return;
    this.radarT = 0.04;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const S = cv.width;
    const R = S / 2;
    const range = 34;
    const sc = R / range;
    const p = this.player;
    if (this.world.footDirty || !this.footReady) {
      const foot = this.world.footprint();
      const img = this.footCtx.createImageData(W, D);
      for (let i = 0; i < W * D; i++) {
        const h = foot[i];
        if (h > 0) {
          const v = Math.min(235, 80 + h * 11);
          img.data[i * 4] = v;
          img.data[i * 4 + 1] = v;
          img.data[i * 4 + 2] = v + 8;
          img.data[i * 4 + 3] = 235;
        } else img.data[i * 4 + 3] = 0;
      }
      this.footCtx.putImageData(img, 0, 0);
      this.footReady = true;
    }
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,12,22,0.78)';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(R, R);
    ctx.rotate(p.yaw);
    ctx.scale(sc, sc);
    ctx.translate(-p.pos.x, -p.pos.z);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.footCanvas, 0, 0);
    const dot = (x: number, z: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, z, r / sc, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const v of this.vehicles) {
      if (v.rider) continue;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(v.pos.x - 0.9, v.pos.z - 0.9, 1.8, 1.8);
    }
    for (const c of this.civs) if (c.alive) dot(c.pos.x, c.pos.z, 2.2, '#86efac');
    for (const b of this.bots) {
      if (!b.alive) continue;
      const m = b.markedT > 0;
      dot(b.pos.x, b.pos.z, m ? 4.2 + Math.sin(this.time * 8) : 3, m ? '#ff2a2a' : '#f87171');
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(R, R - 7);
    ctx.lineTo(R - 5, R + 5);
    ctx.lineTo(R + 5, R + 5);
    ctx.closePath();
    ctx.fill();
  }
  footReady = false;

  // ================= HUD =================
  hud(): HudState {
    const p = this.player;
    const w = this.ws;
    const nv = !p.vehicle && !p.dead ? this.nearestVehicle() : null;
    let charge = 0;
    let chargeLabel = '';
    const wk = this.activeWeapon().key;
    if (w.windup > 0) {
      charge = 1 - w.windup / 1.15;
      chargeLabel = 'ONE… PUNCH…';
    } else if (w.charge > 0) {
      charge = 1 - w.charge / w.chargeMax;
      chargeLabel = 'KA-ME-HA-ME-HA…';
    } else if (wk === 'world' && this.timeStop <= 0 && w.cd2 > 0) {
      charge = 1 - w.cd2 / 11;
      chargeLabel = 'The World recarregando';
    }
    return {
      phase: this.phase,
      level: p.level,
      kills: p.kills,
      civKills: p.civKills,
      civStreak: p.civStreak,
      hp: Math.round(p.hp),
      cd: w.cdMax > 0 ? clamp(1 - w.cd / w.cdMax, 0, 1) : 1,
      charge,
      chargeLabel,
      markedT: p.markedT,
      vehicle: p.vehicle ? { name: p.vehicle.def.name, emoji: p.vehicle.def.emoji, special: p.vehicle.def.special, shoot: p.vehicle.def.shoot } : null,
      nearVehicle: nv ? `${nv.def.emoji} ${nv.def.name}` : null,
      timeStop: this.timeStop,
      nukeCount: this.nukeCount,
      nukeT: this.nukeT,
      matchTime: this.matchTime,
      rewind: this.phase === 'rewinding' ? this.rwProgress : 0,
      dead: p.dead,
      respawnT: p.respawnT,
      introT: this.introT,
      locked: this.locked,
      lockFailed: this.lockFailed,
      paused: this.paused,
      botsAlive: this.bots.filter((b) => b.alive).length,
      botsTotal: this.bots.length,
      muted: this.sfx.muted,
      training: this.opts.training,
      zoom: w.zoom,
      mapName: this.map.name,
      canShoot: this.canShoot(this.activeWeapon()),
      truth: this.truthMode,
      truthPower: this.truthPower,
      truthCds: this.truthCd.slice(),
      gravMode: this.gravMode,
      wormhole: this.wormholeOn ? this.wormholeInfo() : null,
      altar: this.sanctum && !this.truthGiven ? Math.hypot(p.pos.x - CX, p.pos.z - CZ) : -1,
      conquered: this.conqueredCount,
    };
  }

  pushHud(_force: boolean) {
    this.cb.onHud(this.hud());
  }

  // ================= Dispose =================
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.container.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.container.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('blur', this.onBlur);
    this.resizeObs?.disconnect();
    this.releaseLock();
    this.sfx.dispose();
    disposeEffects(this);
    this.world.dispose();
    this.particles.dispose();
    this.nuke.dispose();
    if (this.vm) disposeViewModel(this.vm);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Points).isPoints) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    this.renderer.dispose();
    if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas);
  }
}
