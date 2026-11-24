export type Kind =
  | 'wood'
  | 'brick'
  | 'plaster'
  | 'concrete'
  | 'stone'
  | 'paper'
  | 'ice'
  | 'metal'
  | 'tile'
  | 'clay'
  | 'neon'
  | 'leaf';

export interface BlockDef {
  name: string;
  hp: number;
  /** Estrutura grande: só explosivos, Stands, Espada etc. conseguem destruir */
  heavy: boolean;
  /** Poder de impacto mínimo de um veículo para quebrar */
  ram: number;
  flammable: boolean;
  /** Parede fina: pode ser atravessada por Sniper/AK-47 */
  thin: boolean;
  base: number;
}

export const KINDS: Kind[] = [
  'wood',
  'brick',
  'plaster',
  'concrete',
  'stone',
  'paper',
  'ice',
  'metal',
  'tile',
  'clay',
  'neon',
  'leaf',
];

export const DEFS: Record<Kind, BlockDef> = {
  wood: { name: 'Madeira', hp: 2, heavy: false, ram: 3, flammable: true, thin: true, base: 0x8a5a2b },
  brick: { name: 'Tijolo', hp: 3, heavy: false, ram: 4, flammable: false, thin: true, base: 0xa8472f },
  plaster: { name: 'Reboco', hp: 2, heavy: false, ram: 3, flammable: false, thin: true, base: 0xd9c9a8 },
  concrete: { name: 'Concreto', hp: 8, heavy: true, ram: 99, flammable: false, thin: false, base: 0x8a8d90 },
  stone: { name: 'Pedra', hp: 12, heavy: true, ram: 99, flammable: false, thin: false, base: 0xc9bfa8 },
  paper: { name: 'Papel (Shoji)', hp: 1, heavy: false, ram: 1, flammable: true, thin: true, base: 0xf3ead2 },
  ice: { name: 'Gelo', hp: 3, heavy: false, ram: 3, flammable: false, thin: true, base: 0xbfe6f5 },
  metal: { name: 'Metal', hp: 10, heavy: true, ram: 99, flammable: false, thin: false, base: 0x9aa4ad },
  tile: { name: 'Telha', hp: 2, heavy: false, ram: 2, flammable: false, thin: true, base: 0x9a4a35 },
  clay: { name: 'Barro', hp: 3, heavy: false, ram: 3, flammable: false, thin: true, base: 0xb6753f },
  neon: { name: 'Neon', hp: 1, heavy: false, ram: 1, flammable: false, thin: true, base: 0xff3df2 },
  leaf: { name: 'Folhagem', hp: 1, heavy: false, ram: 1, flammable: true, thin: true, base: 0x3f8f3a },
};

export const kindIndex = (k: Kind) => KINDS.indexOf(k) + 1;
export const kindOf = (i: number): Kind => KINDS[i - 1];
