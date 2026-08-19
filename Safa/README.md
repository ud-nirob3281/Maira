# Safa (MYRAA) — Realistic Emotional Voice & Video System

Safa-র emotion system: **user-এর কথা → conversation context → emotion → emotion অনুযায়ী voice + matching video।** Voice-এ emotion শোনা যায়, video-তে দেখা যায় — দুটো সবসময় sync-এ থাকে।

---

## Supported Emotions (১৭টি)

`happy` · `sad` · `angry` · `upset` · `excited` · `surprised` · `worried` · `nervous` · `calm` · `shy` · `confused` · `disappointed` · `curious` · `caring` · `playful` · `serious` · `neutral`

প্রতিটির ৩টি intensity level: `slight` (হালকা) · `normal` · `strong` (তীব্র) — শুধু internal control, user কখনো দেখে না।

---

## Emotion কীভাবে নির্বাচন হয় (৩-layer system)

### Layer 1 — Model-driven (primary): `express_emotion` tool

Gemini Live session-এ model নিজেই একটি tool call করে:

```ts
express_emotion(emotion: "caring", intensity: "normal")
```

- Model পুরো conversation context বুঝে ঠিক করে কোন emotion — তাই সবচেয়ে accurate
- Turn-এর শুরুতেই silently call হয়, response **instant** (speech-এ কোনো delay নেই)
- System prompt-এ `EMOTIONAL_DELIVERY_PROTOCOL` (section 14) model-কে নির্দেশ দেয় কখন কোন emotion নিতে হবে

### Layer 2 — User utterance empathy scan (fallback)

User-এর **শেষ কথা** scan করে Safa-র empathetic reaction (user কষ্টের কথা বললে Safa কথা বলা শুরুর আগেই caring হয়ে যায়):

| User বলল | Safa-র emotion |
|---|---|
| দুঃখ/কষ্টের কথা (sad, crying, মন খারাপ, একা...) | `caring` |
| রাগ/বিরক্তি (angry, রাগ, annoyed...) | `serious` (শান্ত, controlled) |
| ভয়/টেনশন (scared, ভয়, nervous...) | `worried` |
| ভালো খবর (passed, promotion...) | `excited` |
| Safa-কে compliment (love you, মিষ্টি...) | `shy` |
| মজার কথা (haha, joke...) | `playful` |

### Layer 3 — Model-text keyword scan (fallback)

Safa-র নিজের কথা থেকে bilingual (English + বাংলা) keyword scan — আগের English-only classifier-এর improved version।

**তিনটাই zero-latency** (microsecond keyword scan / instant tool response) — কোনো extra API call নেই।

---

## Voice-এ Realistic Emotion কীভাবে আসে

Gemini Live API-র prebuilt voice-এ **কোনো per-turn style/SSML parameter নেই** — তাই এটাই technically correct উপায়:

**`EMOTIONAL_DELIVERY_PROTOCOL`** (system prompt-এর section 14) speech model-কে বলে কীভাবে কথা বলতে হবে:

- `HAPPY` → warm, bright, naturally energetic
- `SAD` → noticeably softer, slower, gentle pacing, natural pauses
- `CARING` → extra warm, gentle, reassuring, একটু slow
- `ANGRY` → firmer, stronger, কিন্তু সবসময় controlled
- `SHY` → quieter, hesitant, delicate
- `EXCITED` → enthusiastic, naturally quicker
- `SERIOUS` → stable, clear, measured
- ... (১৭টি emotion-এর জন্যই আলাদা delivery style)

Speech model সত্যিই delivery instruction follow করে (pace, softness, energy shift করে) — এটা fake random pitch/speed hack না। Intensity (`slight`/`strong`) delivery-এর তীব্রতা নিয়ন্ত্রণ করে।

---

## Voice + Video Synchronization

```text
Emotion = sad নির্বাচিত হলো
     ↓
Voice → sad delivery protocol (soft, slow, gentle)
Video → safa_sad_talking.mp4 (বা fallback chain)
     ↓
একই emotion — কখনো mismatch হয় না
```

দুটোই একই WS message থেকে চলে: `{"type":"emotion","emotion":"sad","intensity":"normal"}`

---

## Video Naming Convention

বিস্তারিত `assets/README.md`-তে। সংক্ষেপে:

- `assets/safa_<emotion>_<state>.mp4` — মূল convention (সব **optional**)
- `assets/safa_<emotion>_<state>_<intensity>.mp4` — intensity variant (optional)
- **Required শুধু ৩টা base video**: `Talking.mp4`, `Thinking.mp4`, `Waiting.mp4` (আগের behavior intact)
- Fallback chain: exact → emotion idle → family leader → base video → kaomoji
- Emotion family: happy ← (playful, excited, proud, curious, surprised), sad ← (disappointed, worried, nervous, upset), calm ← (caring, shy), neutral ← (serious, confused)

## Smooth Emotion Switching

Video switch-এর সময় 0.35s **crossfade** (পুরনো video fade-out, নতুন fade-in) — কোনো black flash নেই, performance unchanged (transition-এর সময় শুধু ২টা element)।

---

## Architecture (files)

| File | দায়িত্ব |
|---|---|
| `emotion_system.ts` | Emotion set, `express_emotion` tool declaration, `EMOTIONAL_DELIVERY_PROTOCOL`, bilingual classifiers, intensity |
| `server.ts` | Live session dispatch (express_emotion → instant WS push), system prompt-এ protocol injection, user/model-text fallback scans |
| `agent_core.ts` | Text-mode chat-এও express_emotion tool |
| `src/lib/audio.ts` | `onEmotionChange(emotion, intensity)` WS dispatch |
| `src/App.tsx` | Emotion + intensity state → visualizer |
| `src/components/MyraaCoreVisualizer.tsx` | Emotion × state video matrix, fallback chain, crossfade, kaomoji |

## Error Handling

- Emotion system-এর কোনো অংশ fail করলে conversation **কখনো থামে না** — silent fallback
- Tool call fail → keyword classifier কাজ করে; classifier fail → আগের emotion থাকে
- Video missing → fallback chain → base video → kaomoji
- User-এর সামনে কোনো technical error নেই; debug info শুধু console-এ

## নতুন Emotion যোগ করার নিয়ম

1. `emotion_system.ts` → `CANONICAL_EMOTIONS`-এ নাম add করো
2. একই file-এ `EMOTIONAL_DELIVERY_PROTOCOL`-এ voice style লিখো
3. `MyraaCoreVisualizer.tsx` → type + `EMOTION_GROUP_LEADER` + `KAOMOJI` map-এ add করো
4. Video file দিলে `assets/safa_<emotion>_<state>.mp4` নামে দাও — auto-detect
