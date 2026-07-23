/**
 * TutorialBattle.tsx — チュートリアルバトル
 *
 * エビデンスA: Scaffolding (Wood, Bruner & Ross 1976)
 *   段階的な足場かけにより学習者が自力で到達できない課題をクリア可能にする
 *
 * エビデンスB: Cognitive Load Theory (Sweller 1988)
 *   情報を段階的に提示し認知負荷を最小化
 */
import React, { useState } from 'react';
import FractionText from './FractionText';

interface TutorialBattleProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  highlight: string;
  question?: string;
  answer?: string;
  hint?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: '算数バトルへようこそ！',
    description: 'このゲームでは算数の問題を解いてバトルします。\n正解すると相手にダメージ、不正解だと自分がダメージを受けます。',
    highlight: 'concept',
  },
  {
    title: 'カードを選ぼう',
    description: '手札からカードを選びます。\nカードにはレベル（難易度）があり、高レベルほど大ダメージ！\nまずは低レベルから挑戦しましょう。',
    highlight: 'card',
  },
  {
    title: '問題を解こう',
    description: '選んだカードの問題が出題されます。\n制限時間内に正解を入力しましょう！',
    highlight: 'problem',
    question: '1 は {1/4} の 何こ分?',
    answer: '4',
    hint: '1を 4つに 分けた {1/4} を あつめて 1に するには…',
  },
  {
    title: '正解！ダメージを与えた！',
    description: '正解すると相手のHPが減ります。\n相手のHPを0にすれば勝利です！\n\n連続正解で「チェインボーナス」も発生します。',
    highlight: 'damage',
  },
  {
    title: 'もう一問やってみよう',
    description: '今度は少し難しい問題です。\n不正解でも大丈夫 — 間違えた問題は自動で復習キューに入ります。',
    highlight: 'problem',
    question: '{2/5} + {2/5} は {1/5} の 何こ分?',
    answer: '4',
    hint: '{1/5} が 2こと 2こ。あわせると…',
  },
  {
    title: 'チュートリアル完了！',
    description: '基本操作はマスターしました！\n\n練習モード: 分野別に問題を解いて実力アップ\nバトル: デッキを組んでCPUやプレイヤーと対戦\nショップ: MPでカードパックを購入\n\nさあ、バトルに出発しましょう！',
    highlight: 'complete',
  },
];

const TutorialBattle: React.FC<TutorialBattleProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const hasQuestion = !!current.question;

  const handleAnswer = () => {
    if (!current.answer) return;
    const correct = userAnswer.trim() === current.answer;
    setIsCorrect(correct);
    setAnswered(true);
  };

  const handleNext = () => {
    setUserAnswer('');
    setShowHint(false);
    setAnswered(false);
    setIsCorrect(false);
    if (isLastStep) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  // チュートリアル用HP表示
  const tutorialPlayerHP = step >= 3 ? 40 : 40;
  const tutorialEnemyHP = step >= 3 ? (step >= 5 ? 20 : 34) : 40;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white relative">
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-4 right-4 text-gray-500 hover:text-white text-xs border border-gray-700 px-3 py-1 rounded transition-colors z-20"
      >
        スキップ
      </button>

      {/* Progress bar */}
      <div className="absolute top-4 left-4 right-20 z-20">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-red-400' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-1">ステップ {step + 1} / {STEPS.length}</p>
      </div>

      {/* Tutorial HP bars (visual only) */}
      {step >= 2 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-8 items-center z-10">
          <div className="text-center">
            <span className="text-[10px] text-red-400 font-bold">あなた</span>
            <div className="w-24 bg-slate-800 rounded-full h-2 mt-1">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-700"
                style={{ width: `${(tutorialPlayerHP / 40) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-mono">{tutorialPlayerHP}/40</span>
          </div>
          <span className="text-gray-600 text-xs">VS</span>
          <div className="text-center">
            <span className="text-[10px] text-red-400 font-bold">CPU</span>
            <div className="w-24 bg-slate-800 rounded-full h-2 mt-1">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-700"
                style={{ width: `${(tutorialEnemyHP / 40) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-mono">{tutorialEnemyHP}/40</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-lg w-full bg-slate-950/90 border border-red-500/30 rounded-2xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.1)] animate-math-fade-in">
        <h2 className="text-xl font-black text-red-300 mb-3 tracking-wider">
          {current.title}
        </h2>
        <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed mb-4">
          {current.description}
        </p>

        {/* Question area */}
        {hasQuestion && !answered && (
          <div className="bg-slate-900/80 rounded-xl p-4 border border-red-900/40 mb-4">
            <p className="text-center text-lg font-bold text-white mb-3"><FractionText text={current.question || ''} /></p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                placeholder="答えを入力..."
                className="flex-1 bg-slate-800 border border-red-700/40 rounded-lg px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-red-400"
                autoFocus
              />
              <button
                onClick={handleAnswer}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
              >
                回答
              </button>
            </div>
            {!showHint && current.hint && (
              <button
                onClick={() => setShowHint(true)}
                className="text-[10px] text-amber-400/60 mt-2 hover:text-amber-400 transition-colors"
              >
                ヒントを見る
              </button>
            )}
            {showHint && (
              <p className="text-[10px] text-amber-400 mt-2 animate-math-fade-in">
                💡 {current.hint}
              </p>
            )}
          </div>
        )}

        {/* Answer result */}
        {hasQuestion && answered && (
          <div className={`rounded-xl p-4 border mb-4 ${
            isCorrect
              ? 'bg-green-900/20 border-green-500/30'
              : 'bg-amber-900/20 border-amber-500/30'
          }`}>
            {isCorrect ? (
              <p className="text-green-400 font-bold text-center">
                🎉 正解！素晴らしい！
              </p>
            ) : (
              <div className="text-center">
                <p className="text-amber-400 font-bold">惜しい！正解は {current.answer} です</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  間違えても大丈夫！復習して強くなりましょう
                </p>
              </div>
            )}
          </div>
        )}

        {/* Next button */}
        {(!hasQuestion || answered) && (
          <button
            onClick={handleNext}
            className="w-full btn-tactical py-3 rounded-xl text-lg font-bold tracking-wider"
          >
            {isLastStep ? 'バトル開始！' : '次へ →'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TutorialBattle;
