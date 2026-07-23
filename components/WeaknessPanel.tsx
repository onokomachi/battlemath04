/**
 * WeaknessPanel.tsx — 弱点分析ダッシュボード
 *
 * エビデンスA: Wang, Haertel & Walberg (1993) メタ認知 (ES=0.69)
 * エビデンスA: Hattie (2009) Visible Learning — フィードバック可視化
 */
import React, { useMemo } from 'react';
import { getWeaknessReport, getOverallAccuracy, type WeaknessReport } from '../services/weaknessAnalysisService';
import { getDueCount, getTotalSrsCount } from '../services/spacedRepetitionService';

interface WeaknessPanelProps {
  onClose: () => void;
}

const statusConfig: Record<WeaknessReport['status'], { label: string; color: string; bg: string }> = {
  mastered: { label: '習得済', color: 'text-green-400', bg: 'bg-green-500/20' },
  proficient: { label: '良好', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  developing: { label: '発展中', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  struggling: { label: '要復習', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const WeaknessPanel: React.FC<WeaknessPanelProps> = ({ onClose }) => {
  const reports = useMemo(() => getWeaknessReport(), []);
  const overallAccuracy = useMemo(() => getOverallAccuracy(), []);
  const dueCount = useMemo(() => getDueCount(), []);
  const totalSrs = useMemo(() => getTotalSrsCount(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-math-fade-in">
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] bg-slate-950/95 border border-red-500/30 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.1)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/20 via-blue-900/10 to-red-900/20 p-5 border-b border-red-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white tracking-wider flex items-center gap-2">
                <span className="text-red-400">📊</span> 弱点分析
              </h2>
              <p className="text-[10px] text-red-400/70 mt-1 font-bold">
                メタ認知支援 — 自分の強み・弱みを可視化
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-2xl transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Overall stats */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="bg-slate-900/60 rounded-lg p-3 text-center border border-red-900/30">
              <div className="text-2xl font-black text-red-300 font-mono">{overallAccuracy}%</div>
              <div className="text-[9px] text-gray-500 font-bold">総合正答率</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 text-center border border-amber-900/30">
              <div className="text-2xl font-black text-amber-400 font-mono">{dueCount}</div>
              <div className="text-[9px] text-gray-500 font-bold">復習待ち</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 text-center border border-slate-700/30">
              <div className="text-2xl font-black text-gray-300 font-mono">{totalSrs}</div>
              <div className="text-[9px] text-gray-500 font-bold">SRS登録数</div>
            </div>
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {reports.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">まだデータがありません</p>
              <p className="text-xs">問題を解くと自動的に分析されます</p>
            </div>
          ) : (
            reports.map(report => {
              const config = statusConfig[report.status];
              return (
                <div
                  key={report.category}
                  className="rounded-lg p-3 border border-slate-700/30 bg-slate-900/30 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Status badge */}
                    <div className={`${config.bg} ${config.color} px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 w-14 text-center`}>
                      {config.label}
                    </div>

                    {/* Category name + recommendation */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-bold truncate">{report.category}</span>
                        <span className="text-gray-600 text-[10px]">{report.totalAttempts}問</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{report.recommendation}</p>
                    </div>

                    {/* Accuracy bar */}
                    <div className="flex-shrink-0 w-28">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className={config.color}>{report.accuracy}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            report.status === 'mastered' ? 'bg-green-500/70' :
                            report.status === 'proficient' ? 'bg-blue-500/70' :
                            report.status === 'developing' ? 'bg-amber-500/70' :
                            'bg-red-500/70'
                          }`}
                          style={{ width: `${report.accuracy}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-red-900/20 bg-slate-900/40 flex-shrink-0">
          <p className="text-[9px] text-gray-600 text-center">
            要復習の分野は「練習モード」で重点的に取り組みましょう
          </p>
        </div>
      </div>
    </div>
  );
};

export default WeaknessPanel;
