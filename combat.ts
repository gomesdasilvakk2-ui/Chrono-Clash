import * as THREE from 'three';
import type { Game, Input, Actor, WeaponState } from './engine';
import type { WeaponDef } from './weapons';
import { TRUTH_POWERS } from './weapons';
import { buildViewModel } from './viewmodels';
import { clamp } from './rng';
import { W, D } from './world';

const W_D = W * D;
const ROCKET_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8);
const ROCKET_MAT = new THREE.MeshLambertMaterial({ color: 0xb91c1c, emissive: 0x330000 });
let burnT = 0;

const cdSet = (ws: WeaponState, v: number) => {
  ws.cd = v;
  ws.cdMax = v;
};

function spreadDir(aim: THREE.Vector3, spread: number) {
  const d = aim.clone();
  d.x += (Math.random() - 0.5) * spread * 2;
  d.y += (Math.random() - 0.5) * spread * 2;
  d.z += (Math.random() - 0.5) * spread * 2;
  return d.normalize();
}

function muzzle(g: Game, eye: THREE.Vector3, aim: THREE.Vector3, color = 0xffe9a0, size = 0.16) {
  const p = g.player;
  g.particles.spawn({
    x: eye.x + aim.x * 0.9 + Math.cos(p.yaw) * 0.2,
    y: eye.y + aim.y * 0.9 - 0.15,
    z: eye.z + aim.z * 0.9 - Math.sin(p.yaw) * 0.2,
    size,
    color,
    life: 0.06,
    grav: 0,
    glow: true,
    spin: 0,
  });
}

function melee(g: Game, o: { range: number; dmg: number; head?: number; blockAmt?: number; heavy?: boolean; weapon: string; radius?: number }) {
  const eye = g.eye();
  const d = g.aim();
  const bh = g.world.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, o.range);
  const maxT = bh ? bh.dist : o.range;
  const hits = g.rayActors(eye, d, maxT, o.radius ?? 0.45);
  if (hits.length) {
    const h = hits[0];
    g.damageActor(h.actor, o.dmg * (h.head ? (o.head ?? 1) : 1), { by: 'player', weapon: o.weapon, head: h.head });
    h.actor.vel.x += d.x * 7;
    h.actor.vel.z += d.z * 7;
    h.actor.stunT = 0.25;
    g.spark(h.actor.pos.x, h.actor.pos.y + 1.2, h.actor.pos.z, 0xffffff, 5, 4);
    return true;
  }
  if (bh) {
    const px = eye.x + d.x * bh.dist;
    const py = eye.y + d.y * bh.dist;
    const pz = eye.z + d.z * bh.dist;
    let res = 0;
    let col = 0xcccccc;
    if (bh.idx >= 0) {
      col = g.world.colArr[bh.idx];
      if ((o.blockAmt ?? 0) > 0) res = g.world.damage(bh.idx, o.blockAmt!, !!o.heavy, { x: d.x * 4, y: 2, z: d.z * 4 });
    }
    g.spark(px, py, pz, col, 5, 3);
    return res > 0;
  }
  return false;
}

function gun(
  g: Game,
  w: WeaponDef,
  o: { dmg: number; head: number; spread: number; pierce?: number; blockAmt?: number; tracer: number; speed: number; range: number; drag?: number; falloff?: number; noiseR: number; sound: 'pistol' | 'rifle' | 'sniper'; kick: number; pitch: number; width?: number },
) {
  const eye = g.eye();
  const aim = g.aim();
  const d = spreadDir(aim, o.spread);
  g.fireBullet(eye, d, { speed: o.speed, drag: o.drag, dmg: o.dmg, head: o.head, pierce: o.pierce ?? 0, blockAmt: o.blockAmt ?? 1, range: o.range, weapon: w.name, color: o.tracer, falloff: o.falloff });
  g.sfx.shot(o.sound);
  g.noise(g.player.pos, o.noiseR);
  g.ws.kick = o.kick;
  g.player.pitch = clamp(g.player.pitch + o.pitch, -1.5, 1.5);
  muzzle(g, eye, aim);
}

function deflect(g: Game, radius: number) {
  const p = g.player;
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i];
    if (pr.owner !== 'bot') continue;
    if (Math.hypot(pr.pos.x - p.pos.x, pr.pos.y - (p.pos.y + 1), pr.pos.z - p.pos.z) < radius) {
      g.spark(pr.pos.x, pr.pos.y, pr.pos.z, 0xc4b5fd, 6, 5);
      g.removeProjectile(i);
      g.sfx.hit();
    }
  }
}

