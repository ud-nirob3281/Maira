/**
 * KaTeX math renderer for the Visual Hub.
 * - Library + fonts bundled locally (dynamic import + CSS → zero startup cost).
 * - Multi-step solutions get step-by-step navigation (Step 2 of 5) so the user
 *   can follow a worked solution one step at a time — the "textbook math"
 *   experience.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutList } from 'lucide-react';

let katexReady: Promise<any> | null = null;

function loadKatex(): Promise<any> {
  if (!katexReady) {
    katexReady = import('katex').then(async mod => {
      await import('katex/dist/katex.min.css');
      return mod.default;
    });
  }
  return katexReady;
}

function renderLatex(katex: any, latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      output: 'html',
      strict: false,
      trust: true,
    });
  } catch {
    return `<span style="color:#94a3b8;font-family:monospace">${latex.replace(/</g, '&lt;')}</span>`;
  }
}

interface MathViewProps {
  title: string;
  steps: string[];
}

export default function MathView({ title, steps }: MathViewProps) {
  const [katex, setKatex] = useState<any>(null);
  const [index, setIndex] = useState(steps.length > 1 ? 0 : -1); // -1 = show all
  const [showAll, setShowAll] = useState(steps.length === 1);

  useEffect(() => {
    let cancelled = false;
    loadKatex().then(k => {
      if (!cancelled) setKatex(k);
    }).catch(err => console.error('[VisualHub] KaTeX load failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const renderedAll = useMemo(() => {
    if (!katex) return [];
    return steps.map(s => renderLatex(katex, s));
  }, [katex, steps]);

  if (!katex) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">
          Preparing math…
        </p>
      </div>
    );
  }

  const multi = steps.length > 1 && !showAll;
  const visible = multi ? [renderedAll[Math.max(0, Math.min(index, steps.length - 1))]] : renderedAll;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 py-3 gap-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/80 text-center max-w-lg">
        {title}
      </p>

      <div className="flex flex-col items-center gap-6 w-full overflow-auto custom-scrollbar py-2">
        {visible.map((html, i) => (
          <div
            key={multi ? 'step' : i}
            className="w-full max-w-2xl px-5 py-4 rounded-xl border border-white/10 bg-[#0d1117]/80 flex justify-center"
          >
            {multi && (
              <span className="self-start mr-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Step {index + 1}
              </span>
            )}
            <div
              className="katex-display-wrap w-full flex justify-center [&_.katex-display]:my-0 [&_.katex]:text-slate-100"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ))}
      </div>

      {steps.length > 1 && (
        <div className="flex items-center gap-2">
          {multi ? (
            <>
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft size={16} className="text-slate-300" />
              </button>
              <span className="text-xs font-mono text-slate-400 min-w-20 text-center">
                {index + 1} / {steps.length}
              </span>
              <button
                onClick={() => setIndex(i => Math.min(steps.length - 1, i + 1))}
                disabled={index === steps.length - 1}
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
                title="Next step"
              >
                <ChevronRight size={16} className="text-slate-300" />
              </button>
              <button
                onClick={() => setShowAll(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono tracking-wider transition cursor-pointer"
                title="Show every step at once"
              >
                <LayoutList size={13} />
                SHOW ALL
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setShowAll(false);
                setIndex(0);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono tracking-wider transition cursor-pointer"
              title="Go through the solution one step at a time"
            >
              <ChevronRight size={13} />
              STEP BY STEP
            </button>
          )}
        </div>
      )}
    </div>
  );
}
