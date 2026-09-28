import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  REC_LEN,
  TIME_STEPS,
  VOLTS_STEPS,
  acquire,
  circuitTiming,
  measure,
  probeCapacitance,
  type ChannelCfg,
  type NodeId,
  type ScopeCfg,
  type WaveRec,
} from '../lib/scope';
import { Renderer, cursorHit, type Cursors, type FrameState } from '../lib/render';

export const defaultChannel = (node: NodeId, posDiv = 0): ChannelCfg => ({
  on: true,
  voltsIdx: 10, // 5 V/div
  posDiv,
  coupling: 'DC',
  invert: false,
  bwLimit: false,
  src: 'probe',
  probe: 'x10',
  scale: 'x10',
  node,
});

export const defaultCfg = (): ScopeCfg => ({
  power: true,
  timeIdx: 11, // 2 ms/div
  hPosDiv: 0,
  mag: 1,
  acq: 'sample',
  display: 'color',
  persistence: 0.45,
  intensity: 0.95,
  focus: 0.85,
  grat: 0.6,
  ch: [defaultChannel('q1c', 2), defaultChannel('q2c', -2)],
  trig: {
    level: 2.5,
    slope: 'up',
    source: 'ch1',
    mode: 'auto',
    coupling: 'DC',
    force: false,
  },
  gen: {
    shape: 'sine',
    freq: 1000,
    amp: 2,
    offset: 0,
    duty: 0.25,
    on: true,
  },
  circuit: { power: true, rate: 0.55, sym: 0.5, cMult: 1 },
});

export interface ScopeApi {
  cfg: ScopeCfg;
  patch: (p: Partial<ScopeCfg>) => void;
  setCh: (i: 0 | 1, p: Partial<ChannelCfg>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cursors: Cursors;
  setCursors: React.Dispatch<React.SetStateAction<Cursors>>;
  showMeas: boolean;
  setShowMeas: (v: boolean) => void;
  running: boolean;
  toggleRun: () => void;
  armSingle: () => void;
  trigd: boolean;
  measures: (Measurement0 | null)[];
  autoset: () => void;
  attach: (i: 0 | 1, node: NodeId) => void;
  onScreenPointer: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  status: 'run' | 'stop' | 'wait' | 'single';
  timing: ReturnType<typeof circuitTiming>;
  reset: () => void;
  setBeamFind: (v: boolean) => void;
  beamFind: boolean;
}

type Measurement0 = import('../lib/scope').Measurement;

export function useScope(): ScopeApi {
  const [cfg, setCfg] = useState<ScopeCfg>(defaultCfg);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const [cursors, setCursors] = useState<Cursors>({
    on: false,
    x1: 3,
    x2: 6,
    y1: -2,
    y2: 2,
    src: 0,
  });
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  const [showMeas, setShowMeas] = useState(true);
  const showMeasRef = useRef(showMeas);
  showMeasRef.current = showMeas;

  const [running, setRunning] = useState(true);
  const runningRef = useRef(running);
  runningRef.current = running;

  const singleRef = useRef(false);
  const beamFindRef = useRef(false);
  const [beamFind, setBeamFindState] = useState(false);
  const setBeamFind = useCallback((v: boolean) => {
    beamFindRef.current = v;
    setBeamFindState(v);
  }, []);
  const [status, setStatus] = useState<'run' | 'stop' | 'wait' | 'single'>('run');
  const [trigd, setTrigd] = useState(false);
  const [measures, setMeasures] = useState<(Measurement0 | null)[]>([null, null]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 800, h: 600 });
  const recRef = useRef<WaveRec | null>(null);
  const renderer = useMemo(() => new Renderer(), []);
  const dragRef = useRef<{ what: 'x1' | 'x2' | 'y1' | 'y2' } | null>(null);

  const patch = useCallback((p: Partial<ScopeCfg>) => setCfg((c) => ({ ...c, ...p })), []);
  const setCh = useCallback(
    (i: 0 | 1, p: Partial<ChannelCfg>) =>
      setCfg((c) => {
        const ch = [...c.ch] as [ChannelCfg, ChannelCfg];
        ch[i] = { ...ch[i], ...p };
        return { ...c, ch };
      }),
    []
  );
  const attach = useCallback(
    (i: 0 | 1, node: NodeId) => {
      setCh(i, { node, src: 'probe' });
    },
    [setCh]
  );

  const toggleRun = useCallback(() => {
    singleRef.current = false;
    setRunning((r) => !r);
  }, []);

  const armSingle = useCallback(() => {
    singleRef.current = true;
    setRunning(true);
    setStatus('single');
  }, []);

  const reset = useCallback(() => {
    setCfg(defaultCfg());
    setRunning(true);
    singleRef.current = false;
  }, []);

