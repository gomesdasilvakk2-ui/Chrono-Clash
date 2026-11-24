import { useState } from 'react';
import Menu from './components/Menu';
import GameView from './components/GameView';
import type { GameOptions } from './game/engine';

export default function App() {
  const [opts, setOpts] = useState<GameOptions | null>(null);
  return (
    <div className="h-full w-full">
      {opts ? <GameView key={`${opts.mapId}-${opts.difficulty}-${opts.training}-${opts.touch}`} opts={opts} onExit={() => setOpts(null)} onWormhole={() => setOpts((o) => (o ? { ...o, mapId: 'santuario', truth: false } : o))} /> : <Menu onStart={setOpts} />}
    </div>
  );
}
