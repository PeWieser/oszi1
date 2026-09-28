/* =====================================================================
   Oszilloskop-Engine
   - analytische Simulation einer astabilen Kippstufe (2 Transistoren)
   - Funktionsgenerator / Kalibrierausgang
   - Abtastung, Triggerung, Messung
   ===================================================================== */

export const DIVS_X = 10;
export const DIVS_Y = 8;

/** 1-2-5 Folgen */
export const VOLTS_STEPS = [
  0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10,
];
export const TIME_STEPS = [
  1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3,
  1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5,
];
export const REC_LEN = 1200; // Abtastpunkte über 10 Divisionen

/* ------------------------------------------------------------------ */
/* Typen                                                              */
/* ------------------------------------------------------------------ */

export type NodeId = 'gnd' | 'vcc' | 'q1c' | 'q1b' | 'q2c' | 'q2b' | 'cal';
export type Coupling = 'DC' | 'AC' | 'GND';
export type SrcSel = 'probe' | 'gen' | 'cal' | 'gnd';
export type TriggerMode = 'auto' | 'norm' | 'single' | 'stop';
export type Acq = 'sample' | 'peak' | 'average';
export type WaveShape =
  | 'sine'
  | 'square'
  | 'triangle'
  | 'ramp'
  | 'pulse'
  | 'noise'
  | 'am'
  | 'chirp';

export interface ChannelCfg {
  on: boolean;
  voltsIdx: number; // Index in VOLTS_STEPS
  posDiv: number; // vertikale Position in Divisionen
  coupling: Coupling;
  invert: boolean;
  bwLimit: boolean;
  src: SrcSel;
  probe: 'x1' | 'x10'; // Schalter am Tastkopf
  scale: 'x1' | 'x10'; // Einstellung am Verstärker
  node: NodeId;
}

export interface TriggerCfg {
  level: number; // Volt
  slope: 'up' | 'down';
  source: 'ch1' | 'ch2';
  mode: TriggerMode;
  coupling: 'AC' | 'DC' | 'HF';
  force: boolean;
}

export interface GenCfg {
  shape: WaveShape;
  freq: number;
  amp: number;
  offset: number;
  duty: number;
  on: boolean;
}

export interface CircuitCfg {
  power: boolean;
  rate: number; // 0..1  -> Basiswiderstände
  sym: number; // 0..1  -> Tastverhältnis
  cMult: number; // 0.1..3 -> Kondensatoren
}

export interface ScopeCfg {
  power: boolean;
  timeIdx: number;
  hPosDiv: number;
  mag: 1 | 5;
  acq: Acq;
  display: 'color' | 'green';
  persistence: number; // 0..1
  intensity: number; // 0..1
  focus: number; // 0..1
  grat: number; // 0..1  Rasterbeleuchtung
  ch: [ChannelCfg, ChannelCfg];
  trig: TriggerCfg;
  gen: GenCfg;
  circuit: CircuitCfg;
}

/* ------------------------------------------------------------------ */
/* Kippstufe (analytisch, zeitdiskret auswertbar)                     */
/* ------------------------------------------------------------------ */

const VCC = 9;
const VSAT = 0.12;
const VBE = 0.7;
const K_ON = Math.log((2 * (VCC - VSAT) - VBE) / (VCC - VBE)); // ≈0.727
const RB_MAX = 68000;
const RB_MIN = 4700;
const C_BASE = 100e-9;

export interface CircuitTiming {
  tOn1: number; // Q1 leitend
  tOn2: number;
  period: number;
  freq: number;
  rb1: number;
  rb2: number;
  c1: number;
  c2: number;
}

export function circuitTiming(c: CircuitCfg, load1 = 0, load2 = 0): CircuitTiming {
  const rb1 = RB_MIN + (RB_MAX - RB_MIN) * (1 - c.sym) * c.rate;
  const rb2 = RB_MIN + (RB_MAX - RB_MIN) * c.sym * c.rate;
  const c1 = C_BASE * c.cMult + load1;
  const c2 = C_BASE * c.cMult + load2;
  const tOn1 = rb2 * c1 * K_ON; // Q1 leitend, solange Q2-Basis < 0.7V
  const tOn2 = rb1 * c2 * K_ON;
  const period = tOn1 + tOn2;
  return { tOn1, tOn2, period, freq: 1 / period, rb1, rb2, c1, c2 };
}

const rampUp = (x: number, tau: number) =>
  VCC - (2 * (VCC - VSAT) - VBE) * Math.exp(-x / Math.max(tau, 1e-9));

export interface NodeLevels {
  q1c: number;
  q1b: number;
  q2c: number;
  q2b: number;
  q1on: boolean;
  q2on: boolean;
}

