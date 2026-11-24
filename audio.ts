type Ctx = AudioContext;

export class Sfx {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  muted = false;
  sirenOsc: OscillatorNode | null = null;
  sirenLfo: OscillatorNode | null = null;
  sirenGain: GainNode | null = null;
  lastShot = 0;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  noise(dur: number, f0: number, f1: number, gain: number, type: BiquadFilterType = 'lowpass', q = 1) {
    const c = this.ctx;
    if (!c || !this.noiseBuf || !this.master) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    const t = c.currentTime;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime + delay;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot(kind: 'pistol' | 'rifle' | 'sniper' | 'magic' | 'swing' | 'beam' | 'punch' | 'enemy' | 'rocket' | 'knife') {
    if (!this.ctx) return;
    switch (kind) {
      case 'pistol':
        this.noise(0.12, 3500, 600, 0.5, 'bandpass', 0.8);
        this.tone(220, 70, 0.1, 'square', 0.15);
        break;
      case 'rifle':
        this.noise(0.14, 2500, 300, 0.6, 'lowpass');
        this.tone(160, 50, 0.12, 'sawtooth', 0.18);
        break;
      case 'sniper':
        this.noise(0.5, 3000, 120, 0.9, 'lowpass');
        this.tone(110, 30, 0.4, 'sawtooth', 0.3);
        break;
      case 'rocket':
        this.noise(0.6, 1200, 200, 0.5, 'bandpass');
        this.tone(90, 40, 0.5, 'sawtooth', 0.2);
        break;
      case 'magic':
        this.tone(400, 1200, 0.25, 'triangle', 0.2);
        this.noise(0.25, 2000, 800, 0.2, 'highpass');
        break;
      case 'swing':
        this.noise(0.18, 600, 3000, 0.35, 'bandpass', 1.5);
        break;
      case 'knife':
        this.noise(0.08, 3500, 6000, 0.25, 'highpass');
        break;
      case 'beam':
        this.tone(120, 900, 0.5, 'sawtooth', 0.28);
        this.noise(0.6, 800, 4000, 0.4, 'bandpass');
        break;
      case 'punch':
        this.noise(0.35, 400, 60, 0.9, 'lowpass');
        this.tone(70, 25, 0.5, 'sine', 0.5);
        break;
      case 'enemy': {
        const n = performance.now();
        if (n - this.lastShot < 70) return;
        this.lastShot = n;
        this.noise(0.08, 2200, 500, 0.18, 'bandpass');
        break;
      }
    }
  }

  explosion(big = false) {
    this.noise(big ? 1.8 : 0.8, big ? 1500 : 1000, 60, big ? 1.2 : 0.8, 'lowpass');
    this.tone(big ? 70 : 90, 22, big ? 1.4 : 0.6, 'sine', big ? 0.7 : 0.45);
  }
  hit() {
    this.tone(1500, 900, 0.06, 'square', 0.1);
  }
  kill() {
    this.tone(660, 990, 0.12, 'square', 0.12);
    this.tone(990, 1320, 0.15, 'square', 0.12, 0.09);
  }
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f * 1.01, 0.14, 'triangle', 0.18, i * 0.07));
  }
  bad() {
    this.tone(180, 90, 0.4, 'sawtooth', 0.25);
    this.tone(150, 70, 0.4, 'sawtooth', 0.25, 0.15);
  }
  hurt() {
    this.noise(0.15, 500, 120, 0.4, 'lowpass');
  }
  dash() {
    this.noise(0.25, 800, 4500, 0.5, 'bandpass', 2);
  }
  stop() {
    this.tone(900, 80, 0.7, 'sawtooth', 0.3);
    this.tone(60, 40, 1, 'sine', 0.4);
  }
  resume() {
    this.tone(80, 900, 0.5, 'sawtooth', 0.25);
  }
  tick() {
    this.tone(1200, 1200, 0.05, 'square', 0.08);
  }

  rewind(dur: number) {
    if (!this.ctx) return;
    this.tone(1400, 80, dur, 'sawtooth', 0.12);
    this.tone(700, 40, dur, 'square', 0.06);
    this.noise(dur, 6000, 200, 0.25, 'bandpass', 0.7);
  }

  siren(on: boolean) {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = c.createOscillator();
      this.sirenOsc.type = 'sawtooth';
      this.sirenOsc.frequency.value = 650;
      this.sirenLfo = c.createOscillator();
      this.sirenLfo.frequency.value = 0.55;
      const lg = c.createGain();
      lg.gain.value = 260;
      this.sirenLfo.connect(lg).connect(this.sirenOsc.frequency);
      this.sirenGain = c.createGain();
      this.sirenGain.gain.value = 0.16;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo?.stop();
      } catch {
        /* ignore */
      }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  dispose() {
    this.siren(false);
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
