/**
 * Safa Emotion System — context-aware emotion for voice + video.
 *
 * How emotion actually works here (honest capabilities of the stack):
 *  - VOICE: the Gemini Live API generates native audio with NO per-turn
 *    style/SSML parameters. Realistic emotional delivery is achieved the only
 *    technically sound way: EMOTIONAL_DELIVERY_PROTOCOL in the system prompt —
 *    the speech model genuinely follows delivery instructions (pace, softness,
 *    energy, pauses). No fake random pitch/speed hacks.
 *  - SELECTION: the model itself calls the `express_emotion` tool right when a
 *    turn starts, so the emotion matches full conversation context (this
 *    replaces random/misread selection). Two zero-latency fallbacks keep it
 *    robust: a bilingual keyword scan of the MODEL's spoken text (improved
 *    version of the original classifier), and an empathy scan of the USER's
 *    utterance (user is sad → Safa becomes caring).
 *  - VIDEO: the chosen emotion is pushed to the client as
 *    {"type":"emotion","emotion","intensity"} and MyraaCoreVisualizer maps it
 *    to assets/safa_<emotion>_<state>.mp4 with a graceful fallback chain —
 *    so voice and video always show the same emotion.
 *
 * This module is server-side only and has zero async work: every function is
 * a microsecond-scale scan, safe to call per transcription chunk.
 */

import { Type } from '@google/genai';

// ─── Canonical emotion set ─────────────────────────────────────────────────

export const CANONICAL_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'upset',
  'excited',
  'surprised',
  'worried',
  'nervous',
  'calm',
  'shy',
  'confused',
  'disappointed',
  'curious',
  'caring',
  'playful',
  'serious',
  'neutral',
] as const;

export type SafaEmotion = (typeof CANONICAL_EMOTIONS)[number];

/** Legacy names the old frontend/classifier may still emit → canonical. */
const LEGACY_EMOTION_ALIASES: Record<string, SafaEmotion> = {
  idle: 'neutral',
  thinking: 'neutral',
  proud: 'happy',
  embarrassed: 'shy',
};

export function normalizeEmotion(raw: string | undefined | null): SafaEmotion {
  const v = String(raw || '').toLowerCase().trim();
  if ((CANONICAL_EMOTIONS as readonly string[]).includes(v)) return v as SafaEmotion;
  return LEGACY_EMOTION_ALIASES[v] || 'neutral';
}

export type EmotionIntensity = 'slight' | 'normal' | 'strong';

export function normalizeIntensity(raw: string | undefined | null): EmotionIntensity {
  const v = String(raw || '').toLowerCase().trim();
  return v === 'slight' || v === 'strong' ? v : 'normal';
}

// ─── Tool declaration (model-driven emotion selection) ─────────────────────

export const EMOTION_TOOL_DECLARATIONS = [
  {
    name: 'express_emotion',
    description:
      'Set the emotion you are feeling RIGHT NOW, so your voice delivery and your on-screen video both match it. Call this SILENTLY at the very start of your turn whenever the conversation carries a clear emotion — e.g. the user shares something sad (caring/soft), shares good news (excited/happy), teases you (playful), you make a small mistake (shy), or the topic becomes important (serious). Choose the emotion from the CONVERSATION CONTEXT, never randomly. If a turn is emotionally neutral, either call this with "neutral" or skip the call.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        emotion: {
          type: Type.STRING,
          description: 'The emotion you are feeling as you begin to speak.',
          enum: [...CANONICAL_EMOTIONS],
        },
        intensity: {
          type: Type.STRING,
          description:
            'How strongly you feel it: "slight" (mild undertone), "normal", or "strong" (overwhelming feeling). Default "normal".',
          enum: ['slight', 'normal', 'strong'],
        },
      },
      required: ['emotion'],
    },
  },
];

export const EMOTION_TOOL_NAMES = new Set(EMOTION_TOOL_DECLARATIONS.map(t => t.name));

// ─── Voice delivery protocol (system-prompt section) ───────────────────────
//
// The Live API prebuilt voices expose no style parameter, so emotional
// delivery comes from instructing the speech model itself — it demonstrably
// shifts pace, energy and softness when told how a line should feel.