/** Spannungen aller Schaltungsknoten zur Zeit t (Sekunden, > 0) */
export function circuitNodes(
  t: number,
  c: CircuitCfg,
  load1 = 0,
  load2 = 0
): NodeLevels {
  if (!c.power) {
    return { q1c: 0, q1b: 0, q2c: 0, q2b: 0, q1on: false, q2on: false };
  }
  const tm = circuitTiming(c, load1, load2);
  const tau1 = Math.max(tm.rb1 * tm.c2, 1e-7);
  const tau2 = Math.max(tm.rb2 * tm.c1, 1e-7);
  const rc1 = 470 * tm.c1;
  const rc2 = 470 * tm.c2;
  let x: number;
  let phaseA: boolean;
  const per = tm.period;
  let tt = t % per;
  if (tt < 0) tt += per;
  if (tt < tm.tOn1) {
    x = tt;
    phaseA = true;
  } else {
    x = tt - tm.tOn1;
    phaseA = false;
  }
  const b1 = Math.min(rampUp(x, tau1), VBE + 0.05);
  const b2 = Math.min(rampUp(x, tau2), VBE + 0.05);
  if (phaseA) {
    // Q1 leitend
    return {
      q1c: VSAT,
      q1b: b1,
      q2b: b2,
      q2c: VCC - (VCC - VSAT) * Math.exp(-x / rc2),
      q1on: true,
      q2on: false,
    };
  }
  return {
    q2c: VSAT,
    q2b: b2,
    q1b: b1,
    q1c: VCC - (VCC - VSAT) * Math.exp(-x / rc1),
    q1on: false,
    q2on: true,
  };
}

/** 1-kHz-Rechteck des Tastkopf-Kalibriererausgangs (0 / 5 V) */
export function calSignal(t: number): number {
  const p = (t * 1000) % 1;
  const edge = 0.02; // 2 µs Anstiegszeit -> realistische Kante
  const s = (v: number) => {
    const a = Math.min(Math.max(v / edge, 0), 1);
    return a * a * (3 - 2 * a);
  };
  return 5 * (p < 0.5 ? s(p / edge) : 1 - s((p - 0.5) / edge));
}

/* ------------------------------------------------------------------ */
/* Funktionsgenerator                                                 */
/* ------------------------------------------------------------------ */

const frac = (x: number) => x - Math.floor(x);

export function genSample(g: GenCfg, t: number): number {
  if (!g.on) return 0;
  const f = Math.max(g.freq, 0.01);
  const A = g.amp;
  const p = frac(t * f);
  let v = 0;
  switch (g.shape) {
    case 'sine':
      v = Math.sin(2 * Math.PI * f * t);
      break;
    case 'square':
      v = p < 0.5 ? 1 : -1;
      break;
    case 'triangle':
      v = 4 * Math.abs(p - 0.5) - 1;
      break;
    case 'ramp':
      v = 2 * p - 1;
      break;
    case 'pulse':
      v = p < g.duty ? 1 : -1;
      break;
    case 'am':
      v = (0.65 + 0.35 * Math.sin(2 * Math.PI * f * 0.12 * t)) * Math.sin(2 * Math.PI * f * t);
      break;
    case 'chirp': {
      const sweep = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 1.6);
      v = Math.sin(2 * Math.PI * f * (0.15 + 0.85 * sweep) * t);
      break;
    }
    case 'noise':
      v = 0;
      break;
  }
  if (g.shape === 'noise') {
    return g.offset + A * 0.9 * (hashNoise(t) * 2 - 1);
  }
  // kurze, endliche Flanken (wie ein echter Generator ~ 25 ns .. 1 % der Periode)
  if (g.shape === 'square' || g.shape === 'pulse') {
    v = smoothShape(g, t);
  }
  return g.offset + A * v;
}

function smoothShape(g: GenCfg, t: number): number {
  const f = Math.max(g.freq, 0.01);
  const duty = g.shape === 'pulse' ? g.duty : 0.5;
  const edge = Math.max(1 / f * 0.012, 20e-9);
  const n = 5;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const tt = t + (i / (n - 1) - 0.5) * edge;
    const p = frac(tt * f);
    acc += p < duty ? 1 : -1;
  }
  return acc / n;
}

