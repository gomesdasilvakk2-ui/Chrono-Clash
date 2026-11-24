import type { RefObject } from 'react';
import type { HudState } from '../game/engine';
import { QUALITY_LIST } from '../game/graphics';
import type { QualityLevel } from '../game/graphics';
import { WEAPONS, TRUTH, TRUTH_POWERS } from '../game/weapons';
import { cn } from '../utils/cn';

export interface FeedItem {
  id: number;
  text: string;
  tone: 'kill' | 'bad' | 'info' | 'good';
}
export interface Ann {
  id: number;
  text: string;
  color: string;
}

const WORMHOLE_W = { ...WEAPONS[19], name: 'BURACO DE MINHOCA', icon: '🌀', color: '#c4b5fd', desc: 'Atravesse o portal para chegar ao Local Sagrado e receber A VERDADE.' };

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 30);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
};

interface Props {
  hud: HudState;
  feed: FeedItem[];
  ann: Ann | null;
  radarRef: RefObject<HTMLCanvasElement | null>;
  onResume: () => void;
  onExit: () => void;
  onRewind: () => void;
  onMute: () => void;
  onQuality: (q: QualityLevel) => void;
  compact: boolean;
}

const toneCls: Record<FeedItem['tone'], string> = {
  kill: 'border-emerald-400 bg-emerald-950/70 text-emerald-100',
  bad: 'border-red-500 bg-red-950/75 text-red-100',
  info: 'border-sky-400 bg-slate-900/75 text-sky-100',
  good: 'border-amber-400 bg-amber-950/70 text-amber-100',
};

