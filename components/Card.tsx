
import React from 'react';
import type { ProblemCard } from '../types';
import { StarIcon } from './Icons';
import FractionText from './FractionText';

interface CardProps {
  card: ProblemCard;
  onClick?: () => void;
  isPlayable?: boolean;
  inHand?: boolean;
  isSelected?: boolean;
  isFaceDown?: boolean;
  isDisabled?: boolean;
}

const categoryStyles: { [key: string]: { border: string, glow: string, header: string, accent: string } } = {
  "大きい数のしくみ": { border: 'border-blue-500/40', glow: 'shadow-blue-500/20', header: 'from-blue-900/60 to-transparent', accent: 'text-blue-300' },
  "折れ線グラフと表": { border: 'border-teal-500/40', glow: 'shadow-teal-500/20', header: 'from-teal-900/60 to-transparent', accent: 'text-teal-300' },
  "わり算の筆算(÷1けた)": { border: 'border-red-500/40', glow: 'shadow-red-500/20', header: 'from-red-900/60 to-transparent', accent: 'text-red-300' },
  "角の大きさ": { border: 'border-amber-500/40', glow: 'shadow-amber-500/20', header: 'from-amber-900/60 to-transparent', accent: 'text-amber-300' },
  "小数のしくみ": { border: 'border-sky-400/40', glow: 'shadow-sky-400/20', header: 'from-sky-900/60 to-transparent', accent: 'text-sky-200' },
  "わり算の筆算(÷2けた)": { border: 'border-rose-500/40', glow: 'shadow-rose-500/20', header: 'from-rose-900/60 to-transparent', accent: 'text-rose-300' },
  "がい数": { border: 'border-indigo-500/40', glow: 'shadow-indigo-500/20', header: 'from-indigo-900/60 to-transparent', accent: 'text-indigo-300' },
  "計算のきまり": { border: 'border-violet-500/40', glow: 'shadow-violet-500/20', header: 'from-violet-900/60 to-transparent', accent: 'text-violet-300' },
  "面積": { border: 'border-lime-500/40', glow: 'shadow-lime-500/20', header: 'from-lime-900/60 to-transparent', accent: 'text-lime-300' },
  "小数のかけ算とわり算": { border: 'border-cyan-500/40', glow: 'shadow-cyan-500/20', header: 'from-cyan-900/60 to-transparent', accent: 'text-cyan-300' },
  "分数": { border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20', header: 'from-emerald-900/60 to-transparent', accent: 'text-emerald-300' },
  "変わり方調べ": { border: 'border-fuchsia-500/40', glow: 'shadow-fuchsia-500/20', header: 'from-fuchsia-900/60 to-transparent', accent: 'text-fuchsia-300' },
  "直方体と立方体": { border: 'border-orange-500/40', glow: 'shadow-orange-500/20', header: 'from-orange-900/60 to-transparent', accent: 'text-orange-300' },
  "倍の見方": { border: 'border-pink-500/40', glow: 'shadow-pink-500/20', header: 'from-pink-900/60 to-transparent', accent: 'text-pink-300' },
  "default": {
    border: 'border-slate-500/40',
    glow: 'shadow-slate-500/20',
    header: 'from-slate-800/60 to-transparent',
    accent: 'text-slate-300'
  }
};

const Card: React.FC<CardProps> = ({ 
  card, 
  onClick, 
  isPlayable = false, 
  inHand = false,
  isSelected = false,
  isFaceDown = false,
  isDisabled = false
}) => {
  if (isFaceDown || !card) {
    return <CardBack />;
  }
  
  const styles = categoryStyles[card.mainCategory] || categoryStyles.default;

  // 安全に問題文を取得する
  const getCardDisplayText = () => {
    const data = card.problem?.data as any;
    if (!data) return "問題データなし";
    
    // プロパティ候補を順に探す
    const text = data.question || data.questionText;
    if (text) return text;

    return card.category || "問題にちょうせん";
  };

  const cardClasses = `
    w-32 h-48 sm:w-40 sm:h-60 md:w-48 md:h-72 border ${styles.border} rounded-xl shadow-2xl flex flex-col justify-between p-2 sm:p-3 md:p-4 transition-all duration-500 transform relative overflow-hidden group
    bg-slate-950/80 backdrop-blur-xl ${styles.glow}
    ${isPlayable && !isDisabled ? 'cursor-pointer' : ''}
    ${isDisabled ? 'opacity-40 saturate-0 scale-95 grayscale' : ''}
    ${isSelected ? 'scale-110 -translate-y-6 z-50 ring-2 ring-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : inHand && !isDisabled ? 'hover:scale-105 hover:-translate-y-2' : ''}
  `;
  
  return (
    <div className={cardClasses} onClick={(isPlayable && !isDisabled) ? onClick : undefined}>
      {/* Dynamic Scanline */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(rgba(239,68,68,0.1)_1px,transparent_1px)] [background-size:100%_4px]"></div>
      
      {/* Star Shine Effect */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-100%] left-[-100%] w-[300%] h-[300%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_50%)] translate-x-[var(--mouse-x,0)] translate-y-[var(--mouse-y,0)] transition-transform duration-75"></div>
      </div>

      <div className={`absolute top-0 left-0 right-0 p-3 text-center text-red-50 text-[10px] font-bold uppercase tracking-[0.3em] bg-gradient-to-b ${styles.header} border-b border-red-400/20`}>
          {card.category}
      </div>

      <div className="flex-grow flex flex-col items-center justify-center text-center mt-6 px-1 relative z-10">
        <p className="text-slate-100 text-[11px] font-bold leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-['JetBrains_Mono'] overflow-hidden line-clamp-6">
          <FractionText text={getCardDisplayText()} />
        </p>
        {card.ability && (
          <div className="mt-4 p-2 bg-blue-950/50 rounded-lg border border-red-500/30 w-full backdrop-blur-sm shadow-inner">
            <p className="text-red-300 text-[9px] font-black tracking-tighter uppercase leading-tight">{card.ability.description}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center items-center gap-1.5 h-8 relative z-10">
        {[...Array(card.difficulty)].map((_, i) => (
            <StarIcon key={i} className="w-4 h-4 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        ))}
      </div>

      <div className="absolute top-2 left-2 w-1.5 h-1.5 border-t border-l border-red-400/40"></div>
      <div className="absolute top-2 right-2 w-1.5 h-1.5 border-t border-r border-red-400/40"></div>
      <div className="absolute bottom-2 left-2 w-1.5 h-1.5 border-b border-l border-red-400/40"></div>
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 border-b border-r border-red-400/40"></div>
      
      {isDisabled && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className="border border-white/20 px-3 py-1 bg-black/80 rounded-sm">
                <span className="text-[10px] font-bold text-white/50">使用不可</span>
            </div>
         </div>
      )}
    </div>
  );
};

export const CardBack: React.FC = () => {
  return (
    <div className="w-32 h-48 sm:w-40 sm:h-60 md:w-48 md:h-72 bg-slate-950 border border-blue-500/40 rounded-xl shadow-2xl flex items-center justify-center p-2 overflow-hidden relative group">
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.3)_0%,transparent_70%)]"></div>
       <div className="w-full h-full border border-blue-400/20 rounded-lg flex items-center justify-center bg-slate-900/40 relative overflow-hidden">
            <div className="text-center z-10">
                <h3 className="font-['Cinzel_Decorative'] font-bold text-2xl text-red-200 tracking-[0.25em] mb-1 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
                    MATH
                </h3>
                <div className="h-[1px] w-20 bg-red-500/40 mx-auto my-2 shadow-[0_0_10px_#ef4444]"></div>
                <h3 className="font-['Cinzel_Decorative'] font-bold text-[10px] text-red-400/60 tracking-[0.15em]">
                    COSMIC_DECK
                </h3>
            </div>
            {/* Cyber Grid */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[linear-gradient(to_right,#f87171_1px,transparent_1px),linear-gradient(to_bottom,#f87171_1px,transparent_1px)] [background-size:20px_20px]"></div>
       </div>
    </div>
  );
}

export default Card;