function slashTick(g: Game) {
  const p = g.player;
  const c = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z);
  for (const a of g.actors) {
    if (!a.alive || g.ws.slashHit.has(a)) continue;
    if (Math.hypot(a.pos.x - c.x, a.pos.y + 0.9 - c.y, a.pos.z - c.z) < 2.5) {
      g.ws.slashHit.add(a);
      g.damageActor(a, 150, { by: 'player', weapon: 'Espada do Destino' });
      g.hitMarker();
    }
  }
  const front = c.clone().addScaledVector(p.dashDir, 0.9);
  g.damageBlocksSphere(front, 2.2, 8, true, 8);
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i];
    if (pr.owner === 'bot' && pr.pos.distanceTo(c) < 3.8) {
      g.spark(pr.pos.x, pr.pos.y, pr.pos.z, 0x9be7ff, 6, 5);
      g.removeProjectile(i);
    }
  }
  g.particles.burst(c.x, c.y, c.z, 3, 0x9be7ff, 3, 0.2, 0.3, { glow: true, grav: 0 });
}

function makeRiftMesh() {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6.5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7.4), new THREE.MeshBasicMaterial({ color: 0xb04bff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1a0733, transparent: true, opacity: 0.75, fog: false }));
  orb.scale.set(1.2, 3.4, 0.25);
  grp.add(orb, halo, core);
  return grp;
}

function disposeGroup(grp: THREE.Object3D) {
  grp.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
}

function kamehameha(g: Game) {
  const p = g.player;
  const eye = g.eye();
  const d = g.aim();
  let range = 30;
  if (d.y < -0.01) range = Math.min(range, -eye.y / d.y);
  const hits = g.rayActors(eye, d, range, 1.1);
  for (const h of hits) g.damageActor(h.actor, 260, { by: 'player', weapon: 'Kamehameha' });
  const c = new THREE.Vector3();
  for (let t = 1.2; t <= range; t += 0.9) {
    c.copy(eye).addScaledVector(d, t);
    if (c.y < 0) break;
    g.damageBlocksSphere(c, 1.5, 16, true, 7);
  }
  const start = eye.clone().addScaledVector(d, 0.6);
  start.y -= 0.12;
  const end = eye.clone().addScaledVector(d, range);
  g.tracer(start, end, 0x7dd3fc, 0.95, 0.5);
  g.tracer(start, end, 0xffffff, 0.45, 0.5);
  for (let i = 0; i < 24; i++) {
    const t = Math.random() * range;
    g.particles.spawn({ x: eye.x + d.x * t, y: eye.y + d.y * t, z: eye.z + d.z * t, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, size: 0.3, color: 0xbfe9ff, life: 0.5, grav: 0, glow: true });
  }
  g.sfx.shot('beam');
  g.shake(0.8);
  g.noise(p.pos, 90);
  p.vel.x -= d.x * 4;
  p.vel.z -= d.z * 4;
  cdSet(g.ws, 2.2);
}

function instantTransmission(g: Game) {
  const eye = g.eye();
  const aim = g.aim();
  const bh = g.world.raycast(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, 60);
  const maxT = bh ? bh.dist : 60;
  const hits = g.rayActors(eye, aim, maxT, 0.7);
  const dest = new THREE.Vector3();
  if (hits.length) {
    const a = hits[0].actor;
    const l = Math.hypot(aim.x, aim.z) || 1;
    dest.set(a.pos.x + (aim.x / l) * 1.7, a.pos.y, a.pos.z + (aim.z / l) * 1.7);
  } else {
    const t = Math.max(0, maxT - 1.0);
    dest.copy(eye).addScaledVector(aim, t);
    dest.y = Math.max(0, dest.y - 1.62);
  }
  dest.x = clamp(dest.x, 1.6, W - 1.6);
  dest.z = clamp(dest.z, 1.6, D - 1.6);
  g.teleportPlayer(dest);
  g.ws.cd2 = 1.6;
  g.sfx.dash();
  g.announce('INSTANT TRANSMISSION', '#fb923c', 700);
}

