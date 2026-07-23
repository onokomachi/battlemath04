
import React, { useState, useEffect } from 'react';
import { getRecords, clearRecords } from '../services/recordService';
import { LearningRecord } from '../types';
import { BackIcon, TrophyIcon, CheckCircleIcon, XCircleIcon } from './Icons';

interface RecordsScreenProps {
  onBackToMenu: () => void;
}

const RecordsScreen: React.FC<RecordsScreenProps> = ({ onBackToMenu }) => {
  const [records, setRecords] = useState<LearningRecord[]>([]);

  useEffect(() => {
    setRecords(getRecords());
  }, []);

  const handleClearRecords = () => {
    if (window.confirm("学習記録をすべて削除しますか？この操作は元に戻せません。")) {
      clearRecords();
      setRecords([]);
    }
  };

  return (
    <div className="h-screen bg-black text-white p-6 md:p-10 flex flex-col items-center overflow-y-auto">
      <main className="w-full max-w-5xl">
        <header className="flex justify-between items-end mb-10 border-b border-red-500/20 pb-6">
          <div>
            <h1 className="text-4xl font-bold text-white">学習記録</h1>
          </div>
          <button onClick={onBackToMenu} className="btn-tactical px-8 py-3 rounded-lg flex items-center gap-3 font-bold text-sm text-red-400">
            <BackIcon className="w-5 h-5" />
            戻る
          </button>
        </header>

        {records.length === 0 ? (
          <div className="text-center hud-panel rounded-2xl p-20 shadow-2xl flex flex-col items-center gap-4">
             <div className="w-16 h-16 border border-red-900/30 rounded-full flex items-center justify-center">
               <span className="text-red-700 text-2xl">?</span>
             </div>
            <p className="text-red-600 text-sm">まだ学習記録がありません。練習を始めてみよう！</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-right mb-6">
                <button
                    onClick={handleClearRecords}
                    className="text-xs text-red-500/60 hover:text-red-400 transition-colors font-bold"
                >
                    記録をすべて削除
                </button>
            </div>
            {records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => {
              const accuracy = record.stats.problemCount > 0 ? Math.round((record.stats.correct / record.stats.problemCount) * 100) : 0;
              return (
                <div key={record.id} className="hud-panel rounded-xl p-5 animate-math-fade-in shadow-xl group border-red-500/5 hover:border-red-500/20 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div className="space-y-1">
                      <p className="text-xs text-red-600">{new Date(record.date).toLocaleString('ja-JP')}</p>
                      <p className="font-bold text-red-300 text-xl">{record.category}</p>
                      <p className="text-sm text-white/60 font-medium">{record.subTopic}</p>
                    </div>
                    <div className="flex items-center gap-6 mt-4 sm:mt-0 border-t sm:border-none border-red-500/5 pt-4 sm:pt-0 font-mono">
                      <div className="flex flex-col items-center" title="スコア">
                        <span className="text-[10px] text-red-500 font-bold mb-1">スコア</span>
                        <div className="flex items-center gap-1.5 text-red-100">
                          <TrophyIcon className="w-4 h-4 text-red-500" />
                          <span className="font-bold text-xl">{record.stats.totalScore}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center" title="正解">
                         <span className="text-[10px] text-red-500 font-bold mb-1">正解</span>
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span className="font-bold text-xl">{record.stats.correct}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center" title="不正解">
                         <span className="text-[10px] text-red-500 font-bold mb-1">不正解</span>
                        <div className="flex items-center gap-1.5 text-red-500/70">
                          <XCircleIcon className="w-4 h-4" />
                          <span className="font-bold text-xl">{record.stats.incorrect}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center" title="正答率">
                         <span className="text-[10px] text-red-500 font-bold mb-1">正答率</span>
                        <span className={`font-bold text-xl ${accuracy >= 70 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{accuracy}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default RecordsScreen;
