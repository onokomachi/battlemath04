/**
 * components/guided/GuidedAnswerHost.tsx
 *
 * type: 'guided' の Problem を受け取り、guidedKind に応じて参照アプリ由来の
 * 専用エンジンへディスパッチする。練習・カードバトル・スピードデュエル・本番テストの
 * 4つの回答パイプラインすべてから同じコンポーネントを呼び出すことで、
 * 「同じ解答方法をすべてのモードで」を1箇所で保証する。
 */
import React from 'react';
import type { Problem, GuidedProblemData } from '../../types';
import LongDivisionSimulator from './LongDivisionSimulator';
import GuidedRetryHintEngine from './GuidedRetryHintEngine';
import DivisionErrorHunter from './DivisionErrorHunter';
import DecimalColumnCalculator from './DecimalColumnCalculator';
import MultiplicationColumnSimulator from './MultiplicationColumnSimulator';

interface Props {
  problem: Problem;
  onComplete: (isCorrect: boolean) => void;
}

const GuidedAnswerHost: React.FC<Props> = ({ problem, onComplete }) => {
  const data = problem.data as GuidedProblemData;

  switch (data.guidedKind) {
    case 'division-hissan':
      return <LongDivisionSimulator data={data} onComplete={onComplete} />;
    case 'division-error-hunter':
      return <DivisionErrorHunter data={data} onComplete={onComplete} />;
    case 'decimal-addsub':
    case 'decimal-muldiv':
      return <DecimalColumnCalculator data={data} onComplete={onComplete} />;
    case 'multiplication-hissan':
      return <MultiplicationColumnSimulator data={data} onComplete={onComplete} />;
    case 'retry-hint':
      return <GuidedRetryHintEngine data={data} onComplete={onComplete} />;
    default:
      return (
        <div className="text-red-400 text-sm font-bold p-4 text-center">
          未対応の guidedKind です: {(data as { guidedKind?: string }).guidedKind}
        </div>
      );
  }
};

export default GuidedAnswerHost;
