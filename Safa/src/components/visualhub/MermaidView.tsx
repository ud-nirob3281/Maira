/**
 * Mermaid diagram renderer for the Visual Hub.
 * - Library is BUNDLED LOCALLY via vite (dynamic import → zero startup cost,
 *   no CDN dependency, works with the app's existing online architecture).
 * - Initialized once with a dark theme matching Safa's cyan-on-black UI.
 * - Failures show a calm, non-technical note (developer detail → console only).
 */

import { useEffect, useRef, useState } from 'react';

let mermaidReady: Promise<any> | null = null;

function loadMermaid(): Promise<any> {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(mod => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        themeVariables: {
          background: '#0a0a12',
          mainBkg: '#0d1117',
          secondaryColor: '#111827',
          tertiaryColor: '#161b22',
          clusterBkg: '#111827',
          edgeLabelBackground: '#0d1117',
          primaryBorderColor: '#00e5ff33',
          secondaryBorderColor: '#1e293b',
          tertiaryBorderColor: '#1e293b',
          nodeBorder: '#00e5ff33',
          clusterBorder: '#1e293b',
          primaryColor: '#0d1117',
          primaryTextColor: '#e2e8f0',
          secondaryTextColor: '#94a3b8',
          tertiaryTextColor: '#e2e8f0',
          lineColor: '#00e5ff70',
          titleColor: '#00e5ff',
          fontFamily: 'Inter, ui-sans-serif, sans-serif',
          fontSize: '13px',
          pie1: '#00e5ff22', pie2: '#3b82f622', pie3: '#8b5cf622',
          pie4: '#10b98122', pie5: '#f59e0b22', pie6: '#ef444422',
          pie7: '#06b6d422', pie8: '#a855f722',
          pieLegendTextColor: '#e2e8f0',
          pieSectionTextColor: '#e2e8f0',
          actorBkg: '#0d1117',
          actorBorder: '#00e5ff33',
          actorTextColor: '#e2e8f0',
          actorLineColor: '#1e293b',
          signalColor: '#00e5ff70',
          signalTextColor: '#e2e8f0',
          labelBoxBkgColor: '#0d1117',
          labelBoxBorderColor: '#1e293b',
          labelTextColor: '#e2e8f0',
          loopTextColor: '#94a3b8',
          noteBorderColor: '#1e293b',
          noteBkgColor: '#111827',
          noteTextColor: '#e2e8f0',
          activationBorderColor: '#00e5ff44',
          activationBkgColor: '#111827',
          gridColor: '#1e293b',
          sectionBkgColor: '#0d1117',
          taskBorderColor: '#00e5ff33',
          taskBkgColor: '#111827',
          taskTextColor: '#e2e8f0',
          classText: '#e2e8f0',
        },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

interface MermaidViewProps {
  code: string;
  /** Changing this key forces a fresh render (used by diagram edit mode). */
  renderKey?: string | number;
  onSvg?: (svg: SVGSVGElement | null) => void;
}

export default function MermaidView({ code, renderKey, onSvg }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    // Debounce so rapid edits don't queue renders.
    const timer = setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        const { svg } = await mermaid.render(
          `vh-mmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code,
        );
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        const el = containerRef.current.querySelector('svg');
        if (el) {
          el.style.maxWidth = '100%';
          el.style.height = 'auto';
        }
        onSvg?.(el as SVGSVGElement | null);
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        // Developer detail stays in the console; the user sees a calm note.
        console.error('[VisualHub] Mermaid render error:', err);
        onSvg?.(null);
        setState('error');
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, renderKey]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      {state === 'loading' && (
        <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">
          Rendering diagram…
        </p>
      )}
      {state === 'error' && (
        <div className="max-w-md p-5 rounded-xl border border-white/10 bg-white/5 text-center">
          <p className="text-sm text-slate-300">
            This diagram could not be drawn right now.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            You can tweak the diagram code with the Edit button, or ask Safa to redraw it.
          </p>
        </div>
      )}
      <div ref={containerRef} className="w-full flex items-center justify-center overflow-hidden" />
    </div>
  );
}
