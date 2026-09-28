import { useEffect, useRef, useState } from 'react';
import type { ScopeApi } from '../hooks/useScope';
import { Knob, Led, Rocker } from './Controls';
import { fmtHz, fmtTime, fmtOhm, circuitNodes, type NodeId } from '../lib/scope';

const CH_COL = ['#e8b700', '#00b7e8'];

const PADS: Record<NodeId, { x: number; y: number; label: string }> = {
  vcc: { x: 96, y: 26, label: '+9V' },
  gnd: { x: 96, y: 236, label: 'GND' },
  q1c: { x: 300, y: 132, label: 'Q1 C' },
  q1b: { x: 264, y: 182, label: 'Q1 B' },
  q2c: { x: 612, y: 132, label: 'Q2 C' },
  q2b: { x: 648, y: 182, label: 'Q2 B' },
  cal: { x: 96, y: 26, label: 'CAL' },
};

const COPPER = '#c98f2e';
const COPPER_HI = '#e6b95c';
const SILK = '#dfe8dc';

/* ---------------- Bauteile ---------------- */

function Resistor({
  x,
  y,
  vertical,
  bands,
  label,
}: {
  x: number;
  y: number;
  vertical?: boolean;
  bands: string[];
  label?: string;
}) {
  const w = 16;
  const h = 46;
  return (
    <g transform={`translate(${x},${y}) ${vertical ? '' : 'rotate(90)'}`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={4}
        fill="#d9c39a"
        stroke="#8a7448"
        strokeWidth={1}
      />
      {bands.map((c, i) => (
        <rect
          key={i}
          x={-w / 2 + 2.5 + i * 3.2}
          y={-h / 2 + 1}
          width={2.2}
          height={h - 2}
          fill={c}
        />
      ))}
      {label && (
        <text x={w / 2 + 4} y={3} fontSize={9} fill={SILK} fontFamily="var(--mono)">
          {label}
        </text>
      )}
    </g>
  );
}

function Cap({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-11} y={-13} width={22} height={26} rx={3} fill="#2b5fa8" stroke="#16305a" />
      <text x={0} y={3} fontSize={8} textAnchor="middle" fill="#dbe7ff" fontFamily="var(--mono)">
        {label}
      </text>
    </g>
  );
}