function saitamaPunch(g: Game) {
  const p = g.player;
  const eye = g.eye();
  const d = g.aim();
  const LEN = 72;
  const hw = (t: number) => 5.2 + t * 0.04;
  for (const a of g.actors) {
    if (!a.alive) continue;
    const rx = a.pos.x - eye.x;
    const ry = a.pos.y + 0.9 - eye.y;
    const rz = a.pos.z - eye.z;
    const t = rx * d.x + ry * d.y + rz * d.z;
    if (t < 0 || t > LEN) continue;
    const lat = Math.hypot(rx - d.x * t, ry - d.y * t, rz - d.z * t);
    if (lat < hw(t)) g.damageActor(a, 9999, { by: 'player', weapon: 'Soco Sério' });
  }
  const end = eye.clone().addScaledVector(d, LEN);
  const x0 = Math.floor(Math.min(eye.x, end.x) - 8);
  const x1 = Math.ceil(Math.max(eye.x, end.x) + 8);
  const z0 = Math.floor(Math.min(eye.z, end.z) - 8);
  const z1 = Math.ceil(Math.max(eye.z, end.z) + 8);
  let n = 0;
  const w = g.world;
  for (let y = 0; y < 22; y++)
    for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const idx = (y * D + z) * W + x;
        if (!w.kindArr[idx]) continue;
        const rx = x + 0.5 - eye.x;
        const ry = y + 0.5 - eye.y;
        const rz = z + 0.5 - eye.z;
        const t = rx * d.x + ry * d.y + rz * d.z;
        if (t < 0 || t > LEN) continue;
        const lat = Math.hypot(rx - d.x * t, ry - d.y * t, rz - d.z * t);
        if (lat < hw(t)) {
          g.suppressDebris = n++ % 3 !== 0;
          const sp = 26 + Math.random() * 22;
          w.removeCell(idx, { x: d.x * sp, y: 6 + Math.random() * 12, z: d.z * sp });
        }
      }
  g.suppressDebris = false;
  for (let i = 0; i < 90; i++) {
    const t = Math.random() * 40;
    g.particles.spawn({
      x: eye.x + d.x * t + (Math.random() - 0.5) * 6,
      y: eye.y + d.y * t + (Math.random() - 0.5) * 6,
      z: eye.z + d.z * t + (Math.random() - 0.5) * 6,
      vx: d.x * 60,
      vy: d.y * 60,
      vz: d.z * 60,
      size: 0.5,
      color: 0xffffff,
      life: 0.6,
      grav: 0,
      glow: true,
    });
  }
  g.tracer(eye.clone().addScaledVector(d, 1), end, 0xffffff, 2.2, 0.35);
  g.flash = 0.8;
  g.shake(1.5);
  g.sfx.shot('punch');
  g.sfx.explosion(true);
  g.noise(p.pos, 120);
  g.announce('ONE PUNCH!', '#fde047', 1600);
  p.vel.x -= d.x * 6;
  p.vel.z -= d.z * 6;
  cdSet(g.ws, 2.3);
}

function erase(g: Game) {
  const eye = g.eye();
  const aim = g.aim();
  const bh = g.world.raycast(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, 50);
  const dist = bh ? Math.max(6, bh.dist) : 30;
  const c = eye.clone().addScaledVector(aim, dist);
  if (c.y < 1) c.y = 1;
  const R = 15;
  for (const a of g.actors) {
    if (a.alive && Math.hypot(a.pos.x - c.x, a.pos.y + 0.9 - c.y, a.pos.z - c.z) < R + 1) g.damageActor(a, 99999, { by: 'player', weapon: 'Apagar' });
  }
  const w = g.world;
  let n = 0;
  const cx = Math.floor(c.x);
  const cy = Math.floor(c.y);
  const cz = Math.floor(c.z);
  for (let y = cy - R; y <= cy + R; y++)
    for (let z = cz - R; z <= cz + R; z++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (!w.solidCell(x, y, z)) continue;
        if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y, z + 0.5 - c.z) > R) continue;
        if (x < 1 || z < 1 || x > W - 2 || z > D - 2) continue;
        g.suppressDebris = n++ % 4 !== 0;
        w.removeCell(w.idx(x, y, z), { x: 0, y: 4, z: 0 });
      }
  g.suppressDebris = false;
  g.particles.burst(c.x, c.y, c.z, 60, 0xffffff, 18, 0.35, 1, { glow: true, grav: 0, drag: 2 });
  g.flash = 0.9;
  g.shake(1.2);
  g.sfx.explosion(true);
  g.noise(c, 80);
  g.announce('☄️ APAGADO DA EXISTÊNCIA', '#ffffff', 1600);
}

function usePower(g: Game) {
  const i = g.truthPower;
  const pw = TRUTH_POWERS[i];
  if (g.truthCd[i] > 0) {
    if (g.ws.warnT <= 0) {
      g.ws.warnT = 1;
      g.feed(`${pw.name} recarregando (${g.truthCd[i].toFixed(1)}s)`, 'info');
    }
    return;
  }
  switch (i) {
    case 0:
      if (g.timeStop > 0) return;
      g.timeStop = 4;
      g.sfx.stop();
      g.flash = 0.6;
      g.announce('⏱️ O TEMPO PAROU', '#fde68a', 1800);
      break;
    case 1:
      if (!g.localRewind(3)) return;
      break;
    case 2:
      g.cycleGravity();
      break;
    default:
      erase(g);
  }
  g.truthCd[i] = pw.cd;
}

