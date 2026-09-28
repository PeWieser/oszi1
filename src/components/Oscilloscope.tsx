import type { RefObject } from 'react';
import type { ScopeApi } from '../hooks/useScope';
import { Crt } from './Crt';
import { Bnc, Btn, Group, Knob, Led, Rocker, Screw } from './Controls';
import {
  TIME_STEPS,
  VOLTS_STEPS,
  fmtOhm,
  fmtTime,
  fmtVolt,
  type ChannelCfg,
  type SrcSel,
} from '../lib/scope';

const CH_COLOR = ['#e8b700', '#00b7e8'];
const SRC_OPTS: SrcSel[] = ['probe', 'gen', 'cal', 'gnd'];

function ChannelPanel({
  api,
  i,
}: {
  api: ScopeApi;
  i: 0 | 1;
}) {
  const ch = api.cfg.ch[i];
  const col = CH_COLOR[i];
  return (
    <Group title={`Kanal ${i + 1}`} accent={col} className="mb-2">
      <div className="flex items-start gap-2">
        <Knob
          label="Volts/Div"
          size={52}
          ticks={12}
          value={ch.voltsIdx}
          min={0}
          max={VOLTS_STEPS.length - 1}
          step={1}
          resetTo={6}
          onChange={(v) => api.setCh(i, { voltsIdx: Math.round(v) })}
          format={(v) => `${fmtVolt(VOLTS_STEPS[Math.round(v)], 0)}/div`}
          color={col}
          title="Vertikale Empfindlichkeit (1-2-5 Folge)"
        />
        <Knob
          label="Position"
          size={38}
          ticks={9}
          value={ch.posDiv}
          min={-4}
          max={4}
          step={0.05}
          resetTo={0}
          onChange={(v) => api.setCh(i, { posDiv: v })}
          format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} div`}
          color={col}
          title="Vertikale Ablenkung des Nullpunktes"
        />
        <div className="flex flex-col items-center gap-1">
          <Rocker
            label="Kopplung"
            height={40}
            options={['AC', 'DC', 'GND']}
            value={ch.coupling === 'AC' ? 0 : ch.coupling === 'DC' ? 1 : 2}
            onChange={(k) => api.setCh(i, { coupling: (['AC', 'DC', 'GND'] as const)[k] })}
          />
          <Rocker
            label="Quelle"
            height={40}
            options={['TST', 'GEN', 'CAL', 'GND']}
            value={SRC_OPTS.indexOf(ch.src)}
            onChange={(k) => api.setCh(i, { src: SRC_OPTS[k] })}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Rocker
            label="Tastkopf"
            height={40}
            options={['x1', 'x10']}
            value={ch.probe === 'x1' ? 0 : 1}
            onChange={(k) => api.setCh(i, { probe: k === 0 ? 'x1' : 'x10' })}
          />
          <Rocker
            label="Anzeige"
            height={40}
            options={['x1', 'x10']}
            value={ch.scale === 'x1' ? 0 : 1}
            onChange={(k) => api.setCh(i, { scale: k === 0 ? 'x1' : 'x10' })}
          />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Btn lit={ch.on} onClick={() => api.setCh(i, { on: !ch.on })} title="Kanal ein/aus">
            An
          </Btn>
          <Btn
            lit={ch.invert}
            onClick={() => api.setCh(i, { invert: !ch.invert })}
            title="Signal invertieren"
          >
            Inv
          </Btn>
          <Btn
            lit={ch.bwLimit}
            onClick={() => api.setCh(i, { bwLimit: !ch.bwLimit })}
            title="Bandbreite begrenzen (Rauschfilter)"
          >
            BW
          </Btn>
          <Btn
            onClick={() => api.setCh(i, { src: 'cal' })}
            title="Kanal intern auf den Kalibriererausgang (1 kHz Rechteck) legen"
          >
            Kal
          </Btn>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="engrave text-[8px] uppercase">
          1 MΩ ‖ {ch.probe === 'x10' ? '~15 pF' : '~110 pF'} · {fmtOhm(ch.probe === 'x10' ? 1e7 : 1e6)}
        </span>
        <span className="mono text-[9px]" style={{ color: col }}>
          {ch.src === 'probe' ? `Messpunkt: ${labelOf(ch)}` : ch.src === 'gen' ? 'interner Generator' : ch.src === 'cal' ? 'Kalibrier 1 kHz' : 'Eingang auf Masse'}
        </span>
      </div>
    </Group>
  );
}

function labelOf(ch: ChannelCfg) {
  const map: Record<string, string> = {
    q1c: 'Q1 Kollektor',
    q1b: 'Q1 Basis',
    q2c: 'Q2 Kollektor',
    q2b: 'Q2 Basis',
    vcc: '+9 V Versorgung',
    gnd: 'Masse',
    cal: 'CAL',
  };
  return map[ch.node] ?? ch.node;
}

export function Oscilloscope({
  api,
  bnc1Ref,
  bnc2Ref,
}: {
  api: ScopeApi;
  bnc1Ref: RefObject<HTMLDivElement | null>;
  bnc2Ref: RefObject<HTMLDivElement | null>;
}) {
  const cfg = api.cfg;
  return (
    <div
      className="metal relative rounded-[28px] px-5 pt-4 pb-4"
      style={{ width: 1180 }}
    >
      {/* Schrauben */}
      <div className="absolute left-3 top-3">
        <Screw />
      </div>
      <div className="absolute right-3 top-3">
        <Screw />
      </div>
      <div className="absolute left-3 bottom-3">
        <Screw />
      </div>
      <div className="absolute right-3 bottom-3">
        <Screw />
      </div>

      {/* Typenschild */}
      <div className="mb-3 flex items-end justify-between px-6">
        <div>
          <div className="engrave text-[19px] font-bold uppercase leading-none tracking-[0.3em]">
            Laab&nbsp;Elektronik
          </div>
          <div className="engrave mt-1 text-[9px] uppercase tracking-[0.2em]">
            Modell OS-2040 · Zweikanal-Oszilloskop 20 MHz · Speicher- / Analogbetrieb
          </div>
        </div>
        <div className="flex items-end gap-4">
          <Led on={cfg.power} color="green" label="Netz" size={9} />
          <Led on={api.trigd} color="yellow" label="Trig'd" size={9} />
          <div className="flex items-center gap-2">
            <span className="engrave text-[9px] uppercase">Netz</span>
            <Rocker
              options={['0', '1']}
              height={34}
              value={cfg.power ? 1 : 0}
              onChange={(v) => api.patch({ power: v === 1 })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Crt api={api} />

        {/* Bedienfelder */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex gap-2">
            <div className="w-[300px]">
              <ChannelPanel api={api} i={0} />
              <ChannelPanel api={api} i={1} />
            </div>

            {/* Horizontal */}
            <div className="w-[210px]">
              <Group title="Ablenkung" accent="#4b5157" className="mb-2">
                <div className="flex items-start gap-3">
                  <Knob
                    label="Time/Div"
                    size={54}
                    ticks={12}
                    value={cfg.timeIdx}
                    min={0}
                    max={TIME_STEPS.length - 1}
                    step={1}
                    resetTo={11}
                    onChange={(v) => api.patch({ timeIdx: Math.round(v) })}
                    format={(v) => `${fmtTime(TIME_STEPS[Math.round(v)], 0)}/div`}
                    title="Zeitablenkung (1-2-5 Folge)"
                  />
                  <Knob
                    label="X-Pos"
                    size={38}
                    ticks={9}
                    value={cfg.hPosDiv}
                    min={-5}
                    max={5}
                    step={0.05}
                    resetTo={0}
                    onChange={(v) => api.patch({ hPosDiv: v })}
                    format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} div`}
                    title="Horizontale Lage des Triggerpunktes"
                  />
                </div>
                <div className="mt-2 flex items-start justify-between">
                  <Rocker
                    label="Vergr."
                    height={40}
                    options={['x1', 'x5']}
                    value={cfg.mag === 1 ? 0 : 1}
                    onChange={(k) => api.patch({ mag: k === 0 ? 1 : 5 })}
                  />
                  <Rocker
                    label="Abtastung"
                    height={52}
                    options={['SMP', 'PK', 'AVG']}
                    value={cfg.acq === 'sample' ? 0 : cfg.acq === 'peak' ? 1 : 2}
                    onChange={(k) =>
                      api.patch({ acq: (['sample', 'peak', 'average'] as const)[k] })
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <Btn onClick={() => api.autoset()} title="Automatische Ablenkanpassung">
                      Auto Set
                    </Btn>
                    <Btn
                      onClick={() =>
                        api.patch({
                          hPosDiv: 0,
                          timeIdx: 11,
                          mag: 1,
                        })
                      }
                      title="Ablenkung zurücksetzen"
                    >
                      Norm
                    </Btn>
                  </div>
                </div>
              </Group>

              {/* Trigger */}
              <Group title="Trigger" accent="#4b5157">
                <div className="flex items-start gap-2">
                  <Knob
                    label="Level"
                    size={48}
                    ticks={11}
                    value={cfg.trig.level}
                    min={-10}
                    max={10}
                    step={0.05}
                    resetTo={0}
                    onChange={(v) => api.patch({ trig: { ...cfg.trig, level: v } })}
                    format={(v) => fmtVolt(v)}
                    title="Triggerschwelle"
                  />
                  <div className="flex flex-col gap-1">
                    <Rocker
                      label="Modus"
                      height={52}
                      options={['AUTO', 'NORM', 'SGGL']}
                      value={cfg.trig.mode === 'auto' ? 0 : cfg.trig.mode === 'norm' ? 1 : 2}
                      onChange={(k) => {
                        const mode = (['auto', 'norm', 'single'] as const)[k];
                        api.patch({ trig: { ...cfg.trig, mode } });
                        if (mode === 'single') api.armSingle();
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Rocker
                      label="Flanke"
                      height={34}
                      options={['↗', '↘']}
                      value={cfg.trig.slope === 'up' ? 0 : 1}
                      onChange={(k) =>
                        api.patch({ trig: { ...cfg.trig, slope: k === 0 ? 'up' : 'down' } })
                      }
                    />
                    <Rocker
                      label="Quelle"
                      height={34}
                      options={['K1', 'K2']}
                      value={cfg.trig.source === 'ch1' ? 0 : 1}
                      onChange={(k) =>
                        api.patch({ trig: { ...cfg.trig, source: k === 0 ? 'ch1' : 'ch2' } })
                      }
                    />
                    <Rocker
                      label="Trig-Kopp."
                      height={34}
                      options={['AC', 'DC', 'HF']}
                      value={cfg.trig.coupling === 'AC' ? 0 : cfg.trig.coupling === 'DC' ? 1 : 2}
                      onChange={(k) =>
                        api.patch({
                          trig: {
                            ...cfg.trig,
                            coupling: (['AC', 'DC', 'HF'] as const)[k],
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </Group>
            </div>

            {/* Betriebsart */}
            <div className="w-[118px]">
              <Group title="Betrieb" accent="#4b5157" dark>
                <div className="flex flex-col items-center gap-2">
                  <Led
                    on={api.status === 'run'}
                    color="green"
                    label="Lauf"
                    size={10}
                  />
                  <Led
                    on={api.status === 'stop'}
                    color="red"
                    label="Stopp"
                    size={10}
                  />
                  <div className="flex w-full flex-col gap-[6px] pt-1">
                    <Btn className="w-full" onClick={api.toggleRun} title="Aufnahme starten/anhalten">
                      {api.running ? 'Stopp' : 'Lauf'}
                    </Btn>
                    <Btn className="w-full" onClick={api.armSingle} title="Einzelabtastung">
                      Single
                    </Btn>
                    <Btn
                      className="w-full"
                      onClick={() => api.setCursors((c) => ({ ...c, on: !c.on }))}
                      lit={api.cursors.on}
                      title="Cursor"
                    >
                      Cursor
                    </Btn>
                    <Btn className="w-full" onClick={api.autoset}>
                      Auto Set
                    </Btn>
                    <Btn className="w-full" onClick={api.reset} title="Grundeinstellung">
                      Reset
                    </Btn>
                  </div>
                </div>
              </Group>
            </div>
          </div>

          {/* Anschlussfeld */}
          <div
            className="metal-dark flex items-end justify-between rounded-xl px-4 py-3"
          >
            <div className="flex items-end gap-5">
              <Bnc
                label="CH1 · 1 MΩ"
                color={CH_COLOR[0]}
                innerRef={bnc1Ref}
              />
              <Bnc label="CH2 · 1 MΩ" color={CH_COLOR[1]} innerRef={bnc2Ref} />
              <div className="flex flex-col items-center gap-1">
                <div className="banana h-[26px] w-[26px]" />
                <div className="engrave-dark text-[8.5px] uppercase">Masse</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    background:
                      'radial-gradient(circle at 35% 28%, #b9c0c6 0%, #6f767d 60%, #454b51 100%)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.6)',
                  }}
                />
                <div className="engrave-dark text-[8.5px] uppercase">Kal. 1 kHz</div>
              </div>
            </div>
            <div className="text-right">
              <div className="engrave-dark text-[8px] uppercase leading-relaxed">
                Tastkopf-Kalibrierung 5 V pp · 1 kHz
                <br />
                Max. Eingang 300 V (DC+ACpk) · CAT I
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
