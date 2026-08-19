/**
 * Zoom + pan container for Visual Hub content (images, diagrams).
 * Wheel to zoom (0.2x–5x, clamped), drag to pan, corner button to reset.
 */

import { useRef, useState, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';

interface ZoomPaneProps {
  children: React.ReactNode;
}

export default function ZoomPane({ children }: ZoomPaneProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(5, Math.max(0.2, s * (e.deltaY < 0 ? 1.12 : 0.89))));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTx(d.tx + (e.clientX - d.x));
    setTy(d.ty + (e.clientY - d.y));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: dragRef.current ? 'none' : 'transform 0.15s ease-out' }}
      >
        {children}
      </div>
      {(scale !== 1 || tx !== 0 || ty !== 0) && (
        <button
          onClick={reset}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/60 backdrop-blur hover:bg-black/80 text-slate-300 text-[10px] font-mono tracking-wider transition cursor-pointer"
          title="Reset zoom"
        >
          <Maximize2 size={11} />
          {Math.round(scale * 100)}%
        </button>
      )}
    </div>
  );
}
