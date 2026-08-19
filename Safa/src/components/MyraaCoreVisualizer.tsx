import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';

export type MyraaEmotion =
  | 'idle'
  | 'neutral'
  | 'playful'
  | 'happy'
  | 'excited'
  | 'curious'
  | 'thinking'
  | 'proud'
  | 'sad'
  | 'surprised'
  | 'embarrassed'
  | 'confused'
  | 'angry'
  | 'upset'
  | 'worried'
  | 'nervous'
  | 'calm'
  | 'shy'
  | 'disappointed'
  | 'caring'
  | 'serious';

type CharacterState = 'idle' | 'thinking' | 'talking';

interface MyraaCoreVisualizerProps {
  state: 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';
  themeColor: string;
  activeEmotion: MyraaEmotion;
  /** Internal only: slight/normal/strong — picks stronger video variants when present. */
  emotionIntensity?: string;
  characterState: CharacterState;
}

// ─── Emotion → video family leadership (fallback grouping) ─────────────────
// When a specific emotion's video is missing, the chain falls back to the
// family leader before dropping to the legacy state videos.
const EMOTION_GROUP_LEADER: Record<string, string> = {
  playful: 'happy',
  excited: 'happy',
  proud: 'happy',
  curious: 'happy',
  surprised: 'happy',
  disappointed: 'sad',
  worried: 'sad',
  nervous: 'sad',
  upset: 'sad',
  caring: 'calm',
  shy: 'calm',
  embarrassed: 'calm',
  confused: 'neutral',
  serious: 'neutral',
  thinking: 'neutral',
  idle: 'neutral',
};

// Base state videos that always exist today — the final video fallback before
// the kaomoji. Missing emotion-specific files degrade gracefully onto these,
// so the current app's behavior is preserved exactly until new videos land.
const LEGACY_STATE_VIDEOS: Record<CharacterState, string> = {
  talking: 'assets/Talking.mp4',
  thinking: 'assets/Thinking.mp4',
  idle: 'assets/Waiting.mp4',
};

/**
 * Ordered fallback chain for the current emotion × state × intensity:
 *   1. assets/safa_<emotion>_<state>_<intensity>.mp4   (optional variant)
 *   2. assets/safa_<emotion>_<state>.mp4               (exact match)
 *   3. assets/safa_<emotion>_idle.mp4                  (emotion, any state)
 *   4. assets/safa_<group-leader>_<state>.mp4          (closest family)
 *   5. assets/safa_<group-leader>_idle.mp4
 *   6. legacy state video (Talking/Thinking/Waiting.mp4)
 * The <video onError> handler advances down the list; after the last entry
 * the kaomoji fallback renders. All safa_* files are OPTIONAL.
 */
function getVideoCandidates(
  emotion: MyraaEmotion,
  state: CharacterState,
  intensity?: string,
): string[] {
  const e = String(emotion || 'neutral').toLowerCase();
  const list: string[] = [];
  if (intensity && intensity !== 'normal') {
    list.push(`assets/safa_${e}_${state}_${intensity}.mp4`);
  }
  list.push(`assets/safa_${e}_${state}.mp4`);
  if (state !== 'idle') {
    list.push(`assets/safa_${e}_idle.mp4`);
  }
  const leader = EMOTION_GROUP_LEADER[e];
  if (leader && leader !== e) {
    list.push(`assets/safa_${leader}_${state}.mp4`);
    if (state !== 'idle') {
      list.push(`assets/safa_${leader}_idle.mp4`);
    }
  }
  list.push(LEGACY_STATE_VIDEOS[state]);
  return [...new Set(list)];
}