export default function Hud({ hud, feed, ann, radarRef, onResume, onExit, onRewind, onMute, onQuality, compact }: Props) {
  const w = hud.truth ? TRUTH : hud.wormhole && hud.level === 20 ? WORMHOLE_W : WEAPONS[hud.level - 1];
  const marked = hud.markedT > 0;
  const nuking = hud.nukeCount >= 0 && hud.phase === 'nuke';
  const rewinding = hud.phase === 'rewinding';
  const scope = !hud.truth && hud.level === 6 && hud.zoom > 0.55;
  const victory = hud.phase === 'ended' && hud.nukeT > 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden font-body text-white">
      {/* SVG do rewind */}
      <svg className="absolute h-0 w-0">
        <filter id="rgbsplit" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx="-6" dy="0" result="ro" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx="6" dy="0" result="bo" />
          <feBlend in="ro" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="bo" mode="screen" />
        </filter>
      </svg>

      {/* vinhetas */}
      <div style={{ opacity: 'var(--hurt)' as unknown as number }} className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(255,0,0,0.7)_100%)]" />
      {marked && <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,30,30,0.55)_100%)]" />}
      {nuking && <div className="nuke-pulse absolute inset-0 bg-red-600" />}
      {hud.timeStop > 0 && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.0)_30%,rgba(250,204,21,0.35)_100%)]" />}

      {/* mira */}
      {!hud.dead && hud.phase !== 'ended' && !rewinding && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_#000]" />
            {[0, 90, 180, 270].map((a) => (
              <div key={a} className="absolute left-1/2 top-1/2 h-2 w-0.5 origin-bottom bg-white/70" style={{ transform: `translate(-50%,-100%) rotate(${a}deg) translateY(-6px)` }} />
            ))}
            <div style={{ opacity: 'var(--hit)' as unknown as number }} className="absolute inset-[-6px]">
              {[45, 135, 225, 315].map((a) => (
                <div key={a} className="absolute left-1/2 top-1/2 h-3 w-[3px] origin-bottom bg-red-500" style={{ transform: `translate(-50%,-100%) rotate(${a}deg) translateY(-8px)` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      {scope && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_22%,#000_23%)]">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-black/80" />
          <div className="absolute bottom-0 left-1/2 top-0 w-px bg-black/80" />
        </div>
      )}

      {/* topo: escada de evolução */}
      {hud.phase !== 'rewinding' && !victory && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div className={cn('flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur', hud.truth && 'hidden')}>
            {WEAPONS.map((x, i) => (
              <div
                key={x.id}
                className={cn('h-2.5 w-2.5 rounded-sm transition-all', i + 1 < hud.level && 'opacity-90', i + 1 === hud.level && 'h-4 w-4 animate-pulse ring-2 ring-white', i + 1 > hud.level && 'bg-white/15')}
                style={i + 1 <= hud.level ? { background: x.color } : undefined}
              />
            ))}
          </div>
          <div className={cn('rounded-full bg-black/55 px-4 py-1 font-display text-sm tracking-wide backdrop-blur', compact && 'px-3 py-0.5 text-[11px]')}>
            {hud.truth ? '👁 MODO VERDADE · ' : `NÍVEL ${hud.level}/20 · `}
            <span style={{ color: w.color }}>{w.name}</span>
          </div>
          <div className={cn('flex gap-3 text-xs font-semibold text-white/80', compact && 'hidden')}>
            <span>🎯 Abates: {hud.kills}</span>
            <span>🤖 Bots: {hud.botsAlive}/{hud.botsTotal}</span>
            <span>⏱ {fmt(hud.matchTime).slice(0, 5)}</span>
            {hud.training && <span className="text-fuchsia-300">🧪 Treino: N/B troca arma</span>}
          </div>
        </div>
      )}

      {/* nuke */}
      {nuking && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 text-center', compact ? 'top-14' : 'top-28')}>
          <div className="font-display text-xl text-red-400 drop-shadow-[0_0_12px_rgba(255,0,0,0.9)]">☢ BOMBA NUCLEAR ☢</div>
          <div key={Math.ceil(hud.nukeCount)} className={cn('count-bump font-display text-red-500 drop-shadow-[0_0_24px_rgba(255,0,0,1)]', compact ? 'text-6xl' : 'text-8xl')}>
            {Math.max(0, Math.ceil(hud.nukeCount))}
          </div>
          <div className="text-sm font-bold text-red-200">Sirene ativa. O mapa inteiro será vaporizado.</div>
        </div>
      )}

      {/* time stop */}
      {hud.timeStop > 0 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full border-2 border-yellow-300 bg-black/60 px-5 py-1 font-display text-2xl text-yellow-300">
          ⏱ THE WORLD {hud.timeStop.toFixed(1)}s
        </div>
      )}

      {/* feed */}
      <div className={cn('absolute left-3 top-3 flex flex-col gap-1', compact ? 'w-[210px]' : 'w-[340px]')}>
        {!victory && feed.slice(compact ? -3 : -6).map((f) => (
          <div key={f.id} className={cn('feed-in rounded-md border-l-4 px-3 py-1 text-sm font-semibold backdrop-blur', compact && 'px-2 py-0.5 text-[11px] leading-tight', toneCls[f.tone])}>
            {f.text}
          </div>
        ))}
      </div>

      {/* radar */}
      <div className="absolute right-3 top-3 flex flex-col items-center gap-1">
        <canvas ref={radarRef} width={170} height={170} className={cn('rounded-full shadow-[0_0_20px_rgba(0,0,0,0.6)]', compact && 'h-24 w-24')} />
        <div className="rounded-full bg-black/55 px-3 py-0.5 text-xs font-bold tracking-wider text-white/85">{hud.mapName.toUpperCase()}</div>
        <div className={cn('flex gap-2 text-[10px] text-white/70', compact && 'hidden')}>
          <span><span className="text-red-400">●</span> bots</span>
          <span><span className="text-green-300">●</span> civis</span>
          <span><span className="text-yellow-300">■</span> veículos</span>
        </div>
      </div>

      {/* esquerda embaixo: vida e carma */}
      {!victory && !compact && (
      <div className="absolute bottom-3 left-3 w-[clamp(210px,24vw,300px)]">
        <div className="rounded-xl bg-black/55 p-2.5 backdrop-blur">
          <div className="mb-1 flex justify-between text-xs font-bold">
            <span>❤ VIDA</span>
            <span>{hud.hp}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/15">
            <div className={cn('h-full rounded-full transition-all', hud.hp > 50 ? 'bg-emerald-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${hud.hp}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={cn('font-bold', marked ? 'text-red-400' : 'text-emerald-300')}>⚖ CARMA: {marked ? 'NEGATIVO' : 'LIMPO'}</span>
            <span className="text-white/70">Civis mortos: {hud.civKills} · Seq. {hud.civStreak}/3</span>
          </div>
        </div>
        {marked && (
          <div className="mt-2 animate-pulse rounded-xl border-2 border-red-500 bg-red-950/80 px-3 py-2">
            <div className="font-display text-sm text-red-300">☠ MARCADO PARA MORRER · {Math.ceil(hud.markedT)}s</div>
            <div className="text-xs text-red-100/90">Bots te veem pelas paredes · −50% velocidade · sem veículos</div>
          </div>
        )}
      </div>
      )}

      {/* centro embaixo: arma */}
      {!rewinding && !victory && !compact && (
        <div className="absolute bottom-3 left-1/2 w-[clamp(270px,36vw,440px)] -translate-x-1/2">
          {hud.nearVehicle && !hud.vehicle && (
            <div className="mb-2 text-center">
              <span className={cn('inline-block rounded-full px-4 py-1 text-sm font-bold', marked ? 'bg-red-900/80 text-red-200' : 'bg-yellow-400 text-black')}>
                {marked ? '🚫 Karma negativo: sem veículos' : `[E] Montar ${hud.nearVehicle}`}
              </span>
            </div>
          )}
          {hud.vehicle && (
            <div className="mb-2 rounded-xl border border-yellow-300/60 bg-black/60 px-3 py-1.5 text-center text-xs backdrop-blur">
              <span className="font-display text-sm text-yellow-300">
                {hud.vehicle.emoji} {hud.vehicle.name}
              </span>{' '}
              · [E] descer · {hud.vehicle.special}
            </div>
          )}
          <div className="rounded-2xl border border-white/15 bg-black/60 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="text-4xl drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{w.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base" style={{ color: w.color }}>
                  {w.name}
                </div>
                <div className="text-xs leading-tight text-white/75">{w.desc}</div>
                {w.alt && <div className="text-[11px] font-semibold text-sky-300">{w.alt}</div>}
                {!hud.canShoot && <div className="text-[11px] font-bold text-orange-300">⚠ Mãos ocupadas no veículo</div>}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/15">
              <div className="h-full rounded" style={{ width: `${hud.cd * 100}%`, background: w.color }} />
            </div>
            {hud.chargeLabel && (
              <div className="mt-2">
                <div className="mb-0.5 text-[11px] font-bold tracking-wider text-yellow-200">{hud.chargeLabel}</div>
                <div className="h-2 overflow-hidden rounded bg-white/15">
                  <div className="h-full rounded bg-gradient-to-r from-yellow-300 to-orange-500" style={{ width: `${hud.charge * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {compact && !rewinding && !victory && (
        <div className="absolute bottom-2 left-1/2 w-[190px] -translate-x-1/2">
          {hud.nearVehicle && !hud.vehicle && (
            <div className="mb-1 text-center text-[11px] font-bold">
              <span className={cn('inline-block rounded-full px-3 py-0.5', marked ? 'bg-red-900/80 text-red-200' : 'bg-yellow-400 text-black')}>
                {marked ? '🚫 sem veículos' : `Toque no botão amarelo: ${hud.nearVehicle}`}
              </span>
            </div>
          )}
          {hud.vehicle && (
            <div className="mb-1 text-center font-display text-[11px] text-yellow-300">
              {hud.vehicle.emoji} {hud.vehicle.name}
            </div>
          )}
          <div className="rounded-xl border border-white/15 bg-black/60 px-2.5 py-1.5 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{w.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[11px]" style={{ color: w.color }}>
                  {w.name}
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/15">
                  <div className="h-full" style={{ width: `${hud.cd * 100}%`, background: w.color }} />
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold">
              <span>❤</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className={cn('h-full rounded-full', hud.hp > 50 ? 'bg-emerald-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${hud.hp}%` }} />
              </div>
              <span>{hud.hp}</span>
            </div>
            {hud.chargeLabel && (
              <div className="mt-1">
                <div className="text-[9px] font-bold tracking-wider text-yellow-200">{hud.chargeLabel}</div>
                <div className="h-1.5 overflow-hidden rounded bg-white/15">
                  <div className="h-full rounded bg-gradient-to-r from-yellow-300 to-orange-500" style={{ width: `${hud.charge * 100}%` }} />
                </div>
              </div>
            )}
            {marked && <div className="mt-1 animate-pulse text-center font-display text-[10px] text-red-300">☠ MARCADO PARA MORRER {Math.ceil(hud.markedT)}s</div>}
            {!hud.canShoot && <div className="text-center text-[10px] font-bold text-orange-300">⚠ Mãos ocupadas</div>}
          </div>
        </div>
      )}

      {/* direita embaixo: dicas */}
      <div className="absolute bottom-3 right-3 hidden w-[230px] rounded-xl bg-black/45 p-2.5 text-[11px] leading-snug text-white/80 backdrop-blur xl:block">
        <div className="mb-1 font-display text-xs text-white">CONTROLES</div>
        <div>WASD mover · Shift correr · Espaço pular</div>
        <div>Mouse/F atirar · Botão dir./Q habilidade</div>
        <div>E montar/descer · R rebobinar · M som</div>
        <div>Setas ←↑↓→ também miram · Esc libera mouse</div>
      </div>

      {/* buraco de minhoca / altar */}
      {hud.wormhole && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 text-center', compact ? 'top-[74px]' : 'top-[96px]')}>
          <div className="inline-flex animate-pulse items-center gap-3 rounded-full border-2 border-violet-300 bg-violet-950/80 px-4 py-1.5 font-display text-sm text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.9)]">
            <span style={{ display: 'inline-block', transform: `rotate(${hud.wormhole.ang}rad)` }} className="text-xl text-amber-200">
              ▲
            </span>
            🌀 ENTRE NO BURACO DE MINHOCA · {Math.round(hud.wormhole.dist)}m
          </div>
        </div>
      )}
      {hud.altar >= 0 && hud.phase !== 'intro' && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 text-center', compact ? 'top-[74px]' : 'top-[96px]')}>
          <div className="inline-flex animate-pulse items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-950/80 px-4 py-1.5 font-display text-sm text-amber-100 shadow-[0_0_24px_rgba(253,230,138,0.8)]">
            ✨ Suba os degraus até o altar · A VERDADE espera · {Math.round(hud.altar)}m
          </div>
        </div>
      )}
      {hud.truth && !rewinding && !victory && (
        <div className={cn('absolute left-1/2 flex -translate-x-1/2 gap-1.5', compact ? 'bottom-[104px]' : 'bottom-[158px]')}>
          {TRUTH_POWERS.map((pw, i) => {
            const cd = hud.truthCds[i] ?? 0;
            const sel = hud.truthPower === i;
            return (
              <div key={pw.name} className={cn('relative overflow-hidden rounded-xl border px-2.5 py-1 text-center backdrop-blur', sel ? 'border-amber-200 bg-amber-300/25 shadow-[0_0_14px_rgba(253,230,138,0.7)]' : 'border-white/20 bg-black/55')}>
                <div className={compact ? 'text-base' : 'text-xl'}>{pw.icon}</div>
                {!compact && (
                  <div className="text-[9px] font-bold tracking-wide text-white/85">
                    {i + 1} · {pw.name}
                  </div>
                )}
                {cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/65" style={{ height: `${Math.min(100, (cd / pw.cd) * 100)}%` }} />}
                {cd > 0 && <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black">{Math.ceil(cd)}</div>}
              </div>
            );
          })}
          {hud.gravMode !== 0 && <div className="self-center rounded-full bg-indigo-900/80 px-2 py-0.5 text-[10px] font-bold text-indigo-100">{hud.gravMode === 1 ? '🌙 lunar' : '🙃 invertida'}</div>}
        </div>
      )}

      {/* anúncio */}
      {ann && (
        <div key={ann.id} className={cn('ann-pop absolute left-1/2 top-[30%] -translate-x-1/2 whitespace-nowrap text-center font-display drop-shadow-[0_3px_0_rgba(0,0,0,0.8)]', compact ? 'top-[24%] text-2xl' : 'text-4xl md:text-5xl')} style={{ color: ann.color, textShadow: `0 0 24px ${ann.color}, 3px 3px 0 #000` }}>
          {ann.text}
        </div>
      )}

      {/* banner de captura de mouse */}
      {!compact && !hud.locked && !hud.lockFailed && !hud.paused && hud.phase !== 'rewinding' && hud.phase !== 'ended' && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-full bg-black/70 px-5 py-2 text-sm font-bold text-white">🖱️ Clique na tela para capturar o mouse e jogar</div>
      )}
      {!compact && hud.lockFailed && !hud.locked && hud.phase === 'intro' && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-xl bg-black/70 px-5 py-2 text-center text-sm font-semibold text-white">
          Captura de mouse indisponível neste ambiente.
          <br />
          Mire com as setas ← ↑ ↓ →, atire com F ou clique, habilidade com Q.
        </div>
      )}

      {/* intro */}
      {hud.phase === 'intro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25">
          <div className="font-display text-lg tracking-widest text-white/80">{hud.mapName.toUpperCase()}</div>
          <div key={Math.ceil(hud.introT)} className={cn('count-bump font-display text-white drop-shadow-[0_0_30px_rgba(34,230,255,0.9)]', compact ? 'text-7xl' : 'text-9xl')}>
            {Math.max(1, Math.ceil(hud.introT))}
          </div>
          <div className={cn('mt-2 rounded-full bg-black/60 px-5 py-1 text-sm font-bold text-yellow-300', compact && 'mx-6 px-3 text-center text-[11px]')}>{hud.truth ? 'Modo Verdade: raio + 4 poderes (teclas 1-4 / C, botão dir./Q usa)' : hud.altar >= 0 ? 'Local Sagrado: suba os degraus até o altar e receba A VERDADE' : hud.conquered >= 3 ? 'Nível 20 abre o BURACO DE MINHOCA (3 mapas conquistados)' : `Cada abate evolui sua arma · nível 20 = BOMBA NUCLEAR · mapas conquistados: ${hud.conquered}/3`}</div>
        </div>
      )}

      {/* morto */}
      {hud.dead && hud.phase !== 'ended' && hud.phase !== 'rewinding' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/50">
          <div className="font-display text-4xl text-red-400 drop-shadow-[0_0_20px_rgba(255,0,0,0.9)] md:text-6xl">VOCÊ MORREU</div>
          <div className="mt-2 text-lg font-bold">Renascendo em {Math.max(0, Math.ceil(hud.respawnT))}s…</div>
        </div>
      )}

      {/* flash branco */}
      <div style={{ opacity: 'var(--flash)' as unknown as number }} className="absolute inset-0 bg-white" />

      {/* vitória nuclear */}
      {victory && (
        <>
          <div className="absolute inset-x-0 top-[6%] flex justify-center px-4">
            <div className="text-center font-display text-4xl text-amber-300 drop-shadow-[0_0_30px_rgba(255,120,0,1)] md:text-6xl">☢ VITÓRIA NUCLEAR ☢</div>
          </div>
          <div className="absolute inset-x-0 bottom-[5%] flex justify-center px-4">
            <div className="rounded-2xl bg-black/65 px-6 py-3 text-center backdrop-blur">
              <div className="text-lg font-bold">
                Abates: {hud.kills} · Civis mortos: {hud.civKills} · Tempo: {fmt(hud.matchTime).slice(0, 5)}
              </div>
              <div className="text-sm text-white/80">O mapa foi vaporizado e a partida terminou. O tempo vai voltar atrás…</div>
              <button onClick={onRewind} className="pointer-events-auto mt-3 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-2 font-display text-sm text-black transition hover:scale-105">
                ⏪ REBOBINAR O TEMPO (R)
              </button>
            </div>
          </div>
        </>
      )}

      {/* rewind VHS */}
      {rewinding && (
        <div className="absolute inset-0">
          <div className="vhs-scanlines absolute inset-0" />
          <div className="vhs-noise absolute inset-0 opacity-[0.16] mix-blend-screen" />
          <div className="absolute inset-0 bg-cyan-400/10 mix-blend-overlay" />
          <div className="vhs-bar absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,30,0.65)_100%)]" />
          <div className="absolute left-8 top-8 flex items-center gap-3 font-display text-3xl text-white drop-shadow-[2px_0_0_rgba(255,0,80,0.9)]">
            <span className="blink text-red-500">●</span> ◀◀ REW
          </div>
          <div className="absolute right-8 top-8 font-mono text-2xl font-bold text-white drop-shadow-[2px_0_0_rgba(0,255,255,0.9)]">{fmt(hud.matchTime)}</div>
          <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
            <div className="font-display text-4xl text-white drop-shadow-[3px_0_0_rgba(255,0,100,0.9)] md:text-6xl">REVERTENDO O TEMPO</div>
            <div className="mt-2 text-sm font-bold tracking-widest text-cyan-200">Prédios se remontam · a fumaça volta para a ogiva · todos voltam ao lobby</div>
          </div>
          <div className="absolute inset-x-10 bottom-28">
            <div className="mb-1 flex justify-between font-mono text-xs text-white/80">
              <span>NÍVEL {hud.level}</span>
              <span>{Math.round(hud.rewind * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-white/20">
              <div className="h-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" style={{ width: `${hud.rewind * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* pausa */}
      {hud.paused && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/65 backdrop-blur-sm">
          <div className="font-display text-5xl">PAUSADO</div>
          <div className="text-white/70">{compact ? 'Jogo em pausa.' : 'O mouse foi liberado (Esc).'}</div>
          <div className="flex flex-wrap justify-center gap-3 px-4">
            <button onClick={onResume} className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-3 font-display text-black transition hover:scale-105">
              ▶ CONTINUAR
            </button>
            <button onClick={onRewind} className="rounded-full border border-white/30 bg-white/10 px-6 py-3 font-display transition hover:bg-white/20">
              ⏪ REBOBINAR
            </button>
            <button onClick={onExit} className="rounded-full border border-white/30 bg-white/10 px-6 py-3 font-display transition hover:bg-white/20">
              ⌂ MENU
            </button>
            <button onClick={onMute} className="rounded-full border border-white/30 bg-white/10 px-6 py-3 font-display transition hover:bg-white/20">
              {hud.muted ? '🔇 SOM OFF' : '🔊 SOM ON'}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-1.5">
            <span className="text-xs font-bold tracking-wider text-white/70">GRÁFICOS:</span>
            {QUALITY_LIST.map((q) => (
              <button
                key={q.id}
                onClick={() => onQuality(q.id)}
                className={cn(
                  'rounded-full px-3 py-1 font-display text-xs transition',
                  hud.quality === q.id ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20',
                )}
              >
                {q.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
