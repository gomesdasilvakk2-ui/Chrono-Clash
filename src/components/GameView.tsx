import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { GameOptions, HudState } from '../game/engine';
import Hud from './Hud';
import TouchControls from './TouchControls';
import type { Ann, FeedItem } from './Hud';
import { cn } from '../utils/cn';

interface Props {
  opts: GameOptions;
  onExit: () => void;
  onWormhole: () => void;
}

export default function GameView({ opts, onExit, onWormhole }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [ann, setAnn] = useState<Ann | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const idRef = useRef(1);
  const touch = opts.touch;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let game: Game | null = null;
    let annTimer: number | undefined;
    const timers: number[] = [];
    try {
      game = new Game(root, radarRef.current, opts, {
        onHud: (h) => setHud(h),
        onWormhole: () => onWormhole(),
        onFeed: (text, tone) => {
          const id = idRef.current++;
          setFeed((f) => [...f.slice(-5), { id, text, tone }]);
          timers.push(window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 6500));
        },
        onAnnounce: (text, color, ms = 1800) => {
          const id = idRef.current++;
          setAnn({ id, text, color });
          window.clearTimeout(annTimer);
          annTimer = window.setTimeout(() => setAnn((a) => (a && a.id === id ? null : a)), ms);
        },
      });
      gameRef.current = game;
      if (location.search.includes('debug')) (window as unknown as { __game?: Game }).__game = game;
      if (!opts.touch) game.requestLock();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      window.clearTimeout(annTimer);
      timers.forEach((t) => window.clearTimeout(t));
      game?.dispose();
      gameRef.current = null;
    };
  }, [opts]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.radar = radarRef.current;
  }, [hud]);

  useEffect(() => {
    if (!touch) return;
    const mq = window.matchMedia('(orientation: portrait)');
    const upd = () => setPortrait(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, [touch]);

  useEffect(() => {
    gameRef.current?.setAutoPaused(touch && portrait);
  }, [portrait, touch]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-black p-8 text-center">
        <div className="font-display text-3xl text-red-400">Não foi possível iniciar o jogo</div>
        <div className="max-w-xl text-white/70">Seu navegador precisa de WebGL ativado. Detalhe: {error}</div>
        <button onClick={onExit} className="rounded-full bg-white px-6 py-2 font-display text-black">
          Voltar ao menu
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('fixed inset-0 touch-none select-none overflow-hidden bg-black', hud?.phase === 'rewinding' && 'fx-rewind', hud && hud.timeStop > 0 && 'fx-timestop')}>
      {hud && (
        <Hud
          hud={hud}
          feed={feed}
          ann={ann}
          radarRef={radarRef}
          compact={touch}
          onMute={() => gameRef.current?.toggleMute()}
          onResume={() => (touch ? gameRef.current?.setUserPaused(false) : gameRef.current?.requestLock())}
          onExit={onExit}
          onRewind={() => gameRef.current?.startRewind()}
        />
      )}
      {touch && hud && <TouchControls getGame={() => gameRef.current} hud={hud} />}
      {touch && portrait && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/95 p-8 text-center">
          <div className="text-7xl">📱↻</div>
          <div className="font-display text-2xl">GIRE O CELULAR</div>
          <div className="max-w-xs text-white/70">O Chrono Clash é jogado na horizontal (modo paisagem). Gire o aparelho para continuar.</div>
          <button onClick={onExit} className="rounded-full border border-white/30 bg-white/10 px-6 py-2 font-display text-sm">
            ⌂ VOLTAR AO MENU
          </button>
        </div>
      )}
    </div>
  );
}
