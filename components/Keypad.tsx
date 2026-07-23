
import React from 'react';
import { BackspaceIcon } from './Icons';

interface KeypadProps {
  onKeyClick: (key: string) => void;
  layout: string[][];
  disabled?: boolean;
}

const Keypad: React.FC<KeypadProps> = ({ onKeyClick, layout, disabled = false }) => {
  const renderKey = (key: string) => {
    if (key === ' ' || !key) {
        return <div key={Math.random()} className="h-9 sm:h-11 lg:h-12 w-full"></div>;
    }
    const isSpecial = ['=', '+', '-', '×', '(', ')', '^', '/', '°', '≤', '≥', '<', '>', ',', 'π', '²', '³', '△', '∠', '≡'].includes(key);
    const isVar = ['x', 'y', 'a', 'b'].includes(key);
    const isLetter = /^[A-Z]$/.test(key);
    const isJapanese = ['共通', '対応', 'と', 'あまり', '億', '兆', '万'].includes(key);

    return (
      <button
        key={key}
        type="button"
        onClick={() => onKeyClick(key)}
        disabled={disabled}
        className={`
          h-9 sm:h-11 lg:h-12 w-full flex items-center justify-center rounded-lg transition-all duration-200 border
          text-base sm:text-lg lg:text-xl font-black transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-1 focus:ring-red-400
          ${isSpecial || isVar
            ? 'bg-red-900/20 border-red-400/30 text-red-200 hover:bg-red-800/40 font-["JetBrains_Mono"]'
            : isLetter
            ? 'bg-indigo-900/30 border-indigo-400/30 text-indigo-200 hover:bg-indigo-800/40 font-bold'
            : isJapanese
            ? 'bg-amber-900/20 border-amber-500/30 text-amber-200 hover:bg-amber-800/40 text-base'
            : 'bg-slate-900/60 border-red-900/50 text-white hover:bg-slate-800 font-mono shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]'
          }
          disabled:opacity-10 disabled:cursor-not-allowed disabled:transform-none shadow-lg
        `}
      >
        {key === '^' ? <span className="text-sm">x<sup>n</sup></span> : key}
      </button>
    );
  };
  
  const colCount = layout[0]?.length || 3;
  const gridColsClass =
    colCount >= 6 ? 'grid-cols-6' :
    colCount === 5 ? 'grid-cols-5' :
    colCount === 4 ? 'grid-cols-4' :
    colCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="w-full mt-1.5 sm:mt-2 bg-slate-950/40 p-2 sm:p-3 rounded-xl backdrop-blur-xl border border-red-500/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <div className={`grid ${gridColsClass} gap-1.5 sm:gap-2`}>
        {layout.flat().map(key => renderKey(key))}
      </div>
       <div className={`grid ${gridColsClass} gap-1.5 sm:gap-2 mt-1.5 sm:mt-2`}>
         <button
            type="button"
            onClick={() => onKeyClick('CLEAR')}
            disabled={disabled}
            className={`h-9 sm:h-11 lg:h-12 w-full flex items-center justify-center rounded-lg transition-all duration-200
              text-xs font-black transform hover:scale-105 focus:outline-none focus:ring-1 focus:ring-red-400
              bg-red-950/20 border border-red-500/20 text-red-300 hover:bg-red-900/40 uppercase tracking-widest
              disabled:opacity-20 disabled:cursor-not-allowed shadow-lg ${colCount >= 5 ? 'col-span-3' : colCount >= 3 ? 'col-span-2' : 'col-span-1'}`}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => onKeyClick('BACKSPACE')}
            disabled={disabled}
            className={`h-9 sm:h-11 lg:h-12 w-full flex items-center justify-center rounded-lg transition-all duration-200
               transform hover:scale-105 focus:outline-none focus:ring-1 focus:ring-red-400
              bg-blue-900/20 border border-blue-500/20 text-red-400 hover:bg-blue-800/40
              disabled:opacity-20 disabled:cursor-not-allowed shadow-lg ${colCount >= 5 ? 'col-span-2' : 'col-span-1'}`}
          >
            <BackspaceIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
      </div>
    </div>
  );
};

export default Keypad;
