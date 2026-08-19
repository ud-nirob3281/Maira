/**
 * Study flashcards renderer for the Visual Hub.
 * Click a card to flip; navigate with prev/next. Pure client-side (no API cost).
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

interface FlashcardsViewProps {
  topic: string;
  cards: { front: string; back: string }[];
}

export default function FlashcardsView({ topic, cards }: FlashcardsViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const go = (delta: number) => {
    setFlipped(false);
    setIndex(i => Math.max(0, Math.min(cards.length - 1, i + delta)));
  };

  const card = cards[index];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 px-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/80 text-center max-w-lg">
        {topic} · {cards.length} cards
      </p>

      <button
        onClick={() => setFlipped(f => !f)}
        className="relative w-full max-w-xl min-h-52 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1117] to-[#111827] hover:border-cyan-400/30 transition cursor-pointer px-8 py-8 flex flex-col items-center justify-center gap-3 group"
        title={flipped ? 'Show question' : 'Reveal answer'}
      >
        <span className="absolute top-3 left-4 text-[9px] font-mono uppercase tracking-widest text-slate-600">
          {flipped ? 'ANSWER' : 'QUESTION'}
        </span>
        <RotateCw
          size={13}
          className={`absolute top-3 right-4 text-slate-600 group-hover:text-cyan-300 transition ${flipped ? 'rotate-180' : ''}`}
        />
        <p className={`text-center text-base leading-relaxed select-none ${flipped ? 'text-cyan-100' : 'text-slate-100'}`}>
          {flipped ? card.back : card.front}
        </p>
        <span className="text-[10px] text-slate-600 font-mono">tap to flip</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
          title="Previous card"
        >
          <ChevronLeft size={16} className="text-slate-300" />
        </button>
        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-cyan-400' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>
        <button
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
          title="Next card"
        >
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>
    </div>
  );
}