function oraTick(g: Game) {
  const eye = g.eye();
  const aim = g.aim();
  let any = false;
  for (const a of g.actors) {
    if (!a.alive) continue;
    const rx = a.pos.x - eye.x;
    const ry = a.pos.y + 0.9 - eye.y;
    const rz = a.pos.z - eye.z;
    const dist = Math.hypot(rx, ry, rz);
    if (dist < 6.2 && (rx * aim.x + ry * aim.y + rz * aim.z) / (dist || 1) > 0.12) {
      g.damageActor(a, 14, { by: 'player', weapon: 'Star Platinum' });
      a.vel.x += aim.x * 2;
      a.vel.z += aim.z * 2;
      a.stunT = 0.2;
      any = true;
    }
  }
  if (any) g.hitMarker();
  for (const t of [1.6, 3.0, 4.4]) {
    const c = eye.clone().addScaledVector(aim, t);
    g.damageBlocksSphere(c, 1.7, 0.9, true, 5);
  }
  for (let i = 0; i < 3; i++) {
    const o = eye.clone().addScaledVector(aim, 1.2);
    g.particles.spawn({
      x: o.x + (Math.random() - 0.5) * 1.4,
      y: o.y + (Math.random() - 0.5) * 1.1 - 0.2,
      z: o.z + (Math.random() - 0.5) * 1.4,
      vx: aim.x * 24,
      vy: aim.y * 24,
      vz: aim.z * 24,
      size: 0.22,
      color: 0xc4b5fd,
      life: 0.28,
      grav: 0,
      glow: true,
    });
  }
  g.sfx.noise(0.06, 500, 180, 0.3, 'lowpass');
  g.shake(0.15);
}

