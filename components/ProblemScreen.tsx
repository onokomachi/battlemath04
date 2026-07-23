
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Problem, SessionStats, ProblemViewRef } from '../types';
import { getShuffledProblemSet } from '../services/problemService';
import { difficultyMap, MATH_CATEGORIES } from '../constants';
import DrawingCanvas from './DrawingCanvas';
import Keypad from './Keypad';
import ProblemControls from './ProblemControls';
import ProblemResultDisplay from './ProblemResultDisplay';
import { BackIcon, PencilIcon, HomeIcon, TrophyIcon, ClockIcon } from './Icons';
import { generateSubtopicKeypadLayout } from '../utils/keypadLayoutGenerator';
import { checkAnswer as evaluateAnswer } from '../utils/answerChecker';
import FractionText, { PartialFractionDisplay } from './FractionText';
import { recordAttempt } from '../services/weaknessAnalysisService';
import { addIncorrectToSrs } from '../services/spacedRepetitionService';
import { recordProblemLog } from '../services/learningLogService';
import { evaluatePracticeReward, type PracticeRewardDecision } from '../services/practiceRewardService';

// Sub-views
import AngleDiagramView from './AngleDiagramView';
import BentTransversalDiagramView from './BentTransversalDiagramView';
import FillInProofProblemView from './FillInProofProblemView';
import GraphingProblemView from './GraphingProblemView';
import GraphingWithTableProblemView from './GraphingWithTableProblemView';
import GraphToEquationProblemView from './GraphToEquationProblemView';
import GraphWithDomainProblemView from './GraphWithDomainProblemView';
import GuidedEquationProblemView from './GuidedEquationProblemView';
import IntersectionGuidedEquationView from './IntersectionGuidedEquationView';
import MultiTransversalAngleDiagramView from './MultiTransversalAngleDiagramView';
import VerticalCalculationProblemView from './VerticalCalculationProblemView';
import ProofProblemView from './ProofProblemView';
import SimultaneousEquationProblemView from './SimultaneousEquationProblemView';
import TriangleInParallelLinesView from './TriangleInParallelLinesView';
import GraphProblemView from './GraphProblemView';
import BoxPlotView from './BoxPlotView';
import HistogramView from './HistogramView';
import GuidedAnswerHost from './guided/GuidedAnswerHost';

interface ProblemScreenProps {
  category: string;
  subTopic: string;
  onBack: (stats: SessionStats) => void;
  onHome: () => void;
  /** 復習モード: 出題する問題を直接指定（指定時は getShuffledProblemSet を使わない） */
  problemsOverride?: Problem[];
  /** 各問題の採点結果を親に通知（復習モードのSRS間隔更新に使用） */
  onProblemResult?: (problem: Problem, correct: boolean) => void;
}

const HintModal: React.FC<{ hint: string | string[]; onClose: () => void }> = ({ hint, onClose }) => (
  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
    <div className="hud-panel rounded-2xl p-8 max-w-xl w-full shadow-2xl border-red-400/40 animate-math-fade-in relative">
      <div className="corner-accent lt border-red-400"></div>
      <div className="corner-accent rb border-red-400"></div>
      <h3 className="text-red-400 text-2xl font-bold mb-4 flex items-center gap-3">
        💡 ヒント
      </h3>
      <div className="text-white/90 text-lg space-y-3 leading-relaxed border-l-2 border-red-500/30 pl-4">
        {Array.isArray(hint) ? hint.map((h, i) => <p key={i}><FractionText text={h} /></p>) : <p><FractionText text={hint} /></p>}
      </div>
      <button
        onClick={onClose}
        className="mt-8 w-full btn-tactical py-3 rounded-lg font-bold text-red-400 border-red-400/40 hover:bg-red-400/20 text-lg"
      >
        閉じる
      </button>
    </div>
  </div>
);

/**
 * スコアに基づくMP報酬計算
 * エビデンス: 可変比率報酬スケジュール (Ferster & Skinner, 1957)
 * - Sランク: スコア×3 MP
 * - Aランク: スコア×2 MP
 * - Bランク: スコア×1.5 MP
 * - C/Dランク: スコア×1 MP
 */