// ─── Kaomoji fallback (final graceful degradation) ─────────────────────────
const KAOMOJI: Record<string, string> = {
  happy: '(❁´◡`❁)',
  playful: '(๑>◡<๑)',
  excited: '(≧▽≦)☆',
  proud: '(☆▽☆)',
  sad: '(｡•́︿•̀｡)',
  angry: '(╬◣д◢)',
  upset: '(´•︵•`)',
  thinking: '(・_・;)',
  confused: '(・・?)',
  surprised: '( Σ(°△°|||)',
  shy: '(⁄⁄>⁄▽⁄<⁄⁄)',
  embarrassed: '(⁄⁄>﹏<⁄⁄)',
  worried: '(´･_･`)',
  nervous: '(；゜〇゜)',
  calm: '(-‿◦)',
  caring: '(♡˙︶˙♡)',
  disappointed: '(´-ι_-｀)',
  curious: '(◉‿◉)',
  serious: '(￣^￣)',
  neutral: '(*^^*)',
  idle: '(*^^*)',
};

export const MyraaCoreVisualizer: React.FC<MyraaCoreVisualizerProps> = ({
  state,
  themeColor,
  activeEmotion,
  emotionIntensity,
  characterState,
}) => {
  const candidates = useMemo(
    () => getVideoCandidates(activeEmotion, characterState, emotionIntensity),
    [activeEmotion, characterState, emotionIntensity],
  );
  // Advance down the fallback chain only when a video actually fails to load.
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => {
    setCandidateIndex(0);
  }, [activeEmotion, characterState, emotionIntensity]);

  const exhausted = candidateIndex >= candidates.length;
  const videoSrc = exhausted ? null : candidates[candidateIndex];
  const videoRef = useRef<HTMLVideoElement>(null);

  // Seamless swap: reload + play whenever the resolved source changes.
  useEffect(() => {
    if (videoRef.current && videoSrc) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked — the control remains visible via muted autoplay policy.
      });
    }
  }, [videoSrc]);

  const kaomoji =
    characterState === 'talking'
      ? '(๑•̀ㅂ•́)و✧'
      : characterState === 'thinking'
        ? '(・_・;)'
        : KAOMOJI[String(activeEmotion || 'neutral').toLowerCase()] || KAOMOJI.neutral;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {state === 'disconnected' ? (
          <motion.div
            key="offline-stage"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            className="relative flex flex-col items-center"
          >
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shadow-inner relative group cursor-pointer backdrop-blur-md">
              <Heart
                size={32}
                className="text-slate-600 group-hover:text-rose-500/70 transition-colors duration-500"
              />
              <div className="absolute inset-0 rounded-full bg-slate-500/5 animate-ping opacity-30" />
            </div>
            <p className="mt-6 font-mono text-xs text-slate-500 tracking-[0.3em] font-medium uppercase">
              SYSTEM STANDBY
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="active-stage"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {videoSrc ? (
                // Crossfade between emotion/state videos — old fades out while
                // the new fades in (0.35s), so switching never flashes black.
                <AnimatePresence mode="sync">
                  <motion.div
                    key={videoSrc}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <video
                      ref={videoRef}
                      key={`video-${videoSrc}`}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      src={videoSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={() => setCandidateIndex(i => i + 1)}
                    />
                  </motion.div>
                </AnimatePresence>
              ) : (
                // Graceful kaomoji fallback when every candidate is missing
                <div className="flex flex-col items-center justify-center h-48 w-48 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                  <div className="font-mono text-2xl font-bold tracking-tight text-indigo-400">
                    {kaomoji}
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-3">
                    [{activeEmotion}]
                  </span>
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="mt-4 flex flex-col items-center z-10 pointer-events-none">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/5 bg-slate-950/60 backdrop-blur-md">
                <span className="relative flex h-1.5 w-1.5">
                  {characterState === 'talking' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
                    </>
                  ) : characterState === 'thinking' ? (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-400 animate-pulse"></span>
                  ) : (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500 animate-pulse"></span>
                  )}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                  {characterState === 'talking'
                    ? 'Speaking'
                    : characterState === 'thinking'
                      ? 'Thinking'
                      : 'Listening'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
