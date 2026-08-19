# Assets Folder — Character Videos

Safa-র character video গুলো এখানে থাকে। Emotion-aware video system-এর জন্য নিচের naming convention follow করো।

## বর্তমানে আছে (base videos — REQUIRED)

| File | State | কখন ব্যবহার হয় |
|---|---|---|
| `Talking.mp4` | talking | Safa কথা বলার সময় (কোনো emotion video না পেলে) |
| `Thinking.mp4` | thinking | Safa চিন্তা করার সময় (কোনো emotion video না পেলে) |
| `Waiting.mp4` | idle | Connected কিন্তু কিছু করছে না (default) |
| `Background.jpg` | — | Background image |

এই ৩টা video দিয়েই app 100% কাজ করে — **কোনো নতুন video ছাড়াই কিছু ভাঙে না।**

## Emotion Video Naming Convention — সব OPTIONAL

নতুন video add করতে চাইলে এই format-এ name দাও:

```
safa_<emotion>_<state>.mp4              → সাধারণ version
safa_<emotion>_<state>_<intensity>.mp4  → intensity variant (optional)
```

- `<emotion>`: happy, sad, angry, upset, excited, surprised, worried, nervous, calm, shy, confused, disappointed, curious, caring, playful, serious, neutral
- `<state>`: `talking`, `thinking`, `idle`
- `<intensity>`: `slight`, `strong` (optional — `normal` হলে suffix লাগে না)

### উদাহরণ

```
safa_happy_talking.mp4        ← happy অবস্থায় কথা বলার video
safa_happy_idle.mp4           ← happy অবস্থায় idle
safa_happy_thinking.mp4       ← happy অবস্থায় thinking
safa_sad_talking.mp4          ← sad অবস্থায় কথা
safa_sad_idle.mp4
safa_angry_talking.mp4
safa_shy_talking.mp4
safa_serious_talking.mp4
safa_caring_talking.mp4
safa_excited_talking_strong.mp4  ← খুব excited হলে এই variant
```

**প্রতিটি emotion-এর প্রতিটি state-এর video দরকার নেই** — যেটা দরকার শুধু সেটা দাও, বাকিতে automatic fallback কাজ করবে।

## Fallback Chain (video না থাকলে যা হয়)

```
1. safa_<emotion>_<state>_<intensity>.mp4   (শুধু slight/strong হলে)
2. safa_<emotion>_<state>.mp4               (exact match)
3. safa_<emotion>_idle.mp4                  (same emotion, idle cut)
4. safa_<group-leader>_<state>.mp4          (কাছের emotion family)
5. safa_<group-leader>_idle.mp4
6. Talking.mp4 / Thinking.mp4 / Waiting.mp4 (base video)
7. Kaomoji (সব video fail করলে)
```

### Emotion Family (fallback grouping)

| Family Leader | Members |
|---|---|
| `happy` | playful, excited, proud, curious, surprised |
| `sad` | disappointed, worried, nervous, upset |
| `calm` | caring, shy, embarrassed |
| `neutral` | serious, confused |

মানে: `safa_sad_talking.mp4` না থাকলে `disappointed`/`worried`/`nervous`/`upset` ও sad family-র video ব্যবহার করবে।

## নতুন Emotion যোগ করতে চাইলে

1. `emotion_system.ts` → `CANONICAL_EMOTIONS` array-তে নামটা add করো
2. `EMOTIONAL_DELIVERY_PROTOCOL`-এ voice delivery style লিখে দাও
3. `MyraaCoreVisualizer.tsx` → `MyraaEmotion` type + `EMOTION_GROUP_LEADER` + `KAOMOJI` map-এ add করো
4. `assets/` folder-এ `safa_<emotion>_<state>.mp4` video দিলেই auto-detect হবে
