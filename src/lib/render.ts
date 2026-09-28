import {
  DIVS_X,
  DIVS_Y,
  REC_LEN,
  TIME_STEPS,
  VOLTS_STEPS,
  fmtHz,
  fmtTime,
  fmtVolt,
  type Measurement,
  type ScopeCfg,
  type WaveRec,
} from './scope';

export interface Cursors {
  on: boolean;
  x1: number; // Divisionen von links
  x2: number;
  y1: number; // Divisionen von unten (Mitte = 0)
  y2: number;
  src: 0 | 1;
}

export interface FrameState {
  cfg: ScopeCfg;
  rec: WaveRec | null;
  measures: (Measurement | null)[];
  cursors: Cursors;
  status: 'run' | 'stop' | 'wait' | 'single';
  blink: boolean;
  showMeas: boolean;
  beamFind?: boolean;
}

const CH_COLORS: [string, string] = ['#ffd447', '#4fd8ff'];
const CH_GREEN: [string, string] = ['#9dffbe', '#3fd97f'];

function px(v: number) {
  return Math.round(v) + 0.5;
}

export class Renderer {
  private ph = document.createElement('canvas');
  private pctx: CanvasRenderingContext2D | null = null;
  w = 0;
  h = 0;

  constructor() {
    this.pctx = this.ph.getContext('2d');
  }

  resize(w: number, h: number) {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.ph.width = Math.max(1, Math.floor(w));
    this.ph.height = Math.max(1, Math.floor(h));
    this.pctx = this.ph.getContext('2d');
    if (this.pctx) this.pctx.clearRect(0, 0, w, h);
  }

