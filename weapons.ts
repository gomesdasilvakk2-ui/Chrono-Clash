export interface WeaponDef {
  id: number;
  key: string;
  name: string;
  icon: string;
  cat: string;
  desc: string;
  alt?: string;
  auto: boolean;
  oneHand: boolean;
  color: string;
}

export const WEAPONS: WeaponDef[] = [
  { id: 1, key: 'carrot', name: 'Cenoura', icon: '🥕', cat: 'Corpo a corpo', desc: 'Ataque corpo a corpo rápido e cômico.', auto: true, oneHand: true, color: '#fb923c' },
  { id: 2, key: 'pickaxe', name: 'Picareta', icon: '⛏️', cat: 'Corpo a corpo', desc: 'Minera estruturas finas e causa dano crítico na cabeça.', auto: false, oneHand: false, color: '#a8a29e' },
  { id: 3, key: 'glock', name: 'Glock', icon: '🔫', cat: 'Arma de fogo', desc: 'Semi-automática rápida.', auto: false, oneHand: true, color: '#94a3b8' },
  { id: 4, key: 'kar98', name: 'Kar98k', icon: '🎯', cat: 'Arma de fogo', desc: 'Rifle de ferrolho com mira de ferro. 1 tiro de alto dano.', auto: false, oneHand: false, color: '#b45309' },
  { id: 5, key: 'ak47', name: 'AK-47', icon: '💥', cat: 'Arma de fogo', desc: 'Automática de alto recuo e alto dano. Atravessa parede fina.', auto: true, oneHand: false, color: '#f59e0b' },
  { id: 6, key: 'sniper', name: 'Sniper Barret .50', icon: '🔭', cat: 'Arma de fogo', desc: 'Mata com 1 tiro no peito e atravessa paredes finas.', alt: 'Botão direito: zoom', auto: false, oneHand: false, color: '#64748b' },
  { id: 7, key: 'bazooka', name: 'Bazuca RPG-7', icon: '🚀', cat: 'Explosivo', desc: 'Dano em área massivo, destrói prédios.', auto: false, oneHand: false, color: '#84cc16' },
  { id: 8, key: 'sword', name: 'Espada do Destino', icon: '⚔️', cat: 'Lendária', desc: 'Dash cortante que corta projéteis e colapsa fundações.', auto: false, oneHand: true, color: '#e2e8f0' },
  { id: 9, key: 'brush', name: 'Pincel de Corte Dimensional', icon: '🖌️', cat: 'Lendária', desc: 'Corta o espaço, criando fendas que puxam inimigos.', auto: false, oneHand: true, color: '#22d3ee' },
  { id: 10, key: 'pedro', name: '"Pedro"', icon: '🦝', cat: 'Meme', desc: 'Pedro gira em alta velocidade como míssil tele-guiado.', auto: false, oneHand: true, color: '#a1a1aa' },
  { id: 11, key: 'chariot', name: 'Stand: Silver Chariot', icon: '🗡️', cat: 'Stand', desc: 'Ataques rápidos de esgrima à distância média.', auto: true, oneHand: true, color: '#cbd5e1' },
  { id: 12, key: 'magician', name: "Stand: Magician's Red", icon: '🔥', cat: 'Stand', desc: 'Rajadas de fogo que incendeiam construções.', auto: false, oneHand: true, color: '#ef4444' },
  { id: 13, key: 'queen', name: 'Stand: Killer Queen', icon: '💣', cat: 'Stand', desc: 'Transforma qualquer objeto, parede ou inimigo em bomba de contato.', alt: 'Botão direito: detonar agora', auto: false, oneHand: true, color: '#f472b6' },
  { id: 14, key: 'platinum', name: 'Stand: Star Platinum', icon: '👊', cat: 'Stand', desc: 'Segure para "ORA ORA ORA" em área. Desvia balas.', alt: 'Botão direito: guarda (desvia balas)', auto: true, oneHand: true, color: '#a78bfa' },
  { id: 15, key: 'world', name: 'Stand: The World', icon: '⏱️', cat: 'Stand', desc: 'Para o tempo por 3 segundos para todos os outros. Facas de arremesso.', auto: true, oneHand: true, color: '#facc15' },
  { id: 16, key: 'goku', name: 'Convidado: Goku', icon: '🟠', cat: 'Convidado', desc: 'Kamehameha curto e devastador.', alt: 'Botão direito: Instant Transmission', auto: false, oneHand: false, color: '#fb923c' },
  { id: 17, key: 'saitama', name: 'Convidado: Saitama', icon: '👆', cat: 'Convidado', desc: '1 soco com delay alto, mas alcance colossal.', auto: false, oneHand: true, color: '#fde047' },
  { id: 18, key: 'gauntlet', name: 'Manopla do Infinito', icon: '🧤', cat: 'Lendária', desc: 'Dispara raios das 6 joias do infinito.', auto: false, oneHand: true, color: '#fbbf24' },
  { id: 19, key: 'knife', name: 'Faca Dourada Final', icon: '🔪', cat: 'Corpo a corpo', desc: 'Um corte, uma morte. Exige precisão máxima: errou, tropeça.', auto: false, oneHand: true, color: '#facc15' },
  { id: 20, key: 'nuke', name: 'BOMBA NUCLEAR TÁTICA', icon: '☢️', cat: 'Killstreak', desc: 'Sirene global, contagem de 10s. O mapa inteiro é vaporizado.', auto: false, oneHand: true, color: '#ef4444' },
];

export const TRUTH: WeaponDef = {
  id: 21,
  key: 'truth',
  name: 'A VERDADE',
  icon: '👁️',
  cat: 'Suprema',
  desc: 'Arma suprema do Local Sagrado. Raio que atravessa tudo e poderes sobrenaturais sobre o tempo e a gravidade.',
  alt: 'Botão direito/Q: usar poder · teclas 1-4 / C: escolher poder',
  auto: true,
  oneHand: true,
  color: '#fde68a',
};

export const TRUTH_POWERS = [
  { name: 'Parar o Tempo', icon: '⏱️', cd: 9, desc: 'Congela tudo e todos por 4 segundos.' },
  { name: 'Retroceder', icon: '⏪', cd: 7, desc: 'Volta 3 segundos no tempo: mortos reerguem, paredes se remontam.' },
  { name: 'Gravidade', icon: '🌌', cd: 3, desc: 'Alterna: normal → lunar → invertida (todos caem para o teto).' },
  { name: 'Apagar', icon: '☄️', cd: 12, desc: 'Apaga da existência tudo numa grande esfera à frente.' },
];