export function tickWeapon(g: Game, dt: number, inp: Input) {
  const ws = g.ws;
  const p = g.player;
  ws.cd = Math.max(0, ws.cd - dt);
  ws.cd2 = Math.max(0, ws.cd2 - dt);
  ws.warnT = Math.max(0, ws.warnT - dt);
  ws.tickT = Math.max(0, ws.tickT - dt);
  ws.heat = Math.max(0, ws.heat - dt * 1.2);
  const w = g.activeWeapon();
  const canAct = !p.dead && g.phase !== 'intro' && g.phase !== 'ended';
  const wantsZoom = canAct && !p.vehicle && inp.secHeld && (w.key === 'sniper' || w.key === 'kar98');
  ws.zoom += ((wantsZoom ? 1 : 0) - ws.zoom) * Math.min(1, dt * 12);
  ws.guard = canAct && !p.vehicle && w.key === 'platinum' && inp.secHeld;
  if (!canAct) {
    ws.windup = 0;
    ws.charge = 0;
    ws.barrage = 0;
    return;
  }
  if (p.dashT > 0) slashTick(g);
  if (ws.windup > 0) {
    ws.windup -= dt;
    if (ws.windup <= 0) {
      ws.windup = 0;
      saitamaPunch(g);
    }
  }
  if (ws.charge > 0) {
    ws.charge -= dt;
    if (ws.charge <= 0) {
      ws.charge = 0;
      kamehameha(g);
    }
  }
  ws.barrage = Math.max(0, ws.barrage - dt);
  if (ws.guard || ws.barrage > 0) deflect(g, 4.6);

  const press = inp.pressed;
  const hold = inp.held || inp.pressed;
  const ok = g.canShoot(w);
  if ((press || hold) && !ok) {
    if (press && ws.warnT <= 0) {
      ws.warnT = 1.6;
      g.feed(
        p.vehicle?.def.shoot === 'none' ? 'Monociclo exige as duas mãos: use o botão direito (giro 360°) ou desça com [E].' : 'Mãos ocupadas pedalando! Só armas de uma mão na bicicleta.',
        'info',
      );
    }
    return;
  }
  const eye = g.eye();
  const aim = g.aim();

  switch (w.key) {
    case 'carrot':
      if (hold && ws.cd <= 0) {
        cdSet(ws, 0.26);
        ws.swing = 1;
        g.sfx.shot('swing');
        melee(g, { range: 2.9, dmg: 38, head: 1.5, weapon: w.name });
      }
      break;
    case 'pickaxe':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.55);
        ws.swing = 1;
        g.sfx.shot('swing');
        melee(g, { range: 3.3, dmg: 55, head: 2.2, blockAmt: 99, weapon: w.name });
      }
      break;
    case 'glock':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.2);
        gun(g, w, { dmg: 28, head: 2, spread: 0.006, blockAmt: 1, tracer: 0xfff2a0, speed: 150, range: 90, drag: 0.25, noiseR: 55, sound: 'pistol', kick: 0.6, pitch: 0.012 });
      }
      break;
    case 'kar98':
      if (press && ws.cd <= 0) {
        cdSet(ws, 1.0);
        gun(g, w, { dmg: 100, head: 2, spread: ws.zoom > 0.5 ? 0.0008 : 0.012, blockAmt: 2, pierce: 1, tracer: 0xfff2c0, speed: 280, range: 170, noiseR: 85, sound: 'rifle', kick: 1, pitch: 0.035 });
      }
      break;
    case 'ak47':
      if (hold && ws.cd <= 0) {
        cdSet(ws, 0.095);
        gun(g, w, { dmg: 24, head: 1.8, spread: 0.008 + ws.heat * 0.03, pierce: 1, blockAmt: 2, tracer: 0xffd27a, speed: 215, range: 130, noiseR: 70, sound: 'rifle', kick: 0.7, pitch: 0.004 + ws.heat * 0.004 });
        ws.heat = Math.min(1, ws.heat + 0.12);
      }
      break;
    case 'sniper':
      if (press && ws.cd <= 0) {
        cdSet(ws, 1.5);
        gun(g, w, { dmg: 160, head: 2, spread: ws.zoom > 0.5 ? 0.0003 : 0.03, pierce: 3, blockAmt: 99, tracer: 0x9be7ff, speed: 480, range: 280, drag: 0.04, falloff: 0, noiseR: 130, sound: 'sniper', kick: 1.6, pitch: 0.05, width: 0.06 });
      }
      break;
    case 'bazooka':
      if (press && ws.cd <= 0) {
        cdSet(ws, 1.8);
        const pos = eye.clone().addScaledVector(aim, 1.1);
        const mesh = new THREE.Mesh(ROCKET_GEO, ROCKET_MAT);
        mesh.position.copy(pos);
        g.addProjectile({ kind: 'rocket', pos, vel: aim.clone().multiplyScalar(46), life: 4, mesh, dmg: 170, owner: 'player', speed: 46 });
        g.sfx.shot('rocket');
        g.noise(p.pos, 90);
        g.ws.kick = 1.8;
        g.shake(0.4);
        p.vel.x -= aim.x * 2.5;
        p.vel.z -= aim.z * 2.5;
        muzzle(g, eye, aim, 0xffaa55, 0.5);
      }
      break;
    case 'sword':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.95);
        const l = Math.hypot(aim.x, aim.z) || 1;
        p.dashDir.set(aim.x / l, 0, aim.z / l);
        p.dashT = 0.21;
        ws.slashHit.clear();
        ws.swing = 1;
        g.sfx.dash();
      }
      break;
    case 'brush':
      if (press && ws.cd <= 0) {
        cdSet(ws, 1.7);
        const bh = g.world.raycast(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, 15);
        const dist = bh ? Math.max(1.5, bh.dist - 1) : 13;
        const pos = eye.clone().addScaledVector(aim, dist);
        pos.y = clamp(pos.y, 1.5, 8);
        const mesh = makeRiftMesh();
        mesh.position.set(pos.x, 3, pos.z);
        mesh.rotation.y = p.yaw;
        g.scene.add(mesh);
        g.rifts.push({ pos, yaw: p.yaw, t: 2.6, max: 2.6, radius: 9.5, mesh });
        g.sfx.shot('magic');
        g.announce('✂ FENDA DIMENSIONAL', '#67e8f9', 900);
        ws.swing = 1;
      }
      break;
    case 'pedro':
      if (press && ws.cd <= 0) {
        cdSet(ws, 1.5);
        const mesh = buildViewModel(10).group;
        mesh.scale.setScalar(1.7);
        const pos = eye.clone().addScaledVector(aim, 1.2);
        mesh.position.copy(pos);
        g.addProjectile({ kind: 'pedro', pos, vel: aim.clone().multiplyScalar(30), life: 6, mesh, dmg: 150, owner: 'player', speed: 30, target: null });
        g.sfx.shot('magic');
        g.announce('PEDRO PEDRO PEDRO PEDRO', '#e5e7eb', 900);
        ws.swing = 0.6;
      }
      break;
    case 'chariot':
      if (hold && ws.cd <= 0) {
        cdSet(ws, 0.07);
        g.hitscan(eye, spreadDir(aim, 0.018), { range: 9.5, dmg: 20, head: 1, radius: 0.35, blockAmt: 0.4, heavy: true, tracer: 0xe2e8f0, width: 0.018, weapon: w.name });
        ws.kick = 0.9;
        if (ws.tickT <= 0) {
          ws.tickT = 0.1;
          g.sfx.shot('knife');
          g.noise(p.pos, 40);
        }
      }
      break;
    case 'magician':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.9);
        const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        for (const s of [-1, 0, 1]) {
          const dir = aim.clone().addScaledVector(right, s * 0.07).normalize();
          const pos = eye.clone().addScaledVector(dir, 1.1);
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a1a, fog: false }));
          mesh.position.copy(pos);
          g.addProjectile({ kind: 'fire', pos, vel: dir.multiplyScalar(40), life: 3, mesh, dmg: 60, owner: 'player', speed: 40 });
        }
        g.sfx.shot('magic');
        g.announce('CROSSFIRE HURRICANE!', '#fb923c', 800);
        ws.kick = 1;
        g.noise(p.pos, 60);
      }
      if (inp.secPressed) {
        /* nada */
      }
      break;
    case 'queen':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.5);
        const bh = g.world.raycast(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, 50);
        const maxT = bh ? bh.dist : 50;
        const hits = g.rayActors(eye, aim, maxT, 0.3);
        let pos: THREE.Vector3 | null = null;
        let actor: Actor | undefined;
        if (hits.length) {
          actor = hits[0].actor;
          pos = new THREE.Vector3(actor.pos.x, actor.pos.y + 1, actor.pos.z);
        } else if (bh) {
          pos = eye.clone().addScaledVector(aim, bh.dist + 0.3);
        }
        const start = eye.clone().addScaledVector(aim, 0.6);
        start.y -= 0.12;
        g.tracer(start, pos ?? eye.clone().addScaledVector(aim, 50), 0xff5fb0, 0.05, 0.2);
        g.sfx.shot('magic');
        if (pos) {
          g.bombs.push({ pos, t: actor ? 0.55 : 1.2, actor, pulse: 0 });
          g.announce(actor ? 'KILLER QUEEN — PRIMEIRA BOMBA' : 'KILLER QUEEN — BOMBA ARMADA', '#f472b6', 800);
        }
      }
      if (inp.secPressed) {
        for (const b of g.bombs) b.t = 0;
      }
      break;
    case 'platinum':
      if (hold) ws.barrage = 0.2;
      if (ws.barrage > 0) {
        ws.oraT -= dt;
        ws.kick = 1;
        if (ws.oraT <= 0) {
          ws.oraT = 0.075;
          oraTick(g);
          if (ws.tickT <= 0) {
            ws.tickT = 0.35;
            g.announce('ORA!', '#c4b5fd', 450);
          }
        }
      }
      break;
    case 'world':
      if (g.timeStop > 0) {
        if (hold && ws.cd <= 0) {
          cdSet(ws, 0.09);
          g.hitscan(eye, spreadDir(aim, 0.01), { range: 70, dmg: 48, head: 1.6, tracer: 0xffffff, width: 0.02, weapon: w.name, blockAmt: 1 });
          g.sfx.shot('knife');
          ws.kick = 0.6;
        }
      } else if (press && ws.cd2 <= 0) {
        g.timeStop = 3;
        ws.cd2 = 11;
        g.announce('ZA WARUDO! ⏱️ TOKI WO TOMARE!', '#facc15', 2200);
        g.sfx.stop();
        g.flash = 0.6;
      } else if (press && ws.warnT <= 0) {
        ws.warnT = 1.5;
        g.feed('The World ainda está recarregando…', 'info');
      }
      break;
    case 'goku':
      if (press && ws.cd <= 0 && ws.charge <= 0) {
        ws.charge = 0.5;
        ws.chargeMax = 0.5;
        g.announce('KA-ME-HA-ME-HA!!', '#7dd3fc', 900);
        g.sfx.tone(200, 700, 0.5, 'sine', 0.2);
      }
      if (inp.secPressed && ws.cd2 <= 0) instantTransmission(g);
      break;
    case 'saitama':
      if (press && ws.cd <= 0 && ws.windup <= 0) {
        ws.windup = 1.15;
        g.announce('…', '#fde047', 1100);
        g.sfx.tone(60, 260, 1.1, 'sine', 0.35);
      }
      break;
    case 'gauntlet':
      if (press && ws.cd <= 0) {
        cdSet(ws, 0.9);
        const gems = [0xa855f7, 0x3b82f6, 0xef4444, 0xfacc15, 0x22c55e, 0xf97316];
        const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        gems.forEach((c, i) => {
          const ang = (i / 6) * Math.PI * 2;
          const d = aim.clone();
          d.addScaledVector(right, Math.cos(ang) * 0.04);
          d.y += Math.sin(ang) * 0.04;
          d.normalize();
          const r = g.hitscan(eye, d, {
            range: 90,
            dmg: 42,
            head: 1.4,
            tracer: c,
            width: 0.045,
            weapon: w.name,
            blockAmt: i === 0 ? 8 : 1,
            heavy: i === 0,
            onActorHit: (a) => {
              if (i === 1) {
                a.pos.set(p.pos.x + aim.x * 3, a.pos.y, p.pos.z + aim.z * 3);
              } else if (i === 4) a.frozenT = 2.5;
              else if (i === 3) a.stunT = 1.5;
              else if (i === 5) p.hp = Math.min(p.maxHp, p.hp + 8);
            },
          });
          if (i === 2 && r.end.distanceTo(eye) < 89) g.explode(r.end, 2.3, 40, 'player', { blockDmg: 6, color: 0xff4444, weapon: w.name });
        });
        g.sfx.shot('beam');
        g.noise(p.pos, 80);
        ws.kick = 1;
        g.shake(0.3);
      }
      break;
    case 'truth':
      if (hold && ws.cd <= 0) {
        cdSet(ws, 0.3);
        g.hitscan(eye, spreadDir(aim, 0.002), { range: 150, dmg: 220, head: 1.5, through: true, pierce: 12, blockAmt: 99, heavy: true, tracer: 0xfff2b0, width: 0.09, weapon: w.name });
        g.sfx.shot('magic');
        ws.kick = 0.8;
        muzzle(g, eye, aim, 0xfff2b0, 0.3);
        g.noise(p.pos, 60);
      }
      if (inp.secPressed) usePower(g);
      break;
    default: {
      // Faca Dourada Final (e arma do nível 20 enquanto a bomba cai)
      if (press && ws.cd <= 0) {
        const hits = g.rayActors(eye, aim, 3.0, 0);
        ws.swing = 1;
        g.sfx.shot('swing');
        if (hits.length) {
          cdSet(ws, 0.35);
          g.damageActor(hits[0].actor, 999, { by: 'player', weapon: 'Faca Dourada', head: hits[0].head });
          g.hitMarker();
          g.spark(hits[0].actor.pos.x, hits[0].actor.pos.y + 1.2, hits[0].actor.pos.z, 0xfacc15, 10, 5);
        } else {
          cdSet(ws, 1.5);
          if (ws.warnT <= 0) {
            ws.warnT = 2;
            g.feed('A Faca Dourada exige precisão máxima: errou, tropeçou.', 'info');
          }
        }
      }
    }
  }
}

