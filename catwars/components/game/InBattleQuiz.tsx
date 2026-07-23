import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '../../../types';
import { getMixedProblemSet } from '../../../services/problemService';
import { checkAnswer } from '../../../utils/answerChecker';
import { generateBattleKeypadLayout } from '../../../utils/keypadLayoutGenerator';
import Keypad from '../../../components/Keypad';
import FractionText, { PartialFractionDisplay } from '../../../components/FractionText';
import GuidedAnswerHost from '../../../components/guided/GuidedAnswerHost';
import { sfx } from '../../utils/audioEngine';

// 戦闘中クイズで扱う問題タイプ（コンパクトに解けるものだけに限定）
const SAFE_TYPES = new Set(['text', 'guided']);
const isServable = (p: Problem): boolean => {
  const d = p.data as { options?: string[] };
  return SAFE_TYPES.has(p.type) || Array.isArray(d?.options);
};

interface Props {
  subtopics: string[];
  /** 正解で得られる基本エナジー */
  reward?: number;
  onReward: (energy: number) => void;
  onClose: () => void;
}

/**
 * 戦闘中に、出撃前に選んだ範囲からランダムに問題を出題するミニクイズ。
 * 正解すると ⚡エナジー を獲得（連続正解でボーナス）。battlemath04 の問題・採点をそのまま利用。
 */
export const InBattleQuiz: React.FC<Props> = ({ subtopics, reward = 40, onReward, onClose }) => {
  // 出題プール（選択範囲から、戦闘中に解ける問題だけを大量に抽出してシャッフル）
  const pool = useMemo(() => getMixedProblemSet(subtopics, 999).filter(isServable), [subtopics]);
  const idxRef = useRef(0);
  const [problem, setProblem] = useState<Problem | null>(pool[0] ?? null);
  const [answer, setAnswer] = useState('');
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gained, setGained] = useState(0);

  const nextProblem = useCallback(() => {
    if (pool.length === 0) return;
    idxRef.current = (idxRef.current + 1) % pool.length;
    setProblem(pool[idxRef.current]);
    setAnswer('');
    setFeedback(null);
  }, [pool]);

  const problemType = problem?.type ?? 'text';
  const problemData = (problem?.data ?? {}) as any;
  const keypadLayout = useMemo(() => (problem ? generateBattleKeypadLayout(problem) : undefined), [problem]);
  const isFractionKeypad = useMemo(() => !!keypadLayout?.some(r => r.includes('と')), [keypadLayout]);

  const grant = useCallback((correct: boolean) => {
    if (correct) {
      const newCombo = combo + 1;
      const bonus = newCombo % 3 === 0 ? reward : 0; // 3連続ごとにボーナス
      const total = reward + bonus;
      setCombo(newCombo);
      setGained(total);
      setFeedback('correct');
      sfx.correct();
      onReward(total);
      setTimeout(() => { setGained(0); nextProblem(); }, 750);
    } else {
      setCombo(0);
      setFeedback('wrong');
      sfx.incorrect();
      setTimeout(() => setFeedback(null), 700);
    }
  }, [combo, reward, onReward, nextProblem]);

  const submit = useCallback(() => {
    if (!problem || feedback === 'correct') return;
    const correct = checkAnswer(answer.trim(), problem.answer, {
      multiple: !!problemData?.multiple, requireForm: problemData?.requireForm,
    });
    grant(correct);
  }, [answer, problem, problemData, feedback, grant]);

  const onKey = useCallback((key: string) => {
    if (feedback === 'correct') return;
    if (key === 'BACKSPACE') setAnswer(p => p.slice(0, -1));
    else if (key === 'CLEAR') setAnswer('');
    else setAnswer(p => p + key);
  }, [feedback]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [submit, onClose]);

  return (
    <div className="fixed inset-0 z-[140] flex flex-col" style={{ background: 'rgba(3,6,16,0.94)', backdropFilter: 'blur(8px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-[#facc15]/25">
        <span className="text-[#facc15] font-bold text-sm" style={{ fontFamily: 'Orbitron, monospace' }}>⚡ エナジーチャージ</span>
        {combo > 0 && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#facc15]/15 text-[#facc15] border border-[#facc15]/40">
            {combo} コンボ！
          </span>
        )}
        <button onClick={onClose} className="ml-auto text-white/60 hover:text-white text-sm px-3 py-1 rounded-lg border border-white/15">
          戦場へもどる ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {!problem ? (
          <div className="text-white/60 text-sm mt-16 text-center">
            この範囲に、戦闘中クイズで出せる問題がありません。<br />別の範囲を選ぶか、戦場でエナジーの自然回復を待とう。
          </div>
        ) : (
          <div className={`w-full max-w-2xl rounded-2xl p-4 border transition-all ${feedback === 'wrong' ? 'vfx-shake border-red-500/60' : feedback === 'correct' ? 'border-[#a3e635]/70' : 'border-[#facc15]/30'}`}
            style={{ background: 'rgba(10,14,26,0.85)' }}>
            {/* Question */}
            <div className="text-center text-white text-lg sm:text-xl font-mono mb-3">
              <FractionText text={problemData?.question || problemData?.questionText || '問題'} />
              {problemData?.svg && (
                <div className="svg-container w-full max-w-xs mx-auto my-2 p-1.5 bg-slate-950 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: problemData.svg }} />
              )}
            </div>

            {feedback === 'correct' && (
              <div className="text-center text-[#a3e635] font-black text-lg mb-2 animate-level-up-reveal">
                ✓ 正解！ +{gained}⚡
              </div>
            )}

            {/* Answer UI */}
            {problemType === 'guided' ? (
              <GuidedAnswerHost key={idxRef.current} problem={problem}
                onComplete={(isCorrect) => grant(isCorrect)} />
            ) : Array.isArray(problemData?.options) ? (
              <div className="grid gap-2 w-full max-w-lg mx-auto">
                {problemData.options.map((opt: string, i: number) => (
                  <button key={i} onClick={() => { setAnswer(opt); grant(checkAnswer(opt, problem.answer, { multiple: !!problemData?.multiple })); }}
                    className="w-full text-left px-4 py-3 rounded-lg border border-white/15 bg-slate-900/60 text-white hover:border-[#facc15]/60 transition-all">
                    <span className="text-[#facc15] mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>
                    <FractionText text={opt} auto />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-xl mb-3 min-h-[3rem] p-3 bg-slate-950 rounded-xl border-2 border-[#facc15]/30 flex items-center">
                  <span className="text-xs font-bold text-[#facc15] mr-3">解答:</span>
                  {isFractionKeypad ? (
                    <span className="text-2xl font-mono text-[#fde68a] flex-grow font-bold">
                      <PartialFractionDisplay raw={answer} placeholder="キーパッドで入力..." />
                    </span>
                  ) : (
                    <input value={answer} onChange={e => setAnswer(e.target.value)} autoFocus placeholder="入力..."
                      className="flex-grow bg-transparent text-2xl font-mono text-[#fde68a] font-bold outline-none placeholder:text-[#78716c] placeholder:text-base" />
                  )}
                </div>
                <Keypad onKeyClick={onKey} layout={keypadLayout} />
                <button onClick={submit}
                  className="w-full max-w-xl mt-3 py-3 rounded-xl font-bold text-lg text-white transition-all active:scale-95"
                  style={{ background: 'rgba(250,204,21,0.18)', border: '2px solid #facc15', color: '#facc15' }}>
                  解答してエナジーGET ⚡
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