export const EMOTIONAL_DELIVERY_PROTOCOL = `
14. EMOTIONAL DELIVERY PROTOCOL (HOW YOU SOUND — CRITICAL FOR REALISM):
   - Your voice must CARRY your emotion naturally, like a real girl talking on the phone — never flat or robotic. Let the emotion shape HOW you speak, matching what you actually feel in the conversation:
     * HAPPY: warm, bright, naturally energetic; let your voice lift upward with genuine delight.
     * EXCITED: enthusiastic and expressive, quicker pace where natural, sparkling energy.
     * PLAYFUL: cheeky, light, musical; tease with your tone.
     * SAD: noticeably softer and slower, gentle pacing, quiet warmth, small natural pauses.
     * CARING: extra warm, gentle and reassuring; slow down slightly, soothe with your tone.
     * WORRIED: softer, tentative, slightly hushed concern.
     * ANGRY (rare for you): firmer, stronger delivery but ALWAYS controlled — never screaming.
     * UPSET/অভিমান: softer, slightly hesitant delivery with subtle natural pauses — hurt but sweet.
     * SHY: quieter, hesitant, delicate; trail off gently on compliments.
     * SURPRISED: a small audible gasp of surprise, then expressive wonder.
     * CONFUSED: slower, thoughtful, questioning intonation.
     * DISAPPOINTED: subdued, heavy pacing, quieter endings.
     * NERVOUS: light tension in the voice, slightly quicker, careful pauses.
     * CALM: relaxed, even, serene pacing.
     * CURIOUS: bright, interested, upward inflections.
     * SERIOUS: stable, clear, confident and controlled; measured pacing, no giggles.
     * NEUTRAL: your default warm, soft conversational tone.
   - INTENSITY MODULATION: a slight emotion stays a subtle undertone; a strong emotion fully colors your delivery (pace, energy, softness) — but you NEVER become theatrical or over-acted. Natural, like a real person.
   - EMOTION SYNC RULE: at the start of any emotionally-colored turn, silently call express_emotion(emotion, intensity) FIRST so your on-screen video matches the emotion you are speaking with. Keep the call invisible — never mention the tool.
   - CONTEXT RULE: pick emotion from what the user said and the conversation flow — if the user shares pain, sound caring/soft; if they share joy, sound happy; if they compliment you, gentle shy warmth; if the topic turns important, become serious. Never switch emotions randomly.`;

// ─── Model-text fallback classifier (improved, bilingual) ──────────────────
//
// Runs on Safa's own spoken text. Ordered most-specific → least-specific so
// the first hit wins. Extended from the original English-only list with
// Bengali cues and the new emotions.

const MODEL_EMOTION_KEYWORDS: { emotion: SafaEmotion; cues: string[] }[] = [
  {
    emotion: 'angry',
    cues: [
      'angry', 'furious', 'frustrated', 'annoyed', 'irritated', 'mad at',
      'fed up', "that's unacceptable", 'রাগ', 'রাগি', 'বিরক্ত',
    ],
  },
  {
    emotion: 'sad',
    cues: [
      'sad', 'sorry to hear', 'unfortunately', 'heartbroken',
      'i understand how tough', 'rough time', 'দুঃখিত', 'কষ্ট হচ্ছে', 'মন খারাপ',
    ],
  },
  {
    emotion: 'disappointed',
    cues: ['disappointed', "didn't work out", 'sad to say', 'হতাশ', 'আশা ভঙ্গ'],
  },
  {
    emotion: 'worried',
    cues: ['worried about you', 'be careful', 'concerned', 'চিন্তা হচ্ছে', 'দুশ্চিন্তা'],
  },
  {
    emotion: 'surprised',
    cues: [
      'wow', 'oh my', 'no way', 'incredible', 'unbelievable', "that's surprising",
      "didn't expect", 'অবাক', 'আশ্চর্য',
    ],
  },
  {
    emotion: 'excited',
    cues: [
      'exciting', 'amazing', 'awesome', 'fantastic', "let's do it", "can't wait",
      'this is great', 'love that', 'চমৎকার', 'দারুণ',
    ],
  },
  {
    emotion: 'playful',
    cues: ['haha', 'lol', 'just kidding', 'funny', 'silly', 'teasing', 'gotcha', 'হেহে', 'মজা'],
  },
  {
    emotion: 'happy',
    cues: [
      'happy', 'glad', 'wonderful', 'delightful', 'perfect', 'sounds good',
      'love this', "that's great", 'proud of you', 'well done', 'great job',
      'congrats', 'congratulations', 'খুশি', 'ভালো লাগছে',
    ],
  },
  {
    emotion: 'caring',
    cues: [
      'i am here for you', 'take care', 'dont worry', "don't worry", 'you are not alone',
      'তোমার পাশে আছি', 'চিন্তা করো না', 'যত্ন',
    ],
  },
  {
    emotion: 'shy',
    cues: ['oops', 'my mistake', 'sorry about that', 'i apologize', 'my bad', 'লজ্জা', 'সরি'],
  },
  {
    emotion: 'curious',
    cues: ['interesting', "let's explore", 'tell me more', 'what do you think', 'curious', 'shall we', 'কৌতূহল'],
  },
  {
    emotion: 'confused',
    cues: ["i'm not sure", 'confused', 'could you clarify', 'what do you mean', 'pardon', 'বুঝতে পারছি না'],
  },
  {
    emotion: 'serious',
    cues: ['listen carefully', 'this is important', 'seriously', 'carefully', 'গুরুত্বপূর্ণ', 'সাবধানে'],
  },
  {
    emotion: 'calm',
    cues: ['relax', 'breathe', 'everything is okay', 'শান্ত', 'ঘাবড়াবে না'],
  },
];

