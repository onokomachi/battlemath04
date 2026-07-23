
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ProblemCard, TurnPhase, ProblemViewRef, TurnInitiative } from '../types';
import { THEME_CONFIGS } from '../constants';
import { generateBattleKeypadLayout } from '../utils/keypadLayoutGenerator';
import Card, { CardBack } from './Card';
import GameLog from './GameLog';
import AngleDiagramView from './AngleDiagramView';
import BentTransversalDiagramView from './BentTransversalDiagramView';
import FillInProofProblemView from './FillInProofProblemView';
import DrawingCanvas from './DrawingCanvas';
import { PencilIcon } from './Icons';
import GraphingProblemView from './GraphingProblemView';
import GraphingWithTableProblemView from './GraphingWithTableProblemView';
import GraphToEquationProblemView from './GraphToEquationProblemView';
import GraphWithDomainProblemView from './GraphWithDomainProblemView';
import GraphProblemView from './GraphProblemView';
import GuidedEquationProblemView from './GuidedEquationProblemView';
import IntersectionGuidedEquationView from './IntersectionGuidedEquationView';
import MultiTransversalAngleDiagramView from './MultiTransversalAngleDiagramView';
import VerticalCalculationProblemView from './VerticalCalculationProblemView';
import ProofProblemView from './ProofProblemView';
import SimultaneousEquationProblemView from './SimultaneousEquationProblemView';
import TriangleInParallelLinesView from './TriangleInParallelLinesView';
import BoxPlotView from './BoxPlotView';
import HistogramView from './HistogramView';
import Keypad from './Keypad';
import FractionText, { PartialFractionDisplay } from './FractionText';
import GuidedAnswerHost from './guided/GuidedAnswerHost';


// --- ProblemSolver Component ---
interface ProblemSolverProps {
  problemCard: ProblemCard;
  onAnswerSubmit: (answer: string) => void;
  isSolving: boolean;
  turnPhase: TurnPhase;
}

