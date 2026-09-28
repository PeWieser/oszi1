import React, { useEffect, useRef } from 'react';

/* ------------------------------------------------------------------ */
/* Drehknopf                                                          */
/* ------------------------------------------------------------------ */

interface KnobProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  size?: number;
  format?: (v: number) => string;
  resetTo?: number;
  ticks?: number;
  color?: string;
  title?: string;
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  size = 58,
  format,
  resetTo,
  ticks = 11,
  color = '#ffcf4a',
  title,
}: KnobProps) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const norm = (value - min) / (max - min || 1);
  const angle = -135 + 270 * norm;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const fine = e.shiftKey ? 0.25 : 1;
      onChangeRef.current(clamp(valueRef.current + dir * step * fine));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [step, min, max]);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value };
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    let v: number;
    if (Number.isInteger(step) && max - min < 40) {
      v = drag.current.v + dy / 9;
      v = Math.round(v / step) * step;
    } else {
      v = drag.current.v + (dy * (max - min)) / 160;
    }
    onChange(clamp(v));
  };
  const onUp = () => {
    drag.current = null;
  };
  return (
    <div className="flex flex-col items-center gap-1 no-select" title={title}>
      <div
        ref={hostRef}
        className="relative"
        style={{ width: size + 14, height: size + 14 }}
        onDoubleClick={() => resetTo !== undefined && onChange(resetTo)}
      >
        {/* Skalenstriche */}
        {Array.from({ length: ticks }).map((_, i) => {
          const a = -135 + (270 * i) / (ticks - 1);
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 origin-bottom"
              style={{
                width: 1,
                height: size / 2 + 5,
                marginLeft: -0.5,
                transform: `translateY(-100%) rotate(${a}deg)`,
                transformOrigin: '50% 100%',
              }}
            >
              <div
                style={{
                  width: 1,
                  height: 4,
                  margin: '0 auto',
                  background: i === Math.round(norm * (ticks - 1)) ? color : 'rgba(60,66,72,0.85)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.45)',
                }}
              />
            </div>
          );
        })}
        <div
          className="knob absolute"
          style={{ inset: 6, width: size, height: size }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="slider"
          aria-valuenow={value}
          aria-label={label}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <div className="knob-ind" style={{ background: `linear-gradient(180deg,#fff,${color})` }} />
          </div>
        </div>
      </div>
      {format && (
        <div
          className="mono rounded px-1 text-[10px] leading-[13px]"
          style={{
            background: 'linear-gradient(180deg,#20262b,#14181b)',
            color,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.25)',
            minWidth: 54,
            textAlign: 'center',
          }}
        >
          {format(value)}
        </div>
      )}
      {label && <div className="engrave text-[9.5px] font-semibold uppercase">{label}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Knopf                                                              */
/* ------------------------------------------------------------------ */

export function Btn({
  children,
  onClick,
  lit = false,
  className = '',
  title,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  lit?: boolean;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className={`btn3d px-2 py-[3px] text-[10px] font-semibold uppercase ${lit ? 'lit' : ''} ${className}`}
      onClick={onClick}
      data-pressed={lit ? 'true' : undefined}
      title={title}
      style={style}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Kippschalter (2/3 Positionen, vertikal)                            */
/* ------------------------------------------------------------------ */

export function Rocker({
  label,
  options,
  value,
  onChange,
  height = 44,
}: {
  label?: string;
  options: string[];
  value: number;
  onChange: (i: number) => void;
  height?: number;
}) {
  const travel = height - 16;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const n = options.length;
      cbRef.current((((valueRef.current + dir) % n) + n) % n);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [options.length]);
  return (
    <div className="flex flex-col items-center gap-1 no-select">
      <div
        ref={hostRef}
        className="slot relative flex flex-col items-center justify-between py-[2px]"
        style={{ width: 20, height }}
        onClick={() => onChange((value + 1) % options.length)}
        title={label}
      >
        {options.map((o, i) => (
          <span
            key={o}
            className="mono text-[7px] leading-[7px]"
            style={{ color: i === value ? '#ffd447' : 'rgba(210,220,228,0.45)' }}
          >
            {o}
          </span>
        ))}
        <div
          className="thumb absolute"
          style={{
            width: 14,
            height: 14,
            left: 3,
            top: 3 + (value / Math.max(options.length - 1, 1)) * travel,
          }}
        />
      </div>
      {label && <div className="engrave text-[9px] font-semibold uppercase">{label}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LED                                                                */
/* ------------------------------------------------------------------ */

export function Led({
  on,
  color = 'red',
  size = 8,
  label,
}: {
  on: boolean;
  color?: 'red' | 'green' | 'yellow';
  size?: number;
  label?: string;
}) {
  const cls =
    color === 'green' ? 'led-green-on' : color === 'yellow' ? 'led-yellow-on' : 'led-on';
  return (
    <div className="flex flex-col items-center gap-[2px] no-select">
      <div
        className={`led ${on ? cls : ''}`}
        style={{ width: size, height: size }}
      />
      {label && <div className="engrave text-[7.5px] uppercase">{label}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Schraube / Fuss                                                    */
/* ------------------------------------------------------------------ */

export function Screw({ size = 12, className = '' }: { size?: number; className?: string }) {
  return <div className={`screw ${className}`} style={{ width: size, height: size }} />;
}

/* ------------------------------------------------------------------ */
/* BNC-Buchse                                                         */
/* ------------------------------------------------------------------ */

export function Bnc({
  label,
  color,
  size = 40,
  innerRef,
}: {
  label: string;
  color?: string;
  size?: number;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col items-center gap-1 no-select">
      <div ref={innerRef} className="bnc" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `inset 0 0 0 2px ${color ?? 'transparent'}55` }}
        />
      </div>
      <div className="engrave text-[9px] font-bold uppercase">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gruppenrahmen                                                      */
/* ------------------------------------------------------------------ */

export function Group({
  title,
  children,
  accent = '#4b5157',
  className = '',
  dark = false,
}: {
  title?: string;
  children: React.ReactNode;
  accent?: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`relative rounded-lg px-2 pt-3 pb-2 ${className}`}
      style={{
        background: dark
          ? 'linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.32))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(0,0,0,0.06))',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      {title && (
        <div
          className="absolute -top-[7px] left-2 rounded px-1 text-[8.5px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: accent,
            background: 'linear-gradient(180deg,#c9cfd5,#b2b9bf)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
