
import React, { useState } from 'react';
import type { ProblemCard } from '../types';
import Card, { CardBack } from './Card';
import { BackIcon } from './Icons';

interface CardShopProps {
  mathPoints: number;
  onBuyPack: (mainCategory: string, cost: number, packType: string) => ProblemCard[] | null;
  onExit: () => void;
  /** ロックされた単元のパックは買えない */
  lockedUnits?: Set<string>;
}

const PACKS = [
  { type: '大きい数パック', cost: 1000, desc: '億・兆のよみかき、10倍・1/10、かけ算', main: '大きい数のしくみ' },
  { type: 'グラフと表パック', cost: 1000, desc: '折れ線グラフのよみとり・二次元表', main: '折れ線グラフと表' },
  { type: 'わり算(÷1けた)パック', cost: 1000, desc: '筆算・たしかめ算・文章題', main: 'わり算の筆算(÷1けた)' },
  { type: '角の大きさパック', cost: 1000, desc: '分度器・180°をこえる角・三角じょうぎ', main: '角の大きさ' },
  { type: '小数パック', cost: 1000, desc: '位取り・たし算ひき算・文章題', main: '小数のしくみ' },
  { type: 'わり算(÷2けた)パック', cost: 1000, desc: '見当づけ・仮の商の修正など', main: 'わり算の筆算(÷2けた)' },
  { type: 'がい数パック', cost: 1000, desc: '四捨五入・はんい・見積もり', main: 'がい数' },
  { type: '計算のきまりパック', cost: 1000, desc: '計算の順じょ・くふうした計算', main: '計算のきまり' },
  { type: '面積パック', cost: 1000, desc: '長方形・正方形・L字型の面積', main: '面積' },
  { type: '小数×÷パック', cost: 1000, desc: '小数×整数・÷整数・わり進み', main: '小数のかけ算とわり算' },
  { type: '分数パック', cost: 1000, desc: '仮分数・帯分数、たし算ひき算など', main: '分数' },
  { type: '変わり方パック', cost: 1000, desc: '表のきまりを式に表す', main: '変わり方調べ' },
  { type: '直方体パック', cost: 1000, desc: '面・辺・頂点、展開図、位置', main: '直方体と立方体' },
  { type: '倍の見方パック', cost: 1000, desc: '何倍・もとにする量・割合でくらべる', main: '倍の見方' },
];

