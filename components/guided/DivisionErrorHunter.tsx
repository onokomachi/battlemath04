/**
 * components/guided/DivisionErrorHunter.tsx
 * wari-hissann3 の ErrorHunterModule.tsx を移植(デザインのみダークテーマ化)。
 * 「見つけて(judge) → 直して(fix) → 理由を選ぶ(reason)」の3ステップ。
 */
import React, { useState } from 'react';
import type { GuidedDivisionErrorHunterData } from '../../types';
import HissanBracket from './HissanBracket';

interface Props {
  data: GuidedDivisionErrorHunterData;
  onComplete: (isCorrect: boolean) => void;
}

const DivisionErrorHunter: React.FC<Props> = ({ data, onComplete }) => {
  const { dividend, divisor, isCorrect, wrongQuotient, wrongRemainder, wrongOffset, correctQuotient, correctRemainder, fixHint, reasonOptions, reasonAnswerIndex, explain } = data;
  const [stage, setStage] = useState<'judge' | 'fix' | 'reason' | 'done'>('judge');
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [qInput, setQInput] = useState('');
  const [rInput, setRInput] = useState('');
  const [activeField, setActiveField] = useState<'q' | 'r'>('q');

  const finish = () => {
    setStage('done');
    onComplete(mistakes === 0);
  };

  const judge = (saysCorrect: boolean) => {
    setHint(null);
    if (saysCorrect === isCorrect) {
      if (isCorrect) finish();
      else setStage('fix');
    } else {
      setMistakes((m) => m + 1);
      setHint(isCorrect
        ? 'もう一度よく見て。たしかめ算(わる数×商+あまり)をすると合っているかわかるよ。'
        : 'もう一度よく見て。たしかめ算をしたり、あまりとわる数をくらべたりしてみよう。');
    }
  };

  const submitFix = () => {
    const okQ = Number(qInput) === correctQuotient;
    const okR = Number(rInput || '0') === correctRemainder;
    if (okQ && okR) {
      setHint(null);
      setStage('reason');
    } else {
      setMistakes((m) => m + 1);
      setHint(fixHint);
    }
  };

  const chooseReason = (i: number) => {
    if (i === reasonAnswerIndex) finish();
    else {
      setMistakes((m) => m + 1);
      setHint('うーん、ちがうみたい。どんなまちがいだったか、もとの式と正しい答えをくらべて考えよう。');
    }
  };

  const handleKey = (field: 'q' | 'r', k: string) => {
    const setter = field === 'q' ? setQInput : setRInput;
    if (k === 'BACKSPACE') setter((v) => v.slice(0, -1));
    else if (k === 'CLEAR') setter('');
    else setter((v) => v + k);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6">
        <div className="text-xs font-black text-red-400/70 mb-2">この筆算</div>
        <div className="flex flex-col items-center gap-2 py-2">
          <HissanBracket
            dividend={String(dividend)}
            divisor={String(divisor)}
            quotient={String(wrongQuotient)}
            quotientOffset={wrongOffset}
            quotientWrong={!isCorrect && stage !== 'judge'}
          />
          <div className="text-xl font-black text-white tabular-nums">
            答え　{wrongQuotient}{wrongRemainder > 0 ? ` あまり ${wrongRemainder}` : ''}
          </div>
        </div>
      </div>

      {hint && stage !== 'done' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <h3 className="text-amber-300 font-black text-sm mb-1">💡 ヒント</h3>
          <p className="text-amber-100/80 text-xs font-bold whitespace-pre-line leading-relaxed">{hint}</p>
        </div>
      )}

      {stage === 'judge' && (
        <>
          <p className="text-center text-red-200/80 font-bold text-sm">このこたえは…？</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => judge(true)} className="px-6 py-4 rounded-2xl bg-slate-900/60 border-2 border-emerald-500/40 text-emerald-300 font-black text-base hover:bg-emerald-950/40 active:scale-95 transition-all">✓ 正しい</button>
            <button onClick={() => judge(false)} className="px-6 py-4 rounded-2xl bg-slate-900/60 border-2 border-rose-500/40 text-rose-300 font-black text-base hover:bg-rose-950/40 active:scale-95 transition-all">✗ まちがい</button>
          </div>
        </>
      )}

      {stage === 'fix' && (
        <>
          <p className="text-center text-red-200/80 font-black text-sm">正しいこたえは？(わりきれたらあまりは0)</p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="text-[10px] font-bold text-red-400/70 mb-1">商</div>
              <button onClick={() => setActiveField('q')} className={`w-20 h-12 rounded-xl border-2 font-mono text-xl font-black flex items-center justify-center ${activeField === 'q' ? 'border-red-400 bg-red-500/10 text-red-200' : 'border-red-900/50 bg-slate-900/60 text-white'}`}>
                {qInput || '？'}
              </button>
            </div>
            <span className="text-red-400 font-black">あまり</span>
            <div className="text-center">
              <div className="text-[10px] font-bold text-red-400/70 mb-1">あまり</div>
              <button onClick={() => setActiveField('r')} className={`w-20 h-12 rounded-xl border-2 font-mono text-xl font-black flex items-center justify-center ${activeField === 'r' ? 'border-red-400 bg-red-500/10 text-red-200' : 'border-red-900/50 bg-slate-900/60 text-white'}`}>
                {rInput || '0'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <button key={n} onClick={() => handleKey(activeField, String(n))} className="h-11 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-lg font-black text-white transition-all">{n}</button>
            ))}
            <button onClick={() => handleKey(activeField, 'BACKSPACE')} className="h-11 bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl">⌫</button>
          </div>
          <button onClick={submitFix} disabled={qInput === ''} className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${qInput !== '' ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-900 text-red-900'}`}>
            なおす！
          </button>
        </>
      )}

      {stage === 'reason' && (
        <>
          <p className="text-center text-red-200/80 font-black text-sm">なぜまちがえたのかな？</p>
          <div className="flex flex-col gap-2">
            {reasonOptions.map((r, i) => (
              <button key={i} onClick={() => chooseReason(i)} className="text-left p-4 rounded-2xl bg-slate-900/60 border-2 border-red-900/50 text-white font-bold hover:border-rose-400/60 active:scale-[0.99] transition-all">
                {r}
              </button>
            ))}
          </div>
        </>
      )}

      {stage === 'done' && (
        <div className={`flex flex-col items-center p-5 rounded-2xl text-center gap-2 border ${mistakes === 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-red-950/30 border-red-500/20'}`}>
          <span className="text-4xl">{mistakes === 0 ? '🏆' : '🎉'}</span>
          <h3 className={`text-lg font-black ${mistakes === 0 ? 'text-emerald-300' : 'text-red-200'}`}>{mistakes === 0 ? 'パーフェクト！' : 'せいかい！'}</h3>
          <p className="text-red-100/70 text-xs font-bold leading-relaxed">{explain}</p>
        </div>
      )}
    </div>
  );
};

export default DivisionErrorHunter;
