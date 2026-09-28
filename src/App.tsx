import { useEffect, useRef } from 'react';
import { useScope } from './hooks/useScope';
import { Oscilloscope } from './components/Oscilloscope';
import { CircuitBoard } from './components/CircuitBoard';
import { GeneratorPanel } from './components/GeneratorPanel';
import { CableLayer } from './components/CableLayer';

export default function App() {
  const api = useScope();
  const bnc1Ref = useRef<HTMLDivElement | null>(null);
  const bnc2Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        api.toggleRun();
      } else if (e.key.toLowerCase() === 's') {
        api.armSingle();
      } else if (e.key.toLowerCase() === 'a') {
        api.autoset();
      } else if (e.key.toLowerCase() === 'c') {
        api.setCursors((c) => ({ ...c, on: !c.on }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden py-8">
      <div className="mx-auto w-[1220px]">
        <header className="mb-5 flex items-end justify-between">
          <div>
            <h1
              className="text-[26px] font-bold uppercase leading-none tracking-[0.28em]"
              style={{ color: '#e8eef2', textShadow: '0 2px 0 rgba(0,0,0,0.7)' }}
            >
              Oszilloskop-Labor
            </h1>
            <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Voll funktionsfähiges Zweikanalgerät · Trigger, Cursor, Messung · Prüfling:
              astabile Kippstufe
            </p>
          </div>
          <div className="text-right text-[10px] uppercase tracking-[0.16em] text-zinc-400">
            Leertaste Lauf/Stopp · S Single · A Auto Set · C Cursor
          </div>
        </header>

        <div className="relative">
          <CableLayer
            bnc1Ref={bnc1Ref}
            bnc2Ref={bnc2Ref}
            color1="#ffd447"
            color2="#4fd8ff"
          />
          <div className="relative z-10 flex flex-col gap-6">
            <Oscilloscope api={api} bnc1Ref={bnc1Ref} bnc2Ref={bnc2Ref} />
            <CircuitBoard api={api} />
            <GeneratorPanel api={api} />
          </div>
        </div>

        <section
          className="mt-6 grid grid-cols-4 gap-4 rounded-xl p-4 text-[11px] leading-[17px] text-zinc-300"
          style={{ background: 'rgba(0,0,0,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              Vertikal
            </h3>
            Volts/Div (1‑2‑5), Position, Kopplung AC/DC/GND, Invert, Bandbreite, Tastkopf
            x1/x10 und Skalierung x1/x10 – stimmen Tastkopf und Anzeige nicht überein, wird
            das Signal um den Faktor 10 falsch angezeigt (wie am echten Gerät).
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              Ablenkung &amp; Trigger
            </h3>
            Time/Div, X‑Position, Vergrößerung ×5, Abtastung SMP/Peak/Average. Trigger mit
            Level, Flanke, Quelle, Kopplung und AUTO/NORM/SINGLE – im NORM‑Modus bleibt das
            Bild stehen, solange kein Triggerpunkt gefunden wird.
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              Auswertung
            </h3>
            Automatische Messung von Vpp, Vrms, Vavg, Frequenz, Periode und Tastverhältnis.
            Cursor (Taste C) greifen und ziehen: Δt, 1/Δt und ΔV werden live angezeigt.
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              Prüfling
            </h3>
            Astabile Kippstufe mit BC547: T ≈ 0,7·(R3·C1 + R4·C2). Die Potis ändern
            Frequenz und Tastverhältnis, der Schalter legt die Versorgung still. Die Tastköpfe
            belasten die Kollektoren – x1 macht die Flanken sichtbar langsamer als x10.
          </div>
        </section>
      </div>
    </div>
  );
}