  draw(ctx: CanvasRenderingContext2D, st: FrameState) {
    const { w, h } = this;
    if (!this.pctx || w < 2 || h < 2) return;
    const cfg = st.cfg;
    const dw = w / DIVS_X;
    const dh = h / DIVS_Y;
    this.blank(ctx, w, h, cfg.display);
    if (!cfg.power) return;

    /* --- Phosphor abklingen lassen --- */
    const p = this.pctx;
    const focus = cfg.focus;
    const persist = 0.04 + cfg.persistence * 0.9;
    const fade = st.status === 'stop' ? 0 : 0.06 + (1 - persist) * 0.6;
    p.globalCompositeOperation = 'destination-out';
    p.fillStyle = `rgba(0,0,0,${fade})`;
    p.fillRect(0, 0, w, h);
    p.globalCompositeOperation = 'lighter';

    /* --- Strahlen --- */
    const samplesPerPx = REC_LEN / w;
    const sub = cfg.acq === 'peak' ? Math.max(2, Math.ceil(samplesPerPx * 6)) : 1;
    const gain = cfg.intensity;
    if (st.beamFind) {
      p.save();
      p.beginPath();
      p.rect(w * 0.47, h * 0.47, w * 0.06, h * 0.06);
      p.clip();
    }
    for (let c = 0; c < 2; c++) {
      const ch = cfg.ch[c];
      if (!ch.on || !st.rec) continue;
      const col =
        cfg.display === 'green'
          ? CH_GREEN[c]
          : CH_COLORS[c];
      const voltsDiv = VOLTS_STEPS[ch.voltsIdx];
      const yOf = (v: number) => h / 2 - (v / voltsDiv) * dh - ch.posDiv * dh;
      const n = REC_LEN;
      p.beginPath();
      let started = false;
      let lastY = 0;
      for (let x = 0; x < w; x++) {
        const i0 = Math.floor(x * samplesPerPx);
        const i1 = Math.min(n, Math.max(i0 + 1, Math.floor((x + 1) * samplesPerPx)));
        let mn = Infinity;
        let mx = -Infinity;
        let sum = 0;
        let cnt = 0;
        for (let i = i0; i < i1; i += sub) {
          const v = st.rec.data[c * n + i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
          sum += v;
          cnt++;
        }
        if (!cnt) continue;
        const avg = sum / cnt;
        const smooth = cfg.acq !== 'peak' || ch.bwLimit;
        const useMin = smooth ? avg : mn;
        const useMax = smooth ? avg : mx;
        const yA = yOf(useMax);
        const yB = yOf(useMin);
        if (!started) {
          p.moveTo(x, yA);
          started = true;
        } else {
          p.lineTo(x, (lastY + yA) / 2);
          p.lineTo(x, yA);
        }
        if (Math.abs(yB - yA) > 0.4) p.lineTo(x, yB);
        lastY = yB;
      }
      const bright = ch.on ? 1 : 0;
      p.lineWidth = 3.4;
      p.strokeStyle = col;
      p.globalAlpha = (0.05 + (1 - focus) * 0.16) * gain * bright;
      p.shadowColor = col;
      p.shadowBlur = 4 + (1 - focus) * 26;
      p.stroke();
      p.lineWidth = 1.6 - (1 - focus) * 0.5;
      p.globalAlpha = (0.45 + focus * 0.25) * gain * bright;
      p.shadowBlur = 3 + (1 - focus) * 12;
      p.stroke();
      p.shadowBlur = 0;
      p.globalAlpha = 1;
    }
    if (st.beamFind) p.restore();
    p.globalCompositeOperation = 'source-over';


    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.ph, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    /* --- Raster --- */
    const gA = 0.06 + cfg.grat * 0.3;
    const grat =
      cfg.display === 'green'
        ? `rgba(120,220,150,${gA})`
        : `rgba(140,190,215,${gA})`;
    ctx.strokeStyle = grat;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < DIVS_X; i++) {
      ctx.moveTo(px(i * dw), 0);
      ctx.lineTo(px(i * dw), h);
    }
    for (let i = 1; i < DIVS_Y; i++) {
      ctx.moveTo(0, px(i * dh));
      ctx.lineTo(w, px(i * dh));
    }
    ctx.stroke();
    ctx.strokeStyle =
      cfg.display === 'green'
        ? `rgba(150,255,180,${gA * 1.5})`
        : `rgba(170,220,240,${gA * 1.6})`;
    ctx.beginPath();
    ctx.moveTo(0, px(h / 2));
    ctx.lineTo(w, px(h / 2));
    ctx.moveTo(px(w / 2), 0);
    ctx.lineTo(px(w / 2), h);
    ctx.stroke();
    // Feinteilung auf den Mittelachsen
    ctx.beginPath();
    for (let i = 1; i < DIVS_X * 5; i++) {
      if (i % 5 === 0) continue;
      const x = i * (dw / 5);
      ctx.moveTo(px(x), h / 2 - 3);
      ctx.lineTo(px(x), h / 2 + 3);
    }
    for (let i = 1; i < DIVS_Y * 5; i++) {
      if (i % 5 === 0) continue;
      const y = i * (dh / 5);
      ctx.moveTo(w / 2 - 3, px(y));
      ctx.lineTo(w / 2 + 3, px(y));
    }
    ctx.stroke();

    this.readout(ctx, st, dw, dh);
    this.cursors(ctx, st, dw, dh);
    this.glass(ctx, w, h);
  }

