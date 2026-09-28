import { useEffect, useState } from 'react';
import type { ScopeApi } from '../hooks/useScope';
import { Knob, Btn, Led, Screw } from './Controls';

export function Crt({ api }: { api: ScopeApi }) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    api.setBeamFind(pressed);
  }, [pressed, api]);

  return (
    <div className="crt-bezel relative rounded-[22px] p-4" style={{ width: 470 }}>
      <div className="absolute left-2 top-2">
        <Screw size={11} />
      </div>
      <div className="absolute right-2 top-2">
        <Screw size={11} />
      </div>

      {/* Röhre */}
      <div
        className="crt-glass relative bg-black"
        style={{ width: 438, height: 330, borderRadius: 14 }}
      >
        <canvas
          ref={api.canvasRef}
          className="block h-full w-full cursor-crosshair touch-none"
          onPointerDown={api.onScreenPointer}
          onPointerMove={api.onScreenPointer}
          onPointerUp={api.onScreenPointer}
        />
        {/* Glasreflex */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 22%, rgba(255,255,255,0) 40%)',
            borderRadius: 14,
          }}
        />
      </div>

      {/* Bildschirm-Bedienelemente */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex items-end gap-3">
          <Knob
            label="Intens"
            size={40}
            ticks={7}
            value={api.cfg.intensity}
            min={0.1}
            max={1}
            step={0.01}
            onChange={(v) => api.patch({ intensity: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Knob
            label="Focus"
            size={40}
            ticks={7}
            value={api.cfg.focus}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => api.patch({ focus: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Knob
            label="Raster"
            size={40}
            ticks={7}
            value={api.cfg.grat}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => api.patch({ grat: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-2">
              <Led on={api.status === 'run' && api.trigd} color="green" label="Trig'd" />
              <Led on={api.status === 'wait' || api.status === 'single'} color="yellow" label="Ready" />
            </div>
            <Btn
              className="w-[74px]"
              lit={pressed}
              onClick={() => {
                setPressed(true);
                window.setTimeout(() => setPressed(false), 900);
              }}
              title="Beam Find: Strahl auf Bildmitte zusammenziehen"
            >
              Beam Find
            </Btn>
          </div>
          <div className="flex flex-col gap-1">
            <Btn
              lit={api.cfg.display === 'green'}
              onClick={() => api.patch({ display: api.cfg.display === 'green' ? 'color' : 'green' })}
              title="Emulationsart der Röhre"
            >
              Phosphor
            </Btn>
            <div className="flex gap-1">
              <Btn
                lit={api.cursors.on}
                onClick={() => api.setCursors((c) => ({ ...c, on: !c.on }))}
                title="Cursor ein/aus – Linien im Bild greifen und ziehen"
              >
                Cursor
              </Btn>
              <Btn
                lit={api.showMeas}
                onClick={() => api.setShowMeas(!api.showMeas)}
                title="Automatische Messungen ein/aus"
              >
                Messen
              </Btn>
            </div>
          </div>
        </div>
      </div>
      {api.cursors.on && (
        <div className="mt-2 flex items-center gap-2">
          <span className="engrave-dark text-[9px] uppercase">Cursor Quelle</span>
          {[0, 1].map((i) => (
            <Btn
              key={i}
              lit={api.cursors.src === i}
              onClick={() => api.setCursors((c) => ({ ...c, src: i as 0 | 1 }))}
            >
              CH{i + 1}
            </Btn>
          ))}
          <span className="engrave-dark ml-2 text-[8.5px] uppercase">
            gestrichelte Linien mit der Maus ziehen
          </span>
        </div>
      )}
    </div>
  );
}