const calcMpReward = (score: number, rank: string): number => {
  const multiplier = rank === 'S' ? 3 : rank === 'A' ? 2 : rank === 'B' ? 1.5 : 1;
  return Math.floor(score * multiplier);
};

const PracticeSummary: React.FC<{ stats: SessionStats, subTopic: string, elapsedTime: number, onBack: (mpReward: number) => void }> = ({ stats, subTopic, elapsedTime, onBack }) => {
    const accuracy = stats.problemCount > 0 ? (stats.correct / stats.problemCount) * 100 : 0;

    // ランク計算: 正答率 + 速度ボーナス
    let rank = 'D';
    if (accuracy === 100) rank = 'A';
    else if (accuracy >= 75) rank = 'B';
    else if (accuracy >= 50) rank = 'C';

    if (rank === 'A') {
        const totalPoints = stats.totalScore;
        const maxPossiblePoints = stats.problemCount * 25;
        if (totalPoints > maxPossiblePoints * 0.8) rank = 'S';
    }

    const mpReward = calcMpReward(stats.totalScore, rank);

    // 荒稼ぎ防止: Bランク以上 かつ (本日はじめてのクリア or 自己ベスト更新) の時だけMPを付与する
    const rewardRef = useRef<PracticeRewardDecision | undefined>(undefined);
    if (rewardRef.current === undefined) {
      rewardRef.current = evaluatePracticeReward(subTopic, rank, mpReward);
    }
    const rewardDecision = rewardRef.current;

    const elapsedMin = Math.floor(elapsedTime / 60);
    const elapsedSec = elapsedTime % 60;

    return (
        <div className="flex flex-col items-center animate-level-up-reveal w-full max-w-xl mx-auto">
             <div className="text-center mb-4 sm:mb-6">
                <p className="text-red-400 font-bold tracking-[0.3em] text-xs sm:text-sm mb-1">セッション完了</p>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-wide">結果発表</h2>
             </div>

             <div className="hud-panel w-full rounded-2xl p-5 sm:p-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-red-500/5 blur-[80px] rounded-full"></div>

                <div className="text-5xl sm:text-6xl font-black mb-2 sm:mb-3 drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <span className={rank === 'S' ? 'text-amber-400' : rank === 'A' ? 'text-red-400' : rank === 'B' ? 'text-blue-400' : 'text-slate-400'}>{rank}</span>
                    <span className="text-xs sm:text-sm text-white/50 block text-center font-bold mt-1">ランク</span>
                </div>

                <p className="text-red-300/70 text-xs sm:text-sm mb-4 sm:mb-6 text-center">
                  {rank === 'S' ? '素晴らしい！完璧な理解力です！' :
                   rank === 'A' ? 'よくできました！この調子で頑張ろう！' :
                   rank === 'B' ? 'いい感じ！もう少し練習すればAランクも近い！' :
                   rank === 'C' ? '基礎は掴めています。繰り返し練習で伸びます！' :
                   '間違いは学びのチャンス。もう一度挑戦してみよう！'}
                </p>

                <div className="grid grid-cols-3 gap-4 w-full mb-4 sm:mb-6 border-t border-red-500/10 pt-4 sm:pt-6">
                    <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-red-400 font-bold mb-1">正解数</p>
                        <p className="text-lg sm:text-xl text-white font-bold font-mono">{stats.correct} <span className="text-xs text-red-600">/ {stats.problemCount}</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-red-400 font-bold mb-1">所要時間</p>
                        <p className="text-lg sm:text-xl text-white font-bold font-mono">{elapsedMin}:{elapsedSec.toString().padStart(2, '0')}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-red-400 font-bold mb-1">スコア</p>
                        <p className="text-lg sm:text-xl text-red-300 font-bold font-mono">{stats.totalScore}</p>
                    </div>
                </div>

                <div className={`w-full border rounded-xl p-3 mb-4 sm:mb-6 text-center ${rewardDecision.award > 0 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/30 border-slate-500/20'}`}>
                  {rewardDecision.award > 0 ? (
                    <>
                      <p className="text-[10px] sm:text-xs text-amber-400 font-bold mb-0.5">獲得ポイント（{rank}ランクボーナス ×{rank === 'S' ? 3 : rank === 'A' ? 2 : rank === 'B' ? 1.5 : 1}）</p>
                      <p className="text-2xl sm:text-3xl text-amber-400 font-bold font-mono">+{rewardDecision.award} <span className="text-sm text-amber-600">MP</span></p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold mb-1">獲得ポイント +0 MP</p>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {rewardDecision.reason === 'rank-too-low'
                          ? 'Bランク以上でMPがもらえます。もう一度挑戦してみよう！'
                          : `本日はこの項目ですでにMPを受け取っています。自己ベスト（${rewardDecision.bestMp}MP）を更新すると、また もらえます！`}
                      </p>
                    </>
                  )}
                </div>

                <button onClick={() => onBack(rewardDecision.award)} className="btn-tactical w-full py-3 rounded-xl font-bold text-base sm:text-lg tracking-wide text-red-400 border-red-400/40">
                    戻る
                </button>
             </div>
        </div>
    );
};