export function vehicleSpecial(g: Game, _inp: Input) {
  const p = g.player;
  const v = p.vehicle;
  if (!v || p.specialCd > 0) return;
  switch (v.kind) {
    case 'skate':
      if (p.onGround || p.grind) {
        p.vel.y = v.def.jump * 1.35;
        p.grind = null;
        p.specialCd = 0.5;
        g.announce('OLLIE!', '#fde047', 700);
        g.sfx.tick();
      }
      break;
    case 'bike':
      p.boostT = 1.2;
      p.specialCd = 4;
      g.announce('EMPINADA TURBO! 🚲💨', '#fb7185', 900);
      g.sfx.dash();
      break;
    case 'unicycle':
      p.spinT = 0.6;
      p.spinHit.clear();
      p.specialCd = 1.4;
      g.sfx.shot('swing');
      g.announce('GIRO 360°!', '#c084fc', 800);
      break;
    case 'horse': {
      p.kickT = 0.35;
      p.specialCd = 1.2;
      const bx = Math.sin(p.yaw);
      const bz = Math.cos(p.yaw);
      g.sfx.shot('punch');
      g.shake(0.5);
      for (const a of g.actors) {
        if (!a.alive) continue;
        const rx = a.pos.x - p.pos.x;
        const rz = a.pos.z - p.pos.z;
        const d = Math.hypot(rx, rz);
        if (d < 3.9 && (rx * bx + rz * bz) / (d || 1) > 0.15) {
          g.damageActor(a, 300, { by: 'player', weapon: 'Coice de Cavalo' });
          a.vel.x += bx * 14;
          a.vel.z += bz * 14;
          a.vel.y = 7;
          a.stunT = 0.8;
          g.hitMarker();
        }
      }
      g.announce('COICE! 🐴', '#fbbf24', 800);
      break;
    }
  }
}