function Transistor({
  x,
  y,
  mirror,
}: {
  x: number;
  y: number;
  mirror?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y}) ${mirror ? 'scale(-1,1)' : ''}`}>
      {/* Gehäuse TO-92 */}
      <path
        d="M -14 -22 a 14 14 0 0 1 28 0 v 22 h -28 z"
        fill="#1c1f22"
        stroke="#0a0c0d"
        strokeWidth={1}
      />
      <path d="M -14 -20 a 14 12 0 0 1 12 -8 l -2 10 z" fill="rgba(255,255,255,0.10)" />
      <line x1={-7} y1={0} x2={-7} y2={12} stroke="#b9c0c6" strokeWidth={2} />
      <line x1={0} y1={0} x2={0} y2={16} stroke="#b9c0c6" strokeWidth={2} />
      <line x1={7} y1={0} x2={7} y2={12} stroke="#b9c0c6" strokeWidth={2} />
    </g>
  );
}

/* ---------------- Tastkopf ---------------- */

function ProbeTip({
  x,
  y,
  ch,
  onGrab,
  dragging,
}: {
  x: number;
  y: number;
  ch: 0 | 1;
  onGrab: (e: React.PointerEvent) => void;
  dragging: boolean;
}) {
  return (
    <g
      transform={`translate(${x},${y}) rotate(-28)`}
      onPointerDown={onGrab}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <circle r={16} fill="transparent" data-tip={ch} />
      <line x1={0} y1={0} x2={-16} y2={-11} stroke="#8d949a" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={-46} y={-26} width={30} height={17} rx={4} fill={CH_COL[ch]} stroke="#2a2f34" />
      <rect x={-50} y={-23} width={6} height={11} rx={2} fill="#3b4147" />
      <text
        x={-31}
        y={-13.5}
        fontSize={9}
        textAnchor="middle"
        fill="#20242a"
        fontFamily="var(--mono)"
        fontWeight="bold"
      >
        CH{ch + 1}
      </text>
      <rect x={-16} y={-17} width={6} height={8} rx={2} fill="#5b6167" />
    </g>
  );
}

/* ---------------- Platine ---------------- */

export function CircuitBoard({ api }: { api: ScopeApi }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ ch: 0 | 1; x: number; y: number } | null>(null);
  const hoverRef = useRef<NodeId | null>(null);
  const [tick, setTick] = useState(0);

  // Blink-Indikatoren
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60);
    return () => window.clearInterval(id);
  }, []);
  const tNow = (performance.now() + tick * 0) / 1000;
  const nodes = circuitNodes(tNow, api.cfg.circuit);

  const toSvg = (e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = (e as PointerEvent).clientX;
    pt.y = (e as PointerEvent).clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const nearestPad = (x: number, y: number): NodeId | null => {
    let best: NodeId | null = null;
    let bd = 1e9;
    (Object.keys(PADS) as NodeId[]).forEach((n) => {
      if (n === 'cal') return;
      const p = PADS[n];
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    });
    return bd < 26 * 26 ? best : null;
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = toSvg(e);
      hoverRef.current = nearestPad(p.x, p.y);
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d));
    };
    const up = () => {
      const node = hoverRef.current;
      if (node) api.attach(drag.ch, node);
      setDrag(null);
      hoverRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, api]);

  const tipPos = (ch: 0 | 1) => {
    if (drag && drag.ch === ch) return { x: drag.x, y: drag.y };
    const node = api.cfg.ch[ch].node;
    const p = PADS[node] ?? PADS.gnd;
    return { x: p.x + 6, y: p.y - 4 };
  };

  const c = api.cfg.circuit;
  const duty = (api.timing.tOn1 / api.timing.period) * 100;

  return (
    <div
      className="relative rounded-[20px] p-4"
      style={{
        width: 1180,
        background:
          'linear-gradient(180deg, #14522f 0%, #0f4227 45%, #0b3520 100%)',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -4px 12px rgba(0,0,0,0.6), 0 16px 40px rgba(0,0,0,0.55)',
      }}
    >
      {/* Bohrungen */}
      {[
        [22, 22],
        [1158, 22],
        [22, 330],
        [1158, 330],
      ].map(([x, y], i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: x - 7,
            top: y - 7,
            width: 14,
            height: 14,
            background: 'radial-gradient(circle at 40% 35%, #d9dde1 0%, #7d848a 60%, #3b4147 100%)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.2)',
          }}
        />
      ))}

      <div className="flex gap-4">
        {/* Schaltbild */}
        <svg
          ref={svgRef}
          viewBox="0 0 700 262"
          width={660}
          height={247}
          style={{ touchAction: 'none' }}
        >
          <defs>
            <linearGradient id="copper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={COPPER_HI} />
              <stop offset="1" stopColor={COPPER} />
            </linearGradient>
          </defs>

          {/* Versorgungsschienen */}
          <line x1={96} y1={26} x2={720} y2={26} stroke="url(#copper)" strokeWidth={4} />
          <line x1={96} y1={236} x2={720} y2={236} stroke="url(#copper)" strokeWidth={4} />
          <text x={60} y={30} fontSize={11} fill="#ff9d7a" fontFamily="var(--mono)">
            +9V
          </text>
          <text x={60} y={240} fontSize={11} fill="#9fd8ff" fontFamily="var(--mono)">
            GND
          </text>
          {!c.power && (
            <text x={250} y={70} fontSize={13} fill="#ff9d7a" fontFamily="var(--mono)">
              — Schaltung spannungslos —
            </text>
          )}

          {/* Kollektorwiderstände */}
          <line x1={300} y1={26} x2={300} y2={54} stroke="url(#copper)" strokeWidth={3} />
          <line x1={300} y1={100} x2={300} y2={132} stroke="url(#copper)" strokeWidth={3} />
          <Resistor x={300} y={77} vertical bands={['#e8c11a', '#7b4bb0', '#3a2a18']} label="R1 470" />
          <line x1={612} y1={26} x2={612} y2={54} stroke="url(#copper)" strokeWidth={3} />
          <line x1={612} y1={100} x2={612} y2={132} stroke="url(#copper)" strokeWidth={3} />
          <Resistor x={612} y={77} vertical bands={['#e8c11a', '#7b4bb0', '#3a2a18']} label="R2 470" />

          {/* Basiswiderstände */}
          <line x1={196} y1={26} x2={196} y2={64} stroke="url(#copper)" strokeWidth={3} />
          <line x1={196} y1={110} x2={196} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <line x1={196} y1={182} x2={264} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <Resistor x={196} y={87} vertical bands={['#e8c11a', '#7b4bb0', '#d06a1a']} label="R3" />
          <line x1={716} y1={26} x2={716} y2={64} stroke="url(#copper)" strokeWidth={3} />
          <line x1={716} y1={110} x2={716} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <line x1={716} y1={182} x2={648} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <Resistor x={716} y={87} vertical bands={['#e8c11a', '#7b4bb0', '#d06a1a']} label="R4" />

          {/* Kondensatoren */}
          <path
            d="M 300 132 L 300 100 L 424 100"
            fill="none"
            stroke="url(#copper)"
            strokeWidth={3}
          />
          <path
            d="M 456 100 L 556 100 L 556 182 L 648 182"
            fill="none"
            stroke="url(#copper)"
            strokeWidth={3}
          />
          <Cap x={440} y={100} label="C1" />
          <path
            d="M 612 132 L 612 76 L 500 76"
            fill="none"
            stroke="url(#copper)"
            strokeWidth={3}
          />
          <path
            d="M 468 76 L 332 76 L 332 182 L 264 182"
            fill="none"
            stroke="url(#copper)"
            strokeWidth={3}
          />
          <Cap x={484} y={76} label="C2" />

          {/* Transistoren */}
          <line x1={300} y1={132} x2={300} y2={162} stroke="url(#copper)" strokeWidth={3} />
          <line x1={300} y1={132} x2={286} y2={152} stroke="url(#copper)" strokeWidth={3} />
          <line x1={300} y1={196} x2={300} y2={236} stroke="url(#copper)" strokeWidth={3} />
          <line x1={300} y1={196} x2={288} y2={176} stroke="url(#copper)" strokeWidth={3} />
          <line x1={286} y1={150} x2={286} y2={178} stroke="#cfd6da" strokeWidth={4} />
          <line x1={264} y1={182} x2={286} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <polygon points="300,196 292,190 296,184" fill="#cfd6da" />
          <Transistor x={300} y={162} />
          <text x={276} y={170} fontSize={9} fill="#cfd6da" fontFamily="var(--mono)" textAnchor="end">Q1</text>

          <line x1={612} y1={132} x2={612} y2={162} stroke="url(#copper)" strokeWidth={3} />
          <line x1={612} y1={132} x2={626} y2={152} stroke="url(#copper)" strokeWidth={3} />
          <line x1={612} y1={196} x2={612} y2={236} stroke="url(#copper)" strokeWidth={3} />
          <line x1={612} y1={196} x2={624} y2={176} stroke="url(#copper)" strokeWidth={3} />
          <line x1={626} y1={150} x2={626} y2={178} stroke="#cfd6da" strokeWidth={4} />
          <line x1={648} y1={182} x2={626} y2={182} stroke="url(#copper)" strokeWidth={3} />
          <polygon points="612,196 620,190 616,184" fill="#cfd6da" />
          <Transistor x={612} y={162} mirror />
          <text x={636} y={170} fontSize={9} fill="#cfd6da" fontFamily="var(--mono)">Q2</text>

          {/* Messpunkte */}
          {(Object.keys(PADS) as NodeId[])
            .filter((n) => n !== 'cal')
            .map((n) => {
              const p = PADS[n];
              const con = (api.cfg.ch[0].node === n && api.cfg.ch[0].src === 'probe') ||
                (api.cfg.ch[1].node === n && api.cfg.ch[1].src === 'probe');
              return (
                <g key={n}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill="#0d2b1a"
                    stroke={con ? '#ffe27a' : '#8fd8ab'}
                    strokeWidth={con ? 3 : 2}
                  />
                  <circle cx={p.x} cy={p.y} r={3} fill={con ? '#ffe27a' : '#4d8f68'} />
                  <text
                    x={p.x + (n === 'q2b' || n === 'q2c' ? -12 : 12)}
                    y={p.y - 12}
                    fontSize={10}
                    textAnchor={n === 'q2b' || n === 'q2c' ? 'end' : 'start'}
                    fill={con ? '#ffe27a' : SILK}
                    fontFamily="var(--mono)"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}

          {/* Tastköpfe */}
          {[0, 1].map((i) => {
            const pos = tipPos(i as 0 | 1);
            return (
              <ProbeTip
                key={i}
                ch={i as 0 | 1}
                x={pos.x}
                y={pos.y}
                dragging={!!drag && drag.ch === i}
                onGrab={(e) => {
                  e.stopPropagation();
                  const p = toSvg(e);
                  setDrag({ ch: i as 0 | 1, x: p.x, y: p.y });
                }}
              />
            );
          })}

          <text x={250} y={258} fontSize={10} fill={SILK} fontFamily="var(--mono)">
            astabile Kippstufe · T = 0,7·(R3·C1 + R4·C2)
          </text>
        </svg>

        {/* Bedienteil der Schaltung */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center gap-1">
                <Rocker
                  label="9 V"
                  options={['0', '1']}
                  height={40}
                  value={c.power ? 1 : 0}
                  onChange={(v) =>
                    api.patch({ circuit: { ...c, power: v === 1 } })
                  }
                />
              </div>
              <Knob
                label="Frequenz"
                size={52}
                ticks={9}
                value={c.rate}
                min={0.05}
                max={1}
                step={0.005}
                resetTo={0.55}
                onChange={(v) => api.patch({ circuit: { ...c, rate: v } })}
                format={() => fmtHz(api.timing.freq)}
                title="RV1: Basiswiderstände R3/R4 (500 kΩ)"
              />
              <Knob
                label="Symmetrie"
                size={44}
                ticks={7}
                value={c.sym}
                min={0.12}
                max={0.88}
                step={0.005}
                resetTo={0.5}
                onChange={(v) => api.patch({ circuit: { ...c, sym: v } })}
                format={(v) => `${((1 - v) * 100).toFixed(0)}/${(v * 100).toFixed(0)}`}
                title="RV2: Verhältnis R3 zu R4 → Tastverhältnis"
              />
              <Knob
                label="C 33..330n"
                size={44}
                ticks={7}
                value={c.cMult}
                min={0.33}
                max={3.3}
                step={0.01}
                resetTo={1}
                onChange={(v) => api.patch({ circuit: { ...c, cMult: v } })}
                format={(v) => `${(v * 100).toFixed(0)} nF`}
                title="Kondensatorgröße C1/C2"
              />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-3">
                <Led on={c.power && nodes.q1on} color="red" label="Q1" size={11} />
                <Led on={c.power && nodes.q2on} color="green" label="Q2" size={11} />
              </div>
              <div
                className="mono rounded px-2 py-1 text-[10px] leading-[14px]"
                style={{
                  background: 'linear-gradient(180deg,#0d1512,#060a08)',
                  color: '#7dffb0',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)',
                  minWidth: 168,
                }}
              >
                f = {fmtHz(api.timing.freq)}
                <br />
                T = {fmtTime(api.timing.period)}
                <br />
                Duty Q1 = {duty.toFixed(1)} %
                <br />
                R3={fmtOhm(api.timing.rb1)} R4={fmtOhm(api.timing.rb2)}
              </div>
            </div>
          </div>

          <div
            className="rounded-lg px-3 py-2 text-[10.5px] leading-[15px]"
            style={{ background: 'rgba(0,0,0,0.28)', color: '#c9e8d4' }}
          >
            <b>Bedienung:</b> den Tastkopfgriff (CH1/CH2) fassen und auf einen Messpunkt
            ziehen – das Kabel folgt live. Am Oszilloskop Time/Div und Volts/Div so stellen,
            dass zwei bis drei Perioden sichtbar sind, den Trigger-Level mit dem Level-Drehknopf
            in eine Flanke legen. Doppelklick auf einen Drehknopf setzt ihn zurück, das
            Mausrad dreht fein (mit Umschalt sehr fein).
          </div>
          <div className="engrave-dark text-[9px] uppercase">
            Prüfling: astabile Kippstufe · BC547 · 9 V Block · Messpunkte über Lötösen
          </div>
        </div>
      </div>
    </div>
  );
}
