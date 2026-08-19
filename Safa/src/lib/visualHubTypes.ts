/**
 * Visual Hub — shared client types + REST helpers.
 * Kept in src/lib so audio.ts, App.tsx and the panel all agree on one shape.
 */

export type VisualType = 'image' | 'diagram' | 'math' | 'chart' | 'flashcards';
export type VisualStatus = 'generating' | 'ready' | 'failed';

export interface VisualItem {
  id: string;
  type: VisualType;
  status: VisualStatus;
  title: string;
  createdAt: number;
  src?: string;
  diagramType?: string;
  mermaidCode?: string;
  mathSteps?: string[];
  chartType?: 'line' | 'bar' | 'area' | 'pie';
  chartData?: { label: string; value: number }[];
  cards?: { front: string; back: string }[];
  errorNote?: string;
}

/** Merge an incoming pushed/updated visual into the current list (newest first). */
export function mergeVisual(list: VisualItem[], incoming: VisualItem): VisualItem[] {
  const idx = list.findIndex(v => v.id === incoming.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = incoming;
    return next;
  }
  return [incoming, ...list];
}

export async function fetchVisuals(): Promise<VisualItem[]> {
  try {
    const res = await fetch('/api/visual-hub');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.visuals) ? data.visuals : [];
  } catch {
    return [];
  }
}

export async function deleteVisualById(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/visual-hub/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
