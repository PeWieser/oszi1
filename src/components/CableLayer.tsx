import { useEffect, useRef, useState } from 'react';

interface Geo {
  bnc: { x: number; y: number } | null;
  tip: { x: number; y: number } | null;
}

/** Zeichnet die Tastkopfkabel von den BNC-Buchsen zu den Messpunkten */
export function CableLayer({
  bnc1Ref,
  bnc2Ref,
  color1,
  color2,
}: {
  bnc1Ref: React.RefObject<HTMLDivElement | null>;
  bnc2Ref: React.RefObject<HTMLDivElement | null>;
  color1: string;
  color2: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 900 });
  const [geo, setGeo] = useState<[Geo, Geo]>([
    { bnc: null, tip: null },
    { bnc: null, tip: null },
  ]);
  const last = useRef<[Geo, Geo]>([
    { bnc: null, tip: null },
    { bnc: null, tip: null },
  ]);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      const host = hostRef.current;
      if (host) {
        const r = host.getBoundingClientRect();
        setSize((s) => (Math.abs(s.w - r.width) > 1 || Math.abs(s.h - r.height) > 1
          ? { w: r.width, h: r.height }
          : s));
      }
      const res: [Geo, Geo] = [{ ...last.current[0] }, { ...last.current[1] }];
      let changed = false;
      ([bnc1Ref, bnc2Ref] as const).forEach((ref, i) => {
        const g = last.current[i];
        const el = ref.current;
        const host2 = hostRef.current;
        if (!el || !host2) return;
        const b = el.getBoundingClientRect();
        const h = host2.getBoundingClientRect();
        const nb = { x: b.left - h.left + b.width / 2, y: b.top - h.top + b.height / 2 };
        if (!g.bnc || Math.abs(g.bnc.x - nb.x) > 0.5 || Math.abs(g.bnc.y - nb.y) > 0.5) changed = true;
        res[i].bnc = nb;
        const tip = document.querySelector(`[data-tip="${i}"]`) as SVGCircleElement | null;
        if (tip) {
          const t = tip.getBoundingClientRect();
          const nt = { x: t.left - h.left + t.width / 2, y: t.top - h.top + t.height / 2 };
          if (!g.tip || Math.abs(g.tip.x - nt.x) > 0.5 || Math.abs(g.tip.y - nt.y) > 0.5) changed = true;
          res[i].tip = nt;
        }
      });
      if (changed) {
        last.current = res;
        setGeo(res);
      }
      raf = requestAnimationFrame(read);
    };
    raf = requestAnimationFrame(read);
    return () => cancelAnimationFrame(raf);
  }, [bnc1Ref, bnc2Ref]);

  const path = (g: Geo, droop: number) => {
    if (!g.bnc || !g.tip) return '';
    const { bnc: a, tip: b } = g;
    const dy = Math.max(70, (b.y - a.y) * 0.35);
    return `M ${a.x} ${a.y} C ${a.x + (b.x - a.x) * 0.15} ${a.y + dy}, ${
      b.x - (b.x - a.x) * 0.35
    } ${b.y - dy - droop}, ${b.x} ${b.y}`;
  };

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-20"
      style={{ overflow: 'visible' }}
    >
      <svg width={size.w} height={size.h} style={{ overflow: 'visible' }}>
        {[0, 1].map((i) => {
          const g = geo[i];
          const col = i === 0 ? color1 : color2;
          const d = path(g, i * 26);
          if (!d) return null;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#15181b" strokeWidth={8} strokeLinecap="round" opacity={0.95} />
              <path d={d} fill="none" stroke="#3a4046" strokeWidth={5} strokeLinecap="round" />
              <path
                d={d}
                fill="none"
                stroke={col}
                strokeWidth={1.6}
                strokeLinecap="round"
                opacity={0.85}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
