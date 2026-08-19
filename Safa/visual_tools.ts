/**
 * Visual Hub — generative-visual tool service (Stonic-AI-inspired, built for Safa).
 *
 * Owns everything visual-related so server.ts / agent_core.ts stay thin:
 *  - Tool declarations for the Gemini sessions (voice + text ReAct loop)
 *  - The visual store (in-memory + persisted meta JSON + image files on disk)
 *  - Image generation / editing via the Gemini image model ("Nano Banana")
 *    with a model fallback chain + 429 retry/backoff
 *  - Validation-only tools (diagram / math / chart / flashcards) whose payloads
 *    are rendered client-side by the Visual Hub panel
 *
 * Design rules (project constraints):
 *  - Generation runs fully server-side → closing the panel never cancels a task;
 *    reopening shows the live state (status: generating → ready/failed).
 *  - Tool responses stay tiny (never return image bytes to the model/WS).
 *  - Errors are user-friendly; the calling layer makes Safa speak them —
 *    no technical stack traces surface in the UI.
 */

import path from 'path';
import os from 'os';
import * as fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { DATA_DIR, dataFile } from './server_paths';
import { runWithVisualKeyFailover, getVisualApiKeyPool } from './visual_key_pool';

// ─── Types ──────────────────────────────────────────────────────────────────

export type VisualType = 'image' | 'diagram' | 'math' | 'chart' | 'flashcards';
export type VisualStatus = 'generating' | 'ready' | 'failed';

export interface VisualItem {
  id: string;
  type: VisualType;
  status: VisualStatus;
  title: string;
  createdAt: number;
  /** Image URL served by this server (data never travels through tool responses). */
  src?: string;
  diagramType?: string;
  mermaidCode?: string;
  mathSteps?: string[];
  chartType?: 'line' | 'bar' | 'area' | 'pie';
  chartData?: { label: string; value: number }[];
  cards?: { front: string; back: string }[];
  /** Friendly, non-technical note shown when status === 'failed'. */
  errorNote?: string;
}

interface StoredVisual extends VisualItem {
  /** Server-internal — never serialized to clients. */
  imageFile?: string;
  mimeType?: string;
}

// ─── Persistence ────────────────────────────────────────────────────────────

const VISUAL_DIR = path.join(DATA_DIR, 'visual_hub');
const META_FILE = dataFile('visual_hub.json');
const MAX_VISUALS = 40;

const visuals = new Map<string, StoredVisual>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadStore() {
  try {
    if (!fs.existsSync(META_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as StoredVisual[];
    for (const v of raw) {
      // Drop entries whose image file vanished; keep text-based visuals forever.
      if (v.imageFile && !fs.existsSync(path.join(VISUAL_DIR, v.imageFile))) {
        if (v.type === 'image') continue;
        delete v.imageFile;
      }
      visuals.set(v.id, v);
    }
  } catch (err) {
    console.error('[VisualHub] Failed to load persisted visuals:', err);
  }
}

function persistStore() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(VISUAL_DIR, { recursive: true });
      const list = [...visuals.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_VISUALS);
      // Evicted images lose their file — keep the list the single source of truth.
      for (const v of visuals.values()) {
        if (!list.includes(v) && v.imageFile) {
          try {
            fs.unlinkSync(path.join(VISUAL_DIR, v.imageFile));
          } catch {}
        }
      }
      fs.writeFileSync(META_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[VisualHub] Failed to persist visuals:', err);
    }
  }, 800);
}

loadStore();

// ─── Store API (used by the REST routes in server.ts) ──────────────────────

export function getVisuals(): VisualItem[] {
  return [...visuals.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toWire);
}

export function getVisual(id: string): VisualItem | undefined {
  const v = visuals.get(id);
  return v ? toWire(v) : undefined;
}

export function getVisualImageData(
  id: string,
): { buffer: Buffer; mimeType: string } | null {
  const v = visuals.get(id);
  if (!v || !v.imageFile) return null;
  try {
    const buffer = fs.readFileSync(path.join(VISUAL_DIR, v.imageFile));
    return { buffer, mimeType: v.mimeType || 'image/png' };
  } catch {
    return null;
  }
}