/** deterministisches Rauschen (stabil bei getriggertem Betrieb) */
export function hashNoise(t: number): number {
  const x = Math.sin(t * 9781.317 + 0.5) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Kanal-Signalpfad                                                   */
/* ------------------------------------------------------------------ */

export function probeCapacitance(ch: ChannelCfg): number {
  // Belastung der Schaltung durch den Tastkopf
  if (ch.src !== 'probe') return 0;
  const n = ch.node;
  if (n !== 'q1c' && n !== 'q2c') return 0;
  return ch.probe === 'x10' ? 12e-12 : 110e-12;
}

export function sourceVoltage(ch: ChannelCfg, t: number, cfg: ScopeCfg): number {
  switch (ch.src) {
    case 'gnd':
      return 0;
    case 'cal':
      return calSignal(t);
    case 'gen':
      return genSample(cfg.gen, t);
    case 'probe': {
      const l1 = probeCapacitance(cfg.ch[0]);
      const l2 = probeCapacitance(cfg.ch[1]);
      const nd = circuitNodes(t, cfg.circuit, l1, l2);
      switch (ch.node) {
        case 'vcc':
          return VCC;
        case 'q1c':
          return nd.q1c;
        case 'q1b':
          return nd.q1b;
        case 'q2c':
          return nd.q2c;
        case 'q2b':
          return nd.q2b;
        default:
          return 0;
      }
    }
  }
}

/** Schlüssel für den Gleichanteil-Cache (AC-Kopplung) */
function dcKey(ch: ChannelCfg, cfg: ScopeCfg): string {
  return [
    ch.src,
    ch.node,
    cfg.gen.shape,
    cfg.gen.freq,
    cfg.gen.amp,
    cfg.gen.offset,
    cfg.gen.duty,
    cfg.gen.on,
    cfg.circuit.power,
    cfg.circuit.rate,
    cfg.circuit.sym,
    cfg.circuit.cMult,
    probeCapacitance(cfg.ch[0]),
    probeCapacitance(cfg.ch[1]),
  ].join('|');
}

const dcCache = new Map<string, number>();

/** DC-Anteil einer Quelle (für AC-Kopplung), über viele Perioden gemittelt */
export function dcComponent(ch: ChannelCfg, cfg: ScopeCfg): number {
  const key = dcKey(ch, cfg);
  const hit = dcCache.get(key);
  if (hit !== undefined) return hit;
  const timing = circuitTiming(
    cfg.circuit,
    probeCapacitance(cfg.ch[0]),
    probeCapacitance(cfg.ch[1])
  );
  const span = Math.max(timing.period * 8, cfg.gen.on ? 8 / Math.max(cfg.gen.freq, 0.01) : 0.02, 0.01);
  const n = 400;
  let acc = 0;
  const t0 = 123.456; // feste Phase -> deterministisch
  for (let i = 0; i < n; i++) acc += sourceVoltage(ch, t0 + (i / n) * span, cfg);
  const v = acc / n;
  if (dcCache.size > 600) dcCache.clear();
  dcCache.set(key, v);
  return v;
}

/** Spannung am Eingang des Vertikalverstärkers */
export function channelVoltage(ch: ChannelCfg, t: number, cfg: ScopeCfg): number {
  let v = sourceVoltage(ch, t, cfg);
  if (ch.src === 'probe' && ch.probe === 'x10') v /= 10; // Tastkopf teilt 1:10
  if (ch.scale === 'x10') v *= 10; // Anzeige-Korrektur
  if (ch.coupling === 'AC') v -= dcComponent(ch, cfg);
  if (ch.coupling === 'GND') v = 0;
  if (ch.invert) v = -v;
  return v;
}

/* ------------------------------------------------------------------ */
/* Abtasten + Trigger                                                 */
/* ------------------------------------------------------------------ */

export interface WaveRec {
  data: Float32Array; // [ch0..., ch1...]
  t0: number; // Zeit am linken Rand
  dt: number;
  trigIdx: number; // Index des Triggerpunktes (oder -1)
}

export function acquire(cfg: ScopeCfg, time: number, freeRun: boolean, jitter: number): WaveRec {
  const secDiv = TIME_STEPS[cfg.timeIdx] / cfg.mag;
  const span = secDiv * DIVS_X;
  const dt = span / REC_LEN;
  // Aufzeichnung ueber 20 Divisionen: hinten 10 Div Suchraum fuer den Trigger,
  // vorn 10 Div Platz fuer die X-Verschiebung
  const n = REC_LEN * 2 + 2;
  const data = new Float32Array(n * 2);
  const t0 = time - span * 2 + jitter;
  const noise = 0.0025 * (VOLTS_STEPS[cfg.ch[0].voltsIdx] + VOLTS_STEPS[cfg.ch[1].voltsIdx]);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    for (let c = 0; c < 2; c++) {
      let v = channelVoltage(cfg.ch[c], t, cfg);
      if (noise > 0) v += (hashNoise(t * 1.7 + c * 31.7) - 0.5) * noise;
      data[c * n + i] = v;
    }
  }
  const src = cfg.trig.source === 'ch1' ? 0 : 1;
  const level = cfg.trig.level;
  let trigIdx = -1;
  const s = data.subarray(src * n, src * n + n);
  for (let i = n - 2; i >= REC_LEN; i--) {
    const a = s[i] - level;
    const b = s[i + 1] - level;
    if (cfg.trig.slope === 'up' ? a < 0 && b >= 0 : a > 0 && b <= 0) {
      trigIdx = i;
      break;
    }
  }
  let start: number;
  if (trigIdx >= 0) {
    const tTrig = t0 + trigIdx * dt;
    start = tTrig - (DIVS_X / 2 - cfg.hPosDiv) * secDiv;
  } else if (freeRun) {
    start = time - span + cfg.hPosDiv * secDiv;
  } else {
    start = t0;
  }
  // auf die Anzeigelaenge interpolieren
  const rel = (start - t0) / dt;
  const out = new Float32Array(REC_LEN * 2);
  for (let c = 0; c < 2; c++) {
    const base = c * n;
    for (let i = 0; i < REC_LEN; i++) {
      const p = rel + i;
      const i0 = Math.floor(p);
      if (i0 < 0 || i0 + 1 >= n) {
        out[c * REC_LEN + i] = 0;
        continue;
      }
      const f = p - i0;
      out[c * REC_LEN + i] = data[base + i0] * (1 - f) + data[base + i0 + 1] * f;
    }
  }
  return { data: out, t0: start, dt, trigIdx };
}