/** Scan a chunk of Safa's own spoken text; null keeps the previous mood. */
export function classifyModelEmotion(text: string): SafaEmotion | null {
  const lower = String(text || '').toLowerCase();
  if (!lower.trim()) return null;
  for (const { emotion, cues } of MODEL_EMOTION_KEYWORDS) {
    for (const cue of cues) {
      if (lower.includes(cue)) return emotion;
    }
  }
  return null;
}

// ─── User-utterance empathy scan ───────────────────────────────────────────
//
// The original classifier only read Safa's own words — so when the USER
// shared something sad, Safa's emotion never changed until she happened to
// say a matching phrase. This scan reads the user's finished utterance and
// moves Safa to the appropriate empathetic reaction (user sad → caring etc.).
// Runs once per finished utterance: zero latency impact.

const USER_MOOD_REACTIONS: { emotion: SafaEmotion; cues: string[] }[] = [
  {
    // User is hurt/sad → Safa becomes soft and caring
    emotion: 'caring',
    cues: [
      'sad', 'depressed', 'crying', 'cry', 'heartbroken', 'alone', 'lonely',
      'breakup', 'broke up', 'miss him', 'miss her', 'miss you', 'tired of',
      "can't take it", 'give up', 'hurts', 'in pain', 'died', 'passed away',
      'মন খারাপ', 'কাঁদছি', 'কান্না', 'কষ্ট', 'দুঃখ', 'একা', 'কেউ নেই',
      'ভালোবাসা', 'ছুটে গেছে', 'মারা গেছে', 'হারিয়েছি', 'পারছি না',
    ],
  },
  {
    // User is angry/frustrated → Safa stays calm and serious
    emotion: 'serious',
    cues: ['angry', 'furious', 'hate this', 'so annoying', 'pissed', 'রাগ', 'রাগে', 'বিরক্ত', 'ঘেন্না'],
  },
  {
    // User is scared/anxious → Safa becomes gently reassuring
    emotion: 'worried',
    cues: ['scared', 'afraid', 'nervous', 'anxious', 'panic', 'ভয়', 'ডর', 'টেনশন', 'ঘাবড়া'],
  },
  {
    // User is worried about something → Safa cares
    emotion: 'caring',
    cues: ['worried about', 'what if', 'exam', 'result', 'interview', 'চিন্তা', 'পরীক্ষা', 'রেজাল্ট'],
  },
  {
    // User shares good news → Safa lights up
    emotion: 'excited',
    cues: ['i passed', 'i won', 'got the job', 'promotion', 'birthday today', 'engaged',
      'পাস করেছি', 'জিতেছি', 'চাকরি পেয়েছি', 'আজ আমার জন্মদিন'],
  },
  {
    // User compliments Safa → sweet shy reaction
    emotion: 'shy',
    cues: ['love you', 'good girl', 'you are the best', 'so cute', 'sweet voice',
      'তোমাকে ভালোবাসি', 'তুমি খুব মিষ্টি', 'তুমি ভালো'],
  },
  {
    // User jokes around → Safa plays along
    emotion: 'playful',
    cues: ['haha', 'lol', 'joke', 'just kidding', 'হেহে', 'মজা', 'রসিকতা'],
  },
];

/** Map the user's finished utterance to Safa's empathetic reaction (or null). */
export function classifyUserUtterance(text: string): SafaEmotion | null {
  const lower = String(text || '').toLowerCase();
  if (!lower.trim()) return null;
  for (const { emotion, cues } of USER_MOOD_REACTIONS) {
    for (const cue of cues) {
      if (lower.includes(cue)) return emotion;
    }
  }
  return null;
}

/** Default intensity sent with classifier-derived emotions. */
export const CLASSIFIER_INTENSITY: EmotionIntensity = 'normal';
