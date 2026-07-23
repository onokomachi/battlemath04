/**
 * components/guided/GuidedRetryHintEngine.tsx
 *
 * syo4-gaisu / syo4-bainomikata / syo4-syousu の RoundModule・TimesModule・
 * BaseModule・CompareModule・RatioCompareModule・MeaningModule・RangeModule・
 * SumDiffModule・ProdQuotModule・RoundJudgeModule・WordProblemModule に共通する
 * インタラクション(ダイアグラム表示 → 単一解答欄 or 選択肢 → 正解するまでヒント付きで
 * リトライ → 解説パネル)を1つのエンジンとして移植したもの。
 */
import React, { useState } from 'react';
import type { GuidedRetryHintData } from '../../types';
import FractionText from '../FractionText';

interface Props {
  data: GuidedRetryHintData;
  onComplete: (isCorrect: boolean) => void;
}

const normalize = (s: string) => s.trim().replace(/^0+(?=\d)/, '');

const GuidedRetryHintEngine: React.FC<Props> = ({ data, onComplete }) => {
  const { prompt, answer, answerAliases = [], svg, hint, choices, choiceAnswerIndex, multiple, explain, allowDecimal = true, extraKeys = [] } = data;
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [stage, setStage] = useState<'answer' | 'done'>('answer');
  const [mistakes, setMistakes] = useState(0);
  const [shownHint, setShownHint] = useState<string | null>(null);
  const [pickedWrong, setPickedWrong] = useState<number | null>(null);
  const hints = Array.isArray(hint) ? hint : [hint];

  const finish = (perfect: boolean) => {
    setStage('done');
    onComplete(perfect);
  };

  const submitText = () => {
    if (input === '') return;
    const candidates = [answer, ...answerAliases].map(normalize);
    if (candidates.includes(normalize(input))) {
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      setShownHint(hints[Math.min(mistakes, hints.length - 1)] ?? hints[0]);
      setInput('');
    }
  };

  const chooseAnswer = (i: number) => {
    if (i === choiceAnswerIndex) {
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      setPickedWrong(i);
      setShownHint(hints[Math.min(mistakes, hints.length - 1)] ?? hints[0]);
    }
  };

  const toggleMulti = (c: string) => {
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const submitMulti = () => {
    const want = [...answer.split(',')].map((s) => s.trim()).sort();
    const got = [...selected].sort();
    if (want.length === got.length && want.every((v, i) => v === got[i])) {
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      setShownHint(hints[Math.min(mistakes, hints.length - 1)] ?? hints[0]);
    }
  };

  const handleKey = (k: string) => {
    if (k === 'BACKSPACE') setInput((v) => v.slice(0, -1));
    else if (k === 'CLEAR') setInput('');
    else if (k === '.' && (!allowDecimal || input.includes('.'))) return;
    else setInput((v) => v + k);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 text-center">
        <p className="text-base sm:text-lg font-black text-white leading-relaxed">
          <FractionText text={prompt} />
        </p>
        {svg && <div className="svg-container w-full max-w-xs mx-auto my-3 p-1.5 bg-slate-950 rounded-lg border border-red-500/10" dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>

      {shownHint && stage === 'answer' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <h3 className="text-amber-300 font-black text-sm mb-1">💡 ヒント</h3>
          <p className="text-amber-100/80 text-xs font-bold whitespace-pre-line leading-relaxed">{shownHint}</p>
        </div>
      )}

      {stage === 'answer' && choices && !multiple && (
        <div className="grid gap-2">
          {choices.map((c, i) => (
            <button
              key={i}
              onClick={() => chooseAnswer(i)}
              className={`p-4 rounded-2xl border-2 text-left font-black transition-all active:scale-[0.98] ${
                pickedWrong === i ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-slate-900/60 border-red-900/50 text-white hover:border-red-500/50'
              }`}
            >
              <FractionText text={c} auto />
            </button>
          ))}
        </div>
      )}

      {stage === 'answer' && choices && multiple && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-red-300/70 font-bold">あてはまるものを すべて えらんでから「こたえる」を おそう</p>
          {choices.map((c, i) => {
            const isSelected = selected.includes(c);
            return (
              <button
                key={i}
                onClick={() => toggleMulti(c)}
                className={`p-4 rounded-2xl border-2 text-left font-black transition-all active:scale-[0.98] ${
                  isSelected ? 'bg-red-500/10 border-red-400 text-red-200' : 'bg-slate-900/60 border-red-900/50 text-white hover:border-red-500/50'
                }`}
              >
                <FractionText text={c} auto />
              </button>
            );
          })}
          <button
            onClick={submitMulti}
            disabled={selected.length === 0}
            className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${selected.length > 0 ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-900 text-red-900'}`}
          >
            こたえる({selected.length}こ えらんだ)
          </button>
        </div>
      )}

      {stage === 'answer' && !choices && (
        <div className="flex flex-col gap-2">
          <div className="min-h-[3rem] p-3 bg-slate-950/60 rounded-xl border-2 border-red-500/30 flex items-center shadow-inner">
            <span className="text-xs font-bold text-red-400 mr-2 whitespace-nowrap">解答:</span>
            <span className="text-lg font-mono text-red-200 flex-grow font-bold tracking-wide">
              {input || <span className="text-red-800 text-sm">キーパッドで入力...</span>}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} onClick={() => handleKey(String(n))} className="h-12 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-xl font-black text-white transition-all">
                {n}
              </button>
            ))}
            <button onClick={() => handleKey('CLEAR')} className="h-12 bg-red-950/20 border border-red-500/20 text-red-300 rounded-xl text-xs font-black uppercase">Clear</button>
            <button onClick={() => handleKey('0')} className="h-12 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-xl font-black text-white transition-all">0</button>
            {allowDecimal ? (
              <button onClick={() => handleKey('.')} className="h-12 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-xl font-black text-white transition-all">.</button>
            ) : extraKeys.length === 0 ? (
              <button onClick={() => handleKey('BACKSPACE')} className="h-12 bg-blue-900/20 border border-blue-500/20 text-red-400 rounded-xl transition-all">⌫</button>
            ) : (
              <div />
            )}
          </div>
          {extraKeys.length > 0 && (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${extraKeys.length}, 1fr)` }}>
              {extraKeys.map((k) => (
                <button key={k} onClick={() => handleKey(k)} className="h-11 bg-amber-900/20 border border-amber-500/30 text-amber-200 rounded-xl font-black transition-all">{k}</button>
              ))}
            </div>
          )}
          <button onClick={() => handleKey('BACKSPACE')} className="h-10 bg-blue-900/20 border border-blue-500/20 text-red-400 rounded-xl transition-all text-sm font-black">⌫ もどす</button>
          <button
            onClick={submitText}
            disabled={input === ''}
            className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${input !== '' ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-900 text-red-900'}`}
          >
            チェック
          </button>
        </div>
      )}

      {stage === 'done' && (
        <div className={`flex flex-col items-center p-5 rounded-2xl text-center gap-2 border ${mistakes === 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-red-950/30 border-red-500/20'}`}>
          <span className="text-4xl">{mistakes === 0 ? '🏆' : '✅'}</span>
          <h3 className={`text-lg font-black ${mistakes === 0 ? 'text-emerald-300' : 'text-red-200'}`}>{mistakes === 0 ? 'パーフェクト！' : 'せいかい！'}</h3>
          {explain && <p className="text-red-100/70 text-xs font-bold leading-relaxed"><FractionText text={explain} /></p>}
        </div>
      )}
    </div>
  );
};

export default GuidedRetryHintEngine;
