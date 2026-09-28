import type { ScopeApi } from '../hooks/useScope';
import { Btn, Group, Knob, Led } from './Controls';
import { fmtHz, fmtVolt, type WaveShape } from '../lib/scope';

const SHAPES: { id: WaveShape; label: string }[] = [
  { id: 'sine', label: 'Sinus' },
  { id: 'square', label: 'Rechteck' },
  { id: 'triangle', label: 'Dreieck' },
  { id: 'ramp', label: 'Sägezahn' },
  { id: 'pulse', label: 'Impuls' },
  { id: 'noise', label: 'Rauschen' },
  { id: 'am', label: 'AM' },
  { id: 'chirp', label: 'Sweep' },
];

export function GeneratorPanel({ api }: { api: ScopeApi }) {
  const g = api.cfg.gen;
  const logF = Math.log10(Math.max(g.freq, 1));
  return (
    <div className="metal relative rounded-[20px] px-4 py-3" style={{ width: 1180 }}>
      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <div className="engrave text-[13px] font-bold uppercase tracking-[0.28em]">
            Laab&nbsp;FG-12 · Funktionsgenerator
          </div>
          <div className="engrave text-[8.5px] uppercase tracking-[0.16em]">
            1 Hz … 100 kHz · 10 V pp · für den GEN-Eingang der Kanäle
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Led on={g.on} color="green" label="Ausgang" size={9} />
          <Btn
            lit={g.on}
            onClick={() => api.patch({ gen: { ...g, on: !g.on } })}
            title="Generatorausgang ein/aus"
          >
            Ausgang
          </Btn>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <Group title="Funktion" accent="#4b5157">
          <div className="grid grid-cols-4 gap-[5px]">
            {SHAPES.map((s) => (
              <Btn
                key={s.id}
                lit={g.shape === s.id}
                onClick={() => api.patch({ gen: { ...g, shape: s.id } })}
                className="w-[62px]"
              >
                {s.label}
              </Btn>
            ))}
          </div>
        </Group>

        <Knob
          label="Frequenz"
          size={60}
          ticks={11}
          value={logF}
          min={0}
          max={5}
          step={0.005}
          resetTo={3}
          onChange={(v) => api.patch({ gen: { ...g, freq: Math.round(10 ** v * 100) / 100 } })}
          format={() => fmtHz(g.freq)}
          title="Frequenz (logarithmisch 1 Hz … 100 kHz)"
        />
        <Knob
          label="Amplitude"
          size={52}
          ticks={9}
          value={g.amp}
          min={0}
          max={10}
          step={0.02}
          resetTo={2}
          onChange={(v) => api.patch({ gen: { ...g, amp: v } })}
          format={(v) => `${fmtVolt(v, 1)} ss`}
          title="Amplitude (Scheitelwert)"
        />
        <Knob
          label="Gleichanteil"
          size={44}
          ticks={9}
          value={g.offset}
          min={-5}
          max={5}
          step={0.02}
          resetTo={0}
          onChange={(v) => api.patch({ gen: { ...g, offset: v } })}
          format={(v) => fmtVolt(v, 1)}
          title="DC-Offset"
        />
        <Knob
          label="Tastverhältnis"
          size={44}
          ticks={7}
          value={g.duty}
          min={0.05}
          max={0.95}
          step={0.005}
          resetTo={0.25}
          onChange={(v) => api.patch({ gen: { ...g, duty: v } })}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          title="Tastverhältnis bei Impuls / Rechteck"
        />

        <div
          className="mono ml-auto rounded-lg px-3 py-2 text-[10px] leading-[15px]"
          style={{
            background: 'linear-gradient(180deg,#1b2126,#0e1215)',
            color: '#9fe4ff',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          Ausgang: {fmtVolt(g.amp, 2)} ss · {fmtVolt(g.offset, 2)} DC
          <br />
          {fmtHz(g.freq)} · {SHAPES.find((s) => s.id === g.shape)?.label}
          <br />
          <span style={{ color: '#7dffb0' }}>
            Am Oszilloskop Kanal-Quelle auf GEN stellen
          </span>
        </div>
      </div>
    </div>
  );
}