export function tickEffects(g: Game, dt: number) {
  const p = g.player;
  // fendas dimensionais
  for (let i = g.rifts.length - 1; i >= 0; i--) {
    const r = g.rifts[i];
    r.t -= dt;
    const f = clamp(Math.min(r.t / 0.4, (r.max - r.t) / 0.2), 0, 1);
    r.mesh.scale.set(1, f, 1);
    r.mesh.rotation.y = r.yaw + Math.sin(g.time * 12) * 0.05;
    if (dt > 0) {
      for (const a of g.actors) {
        if (!a.alive) continue;
        const dx = r.pos.x - a.pos.x;
        const dz = r.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < r.radius) {
          const pull = 10 * (1 - d / r.radius + 0.25);
          if (d > 0.5) g.moveBody(a, (dx / d) * pull * dt, 0, (dz / d) * pull * dt, false);
          a.stunT = 0.2;
          if (d < 1.9) g.damageActor(a, 140 * dt, { by: 'player', weapon: 'Pincel Dimensional' });
        }
      }
      g.damageBlocksSphere(new THREE.Vector3(r.pos.x, 2, r.pos.z), 2.8, 10 * dt, true, 4, dt);
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        const rr = 3 + Math.random() * 6;
        g.particles.spawn({
          x: r.pos.x + Math.cos(a) * rr,
          y: 0.5 + Math.random() * 5,
          z: r.pos.z + Math.sin(a) * rr,
          vx: -Math.cos(a) * rr * 2.2,
          vz: -Math.sin(a) * rr * 2.2,
          size: 0.2,
          color: Math.random() < 0.5 ? 0x67e8f9 : 0xc084fc,
          life: 0.45,
          grav: 0,
          glow: true,
        });
      }
    }
    if (r.t <= 0) {
      g.scene.remove(r.mesh);
      disposeGroup(r.mesh);
      g.rifts.splice(i, 1);
    }
  }
  // bombas do Killer Queen
  for (let i = g.bombs.length - 1; i >= 0; i--) {
    const b = g.bombs[i];
    b.t -= dt;
    if (b.actor && b.actor.alive) b.pos.set(b.actor.pos.x, b.actor.pos.y + 1, b.actor.pos.z);
    b.pulse -= dt;
    if (b.pulse <= 0) {
      b.pulse = 0.09;
      g.particles.burst(b.pos.x, b.pos.y, b.pos.z, 3, 0xff5fb0, 2.2, 0.16, 0.35, { glow: true, grav: 0 });
    }
    if (b.t <= 0) {
      g.bombs.splice(i, 1);
      g.explode(b.pos, 3.9, 140, 'player', { heavy: true, blockDmg: 15, color: 0xff5fb0, weapon: 'Killer Queen' });
    }
  }
  // fogo
  if (dt > 0 && g.burning.size) {
    burnT -= dt;
    if (burnT <= 0) {
      burnT = 0.4;
      for (const idx of Array.from(g.burning.keys())) {
        const k = g.world.kindArr[idx];
        if (!k) {
          g.burning.delete(idx);
          continue;
        }
        const x = idx % W;
        const z = Math.floor(idx / W) % D;
        const y = Math.floor(idx / W_D);
        g.particles.spawn({ x: x + 0.5 + (Math.random() - 0.5) * 0.6, y: y + 1, z: z + 0.5 + (Math.random() - 0.5) * 0.6, vy: 2 + Math.random() * 2, size: 0.4, color: Math.random() < 0.5 ? 0xff7a1a : 0xffd34a, life: 0.7, grav: -1, glow: true, grow: -0.5 });
        g.particles.spawn({ x: x + 0.5, y: y + 1.2, z: z + 0.5, vy: 1.5, size: 0.5, color: 0x333333, life: 1.1, grav: -1, grow: 1 });
        g.world.damage(idx, 1, false, { x: 0, y: 2, z: 0 });
        if (g.world.kindArr[idx] && Math.random() < 0.35) {
          const offs = [1, -1, W, -W, W_D, -W_D];
          const n = idx + offs[Math.floor(Math.random() * 6)];
          if (n >= 0 && n < W_D * 22) g.ignite(n);
        }
      }
    }
  }
  // giro do monociclo
  if (p.spinT > 0 && dt > 0) {
    for (const a of g.actors) {
      if (!a.alive || p.spinHit.has(a)) continue;
      const rx = a.pos.x - p.pos.x;
      const rz = a.pos.z - p.pos.z;
      const d = Math.hypot(rx, rz);
      if (d < 3.5) {
        p.spinHit.add(a);
        g.damageActor(a, 200, { by: 'player', weapon: 'Giro do Monociclo' });
        a.vel.x += (rx / (d || 1)) * 10;
        a.vel.z += (rz / (d || 1)) * 10;
        a.vel.y = 5;
        a.stunT = 0.6;
        g.hitMarker();
      }
    }
    for (let k = 0; k < 2; k++) {
      const an = g.time * 20 + k * Math.PI;
      g.particles.spawn({ x: p.pos.x + Math.cos(an) * 3, y: p.pos.y + 1, z: p.pos.z + Math.sin(an) * 3, size: 0.2, color: 0xc084fc, life: 0.25, grav: 0, glow: true });
    }
  }
}

export function disposeEffects(g: Game) {
  g.rifts.forEach((r) => {
    g.scene.remove(r.mesh);
    disposeGroup(r.mesh);
  });
  g.rifts = [];
  burnT = 0;
  ROCKET_GEO.dispose();
  ROCKET_MAT.dispose();
}