const PackOpeningView: React.FC<{
  pack: ProblemCard[];
  onFinish: () => void;
}> = ({ pack, onFinish }) => {
  const [stage, setStage] = useState<'presenting' | 'revealing'>('presenting');
  const [revealed, setRevealed] = useState<boolean[]>(new Array(pack.length).fill(false));

  const handleRevealCard = (index: number) => {
    if (revealed[index] || stage !== 'revealing') return;
    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);
  };

  const allRevealed = revealed.every(r => r);

  if (stage === 'presenting') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white bg-black/90 backdrop-blur-xl animate-math-fade-in z-[100]">
        <h2 className="text-4xl font-bold text-red-300 mb-12 tracking-wide">パック開封中...</h2>
        <div 
          className="w-56 h-80 bg-gradient-to-br from-red-900 to-blue-950 border-2 border-red-400/60 rounded-xl shadow-[0_0_50px_rgba(239,68,68,0.3)] flex items-center justify-center p-4 cursor-pointer transform hover:scale-110 transition-all duration-500 animate-pulse-slow group"
          onClick={() => setStage('revealing')}
        >
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2)_0%,transparent_70%)] animate-pulse"></div>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-red-400 group-hover:rotate-90 transition-transform duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </div>
        <p className="mt-12 text-red-600 text-sm font-bold">タップして開封</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto text-white bg-black/90 backdrop-blur-2xl z-[100]">
      <div className="min-h-full flex flex-col items-center justify-center p-4 pt-8 sm:pt-4">
        <h2 className="text-4xl font-bold text-red-300 mb-12 tracking-wide">新しいカードを入手！</h2>
        <div className="flex flex-wrap justify-center items-center gap-6 py-4">
          {pack.map((card, index) => (
            <div
              key={index}
              className="card-container animate-math-fade-in"
              style={{ animationDelay: `${index * 200}ms` }}
              onClick={() => handleRevealCard(index)}
            >
              <div className={`card-inner ${revealed[index] ? 'is-flipped' : ''}`}>
                <div className="card-back">
                  <CardBack />
                </div>
                <div className="card-front">
                  <Card card={card} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {allRevealed && (
           <button
            onClick={onFinish}
            className="mt-16 btn-tactical px-12 py-4 rounded-xl text-xl font-bold text-red-400 animate-level-up-reveal"
          >
            ショップに戻る
          </button>
        )}
      </div>
    </div>
  );
};

const CardShop: React.FC<CardShopProps> = ({ mathPoints, onBuyPack, onExit, lockedUnits }) => {
  const [packToOpen, setPackToOpen] = useState<ProblemCard[] | null>(null);

  const handleBuy = (main: string, cost: number, type: string) => {
    const newCards = onBuyPack(main, cost, type);
    if (newCards) {
      if (newCards.length === 0) {
        alert('ALL MODULES SYNCED: この分野のカードはすべて入手済みです。');
        return;
      }
      setPackToOpen(newCards);
    } else {
      alert('INSUFFICIENT_CREDITS: クレジットが不足しています。');
    }
  };
  
  if (packToOpen) {
    return <PackOpeningView pack={packToOpen} onFinish={() => setPackToOpen(null)} />;
  }
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center p-6 pt-24 sm:pt-6 text-white font-['Inter'] overflow-y-auto">
      <div className="absolute top-8 left-8 hud-panel p-5 rounded-xl border-l-4 border-red-500 shadow-2xl">
        <span className="text-xs text-red-400 font-bold block mb-1">所持ポイント</span>
        <span className="text-red-300 text-3xl font-bold font-mono">{mathPoints.toLocaleString()} <span className="text-sm text-red-500/60">MP</span></span>
      </div>

      <header className="text-center mb-6 sm:mb-16">
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-hologram tracking-[0.1em] mb-4">カードショップ</h1>
        <p className="text-sm text-red-400 font-bold opacity-70">MPを使ってカードパックを購入しよう</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full max-w-7xl px-4">
        {PACKS.map(pack => (
          <div key={pack.type} className="hud-panel rounded-2xl p-6 flex flex-col items-center shadow-2xl transition-all transform hover:scale-105 border-red-500/10 group">
            <div className="w-full h-40 bg-gradient-to-br from-red-900/30 to-slate-950 rounded-xl mb-4 flex items-center justify-center border border-red-500/5 relative overflow-hidden">
               <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,transparent_2px,rgba(239,68,68,0.05)_2px,rgba(239,68,68,0.05)_4px)]"></div>
               <div className="z-10 text-red-400 group-hover:scale-110 transition-transform duration-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
               </div>
            </div>
            <h2 className="text-lg font-black text-red-100 mb-2 tracking-tighter uppercase text-center leading-tight h-10 flex items-center">{pack.type}</h2>
            <p className="text-[10px] text-red-700 font-mono mb-6 text-center h-12 flex items-center leading-tight tracking-wider">{pack.desc}</p>
            <button
              onClick={() => handleBuy(pack.main, pack.cost, pack.type)}
              disabled={mathPoints < pack.cost || lockedUnits?.has(pack.main)}
              className={`w-full py-3 rounded-lg font-black text-xs tracking-widest transition-all
                ${mathPoints < pack.cost || lockedUnits?.has(pack.main)
                  ? 'bg-slate-900 text-slate-700 border border-slate-800 cursor-not-allowed'
                  : 'bg-blue-700/20 text-red-400 border border-red-500/40 hover:bg-blue-600 hover:text-white'}`}
            >
              {lockedUnits?.has(pack.main) ? '🔒 じゅんび中' : `${pack.cost} MP`}
            </button>
          </div>
        ))}
      </div>
       <button onClick={onExit} className="mt-6 sm:mt-16 mb-6 btn-tactical px-10 py-3 rounded-lg flex items-center gap-3 text-sm font-bold opacity-70 hover:opacity-100 flex-shrink-0">
        <BackIcon className="w-4 h-4" /> メニューに戻る
      </button>
    </div>
  );
};

export default CardShop;