  private blank(ctx: CanvasRenderingContext2D, w: number, h: number, mode: string) {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.45, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.75);
    if (mode === 'green') {
      bg.addColorStop(0, '#0d1f14');
      bg.addColorStop(1, '#040a06');
    } else {
      bg.addColorStop(0, '#101a22');
      bg.addColorStop(1, '#04080c');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------------------------------------------------------------- */
  private readout(
    ctx: CanvasRenderingContext2D,
    st: FrameState,
    dw: number,
    dh: number
  ) {
    const cfg = st.cfg;
    const mono = (size = 11, bold = false) =>
      `${bold ? 'bold ' : ''}${size}px "Share Tech Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.save();
    ctx.textBaseline = 'top';

    for (let c = 0; c < 2; c++) {
      const ch = cfg.ch[c];
      const col = cfg.display === 'green' ? CH_GREEN[c] : CH_COLORS[c];
      const y = 6 + c * 14;
      ctx.font = mono(11.5, true);
      ctx.fillStyle = ch.on ? col : 'rgba(150,160,160,0.55)';
      const label =
        `${c + 1}${ch.on ? '' : ' OFF'}  ${fmtVolt(VOLTS_STEPS[ch.voltsIdx], 0)}/div  ` +
        `${ch.coupling}  ${ch.scale}${ch.src === 'probe' ? '' : '·' + ch.src.toUpperCase()}` +
        `${ch.invert ? '  INV' : ''}${ch.bwLimit ? '  BW' : ''}`;
      ctx.fillText(label, 8, y);
      // Positionsmarke links
      const yy = this.h / 2 - ch.posDiv * dh;
      ctx.beginPath();
      ctx.moveTo(0, yy - 5);
      ctx.lineTo(6, yy);
      ctx.lineTo(0, yy + 5);
      ctx.closePath();
      ctx.fillStyle = ch.on ? col : 'rgba(140,150,150,0.5)';
      ctx.fill();
    }

    // Trigger
    ctx.font = mono(11.5, true);
    const tcol =
      st.status === 'run' && st.rec ? (cfg.display === 'green' ? '#8dffb4' : '#7cff9e') : '#ffb347';
    const trigX = (DIVS_X / 2 - cfg.hPosDiv) * dw;
    ctx.fillStyle = tcol;
    ctx.fillText(
      `${cfg.trig.source.toUpperCase()} ${cfg.trig.slope === 'up' ? '↗' : '↘'} ${fmtVolt(cfg.trig.level)}  ${cfg.trig.mode.toUpperCase()}`,
      8,
      this.h - 34
    );
    ctx.font = mono(11.5, true);
    ctx.fillStyle = cfg.display === 'green' ? '#a9ffd0' : '#9fe4ff';
    const magTxt = cfg.mag === 1 ? '' : `  ×${cfg.mag}`;
    ctx.fillText(
      `${fmtTime(TIME_STEPS[cfg.timeIdx], 0)}/div${magTxt}  ${cfg.acq.toUpperCase()}`,
      8,
      this.h - 18
    );
    // Statuszeile rechts
    ctx.textAlign = 'right';
    const stat =
      st.status === 'run'
        ? st.rec
          ? 'TRIG\'D'
          : 'WAIT'
        : st.status === 'wait'
        ? 'WAIT'
        : st.status === 'single'
        ? 'SINGLE ARM'
        : 'STOP';
    ctx.fillStyle =
      stat === "TRIG'D"
        ? tcol
        : stat === 'STOP'
        ? '#ff6b6b'
        : st.blink
        ? '#ffd447'
        : 'rgba(255,212,71,0.45)';
    ctx.fillText(stat, this.w - 8, this.h - 18);
    ctx.textAlign = 'left';

    // Triggermarken oben/unten
    ctx.fillStyle = tcol;
    ctx.beginPath();
    ctx.moveTo(trigX - 5, 0);
    ctx.lineTo(trigX + 5, 0);
    ctx.lineTo(trigX, 6);
    ctx.closePath();
    ctx.fill();
    // Trigger-Level-Marke rechts
    const src = cfg.trig.source === 'ch1' ? 0 : 1;
    const tch = cfg.ch[src];
    const ty = this.h / 2 - (cfg.trig.level / VOLTS_STEPS[tch.voltsIdx]) * dh - tch.posDiv * dh;
    if (ty > -10 && ty < this.h + 10) {
      const col = cfg.display === 'green' ? CH_GREEN[src] : CH_COLORS[src];
      ctx.strokeStyle = col;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(this.w, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.w - 1, ty - 5);
      ctx.lineTo(this.w - 8, ty);
      ctx.lineTo(this.w - 1, ty + 5);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Messungen
    if (st.showMeas) {
      ctx.font = mono(10.5, false);
      for (let c = 0; c < 2; c++) {
        const m = st.measures[c];
        const ch = cfg.ch[c];
        const col = cfg.display === 'green' ? CH_GREEN[c] : CH_COLORS[c];
        ctx.fillStyle = ch.on && m ? col : 'rgba(140,150,150,0.5)';
        const txt = m
          ? `CH${c + 1}  Vpp ${fmtVolt(m.vpp)}  Vrms ${fmtVolt(m.vrms)}  Vavg ${fmtVolt(m.vavg)}  Freq ${fmtHz(m.freq)}  Per ${fmtTime(m.period)}  Duty ${(m.duty * 100).toFixed(1)}%`
          : `CH${c + 1}  ---`;
        ctx.fillText(txt, 8, 36 + c * 14);
      }
    }

    // Cursor
    if (st.cursors.on) {
      const cu = st.cursors;
      const ch = cfg.ch[cu.src];
      const voltsDiv = VOLTS_STEPS[ch.voltsIdx];
      const dv = (cu.y2 - cu.y1) * voltsDiv;
      const dtx = (cu.x2 - cu.x1) * secDivOf(cfg);
      const font = mono(11, true);
      ctx.font = font;
      ctx.fillStyle = '#e8ffe8';
      ctx.textAlign = 'right';
      ctx.fillText(
        `Δt ${fmtTime(dtx, 3)}   1/Δt ${fmtHz(Math.abs(dtx) > 0 ? 1 / dtx : 0)}   ΔV ${fmtVolt(dv)}   CURSOR ${cu.src + 1}`,
        this.w - 8,
        6
      );
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  private cursors(
    ctx: CanvasRenderingContext2D,
    st: FrameState,
    dw: number,
    dh: number
  ) {
    if (!st.cursors.on) return;
    const cu = st.cursors;
    const col = '#f2fff2';
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    for (const x of [cu.x1, cu.x2]) {
      const px1 = px(x * dw);
      ctx.beginPath();
      ctx.moveTo(px1, 0);
      ctx.lineTo(px1, this.h);
      ctx.stroke();
    }
    for (const y of [cu.y1, cu.y2]) {
      const py = px(this.h / 2 - y * dh);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(this.w, py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = 'bold 10px "Share Tech Mono", monospace';
    const tag = (t: string, x: number, y: number) => {
      const wdt = ctx.measureText(t).width + 6;
      ctx.fillRect(x, y, wdt, 13);
      ctx.fillStyle = '#0a1409';
      ctx.fillText(t, x + 3, y + 2);
      ctx.fillStyle = col;
    };
    tag('1', cu.x1 * dw - 6, this.h - 15);
    tag('2', cu.x2 * dw - 6, this.h - 15);
    tag('1', 2, this.h / 2 - cu.y1 * dh - 6);
    tag('2', 2, this.h / 2 - cu.y2 * dh - 6);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  private glass(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createLinearGradient(0, 0, w * 0.7, h);
    g.addColorStop(0, 'rgba(255,255,255,0.075)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.36, 'rgba(255,255,255,0.0)');
    g.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}

function secDivOf(cfg: ScopeCfg) {
  return TIME_STEPS[cfg.timeIdx] / cfg.mag;
}

/** Treffer-Test für Cursor-Griffe; gibt zu verschiebenden Cursor zurück */
export function cursorHit(
  mx: number,
  my: number,
  cu: Cursors,
  dw: number,
  dh: number
): 'x1' | 'x2' | 'y1' | 'y2' | null {
  const tol = 9;
  if (Math.abs(mx - cu.x1 * dw) < tol) return 'x1';
  if (Math.abs(mx - cu.x2 * dw) < tol) return 'x2';
  if (Math.abs(my - (dh * DIVS_Y) / 2 + cu.y1 * dh) < tol) return 'y1';
  if (Math.abs(my - (dh * DIVS_Y) / 2 + cu.y2 * dh) < tol) return 'y2';
  return null;
}