const ProblemScreen: React.FC<ProblemScreenProps> = ({ category, subTopic, onBack, onHome, problemsOverride, onProblemResult }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState<'correct' | 'incorrect' | 'proof' | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ correct: 0, incorrect: 0, totalScore: 0, problemCount: 0 });
  const [isMemoVisible, setIsMemoVisible] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [vfxClass, setVfxClass] = useState('');
  // セッション経過時間タイマー（結果確認中は一時停止）
  const [sessionStartTime] = useState<number>(Date.now());
  const [elapsedDisplay, setElapsedDisplay] = useState('0:00');
  const pausedTimeRef = useRef<number>(0);     // 一時停止した累計時間
  const pauseStartRef = useRef<number | null>(null); // 一時停止開始時刻

  const problemViewRef = useRef<ProblemViewRef>(null);
  const questionBoxRef = useRef<HTMLDivElement>(null);

  // 結果表示時にタイマーを一時停止
  useEffect(() => {
    if (showAnswer) {
      // 一時停止開始
      pauseStartRef.current = Date.now();
    } else {
      // 一時停止解除（累計に加算）
      if (pauseStartRef.current !== null) {
        pausedTimeRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
    }
  }, [showAnswer]);

  // セッション経過時間の表示更新（一時停止中はカウントしない）
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const totalPaused = pausedTimeRef.current + (pauseStartRef.current !== null ? now - pauseStartRef.current : 0);
      const elapsed = Math.floor((now - sessionStartTime - totalPaused) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      setElapsedDisplay(`${min}:${sec.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime, isFinished]);

  // 現在の階層パスを取得
  const getHierarchyLabel = useCallback(() => {
    const cat = MATH_CATEGORIES.find(c => c.name === category);
    if (!cat) return category;
    const group = cat.groups.find(g => g.subtopics.includes(subTopic));
    return group ? `${category} / ${group.name}` : category;
  }, [category, subTopic]);

  useEffect(() => {
    const loadedProblems = problemsOverride ?? getShuffledProblemSet(category, subTopic);
    setProblems(loadedProblems);
    setIsLoading(false);
    setStartTime(Date.now());
    // 注意: problemsOverride は親側で useMemo 等により参照を安定させること
  }, [category, subTopic, problemsOverride]);

  // 問題が変わるたびに、図の表示欄のスクロール位置を先頭に戻す
  // (前の問題で下までスクロールしたまま次の問題に進むと、問題文が隠れて見えなくなるため)
  useEffect(() => {
    questionBoxRef.current?.scrollTo(0, 0);
  }, [currentIndex]);

  const currentProblem = problems[currentIndex] || null;
  const isProof = currentProblem?.type === 'proof';
  const problemData = currentProblem?.data as any;
  const problemHint = (currentProblem?.data as any)?.hint;

  // マスターモード: ヒントを出さず、最後にまとめて答え合わせする自己選択モード
  // (wari-hissann3のProblemSelectorのトグルを移植。同じ問題データをそのまま使う)
  const [masterModeOn, setMasterModeOn] = useState(false);
  const supportsMasterMode = ['division-hissan', 'decimal-addsub', 'decimal-muldiv', 'multiplication-hissan'].includes(
    (problemData as { guidedKind?: string } | undefined)?.guidedKind || ''
  );
  const guidedDisplayProblem = useMemo(() => {
    if (!currentProblem || currentProblem.type !== 'guided' || !supportsMasterMode) return currentProblem;
    return { ...currentProblem, data: { ...currentProblem.data, masterMode: masterModeOn } };
  }, [currentProblem, supportsMasterMode, masterModeOn]);

  const handleNextProblem = useCallback(() => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setShowAnswer(false);
      setResult(null);
      setTimeTaken(null);
      setScore(null);
      setStartTime(Date.now());
      setVfxClass('');
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, problems.length]);

  const checkAnswer = useCallback(() => {
    if (!currentProblem || result !== null) return;

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    setTimeTaken(duration);

    // 学習記録に使う単元名（復習モードでは問題側に元の単元が付与されている）
    const recordCategory = (currentProblem as any).category || subTopic;

    if (isProof) {
      setResult('proof');
      setShowAnswer(true);
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1, totalScore: prev.totalScore + 10, problemCount: prev.problemCount + 1 }));
      onProblemResult?.(currentProblem, true);
      return;
    }

    // バトルモードと同一の統一採点ロジック（全角入力・複数入力欄・順不同選択に対応）
    const isCorrect = evaluateAnswer(userAnswer, currentProblem.answer, { multiple: !!problemData?.multiple, requireForm: problemData?.requireForm });

    // 学習記録: 弱点分析・間隔反復(SRS)をバトルモードと同様に蓄積
    // （従来、練習モードの解答はどちらにも記録されていなかった）
    recordAttempt(recordCategory, isCorrect);
    if (!isCorrect) {
      addIncorrectToSrs(
        recordCategory,
        String((currentProblem.data as any)?.question || '').slice(0, 50),
        currentProblem.answer,
        currentProblem.type
      );
    }
    // がくしゅうのきろく: 1問ログ(きょうやった問題の即時確認用)
    recordProblemLog({
      mode: problemsOverride ? 'review' : 'practice',
      subTopic: recordCategory,
      question: String((currentProblem.data as any)?.question || ''),
      userAnswer,
      correct: isCorrect,
      timeSec: Math.round(duration * 10) / 10,
    });
    onProblemResult?.(currentProblem, isCorrect);

    if (isCorrect) {
      setResult('correct');
      setVfxClass('vfx-success ring-2 ring-red-500');
      const points = Math.max(5, Math.floor(25 - duration));
      setScore(points);
      setSessionStats(prev => ({
        ...prev,
        correct: prev.correct + 1,
        totalScore: prev.totalScore + points,
        problemCount: prev.problemCount + 1
      }));
    } else {
      setResult('incorrect');
      setVfxClass('vfx-shake ring-2 ring-red-500');
      setSessionStats(prev => ({
        ...prev,
        incorrect: prev.incorrect + 1,
        problemCount: prev.problemCount + 1
      }));
    }
    setShowAnswer(true);
  }, [currentProblem, result, startTime, userAnswer, isProof, subTopic, onProblemResult, problemsOverride]);

  // 'guided' タイプ(筆算シミュレーター等)は正誤判定を自前で行うため、
  // checkAnswer の evaluateAnswer 部分だけをスキップして同じ記録経路に合流させる
  const handleGuidedComplete = useCallback((isCorrect: boolean) => {
    if (!currentProblem || result !== null) return;
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    setTimeTaken(duration);
    const recordCategory = (currentProblem as any).category || subTopic;

    recordAttempt(recordCategory, isCorrect);
    if (!isCorrect) {
      addIncorrectToSrs(recordCategory, String((currentProblem.data as any)?.question || '筆算').slice(0, 50), currentProblem.answer, currentProblem.type);
    }
    recordProblemLog({
      mode: problemsOverride ? 'review' : 'practice',
      subTopic: recordCategory,
      question: String((currentProblem.data as any)?.question || '筆算'),
      userAnswer: isCorrect ? currentProblem.answer : '(guided)',
      correct: isCorrect,
      timeSec: Math.round(duration * 10) / 10,
    });
    onProblemResult?.(currentProblem, isCorrect);

    if (isCorrect) {
      setResult('correct');
      setVfxClass('vfx-success ring-2 ring-red-500');
      const points = Math.max(5, Math.floor(25 - duration));
      setScore(points);
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1, totalScore: prev.totalScore + points, problemCount: prev.problemCount + 1 }));
    } else {
      setResult('incorrect');
      setVfxClass('vfx-shake ring-2 ring-red-500');
      setSessionStats(prev => ({ ...prev, incorrect: prev.incorrect + 1, problemCount: prev.problemCount + 1 }));
    }
    setShowAnswer(true);
  }, [currentProblem, result, startTime, subTopic, onProblemResult, problemsOverride]);

  const handleKeypadClick = useCallback((key: string) => {
    if (showAnswer) return;
    
    const interactiveTypes = ['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'intersection_guided_equation', 'simultaneous_equation'];
    if (interactiveTypes.includes(currentProblem?.type || '')) {
       problemViewRef.current?.handleKeyClick(key);
       return;
    }

    if (key === 'BACKSPACE') {
      setUserAnswer(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setUserAnswer('');
    } else {
      setUserAnswer(prev => prev + key);
    }
  }, [showAnswer, currentProblem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAnswer) {
         if (e.key === 'Enter') handleNextProblem();
         return;
      }
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
        if (userAnswer) checkAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadClick, showAnswer, handleNextProblem, checkAnswer, userAnswer]);

  // subtopic内の全問題から共通キーセットを生成（メモ化でセッション中は固定）
  const subtopicKeypadLayout = useMemo(() => {
    if (problems.length === 0) return [['0']];
    const dominantType = problems[0]?.type || 'text';
    return generateSubtopicKeypadLayout(problems, dominantType);
  }, [problems]);

  // 分数キーパッド使用時は、入力を積み上げ表記でライブ表示する
  const isFractionKeypad = useMemo(
    () => subtopicKeypadLayout.some(row => row.includes('と')),
    [subtopicKeypadLayout],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-400 font-mono">
        <div className="w-16 h-16 border-2 border-red-900 border-t-red-400 rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse tracking-[0.2em]">INITIALIZING_HUD...</p>
      </div>
    );
  }

  const sessionElapsedSec = Math.floor((Date.now() - sessionStartTime - pausedTimeRef.current) / 1000);

  if (isFinished) {
      return (
        <div className="h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xl overflow-y-auto">
            <PracticeSummary
              stats={sessionStats}
              subTopic={subTopic}
              elapsedTime={sessionElapsedSec}
              onBack={(mpReward: number) => {
                // MP報酬をセッションスコアに上書きして返す
                onBack({ ...sessionStats, totalScore: mpReward });
              }}
            />
        </div>
      );
  }

  return (
    <div className="h-[100dvh] w-full p-2 sm:p-3 flex items-start justify-center relative overflow-hidden font-['Inter'] text-white">
      {isHintVisible && problemHint && <HintModal hint={problemHint} onClose={() => setIsHintVisible(false)} />}
      <DrawingCanvas isVisible={isMemoVisible} />

      <div className="relative w-full max-w-6xl h-full">
        <div className={`w-full h-full hud-panel rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 z-10 relative transition-all duration-300 flex flex-col overflow-hidden ${vfxClass}`}>
           <div className="corner-accent lt border-red-500/40"></div>
           <div className="corner-accent rt border-red-500/40"></div>
           <div className="corner-accent lb border-red-500/40"></div>
           <div className="corner-accent rb border-red-500/40"></div>

           <header className='flex justify-between items-center mb-2 border-b border-red-500/10 pb-2 flex-shrink-0'>
              <div className='flex items-center gap-2 sm:gap-3 min-w-0'>
                <button onClick={() => onBack(sessionStats)} className='text-red-400 hover:text-white transition-all p-1.5 sm:p-2 bg-blue-900/20 rounded-lg border border-red-500/20 flex-shrink-0' title="前の画面へ">
                  <BackIcon className='w-4 h-4 sm:w-5 sm:h-5' />
                </button>
                <button onClick={onHome} className='text-red-400 hover:text-white transition-all p-1.5 sm:p-2 bg-blue-900/20 rounded-lg border border-red-500/20 flex-shrink-0' title="メインメニューへ">
                  <HomeIcon className='w-4 h-4 sm:w-5 sm:h-5' />
                </button>
                <div className="min-w-0">
                  <h2 className='text-[9px] sm:text-[10px] text-red-300 tracking-[0.2em] font-bold truncate'>{getHierarchyLabel()}</h2>
                  <h1 className='text-sm sm:text-base lg:text-lg font-bold tracking-wide text-white truncate'>{subTopic}</h1>
                </div>
              </div>
              <div className='flex items-center gap-3 sm:gap-5 flex-shrink-0'>
                <div className='text-center'>
                  <p className='text-[9px] sm:text-[10px] text-amber-400 font-bold'>経過時間</p>
                  <p className='text-sm sm:text-base font-bold font-mono text-amber-300'>{elapsedDisplay}</p>
                </div>
                <div className='text-right'>
                  <p className='text-[9px] sm:text-[10px] text-red-400 font-bold tracking-wide'>進捗</p>
                  <p className='text-base sm:text-lg font-bold font-mono text-red-300'>{currentIndex + 1} <span className="text-xs text-red-600">/ {problems.length}</span></p>
                  <div className="w-16 sm:w-20 bg-slate-900 h-1 rounded-full overflow-hidden mt-0.5">
                    <div className="bg-red-400 h-full rounded-full transition-all duration-500" style={{ width: `${((currentIndex + 1) / problems.length) * 100}%` }} />
                  </div>
                </div>
              </div>
           </header>

           {supportsMasterMode && (
             <div className='flex justify-end mb-2 flex-shrink-0'>
               <button
                 onClick={() => setMasterModeOn(v => !v)}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${masterModeOn ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-900/40 border-slate-600/40 text-slate-400 hover:text-slate-200'}`}
                 title="ONにするとヒントなし・最後にまとめて答え合わせするモードになります"
               >
                 <span className='text-sm sm:text-base'>👑</span>
                 <span className='text-[10px] sm:text-xs font-bold tracking-wide'>マスターモード</span>
                 <span className={`relative inline-block w-8 h-4 rounded-full transition-colors ${masterModeOn ? 'bg-amber-500' : 'bg-slate-700'}`}>
                   <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${masterModeOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                 </span>
               </button>
             </div>
           )}

           <main className='grid lg:grid-cols-[1fr_220px] gap-3 lg:gap-4 flex-1 min-h-0 overflow-y-auto'>
              <div className='space-y-2 sm:space-y-3'>
                <div ref={questionBoxRef} className={`w-full flex items-center justify-center bg-slate-950/40 rounded-xl p-3 sm:p-4 border border-red-500/5 shadow-inner relative overflow-y-auto ${currentProblem?.type === 'guided' ? 'max-h-none' : 'max-h-[40vh] lg:max-h-[50vh]'}`}>
                    <div className="w-full">
                    {currentProblem?.type === 'angle_diagram' && <AngleDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'bent_transversal_diagram' && <BentTransversalDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'fill_in_proof' && <FillInProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'graphing' && <GraphingProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} />}
                    {currentProblem?.type === 'graphing_with_table' && <GraphingWithTableProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} />}
                    {currentProblem?.type === 'graph_to_equation' && <GraphToEquationProblemView data={problemData} />}
                    {currentProblem?.type === 'graph_with_domain' && <GraphWithDomainProblemView data={problemData} isVisualHintVisible={showAnswer} />}
                    {currentProblem?.type === 'guided_equation' && <GuidedEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'intersection_guided_equation' && <IntersectionGuidedEquationView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'multi_transversal_angle' && <MultiTransversalAngleDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'vertical_calculation' && <VerticalCalculationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {/* 完了後もアンマウントしない: エビデンスA(ワークトイグザンプル効果, Sweller & Cooper 1985; Renkl 2014)
                        誤答時にguidedエンジン自身のまちがい箇所ハイライト・かいせつ表示をそのまま見せることで、
                        単なる正解の文字列提示より定着しやすい振り返りになる。
                        key必須: 問題(またはマスターモードの切り替え)が変わったらエンジンを作り直す
                        (前問の「完了」状態の持ち越し防止) */}
                    {currentProblem?.type === 'guided' && guidedDisplayProblem && (
                      <GuidedAnswerHost key={`${currentIndex}-${masterModeOn}`} problem={guidedDisplayProblem} onComplete={handleGuidedComplete} />
                    )}
                    {currentProblem?.type === 'proof' && <ProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'simultaneous_equation' && <SimultaneousEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'triangle_in_parallel_lines' && <TriangleInParallelLinesView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'box_plot' && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight">{problemData?.question}</p>
                        <BoxPlotView datasets={problemData?.datasets || []} hideValue={problemData?.hideValue} />
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = userAnswer === opt;
                              return (
                                <button key={i} onClick={() => { if (!showAnswer) setUserAnswer(opt); }} disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {currentProblem?.type === 'histogram' && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight">{problemData?.question}</p>
                        <HistogramView bars={problemData?.bars || []} xLabel={problemData?.xLabel} yLabel={problemData?.yLabel} />
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = userAnswer === opt;
                              return (
                                <button key={i} onClick={() => { if (!showAnswer) setUserAnswer(opt); }} disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {currentProblem?.type === 'graph_with_area' &&
                        <div className="text-center w-full">
                          <p className="text-sm sm:text-base lg:text-lg mb-2 font-mono">{problemData?.question || "面積を求めよ"}</p>
                          <div className="w-full max-w-[200px] sm:max-w-[240px] mx-auto aspect-square">
                            <GraphProblemView lines={problemData?.graphLines || []} polygon={problemData?.polygon} />
                          </div>
                        </div>
                    }
                    {(currentProblem?.type === 'text' || !currentProblem?.type) && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight"><FractionText text={problemData?.question || problemData?.questionText || "問題文の解析に失敗しました"} /></p>
                        {problemData?.svg ? (
                          <div className="svg-container w-full max-w-xs mx-auto my-2 p-1.5 bg-slate-950 rounded-lg border border-red-500/10 overflow-visible" dangerouslySetInnerHTML={{ __html: problemData.svg }} />
                        ) : problemData?.imageUrl ? (
                          <img src={problemData.imageUrl} alt="DOC" className="max-w-full max-h-40 sm:max-h-52 mx-auto rounded-lg shadow-xl border border-red-500/10 p-1 bg-slate-900 mb-2" />
                        ) : null}
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = problemData.multiple
                                ? userAnswer.split(',').map((s: string) => s.trim()).includes(opt)
                                : userAnswer === opt;
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (showAnswer) return;
                                    if (problemData.multiple) {
                                      const current = userAnswer ? userAnswer.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                      if (current.includes(opt)) {
                                        setUserAnswer(current.filter((s: string) => s !== opt).join(','));
                                      } else {
                                        setUserAnswer([...current, opt].join(','));
                                      }
                                    } else {
                                      setUserAnswer(opt);
                                    }
                                  }}
                                  disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected
                                      ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                      : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
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
                </div>

                {!['proof', 'guided'].includes(currentProblem?.type || '') && !problemData?.options && (
                  <div className='flex flex-col items-center gap-2'>
                    {!['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'intersection_guided_equation', 'simultaneous_equation'].includes(currentProblem?.type || '') && (
                        <div className='w-full max-w-lg'>
                           <div className={`min-h-[3rem] sm:min-h-[3.5rem] p-2 sm:p-3 bg-slate-950/60 rounded-xl border-2 border-red-500/30 flex items-center shadow-inner`}>
                              <span className='text-xs sm:text-sm font-bold text-red-400 mr-2 sm:mr-3 whitespace-nowrap'>解答:</span>
                              {isFractionKeypad ? (
                                <span className='text-lg sm:text-xl lg:text-2xl font-mono text-red-200 flex-grow font-bold tracking-wide'>
                                  <PartialFractionDisplay raw={userAnswer} placeholder="キーパッドで入力..." />
                                </span>
                              ) : (currentProblem?.type === 'text' || !currentProblem?.type) ? (
                                <input
                                  type="text"
                                  value={userAnswer}
                                  onChange={(e) => !showAnswer && setUserAnswer(e.target.value)}
                                  disabled={showAnswer}
                                  placeholder="ここに入力..."
                                  className="flex-grow bg-transparent text-lg sm:text-xl lg:text-2xl font-mono text-red-200 font-bold tracking-wide outline-none placeholder:text-red-800 placeholder:text-sm"
                                />
                              ) : (
                                <span className='text-lg sm:text-xl lg:text-2xl font-mono text-red-200 flex-grow font-bold tracking-wide' style={{ wordBreak: 'break-all' }}>{userAnswer || <span className="text-red-800 text-sm">キーパッドで入力...</span>}</span>
                              )}
                           </div>
                        </div>
                    )}
                    <div className="w-full max-w-lg">
                      <Keypad onKeyClick={handleKeypadClick} layout={subtopicKeypadLayout} disabled={showAnswer} />
                    </div>
                  </div>
                )}

                <ProblemResultDisplay
                  showAnswer={showAnswer}
                  problemData={currentProblem}
                  result={result}
                  userAnswer={userAnswer}
                  timeTaken={timeTaken}
                  score={score}
                  hint={problemHint}
                  hideAnswerGrid={currentProblem?.type === 'guided'}
                  getResultRingColor={() => showAnswer ? (result === 'correct' ? 'border-emerald-400' : 'border-red-500') : 'border-transparent'}
                />
              </div>

              <div className="flex flex-col gap-2 sm:gap-3">
                <ProblemControls
                  isProof={isProof}
                  isLoading={isLoading}
                  userAnswer={userAnswer}
                  result={result}
                  isSessionComplete={currentIndex >= problems.length}
                  hasHint={!!problemHint}
                  onCheckAnswer={checkAnswer}
                  onLoadNextProblem={handleNextProblem}
                  onShowHint={() => setIsHintVisible(true)}
                />

                {/* Session stats */}
                <div className="hud-panel p-2.5 sm:p-3 rounded-xl text-sm space-y-2 mt-auto border-red-500/10">
                   <div className="flex justify-between items-center"><span className="text-red-500 font-bold text-xs">正解数</span><span className="text-white font-bold text-sm">{sessionStats.correct} / {sessionStats.problemCount}</span></div>
                   <div className="flex justify-between items-center"><span className="text-red-500 font-bold text-xs">獲得MP</span><span className="text-amber-400 font-bold text-sm">{sessionStats.totalScore}</span></div>
                   {sessionStats.problemCount > 0 && (
                     <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                       <div className={`h-full rounded-full transition-all duration-500 ${(sessionStats.correct / sessionStats.problemCount) >= 0.7 ? 'bg-red-400' : 'bg-amber-500'}`} style={{ width: `${(sessionStats.correct / sessionStats.problemCount) * 100}%` }}></div>
                     </div>
                   )}
                </div>
              </div>
           </main>
        </div>

        <button
          onClick={() => setIsMemoVisible(prev => !prev)}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 p-3 sm:p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 z-50 ${isMemoVisible ? 'bg-red-500 text-slate-950 ring-2 ring-white' : 'bg-slate-900/80 text-red-400 border border-red-500/40'}`}
        >
          <PencilIcon className='w-6 h-6 sm:w-7 sm:h-7' />
        </button>
      </div>
    </div>
  );
};

export default ProblemScreen;
