import { useState } from 'react';
import { MAPS } from '../game/maps';
import type { MapDef } from '../game/maps';
import { WEAPONS, TRUTH, TRUTH_POWERS } from '../game/weapons';
import { loadProgress, resetProgress, NEEDED } from '../game/progress';
import { VEHICLES } from '../game/vehicles';
import type { GameOptions, Difficulty } from '../game/engine';
import { cn } from '../utils/cn';

const VISIBLE = MAPS.filter((m) => !m.hidden);

const detectTouch = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !window.matchMedia('(any-pointer: fine)').matches);
};

const enterMobileMode = () => {
  try {
    const el = document.documentElement;
    const req = el.requestFullscreen?.bind(el) ?? (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el);
    const p = req?.() as Promise<void> | undefined;
    p?.then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => undefined);
  } catch {
    /* ignore */
  }
};

type Tab = 'play' | 'arsenal' | 'rules' | 'vehicles' | 'controls';

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: '🎮 JOGAR' },
  { id: 'arsenal', label: '🔫 ARSENAL (20)' },
  { id: 'rules', label: '⚖ REGRAS & CARMA' },
  { id: 'vehicles', label: '🛹 VEÍCULOS' },
  { id: 'controls', label: '⌨ CONTROLES' },
];

const hex = (n?: number) => (n === undefined ? 'transparent' : '#' + n.toString(16).padStart(6, '0'));

function MiniFigure({ o }: { o: MapDef['civs'][number] }) {
  const skin = o.skin ? o.skin[0] : 0xe0ac69;
  return (
    <div className="flex w-9 flex-col items-center">
      <div className="relative h-3.5 w-3.5 rounded-[2px]" style={{ background: hex(skin) }}>
        {o.hat && o.hat !== 'none' && <div className="absolute -top-1.5 -left-0.5 h-2 w-4.5 rounded-sm" style={{ background: hex(o.hatColor ?? 0x222222), width: 18 }} />}
        {o.goggles && <div className="absolute top-1 left-0 h-1 w-3.5 bg-sky-400" />}
      </div>
      <div className="relative mt-px h-6 w-6 rounded-[2px]" style={{ background: hex(o.coat ?? o.shirt) }}>
        {o.stripe !== undefined && <div className="absolute inset-x-0 top-2 h-0.5" style={{ background: hex(o.stripe) }} />}
        {o.vest !== undefined && <div className="absolute inset-x-1 top-1 bottom-1" style={{ background: hex(o.vest) }} />}
        {o.tie !== undefined && <div className="absolute left-2.5 top-0 h-4 w-1" style={{ background: hex(o.tie) }} />}
      </div>
      <div className="mt-px flex gap-px">
        <div className="h-4 w-2.5" style={{ background: hex(o.shorts ? skin : o.pants) }} />
        <div className="h-4 w-2.5" style={{ background: hex(o.shorts ? skin : o.pants) }} />
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children, tone = 'sky' }: { icon: string; title: string; children: React.ReactNode; tone?: 'sky' | 'red' | 'amber' | 'fuchsia' | 'emerald' }) {
  const tones = {
    sky: 'border-sky-400/40 from-sky-500/10',
    red: 'border-red-400/40 from-red-500/10',
    amber: 'border-amber-400/40 from-amber-500/10',
    fuchsia: 'border-fuchsia-400/40 from-fuchsia-500/10',
    emerald: 'border-emerald-400/40 from-emerald-500/10',
  };
  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br to-transparent p-5', tones[tone])}>
      <div className="mb-2 flex items-center gap-2 font-display text-lg">
        <span className="text-2xl">{icon}</span> {title}
      </div>
      <div className="space-y-1.5 text-[15px] leading-snug text-white/85">{children}</div>
    </div>
  );
}