  /* ---------------- Auto Set ---------------- */
  const autoset = useCallback(() => {
    const base: ScopeCfg = JSON.parse(JSON.stringify(cfgRef.current));
    base.ch[0].on = true;
    const probeCh = base.ch[0].src === 'probe' ? 0 : 1;
    let idx = base.timeIdx;
    let period = 0;
    for (let a = 0; a < 7; a++) {
      base.timeIdx = idx;
      const rec = acquire(base, performance.now() / 1000, true, 0);
      const m = measure(rec, probeCh);
      if (m.period > 0) {
        period = m.period;
        const periods = (TIME_STEPS[idx] * 10) / period;
        if (periods < 1.2 && idx > 1) {
          idx = Math.max(0, idx - 2);
          continue;
        }
        if (periods > 5 && idx < TIME_STEPS.length - 2) {
          idx = Math.min(TIME_STEPS.length - 1, idx + 2);
          continue;
        }
        break;
      }
      if (idx <= 1) break;
      idx = Math.max(0, idx - 2);
    }
    base.timeIdx = idx;
    const rec = acquire(base, performance.now() / 1000, true, 0);
    for (const c of [0, 1] as const) {
      const ch = base.ch[c];
      ch.on = true;
      ch.invert = false;
      const m = measure(rec, c);
      const vpp = Math.max(m.vpp, 1e-4);
      const target = vpp / 6; // Signal soll etwa 6 Divisionen fuellen
      let vi = VOLTS_STEPS.findIndex((st) => st >= target);
      if (vi < 0) vi = VOLTS_STEPS.length - 1;
      ch.voltsIdx = vi;
      const mid = (m.vmax + m.vmin) / 2;
      ch.posDiv = Math.max(-4, Math.min(4, -mid / VOLTS_STEPS[ch.voltsIdx]));
    }
    base.trig.source = probeCh === 0 ? 'ch1' : 'ch2';
    const m = measure(rec, probeCh);
    base.trig.level = (m.vmax + m.vmin) / 2;
    base.trig.mode = 'auto';
    setCfg(base);
    setRunning(true);
    singleRef.current = false;
  }, []);

  /* ---------------- Render-Schleife ---------------- */
  useEffect(() => {
    let raf = 0;
    let lastMeas = 0;
    let lastBlink = 0;
    let blink = true;
    let measures: (Measurement0 | null)[] = [null, null];
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(80, Math.round(rect.width));
      const h = Math.max(60, Math.round(rect.height));
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      sizeRef.current = { w, h };
      renderer.resize(w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const c = cfgRef.current;
      const now = performance.now() / 1000;
      let st: 'run' | 'stop' | 'wait' | 'single' = 'run';
      if (!runningRef.current) {
        st = 'stop';
      } else {
        const rec = acquire(c, now, true, 0);
        const found = rec.trigIdx >= 0;
        if (found) {
          recRef.current = rec;
          st = 'run';
        } else if (c.trig.mode === 'auto') {
          recRef.current = rec;
          st = 'run';
        } else {
          st = singleRef.current ? 'single' : 'wait';
        }
        if (singleRef.current && found) {
          singleRef.current = false;
          runningRef.current = false;
          setRunning(false);
          st = 'stop';
        }
      }
      const rec = recRef.current;
      if (rec && rec.data.length !== REC_LEN * 2) recRef.current = null;

      if (now - lastMeas > 0.2) {
        lastMeas = now;
        setTrigd(st === 'run' && !!rec);
        setStatus(st);
        const out: (Measurement0 | null)[] = [null, null];
        if (rec) {
          for (const ci of [0, 1] as const) {
            if (!c.ch[ci].on) continue;
            const m = measure(rec, ci);
            out[ci] = m.vpp > 0 ? m : null;
          }
        }
        measures = out;
        setMeasures(out);
      }
      if (now - lastBlink > 0.45) {
        lastBlink = now;
        blink = !blink;
      }

      const frame: FrameState = {
        cfg: c,
        rec,
        measures,
        cursors: cursorsRef.current,
        status: st,
        blink,
        showMeas: showMeasRef.current,
        beamFind: beamFindRef.current,
      };
      renderer.draw(ctx, frame);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [renderer]);

  /* ---------------- Cursor-Interaktion ---------------- */
  const onScreenPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!cursorsRef.current.on) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const dw = w / 10;
      const dh = h / 8;
      const mx = ((e.clientX - rect.left) / rect.width) * w;
      const my = ((e.clientY - rect.top) / rect.height) * h;
      if (e.type === 'pointerdown') {
        const hit = cursorHit(mx, my, cursorsRef.current, dw, dh);
        if (hit) {
          dragRef.current = { what: hit };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else if (e.type === 'pointermove' && dragRef.current) {
        const what = dragRef.current.what;
        setCursors((cu) => {
          if (what === 'x1' || what === 'x2') {
            const v = Math.max(0, Math.min(10, mx / dw));
            return { ...cu, [what]: v } as Cursors;
          }
          const v = Math.max(-4, Math.min(4, -(my - h / 2) / dh));
          return { ...cu, [what]: v } as Cursors;
        });
      } else if (e.type === 'pointerup' && dragRef.current) {
        dragRef.current = null;
      }
    },
    []
  );

  const timing = useMemo(
    () =>
      circuitTiming(
        cfg.circuit,
        probeCapacitance(cfg.ch[0]),
        probeCapacitance(cfg.ch[1])
      ),
    [cfg.circuit, cfg.ch]
  );

  return {
    cfg,
    patch,
    setCh,
    canvasRef,
    cursors,
    setCursors,
    showMeas,
    setShowMeas,
    running,
    toggleRun,
    armSingle,
    trigd,
    measures,
    autoset,
    attach,
    onScreenPointer,
    status,
    timing,
    reset,
    setBeamFind,
    beamFind,
  };
}