/* ------------------------------------------------------------------ */
/* Messungen                                                          */
/* ------------------------------------------------------------------ */

export interface Measurement {
  vpp: number;
  vmax: number;
  vmin: number;
  vavg: number;
  vrms: number;
  freq: number;
  period: number;
  duty: number;
  rise: number;
}

export function measure(rec: WaveRec, ch: number): Measurement {
  const base = ch * REC_LEN;
  const n = REC_LEN;
  let vmax = -Infinity;
  let vmin = Infinity;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const v = rec.data[base + i];
    if (v > vmax) vmax = v;
    if (v < vmin) vmin = v;
    sum += v;
    sq += v * v;
  }
  const vavg = sum / n;
  const vrms = Math.sqrt(sq / n);
  // Frequenz aus steigenden Flanken
  const crossings: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const a = rec.data[base + i - 1] - vavg;
    const b = rec.data[base + i] - vavg;
    if (a < 0 && b >= 0) crossings.push(i);
  }
  let freq = 0;
  let period = 0;
  let duty = 0;
  if (crossings.length >= 2) {
    const first = crossings[0];
    const last = crossings[crossings.length - 1];
    period = ((last - first) / (crossings.length - 1)) * rec.dt;
    freq = 1 / period;
    const end = crossings.length > 1 ? crossings[1] : n - 1;
    let hi = 0;
    for (let i = first; i < end; i++) if (rec.data[base + i] > vavg) hi++;
    duty = hi / Math.max(end - first, 1);
  }
  // Anstiegszeit 10%..90% der ersten Flanke
  let rise = 0;
  const vpp = vmax - vmin;
  if (vpp > 0) {
    const lo = vmin + 0.1 * vpp;
    const hi = vmin + 0.9 * vpp;
    for (let i = 1; i < n; i++) {
      if (rec.data[base + i - 1] < lo && rec.data[base + i] >= lo) {
        let j = i;
        while (j < n - 1 && rec.data[j] < hi) j++;
        rise = (j - i) * rec.dt;
        break;
      }
    }
  }
  return { vpp, vmax, vmin, vavg, vrms, freq, period, duty, rise };
}

/* ------------------------------------------------------------------ */
/* Formatierung                                                       */
/* ------------------------------------------------------------------ */

export function fmtVolt(v: number, digits = 2): string {
  const a = Math.abs(v);
  if (a >= 1) return v.toFixed(digits) + ' V';
  if (a >= 1e-3) return (v * 1e3).toFixed(digits) + ' mV';
  return (v * 1e6).toFixed(digits) + ' µV';
}

export function fmtTime(v: number, digits = 2): string {
  const a = Math.abs(v);
  if (a >= 1) return v.toFixed(digits) + ' s';
  if (a >= 1e-3) return (v * 1e3).toFixed(digits) + ' ms';
  if (a >= 1e-6) return (v * 1e6).toFixed(digits) + ' µs';
  return (v * 1e9).toFixed(digits) + ' ns';
}

export function fmtHz(v: number): string {
  if (!isFinite(v) || v <= 0) return '— Hz';
  if (v >= 1e6) return (v / 1e6).toFixed(3) + ' MHz';
  if (v >= 1e3) return (v / 1e3).toFixed(3) + ' kHz';
  return v.toFixed(2) + ' Hz';
}

export function fmtOhm(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + ' MΩ';
  if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + ' kΩ';
  return v.toFixed(0) + ' Ω';
}

export const NODE_LABEL: { [K in NodeId]: string } = {
  gnd: 'GND',
  vcc: '+9 V',
  q1c: 'Q1 C',
  q1b: 'Q1 B',
  q2c: 'Q2 C',
  q2b: 'Q2 B',
  cal: 'CAL 1 kHz',
};
