
import React, { useState, useMemo } from 'react';
import type { Problem, SessionStats, StudentProfile } from '../types';
import type { User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import MenuScreen from './MenuScreen';
import ProblemScreen from './ProblemScreen';
import RecordsScreen from './RecordsScreen';
import MixPracticeSetup from './MixPracticeSetup';
import { saveRecord } from '../services/recordService';
import { getMixedProblemSet } from '../services/problemService';

interface PracticeModeProps {
  onSessionComplete: (score: number) => void;
  db: Firestore | null;
  user: User | null;
  studentProfile: StudentProfile | null;
  /** ロックされた単元(ワールド)。先生が管理画面から設定 */
  lockedUnits?: Set<string>;
}

// 個別ランキングは児童のやる気を下げる可能性があるため撤去した。
// 学習の見取りは管理画面の「学習分析」(dailySummaries)で行う。
const MIX_PRACTICE_CATEGORY = 'ミックス演習';

const PracticeMode: React.FC<PracticeModeProps> = ({ onSessionComplete, db, user, studentProfile, lockedUnits }) => {
  void db; void user; void studentProfile;
  const [screen, setScreen] = useState<'menu' | 'problem' | 'records' | 'mix_setup' | 'mix_problem'>('menu');
  const [selectedTopic, setSelectedTopic] = useState<{ category: string; subTopic: string } | null>(null);
  // 開いていたワールドをここで保持し、問題画面から「戻る」してもMenuScreenが
  // 再マウントで先頭のワールドにリセットされないようにする
  const [selectedWorldName, setSelectedWorldName] = useState<string | null>(null);
  const [mixProblems, setMixProblems] = useState<Problem[]>([]);
  const [overallStats, setOverallStats] = useState<SessionStats>({ correct: 0, incorrect: 0, totalScore: 0, problemCount: 0 });

  const handleSelectSubTopic = (category: string, subTopic: string) => {
    setSelectedTopic({ category, subTopic });
    setSelectedWorldName(category);
    setScreen('problem');
  };

  const handleShowRecords = () => {
    setScreen('records');
  };

  const handleStartMixPractice = (subtopics: string[], count: number) => {
    setMixProblems(getMixedProblemSet(subtopics, count));
    setScreen('mix_problem');
  };

  // ミックス演習では ProblemScreen に渡す参照を安定させる(再読込防止)
  const stableMixProblems = useMemo(() => mixProblems, [mixProblems]);

  const handleProblemSessionBack = (stats: SessionStats) => {
    if (selectedTopic && stats.problemCount > 0) {
        saveRecord({
            category: selectedTopic.category,
            subTopic: selectedTopic.subTopic,
            stats: stats
        });
        setOverallStats(prev => ({
            correct: prev.correct + stats.correct,
            incorrect: prev.incorrect + stats.incorrect,
            totalScore: prev.totalScore + stats.totalScore,
            problemCount: prev.problemCount + stats.problemCount,
        }));
    }
    setScreen('menu');
    setSelectedTopic(null);
  };

  const handleMixSessionBack = (stats: SessionStats) => {
    if (stats.problemCount > 0) {
        saveRecord({
            category: MIX_PRACTICE_CATEGORY,
            subTopic: MIX_PRACTICE_CATEGORY,
            stats: stats
        });
        setOverallStats(prev => ({
            correct: prev.correct + stats.correct,
            incorrect: prev.incorrect + stats.incorrect,
            totalScore: prev.totalScore + stats.totalScore,
            problemCount: prev.problemCount + stats.problemCount,
        }));
    }
    setScreen('menu');
    setMixProblems([]);
  };

  const handleGoHome = () => {
    onSessionComplete(overallStats.totalScore);
  };

  if (screen === 'problem' && selectedTopic) {
    return (
      <ProblemScreen
        category={selectedTopic.category}
        subTopic={selectedTopic.subTopic}
        onBack={handleProblemSessionBack}
        onHome={handleGoHome}
      />
    );
  }

  if (screen === 'mix_setup') {
    return (
      <MixPracticeSetup
        onStart={handleStartMixPractice}
        onBack={() => setScreen('menu')}
        lockedUnits={lockedUnits}
      />
    );
  }

  if (screen === 'mix_problem' && stableMixProblems.length > 0) {
    return (
      <ProblemScreen
        category={MIX_PRACTICE_CATEGORY}
        subTopic={MIX_PRACTICE_CATEGORY}
        problemsOverride={stableMixProblems}
        onBack={handleMixSessionBack}
        onHome={handleGoHome}
      />
    );
  }

  if (screen === 'records') {
      return <RecordsScreen onBackToMenu={() => setScreen('menu')} />
  }

  return (
    <MenuScreen
      onSelectSubTopic={handleSelectSubTopic}
      onShowRecords={handleShowRecords}
      onExit={handleGoHome}
      onMixPractice={() => setScreen('mix_setup')}
      lockedUnits={lockedUnits}
      selectedWorldName={selectedWorldName}
      onSelectWorld={setSelectedWorldName}
    />
  );
};

export default PracticeMode;