const ProblemSolver: React.FC<ProblemSolverProps> = ({ problemCard, onAnswerSubmit, isSolving, turnPhase }) => {
  const [answer, setAnswer] = useState('');
  const problemViewRef = useRef<ProblemViewRef>(null);

  useEffect(() => {
    if (isSolving) {
      setAnswer('');
    }
  }, [isSolving, problemCard]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const autoAnswerTypes = ['graphing', 'graphing_with_table', 'proof', 'guided_equation', 'intersection_guided_equation', 'simultaneous_equation', 'vertical_calculation', 'fill_in_proof'];
    if (answer.trim() || autoAnswerTypes.includes(problemCard.problem.type)) {
      onAnswerSubmit(answer.trim());
    }
  }, [answer, onAnswerSubmit, problemCard]);

  const handleKeypadClick = useCallback((key: string) => {
    if (!isSolving || turnPhase !== 'solving_problem') return;
    
    const problemType = problemCard?.problem?.type;
    const interactiveTypes = ['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'simultaneous_equation', 'intersection_guided_equation', 'proof'];

    if (interactiveTypes.includes(problemType)) {
       problemViewRef.current?.handleKeyClick(key);
       return;
    }

    if (key === 'BACKSPACE') {
      setAnswer(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setAnswer('');
    } else {
      setAnswer(prev => prev + key);
    }
  }, [isSolving, turnPhase, problemCard]);

  // Physical keyboard support for Battle Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSolving || turnPhase !== 'solving_problem') return;
      // Avoid double input when typing in an <input> element
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const keyMap: Record<string, string> = {
        'Backspace': 'BACKSPACE',
        'Escape': 'CLEAR',
        'Delete': 'CLEAR',
        '*': '×',
        'p': 'π',
        '^': '^',
        'd': '°',
        '<': '<',
        '>': '>',
        't': 'と',
      };

      if (keyMap[e.key]) {
        handleKeypadClick(keyMap[e.key]);
      } else if (/^[0-9xya b=+\-/,().]$/.test(e.key)) {
        handleKeypadClick(e.key);
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadClick, isSolving, turnPhase, handleSubmit]);

  // バトルモード用: 個別問題の正解から動的にキーセットを生成（デコイ多め）
  const battleKeypadLayout = useMemo(() => {
    return generateBattleKeypadLayout(problemCard.problem);
  }, [problemCard]);

  // 分数キーパッド使用時は、入力を積み上げ表記でライブ表示する
  const isFractionKeypad = useMemo(
    () => battleKeypadLayout.some(row => row.includes('と')),
    [battleKeypadLayout],
  );

  const problemType = problemCard.problem.type;
  const problemData = problemCard.problem.data as any;

  return (
    <div className="w-full max-w-4xl bg-slate-950/80 backdrop-blur-2xl border border-red-500/30 rounded-2xl p-3 sm:p-5 md:p-8 flex flex-col items-center shadow-[0_0_80px_rgba(0,0,0,0.8)] relative overflow-y-auto max-h-[75vh] sm:max-h-[80vh]">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
      <h3 className="text-red-400 font-bold text-sm mb-4">問題を解こう</h3>

      <div className="w-full">
      {problemType === 'angle_diagram' && <AngleDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
      {problemType === 'bent_transversal_diagram' && <BentTransversalDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
      {problemType === 'fill_in_proof' && <FillInProofProblemView data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer="" correctAnswer={problemCard.problem.answer} ref={problemViewRef} />}
      {problemType === 'graphing' && <GraphingProblemView data={problemData} onAnswerChange={setAnswer} ref={problemViewRef} />}
      {problemType === 'graphing_with_table' && <GraphingWithTableProblemView data={problemData} onAnswerChange={setAnswer} ref={problemViewRef} />}
      {problemType === 'graph_to_equation' && <GraphToEquationProblemView data={problemData} />}
      {problemType === 'graph_with_domain' && <GraphWithDomainProblemView data={problemData} isVisualHintVisible={false} />}
      {problemType === 'guided_equation' && <GuidedEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problemCard.problem.answer} />}
      {problemType === 'intersection_guided_equation' && <IntersectionGuidedEquationView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problemCard.problem.answer} />}
      {problemType === 'multi_transversal_angle' && <MultiTransversalAngleDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
      {problemType === 'vertical_calculation' && <VerticalCalculationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problemCard.problem.answer} />}
      {problemType === 'proof' && <ProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} />}
      {problemType === 'simultaneous_equation' && <SimultaneousEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} />}
      {problemType === 'triangle_in_parallel_lines' && <TriangleInParallelLinesView data={problemData} userAnswer={answer} isSubmitted={false} />}
      {problemType === 'guided' && (
        // key必須: カードが変わったらエンジンを作り直す(前問の完了状態の持ち越し防止)
        <GuidedAnswerHost
          key={problemCard.id}
          problem={problemCard.problem}
          onComplete={(isCorrect) => onAnswerSubmit(isCorrect ? problemCard.problem.answer : '__guided_incorrect__')}
        />
      )}
      {problemType === 'box_plot' && (
        <div className="w-full text-center">
          <p className="text-base sm:text-xl md:text-2xl mb-2 sm:mb-4 font-mono">{problemData?.question}</p>
          <BoxPlotView datasets={problemData?.datasets || []} hideValue={problemData?.hideValue} />
          {problemData?.options && (
            <div className="grid gap-2 w-full max-w-lg mt-4 text-lg">
              {(problemData.options as string[]).map((opt: string, i: number) => {
                const isSelected = answer === opt;
                return (
                  <button key={i} type="button"
                    onClick={() => { if (turnPhase === 'solving_problem') setAnswer(opt); }}
                    disabled={turnPhase !== 'solving_problem'}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all
                      ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50'}
                      disabled:opacity-50`}>
                    <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {problemType === 'histogram' && (
        <div className="w-full text-center">
          <p className="text-base sm:text-xl md:text-2xl mb-2 sm:mb-4 font-mono">{problemData?.question}</p>
          <HistogramView bars={problemData?.bars || []} xLabel={problemData?.xLabel} yLabel={problemData?.yLabel} />
          {problemData?.options && (
            <div className="grid gap-2 w-full max-w-lg mt-4 text-lg">
              {(problemData.options as string[]).map((opt: string, i: number) => {
                const isSelected = answer === opt;
                return (
                  <button key={i} type="button"
                    onClick={() => { if (turnPhase === 'solving_problem') setAnswer(opt); }}
                    disabled={turnPhase !== 'solving_problem'}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all
                      ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50'}
                      disabled:opacity-50`}>
                    <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {problemType === 'graph_with_area' &&
          <div className="text-center w-full">
            <p className="text-base sm:text-xl md:text-2xl mb-2 sm:mb-4 font-mono">{problemData?.question || "面積を求めよ"}</p>
            <div className="w-full max-w-[200px] sm:max-w-[280px] md:max-w-sm mx-auto aspect-square bg-slate-900 rounded-xl p-2 border border-red-500/10">
             <GraphProblemView lines={problemData?.graphLines || []} polygon={problemData?.polygon} />
            </div>
          </div>
      }
      {(problemType === 'text' || !problemType) && (
        <div className="w-full min-h-[6rem] sm:min-h-[10rem] bg-slate-900/50 border border-red-500/5 rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 flex flex-col items-center justify-center text-center text-white text-base sm:text-xl md:text-2xl font-mono tracking-tight">
          <p><FractionText text={problemData?.question || problemData?.questionText || "問題を といてみよう"} /></p>
          {problemData?.svg ? (
            <div className="svg-container w-full max-w-xs sm:max-w-sm h-auto my-3 sm:my-6 p-2 sm:p-4 bg-slate-950 rounded-lg border border-red-500/10 overflow-visible" dangerouslySetInnerHTML={{ __html: problemData.svg }} />
          ) : problemData?.imageUrl ? (
            <img src={problemData.imageUrl} alt="DOC" className="max-w-full max-h-32 sm:max-h-48 mx-auto rounded-lg border border-red-500/10 p-1 bg-slate-900 my-2 sm:my-4" />
          ) : null}
          {problemData?.options && (
            <div className="grid gap-2 w-full max-w-lg mt-4 text-lg">
              {(problemData.options as string[]).map((opt: string, i: number) => {
                const isSelected = problemData.multiple
                  ? answer.split(',').map((s: string) => s.trim()).includes(opt)
                  : answer === opt;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (turnPhase !== 'solving_problem') return;
                      if (problemData.multiple) {
                        const current = answer ? answer.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                        if (current.includes(opt)) {
                          setAnswer(current.filter((s: string) => s !== opt).join(','));
                        } else {
                          setAnswer([...current, opt].join(','));
                        }
                      } else {
                        setAnswer(opt);
                      }
                    }}
                    disabled={turnPhase !== 'solving_problem'}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all
                      ${isSelected
                        ? 'border-red-400 bg-red-900/30 text-red-200'
                        : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50'}
                      disabled:opacity-50`}
                  >
                    <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>
                    <FractionText text={opt} auto />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        {!['proof', 'guided'].includes(problemType) && (
          <div className="w-full flex flex-col items-center mt-6">
             {!problemData?.options && !['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'simultaneous_equation', 'intersection_guided_equation'].includes(problemType) && (
                 <div className="w-full max-w-xl mb-4">
                    <div className={`min-h-[4rem] p-4 bg-slate-950 rounded-xl border-2 border-red-500/30 flex items-center shadow-inner`}>
                        <span className="text-sm font-bold text-red-400 mr-4 whitespace-nowrap">解答:</span>
                        {isFractionKeypad ? (
                          <span className="text-2xl sm:text-3xl font-mono text-red-200 flex-grow font-bold tracking-wide">
                            <PartialFractionDisplay raw={answer} placeholder="キーパッドで入力..." />
                          </span>
                        ) : (problemType === 'text' || !problemType) ? (
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) => turnPhase === 'solving_problem' && setAnswer(e.target.value)}
                            disabled={turnPhase !== 'solving_problem'}
                            placeholder="ここに入力..."
                            className="flex-grow bg-transparent text-2xl sm:text-3xl font-mono text-red-200 font-bold tracking-wide outline-none placeholder:text-red-800 placeholder:text-lg"
                          />
                        ) : (
                          <span className="text-3xl font-mono text-red-200 flex-grow font-bold tracking-wide" style={{ wordBreak: 'break-all' }}>{answer || <span className="text-red-800 text-lg">入力してください...</span>}</span>
                        )}
                    </div>
                </div>
             )}
            {!problemData?.options && <Keypad onKeyClick={handleKeypadClick} layout={battleKeypadLayout} disabled={turnPhase !== 'solving_problem'} />}
             <button
              type="submit"
              disabled={!isSolving || turnPhase !== 'solving_problem'}
              className="w-full mt-6 bg-blue-600 text-white font-bold py-4 px-10 rounded-xl hover:bg-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xl border border-blue-400/30 shadow-xl"
            >
              解答する
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

// --- HP Bar Component (aicardbattle2 integration) ---
const HpBar: React.FC<{ hp: number; maxHp: number; label: string; isPlayer: boolean }> = ({ hp, maxHp, label, isPlayer }) => {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 50 ? (isPlayer ? 'bg-red-500' : 'bg-gray-400') : pct > 25 ? 'bg-amber-400' : 'bg-red-600';
  return (
    <div className={`p-3 sm:p-4 rounded-2xl border-2 flex flex-col gap-2 w-full max-w-80 shadow-2xl backdrop-blur-md ${isPlayer ? 'bg-red-950/30 border-red-500/40' : 'bg-slate-900/40 border-slate-700'}`}>
      <div className="flex justify-between items-center">
        <span className={`text-xs font-bold ${isPlayer ? 'text-red-400' : 'text-gray-400'}`}>{label}</span>
        <span className="text-xl font-bold font-mono text-white">{hp} <span className="text-sm text-white/40">/ {maxHp} HP</span></span>
      </div>
      <div className="bg-slate-950/80 h-3 rounded-full overflow-hidden p-[1px] border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(239,68,68,0.4)] ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// --- GameBoard Component ---
interface GameBoardProps {
  turnPhase: TurnPhase;
  playerScore: number;
  pcScore: number;
  playerHP: number;
  pcHP: number;
  initialHP: number;
  playerHand: ProblemCard[];
  pcHandSize: number;
  playerDeckSize: number;
  pcDeckSize: number;
  playerPlayedCard: ProblemCard | null;
  pcPlayedCard: ProblemCard | null;
  onCardSelect: (card: ProblemCard) => void;
  onAnswerSubmit: (answer: string) => void;
  selectedCardId: number | null;
  gameLog: string[];
  roundResult: string | null;
  maxScore: number;
  initiative: TurnInitiative;
  // ゲーミフィケーション拡張
  chainCount?: number;
  wrongAnswerText?: string | null;
  /** エビデンスA: 精緻化フィードバック (Hattie & Timperley 2007, ES=0.73) */
  playerWrongAnswer?: string | null;
  wrongCategory?: string | null;
  /** レベル不一致で応戦中 */
  mismatchRound?: boolean;
  /** バトル形式情報 */
  battleFormat?: string;
  playerRoundWins?: number;
  pcRoundWins?: number;
  currentRound?: number;
  /** バトルテーマ */
  battleTheme?: string | null;
}

const ScoreDisplay: React.FC<{ score: number; label: string; maxScore: number; isPlayer: boolean }> = ({ score, label, maxScore, isPlayer }) => (
  <div className={`p-3 sm:p-5 rounded-2xl border-2 flex items-center justify-between gap-4 sm:gap-6 w-full max-w-80 shadow-2xl backdrop-blur-md ${isPlayer ? 'bg-red-950/30 border-red-500/40' : 'bg-slate-900/40 border-slate-700'}`}>
    <div className="flex flex-col">
      <span className={`text-[10px] font-black uppercase tracking-widest ${isPlayer ? 'text-red-400' : 'text-gray-500'}`}>{label}</span>
      <span className="text-3xl font-black font-mono text-white leading-none mt-1">{score} <span className="text-sm opacity-30">/ {maxScore}</span></span>
    </div>
    <div className="flex-grow bg-slate-950/80 h-3 rounded-full overflow-hidden p-[1px] border border-white/5">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(239,68,68,0.5)] ${isPlayer ? 'bg-red-400' : 'bg-slate-600'}`}
          style={{ width: `${(score / maxScore) * 100}%` }}
        ></div>
    </div>
  </div>
);

const GameBoard: React.FC<GameBoardProps> = ({
  turnPhase,
  playerScore,
  pcScore,
  playerHP,
  pcHP,
  initialHP,
  playerHand,
  pcHandSize,
  playerDeckSize,
  pcDeckSize,
  playerPlayedCard,
  pcPlayedCard,
  onCardSelect,
  onAnswerSubmit,
  selectedCardId,
  gameLog,
  roundResult,
  maxScore,
  initiative,
  chainCount = 0,
  wrongAnswerText,
  playerWrongAnswer,
  wrongCategory,
  mismatchRound = false,
  battleFormat,
  playerRoundWins = 0,
  pcRoundWins = 0,
  currentRound = 1,
  battleTheme,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);

  const isPlayerSecond = initiative === 'pc';
  const playerMustMatchLevel = isPlayerSecond && pcPlayedCard !== null && playerPlayedCard === null;
  // 手札に同レベルカードがあるか（UIで禁止表示に使用）
  const hasMatchInHand = playerMustMatchLevel && pcPlayedCard
    ? playerHand.some(c => c.difficulty === pcPlayedCard.difficulty)
    : false;

  const themeConfig = battleTheme ? THEME_CONFIGS[battleTheme] : null;

  return (
    <div
      className={`w-full h-full flex flex-col justify-between items-center p-3 sm:p-4 md:p-6 relative overflow-y-auto ${themeConfig?.bgClass || ''}`}
      style={themeConfig ? { boxShadow: `inset 0 0 120px ${themeConfig.accentColor}18` } : {}}
    >
      {/* Star Field Decorations */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-blue-500/5 blur-[60px] rounded-full"></div>
      <div className="absolute bottom-20 right-20 w-32 h-32 bg-red-500/5 blur-[80px] rounded-full"></div>

      {/* Round Score (for best-of-N formats) */}
      {battleFormat && battleFormat !== 'master_duel' && (
        <div className="w-full flex justify-center mb-1">
          <div className="flex items-center gap-3 bg-purple-950/40 border border-purple-500/30 rounded-xl px-4 py-1.5 backdrop-blur-sm">
            <span className="text-[10px] text-purple-400 font-bold">
              {battleFormat === 'best_of_3' ? '3本勝負' : battleFormat === 'best_of_5' ? '5本勝負' : '7本勝負'}
            </span>
            <span className="text-sm font-bold font-mono text-red-300">{playerRoundWins}</span>
            <span className="text-xs text-purple-400">-</span>
            <span className="text-sm font-bold font-mono text-gray-300">{pcRoundWins}</span>
            <span className="text-[10px] text-slate-500">第{currentRound}回戦</span>
          </div>
        </div>
      )}

      {/* PC Area */}
      <div className="w-full flex justify-center items-center flex-col space-y-6">
        <HpBar hp={pcHP} maxHp={initialHP} label={`相手 HP  |  正解: ${pcScore}`} isPlayer={false} />
        <div className="flex justify-center items-center h-48 space-x-2">
          {[...Array(pcHandSize)].map((_, i) => (
            <div key={i} className="opacity-40 hover:opacity-60 transition-opacity relative group transform -translate-y-4">
              <CardBack />
              {i === 0 && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full">残り: {pcDeckSize}枚</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Battle Field */}
      <div className="w-full flex justify-center items-center min-h-[16rem] sm:min-h-[20rem] md:min-h-[28rem] gap-2 sm:gap-4 md:gap-8 lg:gap-12 relative">
        <div className="w-24 h-40 sm:w-36 sm:h-56 md:w-56 md:h-80 flex items-center justify-center relative flex-shrink-0">
          {playerPlayedCard ? (
            <div className="animate-math-fade-in"><Card card={playerPlayedCard} isSelected={true} /></div>
          ) : (
            <div className="w-full h-full rounded-2xl border-2 border-dashed border-red-500/10 flex items-center justify-center">
                <span className="text-red-700 text-xs font-bold animate-pulse">
                    {initiative === 'player' ? 'カードを選んでください' : '待機中...'}
                </span>
            </div>
          )}
          {playerPlayedCard && <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-red-400 text-[10px] font-bold">あなたのカード</div>}
        </div>

        <div className="flex-grow flex flex-col items-center justify-center max-w-4xl z-20">
          {/* レベル不一致ラウンドの時間ボーナス表示 */}
          {mismatchRound && turnPhase === 'solving_problem' && (
            <div className="mb-3 bg-purple-900/40 border border-purple-500/40 rounded-xl px-5 py-2 flex items-center gap-3 animate-math-fade-in">
              <span className="text-lg">⚡</span>
              <span className="text-purple-300 text-sm font-bold">レベル不一致応戦 — 解答時間+50%ボーナス</span>
            </div>
          )}
          {turnPhase === 'solving_problem' && pcPlayedCard ? (
            <ProblemSolver
              problemCard={pcPlayedCard}
              onAnswerSubmit={onAnswerSubmit}
              isSolving={turnPhase === 'solving_problem'}
              turnPhase={turnPhase}
            />
          ) : (
             <div className="text-center bg-slate-950/40 backdrop-blur-md p-10 rounded-full border border-red-500/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
                {turnPhase === 'selecting_card' ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
                        <p className="text-red-200 text-2xl font-bold">
                            {initiative === 'player' ? (playerPlayedCard ? '相手が考え中...' : 'あなたの先攻！カードを選ぼう') : (pcPlayedCard ? '同じ難易度のカードを選ぼう' : '相手の先攻！')}
                        </p>
                        {playerMustMatchLevel && hasMatchInHand && (
                             <div className="bg-amber-500/20 border border-amber-500/40 px-4 py-1.5 rounded-lg text-sm text-amber-300 font-bold animate-pulse">
                                難易度 {pcPlayedCard!.difficulty} のカードを選んでください
                             </div>
                        )}
                        {playerMustMatchLevel && !hasMatchInHand && (
                             <div className="bg-purple-500/20 border border-purple-500/40 px-4 py-1.5 rounded-lg text-sm text-purple-300 font-bold animate-pulse">
                                ⚡ 同レベルなし — 任意のカードで応戦！（時間ボーナス+50%）
                             </div>
                        )}
                    </div>
                ) : (
                    <div className="text-red-500 text-6xl font-black tracking-widest animate-pulse font-['Cinzel_Decorative']">VS</div>
                )}
            </div>
          )}
          {/* チェインカウンター - Level A: 可変比率報酬スケジュール (Ferster & Skinner, 1957) */}
          {chainCount >= 2 && !roundResult && (
            <div className="mt-6 text-center animate-math-fade-in">
              <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-500/50 rounded-full px-5 py-2 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                <span className="text-amber-400 font-bold text-sm">連続正解</span>
                <span className="text-amber-300 font-bold text-2xl font-mono">×{chainCount}</span>
                <span className="text-xl">{chainCount >= 10 ? '⚡⚡' : chainCount >= 5 ? '⚡' : '🔥'}</span>
              </div>
            </div>
          )}
          {/* エビデンスA: 精緻化フィードバック (Hattie & Timperley 2007, ES=0.73)
              - 正解を表示するだけでなく「あなたの回答」との差分を示す
              - カテゴリを表示して「何の分野か」を意識させる（メタ認知支援）
              - Growth Mindset メッセージ（Dweck 2006） */}
          {wrongAnswerText && (
            <div className="mt-6 text-center animate-math-fade-in">
              <div className="inline-block bg-red-950/60 border border-red-500/40 rounded-xl px-6 py-4 shadow-lg max-w-md">
                {wrongCategory && (
                  <div className="text-red-300/40 text-[10px] font-bold mb-1 tracking-wider">{wrongCategory}</div>
                )}
                {playerWrongAnswer && (
                  <div className="mb-2">
                    <span className="text-red-400/60 text-xs">あなたの回答: </span>
                    <span className="text-red-300 font-mono text-sm line-through">{playerWrongAnswer}</span>
                  </div>
                )}
                <div className="text-green-400 text-sm font-bold mb-1">正解</div>
                <div className="text-white font-bold text-2xl font-mono">{wrongAnswerText}</div>
                <div className="text-red-300/50 text-xs mt-2 italic">間違いは学びのチャンス。この問題は後で復習に出るよ！</div>
              </div>
            </div>
          )}
          {roundResult && <div className={`mt-8 text-5xl font-black text-center animate-math-fade-in tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] ${roundResult.includes('勝利') ? 'text-red-400' : 'text-slate-400'}`}>{roundResult}</div>}
        </div>

        <div className="w-24 h-40 sm:w-36 sm:h-56 md:w-56 md:h-80 flex items-center justify-center relative flex-shrink-0">
          {pcPlayedCard ? (
            <div className="animate-math-fade-in"><Card card={pcPlayedCard} isSelected={true} /></div>
          ) : (
            <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-700/30 flex items-center justify-center">
                <span className="text-slate-700 text-xs font-bold">
                    {initiative === 'pc' ? '選択中...' : '待機中'}
                </span>
            </div>
          )}
          {pcPlayedCard && <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-slate-400 text-[10px] font-bold">相手のカード</div>}
        </div>
      </div>

      {/* Player Area */}
      <div className="w-full flex justify-center items-center flex-col space-y-6">
       <div className="h-56 md:h-80 flex justify-center items-end space-x-[-2rem] md:space-x-[-3rem] pb-4 md:pb-6 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          {turnPhase === 'selecting_card' && (
            <>
              <div className="relative mr-8 group transform translate-y-4">
                <CardBack />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-900 border border-red-500/40 text-red-200 text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg">残り: {playerDeckSize}枚</div>
              </div>
              {playerHand.map(card => {
                // 同レベルカードが手札にある場合のみ、不一致カードを禁止
                const isForbidden = playerMustMatchLevel && hasMatchInHand && card.difficulty !== pcPlayedCard!.difficulty;
                return (
                  <Card
                    key={card.id}
                    card={card}
                    onClick={() => onCardSelect(card)}
                    isPlayable={turnPhase === 'selecting_card'}
                    inHand={true}
                    isSelected={selectedCardId === card.id}
                    isDisabled={isForbidden}
                  />
                );
              })}
            </>
          )}
        </div>
        <HpBar hp={playerHP} maxHp={initialHP} label={`あなた HP  |  正解: ${playerScore}`} isPlayer={true} />
      </div>

      <DrawingCanvas isVisible={isDrawing} />
      
      <button 
        onClick={() => setIsDrawing(prev => !prev)}
        className={`fixed top-8 right-8 p-5 rounded-full shadow-2xl transition-all transform hover:scale-110 z-30 backdrop-blur-md ${isDrawing ? 'bg-red-500 text-slate-950 border-white border-4' : 'bg-slate-900/80 text-red-400 border border-red-500/40'}`}
        aria-label="Toggle Drawing Memo"
      >
        <PencilIcon className="w-8 h-8" />
      </button>

      <div className="fixed bottom-8 right-8">
        <GameLog messages={gameLog} />
      </div>
    </div>
  );
};

export default GameBoard;