export function deleteVisual(id: string): boolean {
  const v = visuals.get(id);
  if (!v) return false;
  if (v.imageFile) {
    try {
      fs.unlinkSync(path.join(VISUAL_DIR, v.imageFile));
    } catch {}
  }
  visuals.delete(id);
  persistStore();
  return true;
}

function toWire(v: StoredVisual): VisualItem {
  const { imageFile: _imageFile, ...wire } = v;
  return wire;
}

function makeId(): string {
  return `vh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function upsertVisual(v: StoredVisual, onUpdate?: (visual: VisualItem) => void) {
  visuals.set(v.id, v);
  persistStore();
  try {
    onUpdate?.(toWire(v));
  } catch {}
}

// ─── Tool declarations (Gemini function-calling schema) ────────────────────

export const VISUAL_TOOL_DECLARATIONS = [
  {
    name: 'generate_image',
    description:
      "Generate an AI image using Gemini image generation and display it in the user's Visual Hub panel. The image appears immediately and is auto-saved to the user's Downloads folder. Use for any creative or illustrative picture request.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'Detailed description of the image to generate. Include style, subject, colors and mood for best results.',
        },
        aspect_ratio: {
          type: Type.STRING,
          description: 'Desired image aspect ratio.',
          enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        },
        title: {
          type: Type.STRING,
          description: 'Optional short label shown above the image in the Visual Hub.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'edit_image',
    description:
      "Edit a previously generated image with a new instruction (conversation-style image editing). The edited copy appears as a new image in the Visual Hub. If the user refers to 'the image' / 'it' / 'that picture', use the most recent image.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: 'What to change in the image, e.g. "make the sky sunset orange".',
        },
        visual_id: {
          type: Type.STRING,
          description:
            'Optional ID of the image to edit. Omit to use the most recent image in the Visual Hub.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_diagram',
    description:
      "Generate and display a professional diagram in the user's Visual Hub using Mermaid.js v11 syntax. Use this whenever you want to visually explain a concept, process, flow, relationship, timeline, or data structure. The diagram appears immediately in the Visual Hub panel. Prefer this over text explanations when a visual would be clearer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mermaid_code: {
          type: Type.STRING,
          description:
            'Valid Mermaid.js v11 diagram code. No markdown fences, no HTML formatting. Keep node labels short. Supported: flowchart, sequenceDiagram, erDiagram, classDiagram, stateDiagram-v2, mindmap, gantt, pie, timeline, quadrantChart.',
        },
        diagram_type: {
          type: Type.STRING,
          description: 'The type of diagram being generated.',
          enum: [
            'flowchart',
            'sequence',
            'er',
            'class',
            'state',
            'mindmap',
            'gantt',
            'pie',
            'timeline',
            'quadrant',
          ],
        },
        title: {
          type: Type.STRING,
          description: 'Optional human-readable title for the diagram, shown as a label in the Visual Hub.',
        },
      },
      required: ['mermaid_code'],
    },
  },
  {
    name: 'render_math',
    description:
      "Display a beautifully typeset mathematical expression or a step-by-step solved math problem in the user's Visual Hub. Use LaTeX syntax. This is the PREFERRED way to explain any math — equations, derivations, algebra, calculus, physics formulas. For problem solving, split the solution into logical steps (each step is one LaTeX expression with its short explanation).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Short title, e.g. the problem statement or topic name.',
        },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description:
            'One or more LaTeX expressions (no $ delimiters). For a worked solution, provide the steps in order, e.g. ["x^2 - 5x + 6 = 0", "(x-2)(x-3) = 0", "x = 2 \\quad \\text{or} \\quad x = 3"].',
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'render_chart',
    description:
      "Display a data chart (line, bar, area, or pie) in the user's Visual Hub. Use for statistics, comparisons, trends, percentages, budgets, marks, or any numeric data the user asks about. Provide the data points explicitly — never invent numbers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        chart_type: {
          type: Type.STRING,
          description: 'The kind of chart that best fits the data.',
          enum: ['line', 'bar', 'area', 'pie'],
        },
        data: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: 'Category / x-axis label.' },
              value: { type: Type.NUMBER, description: 'Numeric value.' },
            },
            required: ['label', 'value'],
          },
          description: 'The data points, e.g. [{"label":"Mon","value":30},{"label":"Tue","value":45}].',
        },
        title: {
          type: Type.STRING,
          description: 'Optional chart title shown in the Visual Hub.',
        },
      },
      required: ['chart_type', 'data'],
    },
  },
  {
    name: 'generate_flashcards',
    description:
      "Create a set of study flashcards and display them in the user's Visual Hub. Use when the user wants to revise, memorize, or test themselves on any topic — especially textbook chapters, definitions, and formulas. 4-12 cards is ideal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: 'The subject of the flashcards, shown as the set title.',
        },
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING, description: 'Question / prompt side.' },
              back: { type: Type.STRING, description: 'Answer side (keep concise).' },
            },
            required: ['front', 'back'],
          },
          description: 'The flashcards (2-20 cards).',
        },
      },
      required: ['topic', 'cards'],
    },
  },
];

export const VISUAL_TOOL_NAMES = new Set(VISUAL_TOOL_DECLARATIONS.map(t => t.name));

// ─── Gemini image generation ("Nano Banana") with model fallback chain ──────

// First entry is the stable GA alias; the dated preview snapshot is proven on
// this user's API key (Stonic AI uses it today). Chain = resilience without
// guessing: whichever alias the key accepts wins.
const IMAGE_MODEL_CHAIN = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview-05-20'];

const ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);

function looksLikeAuthError(err: any): boolean {
  const s = `${err?.message ?? ''} ${err?.status ?? ''}`.toLowerCase();
  return s.includes('401') || s.includes('403') || s.includes('api key') || s.includes('api_key') || s.includes('permission');
}

function looksLikeModelUnavailable(err: any): boolean {
  const s = `${err?.message ?? ''} ${err?.status ?? ''}`.toLowerCase();
  return (
    s.includes('404') ||
    s.includes('not found') ||
    s.includes('not_found') ||
    s.includes('is not available') ||
    s.includes('unsupported') ||
    s.includes('not_supported')
  );
}

function looksLikeRateLimit(err: any): boolean {
  const s = `${err?.message ?? ''} ${err?.status ?? ''}`.toLowerCase();
  return s.includes('429') || s.includes('resource_exhausted') || s.includes('quota');
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Image generation timed out')), ms)),
  ]);
}

interface GeneratedImage {
  base64: string;
  mimeType: string;
}

async function callImageModel(
  ai: GoogleGenAI,
  model: string,
  parts: any[],
  aspectRatio?: string,
): Promise<GeneratedImage> {
  const attempt = async (useImageConfig: boolean): Promise<GeneratedImage> => {
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: { parts } as any,
        config: useImageConfig && aspectRatio
          ? ({ imageConfig: { aspectRatio } } as any)
          : undefined,
      }),
      120_000,
    );
    const candidate = response.candidates?.[0];
    const inline = candidate?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!inline?.data) {
      throw new Error('NO_IMAGE_DATA');
    }
    return { base64: inline.data, mimeType: inline.mimeType || 'image/png' };
  };
  try {
    return await attempt(true);
  } catch (err: any) {
    // Older model revisions reject imageConfig — retry once without it.
    if (String(err?.message || '').includes('imageConfig') || String(err?.message || '').includes('Unknown name')) {
      return attempt(false);
    }
    throw err;
  }
}

/**
 * Generate an image using the Visual key pool (backup keys first, main key as
 * final fallback — see visual_key_pool.ts). Model-alias fallback stays
 * key-local; every key-level failure (quota, auth, network, timeout) rotates
 * to the next API key instead of sleeping, so one bad key never stalls Visual.
 */
async function generateImageWithAnyKey(
  parts: any[],
  aspectRatio?: string,
): Promise<GeneratedImage> {
  return runWithVisualKeyFailover(async apiKey => {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    let lastErr: any = null;
    for (const model of IMAGE_MODEL_CHAIN) {
      try {
        return await callImageModel(ai, model, parts, aspectRatio);
      } catch (err: any) {
        lastErr = err;
        // 404-style "model unavailable" → try the next model alias on the
        // SAME key; everything else bubbles up so the pool rotates keys.
        if (!looksLikeModelUnavailable(err)) break;
      }
    }
    throw lastErr ?? new Error('Image generation failed');
  });
}

// ─── Disk helpers ───────────────────────────────────────────────────────────

function extForMime(mimeType: string): string {
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}

function saveImageToDisk(id: string, image: GeneratedImage): { file: string; downloadsPath?: string } {
  fs.mkdirSync(VISUAL_DIR, { recursive: true });
  const file = `${id}.${extForMime(image.mimeType)}`;
  const buffer = Buffer.from(image.base64, 'base64');
  fs.writeFileSync(path.join(VISUAL_DIR, file), buffer);

  // Auto-save a copy to the user's Downloads folder (Stonic behavior), with the
  // CORRECT extension derived from the actual mime type.
  let downloadsPath: string | undefined;
  try {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(downloadsDir)) {
      downloadsPath = path.join(downloadsDir, `safa_visual_${Date.now()}.${extForMime(image.mimeType)}`);
      fs.writeFileSync(downloadsPath, buffer);
    }
  } catch (err) {
    console.warn('[VisualHub] Downloads auto-save skipped:', err);
  }
  return { file, downloadsPath };
}

// ─── Friendly error notes (spoken by Safa — never technical) ────────────────

function friendlyImageError(err: any): string {
  if (looksLikeAuthError(err)) {
    return 'The Gemini API key was rejected. Politely tell the user to check their API key in Settings, and that the image could not be created.';
  }
  if (looksLikeRateLimit(err)) {
    return 'The image quota is exhausted right now. Politely tell the user to try again in a few minutes.';
  }
  if (String(err?.message || '').includes('timed out')) {
    return 'Image generation took too long. Politely tell the user the image could not be finished and offer to try again.';
  }
  return 'Image generation failed. Politely tell the user it did not work out and offer to try again in a moment.';
}

// ─── Tool dispatcher ────────────────────────────────────────────────────────

export interface VisualToolResult {
  /** Small payload returned to the model via sendToolResponse. */
  output: any;
}

export async function executeVisualTool(
  name: string,
  args: any,
  opts: { onVisualUpdate?: (visual: VisualItem) => void } = {},
): Promise<VisualToolResult> {
  const onUpdate = opts.onVisualUpdate;
  const a = args || {};

  switch (name) {
    // ── Asynchronous (generating → ready/failed), runs server-side ──
    case 'generate_image':
    case 'edit_image': {
      const prompt = String(a.prompt || '').trim();
      if (!prompt) {
        return { output: { error: 'A prompt is required. Ask the user what the image should show.' } };
      }
      if (getVisualApiKeyPool().length === 0) {
        return { output: { error: 'No Gemini API key is configured. Politely tell the user to add their API key in Settings first.' } };
      }

      let reference: GeneratedImage | null = null;
      const base: StoredVisual = {
        id: makeId(),
        type: 'image',
        status: 'generating',
        title: String(a.title || (name === 'edit_image' ? `Edit: ${prompt.slice(0, 40)}` : prompt.slice(0, 60))) || 'Image',
        createdAt: Date.now(),
      };

      if (name === 'edit_image') {
        const refId = a.visual_id ? String(a.visual_id) : null;
        const refVisual = (refId && visuals.get(refId)) || latestImageVisual();
        if (!refVisual?.imageFile) {
          return { output: { error: 'There is no previous image to edit. Politely tell the user, and suggest generating a new image first with generate_image.' } };
        }
        try {
          const buf = fs.readFileSync(path.join(VISUAL_DIR, refVisual.imageFile));
          reference = { base64: buf.toString('base64'), mimeType: refVisual.mimeType || 'image/png' };
        } catch {
          return { output: { error: 'The original image could not be loaded for editing. Suggest generating a fresh image instead.' } };
        }
      }

      const aspectRatio = ASPECT_RATIOS.has(String(a.aspect_ratio)) ? String(a.aspect_ratio) : undefined;
      upsertVisual(base, onUpdate);

      // Fire-and-forget: the Live session gets its toolResponse immediately with
      // the "generating" state; completion is broadcast via onVisualUpdate.
      (async () => {
        try {
          const parts: any[] = [];
          if (reference) {
            parts.push({ inlineData: { data: reference.base64, mimeType: reference.mimeType } });
          }
          parts.push({ text: prompt });
          const image = await generateImageWithAnyKey(parts, aspectRatio);
          const { file } = saveImageToDisk(base.id, image);
          const done = visuals.get(base.id);
          if (done) {
            done.status = 'ready';
            done.imageFile = file;
            done.mimeType = image.mimeType;
            done.src = `/api/visual-hub/${base.id}/image`;
            upsertVisual(done, onUpdate);
          }
          console.log(`[VisualHub] ${name} ready (${base.id})`);
        } catch (err) {
          console.error(`[VisualHub] ${name} failed:`, err);
          const failed = visuals.get(base.id);
          if (failed) {
            failed.status = 'failed';
            failed.errorNote = 'This image could not be created.';
            upsertVisual(failed, onUpdate);
          }
        }
      })();

      return {
        output: {
          result:
            name === 'edit_image'
              ? 'Image edit started. It will appear in the Visual Hub in a few seconds — continue naturally.'
              : 'Image generation started. It will appear in the Visual Hub in a few seconds — continue naturally.',
        },
      };
    }

    // ── Instant (payload rendered client-side) ──
    case 'generate_diagram': {
      const code = String(a.mermaid_code || '').trim();
      if (!code) {
        return { output: { error: 'mermaid_code is required and must be valid Mermaid.js v11 syntax.' } };
      }
      const diagramType = String(a.diagram_type || 'diagram');
      const title = String(a.title || '').trim() || `${diagramType.charAt(0).toUpperCase()}${diagramType.slice(1)} diagram`;
      upsertVisual(
        {
          id: makeId(),
          type: 'diagram',
          status: 'ready',
          title,
          createdAt: Date.now(),
          diagramType,
          mermaidCode: code,
        },
        onUpdate,
      );
      return { output: { result: `Diagram "${title}" rendered in the Visual Hub successfully.` } };
    }

    case 'render_math': {
      const steps = Array.isArray(a.steps) ? a.steps.map((s: any) => String(s)).filter(Boolean) : [];
      if (steps.length === 0) {
        return { output: { error: 'At least one LaTeX step is required (no $ delimiters).' } };
      }
      const title = String(a.title || '').trim() || 'Math solution';
      upsertVisual(
        {
          id: makeId(),
          type: 'math',
          status: 'ready',
          title,
          createdAt: Date.now(),
          mathSteps: steps.slice(0, 30),
        },
        onUpdate,
      );
      return { output: { result: `Math "${title}" is now displayed step-by-step in the Visual Hub.` } };
    }

    case 'render_chart': {
      const chartType = ['line', 'bar', 'area', 'pie'].includes(String(a.chart_type))
        ? (String(a.chart_type) as 'line' | 'bar' | 'area' | 'pie')
        : 'bar';
      const raw = Array.isArray(a.data) ? a.data : [];
      const data = raw
        .map((d: any) => ({ label: String(d?.label ?? ''), value: Number(d?.value) }))
        .filter(d => d.label && Number.isFinite(d.value))
        .slice(0, 60);
      if (data.length < 2) {
        return { output: { error: 'At least two valid {label, value} data points are required for a chart.' } };
      }
      const title = String(a.title || '').trim() || `${chartType} chart`;
      upsertVisual(
        {
          id: makeId(),
          type: 'chart',
          status: 'ready',
          title,
          createdAt: Date.now(),
          chartType,
          chartData: data,
        },
        onUpdate,
      );
      return { output: { result: `Chart "${title}" rendered in the Visual Hub successfully.` } };
    }

    case 'generate_flashcards': {
      const topic = String(a.topic || '').trim();
      const raw = Array.isArray(a.cards) ? a.cards : [];
      const cards = raw
        .map((c: any) => ({ front: String(c?.front ?? '').trim(), back: String(c?.back ?? '').trim() }))
        .filter(c => c.front && c.back)
        .slice(0, 20);
      if (!topic || cards.length < 2) {
        return { output: { error: 'A topic and at least 2 complete cards (front + back) are required.' } };
      }
      upsertVisual(
        {
          id: makeId(),
          type: 'flashcards',
          status: 'ready',
          title: topic,
          createdAt: Date.now(),
          cards,
        },
        onUpdate,
      );
      return { output: { result: `${cards.length} flashcards on "${topic}" are ready in the Visual Hub.` } };
    }

    default:
      return { output: { error: `Unknown visual tool: ${name}` } };
  }
}

function latestImageVisual(): StoredVisual | undefined {
  return [...visuals.values()]
    .filter(v => v.type === 'image' && v.imageFile)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

/** Friendly spoken-error text for hard dispatcher failures (never technical). */
export function visualToolFailureNotice(): string {
  return 'The visual could not be created. Politely tell the user it did not work out and offer to try again.';
}
