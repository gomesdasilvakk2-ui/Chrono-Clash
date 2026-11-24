import { useEffect, useRef } from 'react';
import type { PointerEvent as RPointerEvent, ReactNode } from 'react';
import type { Game, HudState } from '../game/engine';
import { WEAPONS } from '../game/weapons';
import { cn } from '../utils/cn';

interface Props {
  getGame: () => Game | null;
  hud: HudState;
}

const R = 56; // raio do joystick

function HoldBtn({
  className,
  onDown,
  onUp,
  onDrag,
  children,
}: {
  className: string;
  onDown: () => void;
  onUp: () => void;
  onDrag?: (dx: number, dy: number) => void;
  children: ReactNode;
}) {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  const end = () => {
    if (last.current) {
      last.current = null;
      onUp();
    }
  };
  return (
    <div
      className={cn('pointer-events-auto fixed flex touch-none select-none flex-col items-center justify-center rounded-full border-2 border-white/60 font-display text-white backdrop-blur-[2px] transition-transform active:scale-90 active:brightness-150', className)}
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        onDown();
      }}
      onPointerMove={(e) => {
        const l = last.current;
        if (l && l.id === e.pointerId && onDrag) {
          onDrag(e.clientX - l.x, e.clientY - l.y);
          l.x = e.clientX;
          l.y = e.clientY;
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {children}
    </div>
  );
}

export default function TouchControls({ getGame, hud }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const joy = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);

  const homePos = () => ({ x: 28 + R + 8, y: window.innerHeight - 40 - R - 8 });
  const placeBase = (x: number, y: number, active: boolean) => {
    const b = baseRef.current;
    if (!b) return;
    b.style.transform = `translate(${x - R - 8}px, ${y - R - 8}px)`;
    b.style.opacity = active ? '1' : '0.35';
  };

  useEffect(() => {
    const home = () => {
      if (!joy.current) {
        const h = homePos();
        placeBase(h.x, h.y, false);
      }
    };
    home();
    window.addEventListener('resize', home);
    return () => window.removeEventListener('resize', home);
  });

  const stopJoy = () => {
    const g = getGame();
    joy.current = null;
    if (g) {
      g.touchMove.x = 0;
      g.touchMove.y = 0;
    }
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px,0px)';
    const h = homePos();
    placeBase(h.x, h.y, false);
  };

  const g = getGame();
  const active = (hud.phase === 'intro' || hud.phase === 'playing' || hud.phase === 'nuke') && !hud.paused;
  if (!g || !active) return null;
  const w = WEAPONS[hud.level - 1];
  const canVehicle = !!hud.nearVehicle || !!hud.vehicle;
  const changeLevel = (d: number) => g.setLevel(g.player.level + d, 'treino');

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      {/* zona de olhar (metade direita) */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-full w-[56%] touch-none"
        style={{ touchAction: 'none' }}
        onPointerDown={(e: RPointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          g.sfx.init();
          if (look.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const l = look.current;
          if (!l || l.id !== e.pointerId) return;
          g.addLook(e.clientX - l.x, e.clientY - l.y);
          l.x = e.clientX;
          l.y = e.clientY;
        }}
        onPointerUp={(e) => {
          if (look.current?.id === e.pointerId) look.current = null;
        }}
        onPointerCancel={(e) => {
          if (look.current?.id === e.pointerId) look.current = null;
        }}
      />

      {/* zona do joystick (esquerda) */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-[78%] w-[44%] touch-none"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault();
          g.sfx.init();
          if (joy.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          joy.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
          placeBase(e.clientX, e.clientY, true);
        }}
        onPointerMove={(e) => {
          const j = joy.current;
          if (!j || j.id !== e.pointerId) return;
          const dx = e.clientX - j.ox;
          const dy = e.clientY - j.oy;
          const l = Math.hypot(dx, dy);
          const c = Math.min(l, R);
          const nx = l > 0 ? (dx / l) * c : 0;
          const ny = l > 0 ? (dy / l) * c : 0;
          if (knobRef.current) knobRef.current.style.transform = `translate(${nx}px,${ny}px)`;
          let vx = nx / R;
          let vy = -ny / R;
          const m = Math.hypot(vx, vy);
          if (m < 0.12) {
            vx = 0;
            vy = 0;
          } else {
            const k = (m - 0.12) / 0.88 / m;
            vx *= k;
            vy *= k;
          }
          g.touchMove.x = vx;
          g.touchMove.y = vy;
        }}
        onPointerUp={(e) => {
          if (joy.current?.id === e.pointerId) stopJoy();
        }}
        onPointerCancel={(e) => {
          if (joy.current?.id === e.pointerId) stopJoy();
        }}
      />
      <div ref={baseRef} className="pointer-events-none fixed left-0 top-0 h-[128px] w-[128px] rounded-full border-2 border-white/60 bg-white/10 transition-opacity" style={{ opacity: 0.35 }}>
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-white/80 bg-white/35" />
      </div>

      {/* botões de ação */}
      <HoldBtn className="bottom-5 right-5 h-24 w-24 border-red-200 bg-red-500/55 text-4xl" onDown={() => g.touchFire(true)} onUp={() => g.touchFire(false)} onDrag={(dx, dy) => g.addLook(dx, dy)}>
        <span className="drop-shadow">{w.icon}</span>
        <span className="text-[9px] tracking-widest">ATACAR</span>
      </HoldBtn>
      <HoldBtn className="bottom-7 right-[130px] h-16 w-16 border-sky-200 bg-sky-500/55 text-2xl" onDown={() => g.touchSec(true)} onUp={() => g.touchSec(false)}>
        <span>✦</span>
        <span className="text-[8px] tracking-widest">HABIL.</span>
      </HoldBtn>
      <HoldBtn
        className="bottom-[128px] right-9 h-16 w-16 border-emerald-200 bg-emerald-500/55 text-2xl"
        onDown={() => {
          g.sfx.init();
          g.touchJump = true;
        }}
        onUp={() => (g.touchJump = false)}
      >
        <span>⤒</span>
        <span className="text-[8px] tracking-widest">PULAR</span>
      </HoldBtn>
      {canVehicle && (
        <HoldBtn className="bottom-[112px] right-[122px] h-[60px] w-[60px] animate-pulse border-yellow-200 bg-yellow-400/70 text-2xl text-black" onDown={() => g.toggleVehicle()} onUp={() => undefined}>
          <span>{hud.vehicle ? '⬇' : '⬆'}</span>
          <span className="text-[8px] font-bold tracking-widest">{hud.vehicle ? 'DESCER' : 'MONTAR'}</span>
        </HoldBtn>
      )}

      {hud.truth && (
        <HoldBtn className="bottom-[34px] right-[206px] h-[52px] w-[52px] border-amber-200 bg-amber-400/60 text-xl text-black" onDown={() => g.cyclePower()} onUp={() => undefined}>
          <span>⟳</span>
          <span className="text-[7px] font-bold tracking-widest">PODER</span>
        </HoldBtn>
      )}

      {/* pausa */}
      <HoldBtn className="right-3 top-[138px] h-10 w-10 border-white/40 bg-black/50 text-lg" onDown={() => g.setUserPaused(true)} onUp={() => undefined}>
        ⏸
      </HoldBtn>

      {/* modo treino: trocar nível */}
      {hud.training && (
        <>
          <HoldBtn className="left-1/2 top-3 h-9 w-9 -translate-x-[215px] border-fuchsia-300 bg-fuchsia-600/60 text-lg" onDown={() => changeLevel(-1)} onUp={() => undefined}>
            −
          </HoldBtn>
          <HoldBtn className="left-1/2 top-3 h-9 w-9 translate-x-[180px] border-fuchsia-300 bg-fuchsia-600/60 text-lg" onDown={() => changeLevel(1)} onUp={() => undefined}>
            +
          </HoldBtn>
        </>
      )}
    </div>
  );
}
