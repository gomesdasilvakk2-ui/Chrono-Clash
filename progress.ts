const KEY = 'chrono-clash-progress-v1';
export const NEEDED = 3;

export interface Progress {
  conquered: string[];
  truth: boolean;
}

export function loadProgress(): Progress {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (r && Array.isArray(r.conquered)) {
      return { conquered: r.conquered.filter((x: unknown) => typeof x === 'string'), truth: !!r.truth };
    }
  } catch {
    /* ignore */
  }
  return { conquered: [], truth: false };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function markConquered(mapId: string): Progress {
  const p = loadProgress();
  if (mapId !== 'santuario' && !p.conquered.includes(mapId)) p.conquered.push(mapId);
  saveProgress(p);
  return p;
}

export function grantTruth(): Progress {
  const p = loadProgress();
  p.truth = true;
  saveProgress(p);
  return p;
}

export function resetProgress(): Progress {
  const p = { conquered: [], truth: false };
  saveProgress(p);
  return p;
}
