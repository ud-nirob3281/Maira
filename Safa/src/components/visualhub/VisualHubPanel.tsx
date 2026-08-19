/**
 * Visual Hub panel — Safa's generative-visual showcase (Stonic-AI-inspired).
 *
 * Behavior contract:
 *  - Lives INSIDE the app window as an overlay (never an external OS window).
 *  - X button closes the panel; generation itself runs server-side, so closing
 *    never cancels a running task — reopening shows its live state.
 *  - Draggable by the header, resizable via the bottom-right grip, and
 *    full-bleed on small screens (responsive).
 *  - Renders: AI images (zoom/pan), Mermaid diagrams (editable), KaTeX math
 *    (step-by-step), data charts, and study flashcards — all libraries bundled
 *    locally, lazily loaded only when this panel opens.
 *  - Errors stay calm and non-technical; Safa speaks failures by voice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Download, Pencil, Trash2, Image as ImageIcon, GitBranch,
  Sigma, BarChart3, Layers, Loader2,
} from 'lucide-react';
import type { VisualItem, VisualType } from '../../lib/visualHubTypes';
import MermaidView from './MermaidView';
import MathView from './MathView';
import ChartView from './ChartView';
import FlashcardsView from './FlashcardsView';
import ZoomPane from './ZoomPane';

interface VisualHubPanelProps {
  isOpen: boolean;
  onClose: () => void;
  visuals: VisualItem[];
  onDelete: (id: string) => void;
}

const TYPE_META: Record<VisualType, { label: string; icon: typeof ImageIcon; color: string }> = {
  image: { label: 'IMAGE', icon: ImageIcon, color: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10' },
  diagram: { label: 'DIAGRAM', icon: GitBranch, color: 'text-violet-300 border-violet-400/40 bg-violet-500/10' },
  math: { label: 'MATH', icon: Sigma, color: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' },
  chart: { label: 'CHART', icon: BarChart3, color: 'text-amber-300 border-amber-400/40 bg-amber-500/10' },
  flashcards: { label: 'CARDS', icon: Layers, color: 'text-pink-300 border-pink-400/40 bg-pink-500/10' },
};

const FILTERS: { key: VisualType | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'image', label: 'IMAGES' },
  { key: 'diagram', label: 'DIAGRAMS' },
  { key: 'math', label: 'MATH' },
  { key: 'chart', label: 'CHARTS' },
  { key: 'flashcards', label: 'CARDS' },
];

function timestampOf(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function VisualHubPanel({ isOpen, onClose, visuals, onDelete }: VisualHubPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VisualType | 'all'>('all');
  const [editMode, setEditMode] = useState(false);
  const [editedCode, setEditedCode] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Panel geometry (responsive: full-bleed under 640px width).
  const [isCompact, setIsCompact] = useState(false);
  const [size, setSize] = useState({ w: 1060, h: 660 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragHeader = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const dragResize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? visuals : visuals.filter(v => v.type === filter)),
    [visuals, filter],
  );

  // Auto-follow the newest visual (matches Stonic's auto-expand behavior) and
  // reset per-visual ephemeral state when the selection changes.
  const latestId = visuals[0]?.id ?? null;
  useEffect(() => {
    if (latestId && latestId !== selectedId) {
      setSelectedId(latestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  const selected = useMemo(
    () => visuals.find(v => v.id === selectedId) ?? filtered[0] ?? null,
    [visuals, selectedId, filtered],
  );

  useEffect(() => {
    setEditMode(false);
    setEditedCode(null);
  }, [selected?.id]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (isCompact) return;
    // Never hijack clicks on interactive children (X close, download, edit,
    // delete): pointer-capturing the header would swallow their click events.
    if (
      (e.target as HTMLElement).closest(
        'button, input, textarea, a, select, [role="button"]',
      )
    )
      return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragHeader.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragHeader.current;
    if (!d) return;
    const maxX = window.innerWidth * 0.4;
    const maxY = window.innerHeight * 0.4;
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, d.ox + (e.clientX - d.x))),
      y: Math.max(-maxY, Math.min(maxY, d.oy + (e.clientY - d.y))),
    });
  };
  const onHeaderPointerUp = () => {
    dragHeader.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragResize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    const d = dragResize.current;
    if (!d) return;
    setSize({
      w: Math.min(window.innerWidth - 24, Math.max(480, d.w + (e.clientX - d.x))),
      h: Math.min(window.innerHeight - 24, Math.max(420, d.h + (e.clientY - d.y))),
    });
  };
  const onResizePointerUp = () => {
    dragResize.current = null;
  };

  const svgRef = useRef<SVGSVGElement | null>(null);

  const download = useCallback(async () => {
    if (!selected) return;
    try {
      if (selected.type === 'image' && selected.src) {
        const res = await fetch(selected.src);
        const blob = await res.blob();
        const ext = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : 'png';
        triggerDownload(URL.createObjectURL(blob), `safa-visual-${selected.id}.${ext}`);
      } else {
        const svg = svgRef.current;
        if (!svg) return;
        const serialized = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([serialized], { type: 'image/svg+xml' });
        triggerDownload(URL.createObjectURL(blob), `safa-visual-${selected.id}.svg`);
      }
    } catch (err) {
      console.error('[VisualHub] Download failed:', err);
    }
  }, [selected]);

  const canDownload =
    !!selected && selected.status === 'ready' &&
    (selected.type === 'image' || (selected.type === 'diagram' && !editMode));

  const meta = selected ? TYPE_META[selected.type] : null;
  const statusLabel =
    selected?.status === 'generating'
      ? selected.type === 'image' ? 'GENERATING' : 'RENDERING'
      : selected?.status === 'failed'
        ? 'UNAVAILABLE'
        : 'ACTIVE';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="vh-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
          />
          <motion.div
            key="vh-panel"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-none"
          >
            <div
              className="pointer-events-auto flex flex-col rounded-2xl border border-white/10 bg-[#0a0a12]/95 backdrop-blur-2xl shadow-[0_0_80px_-20px_rgba(0,229,255,0.25)] overflow-hidden"
              style={
                isCompact
                  ? { width: '100%', height: '100%' }
                  : {
                      width: Math.min(size.w, window.innerWidth - 24),
                      height: Math.min(size.h, window.innerHeight - 24),
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                    }
              }
            >
              {/* ── Header (drag handle) ── */}
              <div
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                onPointerCancel={onHeaderPointerUp}
                className={`flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0c121d]/80 shrink-0 ${isCompact ? '' : 'cursor-move'}`}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                      selected?.status === 'generating'
                        ? 'bg-cyan-400 animate-ping'
                        : selected?.status === 'failed'
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      selected?.status === 'generating' ? 'bg-cyan-400' : selected?.status === 'failed' ? 'bg-rose-400' : 'bg-emerald-400'
                    }`}
                  />
                </span>
                <h3 className="text-xs font-mono tracking-widest text-slate-200 select-none">
                  VISUAL HUB
                </h3>
                <span className="text-[9px] font-mono tracking-widest text-slate-500 select-none">
                  {statusLabel} · {visuals.length} ITEMS
                </span>

                <div className="flex-1" />

                {meta && selected && (
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-mono tracking-widest ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                )}
                {canDownload && (
                  <button
                    onClick={download}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition cursor-pointer"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                )}
                {selected?.type === 'diagram' && !editMode && selected.status === 'ready' && (
                  <button
                    onClick={() => {
                      setEditedCode(selected.mermaidCode || '');
                      setEditMode(true);
                    }}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition cursor-pointer"
                    title="Edit diagram code"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {selected && (
                  <button
                    onClick={() => onDelete(selected.id)}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 transition cursor-pointer"
                    title="Remove from Visual Hub"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {/* X close — visual tasks keep running in the background */}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 transition cursor-pointer"
                  title="Close Visual Hub (running tasks continue)"
                >
                  <X size={14} />
                </button>
              </div>

              {/* ── Viewer ── */}
              <div className="relative flex-1 min-h-0 overflow-hidden">
                {!selected && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
                      <GitBranch size={22} className="text-cyan-300/70" />
                    </div>
                    <p className="text-sm text-slate-300 max-w-sm">
                      Ask Safa to generate a diagram, image, chart, math solution or flashcards —
                      it appears here instantly.
                    </p>
                    <p className="text-xs text-slate-500">
                      Try: “Explain photosynthesis with a diagram” · “Draw a flowchart of the login system”
                    </p>
                  </div>
                )}

                {selected?.status === 'generating' && (
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <Loader2 size={26} className="text-cyan-300 animate-spin" />
                    <p className="text-xs font-mono tracking-widest text-slate-400 uppercase">
                      Synthesizing visual output…
                    </p>
                    <p className="text-[11px] text-slate-600 max-w-xs text-center">
                      You can close this panel — Safa keeps working and it will appear in the gallery.
                    </p>
                  </div>
                )}

                {selected?.status === 'failed' && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
                      <X size={22} className="text-rose-300/70" />
                    </div>
                    <p className="text-sm text-slate-300">{selected.errorNote || 'This visual could not be created.'}</p>
                    <p className="text-xs text-slate-500">Ask Safa to try again in a moment.</p>
                  </div>
                )}

                {selected?.status === 'ready' && selected.type === 'image' && (
                  <ZoomPane>
                    <img
                      src={selected.src}
                      alt={selected.title}
                      draggable={false}
                      className="max-w-[92%] max-h-[88%] object-contain rounded-xl border border-white/10 select-none"
                    />
                  </ZoomPane>
                )}

                {selected?.status === 'ready' && selected.type === 'diagram' && (
                  editMode ? (
                    <div className="flex flex-col h-full gap-2 p-4">
                      <textarea
                        value={editedCode ?? ''}
                        onChange={e => setEditedCode(e.target.value)}
                        spellCheck={false}
                        className="flex-1 w-full rounded-xl border border-cyan-400/20 bg-[#0d1117] p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-cyan-400/40 custom-scrollbar"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditMode(false);
                            setEditedCode(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono tracking-wider transition cursor-pointer"
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={() => {
                            setRenderKey(k => k + 1);
                            setEditMode(false);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono tracking-wider transition cursor-pointer"
                        >
                          APPLY
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ZoomPane>
                      <div className="max-w-[96%]">
                        <MermaidView
                          code={editedCode ?? selected.mermaidCode ?? ''}
                          renderKey={`${selected.id}-${renderKey}`}
                          onSvg={el => (svgRef.current = el)}
                        />
                      </div>
                    </ZoomPane>
                  )
                )}

                {selected?.status === 'ready' && selected.type === 'math' && (
                  <MathView title={selected.title} steps={selected.mathSteps || []} />
                )}
                {selected?.status === 'ready' && selected.type === 'chart' && (
                  <ChartView chartType={selected.chartType || 'bar'} data={selected.chartData || []} />
                )}
                {selected?.status === 'ready' && selected.type === 'flashcards' && (
                  <FlashcardsView topic={selected.title} cards={selected.cards || []} />
                )}
              </div>

              {/* ── Gallery rail ── */}
              <div className="shrink-0 border-t border-white/10 bg-[#0c121d]/80">
                <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 overflow-x-auto custom-scrollbar">
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-widest border transition cursor-pointer whitespace-nowrap ${
                        filter === f.key
                          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                          : 'border-white/10 bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-4 pb-3 pt-1.5 overflow-x-auto custom-scrollbar min-h-[68px]">
                  {filtered.length === 0 && (
                    <p className="text-[10px] font-mono tracking-widest text-slate-600 uppercase py-4">
                      Nothing here yet
                    </p>
                  )}
                  {filtered.map(v => {
                    const m = TYPE_META[v.type];
                    const Icon = m.icon;
                    const active = v.id === selected?.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedId(v.id)}
                        title={`${v.title} · ${timestampOf(v.createdAt)}`}
                        className={`relative shrink-0 w-16 h-12 rounded-lg border overflow-hidden transition cursor-pointer group ${
                          active ? 'border-cyan-400/60 ring-1 ring-cyan-400/30' : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        {v.type === 'image' && v.src && v.status === 'ready' ? (
                          <img src={v.src} alt={v.title} className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
                            {v.status === 'generating' ? (
                              <Loader2 size={14} className="text-cyan-300 animate-spin" />
                            ) : (
                              <Icon size={14} className="opacity-70 text-slate-400" />
                            )}
                          </div>
                        )}
                        {v.status === 'failed' && (
                          <span className="absolute inset-0 bg-rose-950/60 flex items-center justify-center">
                            <X size={12} className="text-rose-300" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Resize grip ── */}
              {!isCompact && (
                <div
                  onPointerDown={onResizePointerDown}
                  onPointerMove={onResizePointerMove}
                  onPointerUp={onResizePointerUp}
                  onPointerCancel={onResizePointerUp}
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize"
                  title="Resize"
                >
                  <svg viewBox="0 0 20 20" className="w-full h-full text-white/25 hover:text-cyan-300/60 transition">
                    <path d="M19 7 L7 19 M19 13 L13 19" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
