
import React from 'react';
import { LightbulbIcon } from './Icons';

interface ProblemControlsProps {
  isProof: boolean;
  isLoading: boolean;
  userAnswer: string;
  result: 'correct' | 'incorrect' | 'proof' | null;
  isSessionComplete: boolean;
  hasHint: boolean;
  onCheckAnswer: () => void;
  onLoadNextProblem: () => void;
  onShowHint: () => void;
}

const ProblemControls: React.FC<ProblemControlsProps> = ({
  isProof,
  isLoading,
  userAnswer,
  result,
  isSessionComplete,
  hasHint,
  onCheckAnswer,
  onLoadNextProblem,
  onShowHint,
}) => {
  return (
    <div className='w-full flex flex-col gap-2'>
      <button
        onClick={onCheckAnswer}
        disabled={isLoading || !userAnswer || result !== null || isSessionComplete}
        className="w-full bg-blue-600 text-white font-bold px-4 py-2.5 sm:py-3 rounded-xl hover:bg-blue-500 transition-all disabled:bg-slate-900/50 disabled:text-slate-600 disabled:border-slate-800 disabled:cursor-not-allowed text-sm sm:text-base shadow-lg border border-blue-400/30"
      >
        {isProof ? '確認する' : '解答する'}
      </button>
      <button
        onClick={onLoadNextProblem}
        disabled={isSessionComplete}
        className="w-full bg-slate-900 text-red-300 px-4 py-2 sm:py-2.5 rounded-xl hover:bg-slate-800 transition-all text-xs sm:text-sm border border-red-800/50 disabled:opacity-20 disabled:cursor-not-allowed font-bold"
      >
        次の問題へ
      </button>
      <button
        onClick={onShowHint}
        disabled={!hasHint || isSessionComplete}
        className="w-full bg-slate-900/30 text-red-400 px-4 py-2 sm:py-2.5 rounded-xl hover:bg-red-900/20 transition-all text-xs sm:text-sm border border-red-500/20 disabled:opacity-10 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold"
      >
        <LightbulbIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        ヒントを見る
      </button>
    </div>
  );
};

export default ProblemControls;