export default function Menu({ onStart }: { onStart: (o: GameOptions) => void }) {
  const [tab, setTab] = useState<Tab>('play');
  const [mapId, setMapId] = useState(MAPS[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [training, setTraining] = useState(true);
  const [touch, setTouch] = useState(detectTouch);
  const [prog, setProg] = useState(loadProgress);
  const [useTruth, setUseTruth] = useState(false);
  const map = MAPS.find((m) => m.id === mapId)!;

  return (
    <div className="menu-bg relative h-full overflow-y-auto overflow-x-hidden thin-scroll">
      <div className="grid-floor pointer-events-none fixed inset-0 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8">
        {/* título */}
        <header className="mb-6 text-center">
          <div className="mb-1 text-xs font-bold tracking-[0.5em] text-cyan-300">GUN GAME · DESTRUIÇÃO PROCEDURAL · TIME REWIND</div>
          <h1 className="glitch font-display text-5xl leading-none text-white drop-shadow-[0_0_30px_rgba(255,61,242,0.5)] md:text-7xl" data-text="CHRONO CLASH">
            CHRONO CLASH
          </h1>
          <div className="mt-2 bg-gradient-to-r from-cyan-300 via-white to-fuchsia-400 bg-clip-text font-display text-lg tracking-[0.25em] text-transparent md:text-2xl">DIMENSIONAL EVOLUTION</div>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">
            Abata bots para evoluir por 20 armas — da cenoura à bomba nuclear. Destrua prédios, cuide do seu carma com os civis, monte em cavalos e skates… e volte no tempo quando tudo acabar.
          </p>
        </header>

        {/* abas */}
        <nav className="mb-6 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-full border px-5 py-2 font-display text-xs tracking-wide transition',
                tab === t.id ? 'border-white bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.4)]' : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/15',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* JOGAR */}
        {tab === 'play' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600/20 via-fuchsia-500/10 to-amber-400/15 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-3xl">🌀</div>
                <div className="min-w-[220px] flex-1">
                  <div className="font-display text-sm">
                    CAMINHO DA VERDADE · {Math.min(prog.conquered.length, NEEDED)}/{NEEDED} mapas conquistados {prog.truth && '· 👁️ VERDADE DESBLOQUEADA'}
                  </div>
                  <div className="text-xs text-white/70">
                    Chegue ao nível 20 em {NEEDED} mapas diferentes: no terceiro, um buraco de minhoca surge no lugar da bomba e leva ao Local Sagrado, onde você recebe A VERDADE.
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: NEEDED }).map((_, i) => (
                    <div key={i} className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg', i < prog.conquered.length ? 'border-amber-300 bg-amber-400/30' : 'border-white/20 bg-white/5 opacity-60')}>
                      {i < prog.conquered.length ? '✔' : '○'}
                    </div>
                  ))}
                </div>
                {(prog.conquered.length > 0 || prog.truth) && (
                  <button
                    onClick={() => {
                      setProg(resetProgress());
                      setUseTruth(false);
                    }}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                  >
                    Reiniciar progresso
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {VISIBLE.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMapId(m.id)}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-1',
                    mapId === m.id ? 'scale-[1.02] border-white shadow-[0_0_30px_rgba(255,255,255,0.35)]' : 'border-white/10 opacity-85 hover:opacity-100',
                  )}
                >
                  <div className={cn('flex h-24 items-center justify-center bg-gradient-to-br text-5xl', m.grad)}>
                    <span className="drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] transition group-hover:scale-125">{m.emoji}</span>
                  </div>
                  <div className="bg-black/70 px-3 py-2">
                    <div className="font-display text-sm leading-tight">{m.name}</div>
                    <div className="text-[11px] leading-tight text-white/60">{m.subtitle}</div>
                  </div>
                  {mapId === m.id && <div className="absolute right-2 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-black">SELECIONADO</div>}
                  {prog.conquered.includes(m.id) && <div className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black">✔ CONQUISTADO</div>}
                </button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-white/15 bg-black/45 p-5 backdrop-blur">
                <div className="mb-3 flex items-center gap-3">
                  <div className="text-4xl">{map.emoji}</div>
                  <div>
                    <div className="font-display text-2xl" style={{ color: map.accent }}>
                      {map.name}
                    </div>
                    <div className="text-sm text-white/60">{map.subtitle}</div>
                  </div>
                </div>
                <div className="space-y-2 text-[15px] text-white/85">
                  <p>
                    <b className="text-white">🏙 Cenário:</b> {map.scenery}
                  </p>
                  <p>
                    <b className="text-white">🧱 Destruição:</b> {map.destruction}
                  </p>
                  <p>
                    <b className="text-white">👥 NPCs:</b> {map.npcs}
                  </p>
                </div>
                <div className="mt-4 text-xs font-bold tracking-widest text-white/50">CIVIS NESTE MAPA (NÃO ATIRE!)</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {map.civs.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
                      <MiniFigure o={c} />
                      <div className="text-xs leading-tight text-white/80">{c.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-white/15 bg-black/45 p-5 backdrop-blur">
                  <div className="mb-2 font-display text-sm">DIFICULDADE DOS BOTS</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['easy', 'FÁCIL', '6 bots'],
                        ['normal', 'NORMAL', '9 bots'],
                        ['insane', 'INSANO', '13 bots'],
                      ] as [Difficulty, string, string][]
                    ).map(([d, l, s]) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={cn('rounded-xl border px-2 py-2 text-center transition', difficulty === d ? 'border-white bg-white text-black' : 'border-white/20 bg-white/5 hover:bg-white/15')}
                      >
                        <div className="font-display text-xs">{l}</div>
                        <div className="text-[11px] opacity-70">{s}</div>
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3">
                    <input type="checkbox" checked={touch} onChange={(e) => setTouch(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
                    <span className="text-sm">
                      <b>📱 Controles de toque</b>
                      <br />
                      <span className="text-white/65">Joystick virtual, olhar arrastando e botões na tela — ligado automaticamente em celulares e tablets. Jogue na horizontal.</span>
                    </span>
                  </label>
                  {prog.truth && (
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3">
                      <input type="checkbox" checked={useTruth} onChange={(e) => setUseTruth(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-400" />
                      <span className="text-sm">
                        <b>👁️ Iniciar com A VERDADE</b>
                        <br />
                        <span className="text-white/65">Raio que atravessa tudo + parar o tempo, retroceder, gravidade e apagar. Sem evolução de armas.</span>
                      </span>
                    </label>
                  )}
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3">
                    <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} className="mt-1 h-4 w-4 accent-fuchsia-500" />
                    <span className="text-sm">
                      <b>🧪 Modo Treino</b>
                      <br />
                      <span className="text-white/65">Teclas N / B sobem e descem o nível da arma na hora — ótimo para testar as 20 armas e a bomba nuclear.</span>
                    </span>
                  </label>
                </div>
                <button
                  onClick={() => {
                    if (touch) enterMobileMode();
                    onStart({ mapId, difficulty, training, touch, truth: prog.truth && useTruth });
                  }}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 p-[3px] shadow-[0_0_40px_rgba(255,61,242,0.45)] transition hover:scale-[1.03]"
                >
                  <div className="rounded-[13px] bg-black/80 px-6 py-5 text-center transition group-hover:bg-black/55">
                    <div className="font-display text-3xl">▶ INICIAR PARTIDA</div>
                    <div className="text-sm text-white/70">
                      {map.emoji} {map.name} · {difficulty === 'easy' ? 'Fácil' : difficulty === 'normal' ? 'Normal' : 'Insano'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ARSENAL */}
        {tab === 'arsenal' && (
          <div className="relative mx-auto max-w-3xl">
            <div className="absolute bottom-4 left-[26px] top-4 w-1 rounded bg-gradient-to-b from-orange-400 via-fuchsia-500 to-red-600" />
            <div className="space-y-2.5">
              {WEAPONS.map((w) => (
                <div key={w.id} className="relative flex items-center gap-4">
                  <div
                    className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-[#070812] font-display text-lg text-black"
                    style={{ background: w.color }}
                  >
                    {w.id}
                  </div>
                  <div className={cn('flex-1 rounded-xl border bg-black/55 px-4 py-2.5 backdrop-blur', w.id === 20 ? 'border-red-500 shadow-[0_0_30px_rgba(255,0,0,0.35)]' : 'border-white/10')}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{w.icon}</span>
                      <span className="font-display text-base" style={{ color: w.color }}>
                        {w.name}
                      </span>
                      <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white/70">{w.cat.toUpperCase()}</span>
                    </div>
                    <div className="text-sm text-white/80">{w.desc}</div>
                    {w.alt && <div className="text-xs font-semibold text-sky-300">{w.alt}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'arsenal' && (
          <div className="mx-auto mt-4 max-w-3xl rounded-2xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-300/15 via-fuchsia-400/10 to-indigo-500/15 p-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👁️</span>
              <div>
                <div className="font-display text-xl text-amber-200">A VERDADE {prog.truth ? '— DESBLOQUEADA' : '🔒'}</div>
                <div className="text-sm text-white/75">{TRUTH.desc}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TRUTH_POWERS.map((pw, i) => (
                <div key={pw.name} className="rounded-xl bg-black/40 p-3">
                  <div className="font-display text-sm">
                    {pw.icon} {i + 1} · {pw.name}
                  </div>
                  <div className="text-xs text-white/70">{pw.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-white/60">Como obter: nível 20 em 3 mapas diferentes → entre no buraco de minhoca → pegue a arma no altar do Local Sagrado.</div>
          </div>
        )}

        {tab === 'rules' && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SectionCard icon="🎯" title="Física da Bala" tone="emerald">
              <p>
                As armas de fogo disparam <b className="text-emerald-300">projéteis reais</b>: velocidade finita, <b>queda por gravidade</b> e arrasto — mire um pouco acima em longa distância.
              </p>
              <p>
                <b className="text-emerald-300">Penetração:</b> AK-47, Kar98k e Sniper atravessam paredes finas (perdendo velocidade e dano). <b className="text-emerald-300">Ricochete:</b> tiros rasantes em concreto, metal e pedra voam em outra direção.
              </p>
              <p>Dano cai com a distância, cápsulas são ejetadas e cada tiro deixa marcas nas paredes.</p>
            </SectionCard>
            <SectionCard icon="🌀" title="Buraco de Minhoca & A Verdade" tone="fuchsia">
              <p>Conquiste o nível 20 em <b>3 mapas diferentes</b>. Na terceira vez, um buraco de minhoca aparece no lugar da bomba nuclear.</p>
              <p>Atravesse-o para chegar ao <b>Local Sagrado</b> e pegue <b className="text-amber-200">A VERDADE</b>: raio que atravessa tudo e poderes para parar o tempo, retroceder, alterar a gravidade e apagar a realidade.</p>
            </SectionCard>
          </div>
        )}

        {/* REGRAS */}
        {tab === 'rules' && (
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard icon="⚖" title="Sistema de Carma" tone="red">
              <p>Civis fogem ao ouvir tiros. Se você matar um inocente:</p>
              <p>
                <b className="text-red-300">1. Marcado para Morrer:</b> você fica destacado em vermelho através das paredes por 15 s — todos os bots sabem onde você está.
              </p>
              <p>
                <b className="text-red-300">2. Karma Negativo:</b> −50% de velocidade e nenhum veículo temporariamente.
              </p>
              <p>
                <b className="text-red-300">3. Punição Extrema:</b> matou 3 civis seguidos? Sua arma regride 1 nível.
              </p>
              <p className="text-white/60">Bots que matam civis também ficam marcados (vistos pelas paredes!).</p>
            </SectionCard>
            <SectionCard icon="🧱" title="Física de Destruição" tone="amber">
              <p>
                <b className="text-amber-300">Paredes finas</b> (madeira, tijolo, reboco, papel, gelo, telha): qualquer tiro abre buracos. <b>Sniper e AK-47 atravessam</b> e veículos as quebram.
              </p>
              <p>
                <b className="text-amber-300">Estruturas grandes</b> (concreto, pedra, metal): só Bazuca, Stands, Espada do Destino, Kamehameha, Saitama e a Manopla colapsam as fundações.
              </p>
              <p>Quando a base cede, o que estava em cima <b>desaba e soterra</b> quem estiver embaixo. Fogo espalha por madeira e papel.</p>
            </SectionCard>
            <SectionCard icon="⏳" title="Chrono-Rewind" tone="sky">
              <p>Quando a partida acaba (ou você aperta <kbd className="rounded bg-white/15 px-1.5">R</kbd>), a tela ganha filtro VHS/Glitch e o tempo anda para trás:</p>
              <p>• Prédios destruídos se remontam peça por peça.</p>
              <p>• Jogadores, civis e veículos desfazem suas trajetórias em alta velocidade.</p>
              <p>• O cogumelo da bomba volta para dentro da ogiva.</p>
              <p>• Todos voltam ao lobby no segundo exato do início da partida.</p>
            </SectionCard>
            <SectionCard icon="☢️" title="Nível 20 — Bomba Nuclear Tática" tone="fuchsia">
              <p>Ao chegar ao nível 20, a sirene toca em todo o mapa e a contagem de <b>10 segundos</b> começa. Uma ogiva despenca do céu.</p>
              <p>No zero, o mapa inteiro é vaporizado, a partida termina — e o tempo volta atrás.</p>
              <p className="text-white/60">Dica: no Modo Treino aperte N repetidamente para ver tudo isso agora.</p>
            </SectionCard>
          </div>
        )}

        {/* VEÍCULOS */}
        {tab === 'vehicles' && (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.values(VEHICLES).map((v) => (
              <div key={v.kind} className="rounded-2xl border border-yellow-300/30 bg-gradient-to-br from-yellow-400/10 to-transparent p-5">
                <div className="mb-1 flex items-center gap-3">
                  <span className="text-5xl">{v.emoji}</span>
                  <div>
                    <div className="font-display text-xl text-yellow-300">{v.name}</div>
                    <div className="text-sm text-white/70">{v.desc}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-white/50">VELOCIDADE</div>
                    <div className="font-display text-base">{v.maxSpeed.toFixed(0)}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-white/50">PULO</div>
                    <div className="font-display text-base">{v.jump.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-white/50">ATIRAR</div>
                    <div className="font-display text-base">{v.shoot === 'all' ? 'Tudo' : v.shoot === 'one' ? '1 mão' : 'Não'}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-sky-200">{v.special}</div>
              </div>
            ))}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75 md:col-span-2">
              Veículos aparecem em locais aleatórios (marcados com um 💎 amarelo flutuante). Aproxime-se e aperte <b>E</b>. Atropele inimigos, quebre paredes leves — mas <b>atropelar civis dá carma negativo</b>.
            </div>
          </div>
        )}

        {/* CONTROLES */}
        {tab === 'controls' && (
          <div className="mx-auto grid max-w-3xl gap-2 text-sm">
            {[
              ['W A S D', 'Mover'],
              ['Shift', 'Correr'],
              ['Espaço', 'Pular (também no veículo; solte o grind pulando)'],
              ['Mouse', 'Mirar (clique na tela para capturar; Esc libera)'],
              ['Botão esquerdo  /  F', 'Atirar / atacar com a arma do nível atual'],
              ['Botão direito  /  Q', 'Habilidade secundária (zoom, Instant Transmission, guarda, detonar bombas…) ou especial do veículo'],
              ['E', 'Montar / descer do veículo próximo'],
              ['R', 'Reiniciar com volta no tempo (Chrono-Rewind)'],
              ['← ↑ ↓ →', 'Mirar com o teclado (alternativa ao mouse)'],
              ['N / B', 'Modo Treino: subir / descer nível da arma'],
              ['M', 'Ligar / desligar som'],
              ['1-4 / C', 'Com A VERDADE: escolher poder (botão dir./Q usa)'],
              ['📱 Joystick (esq.)', 'Mover — empurre até o limite para correr'],
              ['📱 Arrastar (dir.)', 'Mirar — também funciona arrastando o botão ATACAR'],
              ['📱 ATACAR / HABIL. / PULAR', 'Tiro da arma, habilidade secundária e pulo'],
              ['📱 MONTAR / DESCER', 'Aparece perto de um veículo (botão amarelo)'],
              ['📱 ⏸ Pausa', 'Pausar, rebobinar o tempo, mudo ou voltar ao menu'],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/45 px-4 py-2.5">
                <kbd className="min-w-[150px] rounded-lg bg-white/15 px-3 py-1 text-center font-mono text-sm font-bold">{k}</kbd>
                <span className="text-white/85">{d}</span>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-white/35">CHRONO CLASH: DIMENSIONAL EVOLUTION — protótipo jogável em Three.js · mundo voxel 100% destrutível</footer>
      </div>
    </div>
  );
}
