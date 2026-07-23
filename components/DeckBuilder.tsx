
import React, { useState, useMemo } from 'react';
import type { ProblemCard, BattleFormat, SavedDeck } from '../types';
import Card from './Card';
import { DECK_SIZE, MAX_DUPLICATES, DECK_CONSTRAINTS, MATH_CATEGORIES } from '../constants';
import { BackIcon } from './Icons';

const SAVED_DECKS_KEY = 'battlemath_saved_decks';
const MAX_SAVED_DECKS = 10;

type SortMode = 'category' | 'difficulty' | 'name';

interface DeckBuilderProps {
  ownedCards: ProblemCard[];
  onDeckSubmit: (deck: ProblemCard[], mode: 'cpu' | 'pvp', format: BattleFormat) => void;
  onBack: () => void;
}

const BATTLE_FORMATS: { key: BattleFormat; label: string; desc: string }[] = [
  { key: 'best_of_3', label: '3本勝負', desc: '先に2勝で決着' },
  { key: 'best_of_5', label: '5本勝負', desc: '先に3勝で決着' },
  { key: 'best_of_7', label: '7本勝負', desc: '先に4勝で決着' },
  { key: 'master_duel', label: 'マスターデュエル', desc: 'HPを0にするまで戦う' },
];

const loadSavedDecks = (): SavedDeck[] => {
  try {
    const raw = localStorage.getItem(SAVED_DECKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveDeckToStorage = (decks: SavedDeck[]) => {
  localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(decks));
};

const DeckBuilder: React.FC<DeckBuilderProps> = ({ ownedCards, onDeckSubmit, onBack }) => {
  const [deck, setDeck] = useState<ProblemCard[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<number>(0); // 0 = all
  const [battleFormat, setBattleFormat] = useState<BattleFormat>('best_of_5');
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(loadSavedDecks());
  const [showSavedDecks, setShowSavedDecks] = useState(false);
  const [saveDeckName, setSaveDeckName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Get unique categories from owned cards
  const categories = useMemo(() => {
    const cats = new Set(ownedCards.map(c => c.mainCategory));
    return Array.from(cats).sort();
  }, [ownedCards]);

  // Get unique difficulties
  const difficulties = useMemo(() => {
    const diffs = Array.from(new Set(ownedCards.map(c => c.difficulty)));
    return diffs.sort((a: number, b: number) => a - b);
  }, [ownedCards]);

  const deckCardCounts = useMemo(() => {
    return deck.reduce((acc, card) => {
      acc[card.id] = (acc[card.id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }, [deck]);

  // Filter and sort owned cards
  const filteredAndSortedCards = useMemo(() => {
    let cards = [...ownedCards];

    // Apply filters
    if (filterCategory !== 'all') {
      cards = cards.filter(c => c.mainCategory === filterCategory);
    }
    if (filterDifficulty > 0) {
      cards = cards.filter(c => c.difficulty === filterDifficulty);
    }

    // Apply sort
    cards.sort((a, b) => {
      if (sortMode === 'category') {
        const catCmp = a.mainCategory.localeCompare(b.mainCategory);
        if (catCmp !== 0) return catCmp;
        return a.difficulty - b.difficulty;
      }
      if (sortMode === 'difficulty') {
        const diffCmp = a.difficulty - b.difficulty;
        if (diffCmp !== 0) return diffCmp;
        return a.mainCategory.localeCompare(b.mainCategory);
      }
      // name sort
      return (a.category || '').localeCompare(b.category || '');
    });

    return cards;
  }, [ownedCards, filterCategory, filterDifficulty, sortMode]);

  const addCardToDeck = (cardDef: ProblemCard) => {
    if (deck.length >= DECK_SIZE) return;
    if ((deckCardCounts[cardDef.id] || 0) >= MAX_DUPLICATES) return;

    const constraint = DECK_CONSTRAINTS[cardDef.difficulty];
    if (constraint) {
      const count = deck.filter(c => c.difficulty === cardDef.difficulty).length;
      if (count >= constraint) return;
    }
    setDeck(prev => [...prev, cardDef]);
  };

  const removeCardFromDeck = (index: number) => {
    setDeck(prev => prev.filter((_, i) => i !== index));
  };

  const isDeckValid = deck.length === DECK_SIZE;

  // Deck save/load
  const handleSaveDeck = () => {
    if (!isDeckValid || !saveDeckName.trim()) return;
    const newDeck: SavedDeck = {
      name: saveDeckName.trim(),
      cardIds: deck.map(c => c.id),
      createdAt: Date.now(),
    };
    const updated = [...savedDecks, newDeck].slice(-MAX_SAVED_DECKS);
    setSavedDecks(updated);
    saveDeckToStorage(updated);
    setSaveDeckName('');
    setShowSaveInput(false);
  };

  const handleLoadDeck = (saved: SavedDeck) => {
    const cardMap = new Map<number, ProblemCard>(ownedCards.map(c => [c.id, c]));
    const loaded: ProblemCard[] = [];
    for (const id of saved.cardIds) {
      const card = cardMap.get(id);
      if (card) loaded.push(card);
    }
    setDeck(loaded);
    setShowSavedDecks(false);
  };

  const handleDeleteSavedDeck = (index: number) => {
    const updated = savedDecks.filter((_, i) => i !== index);
    setSavedDecks(updated);
    saveDeckToStorage(updated);
  };

  return (
    <div className="w-full h-full flex flex-col items-center p-3 sm:p-4 text-white overflow-hidden">
      <header className="text-center mb-3 sm:mb-4 flex-shrink-0">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-hologram tracking-[0.1em] mb-1">デッキ編成</h1>
        <p className="text-xs sm:text-sm text-red-400 font-bold">カードを選んでデッキを作ろう: {deck.length} / {DECK_SIZE}枚</p>
      </header>

      <div className="w-full max-w-7xl flex-grow flex gap-3 sm:gap-4 overflow-hidden min-h-0">
        {/* 所持カード */}
        <div className="w-1/2 flex flex-col hud-panel rounded-2xl p-3 sm:p-4 border-red-500/20 shadow-2xl relative">
          <div className="corner-accent lt"></div>
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-red-400">所持カード ({filteredAndSortedCards.length}枚)</h2>
          </div>

          {/* Sort & Filter Controls */}
          <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
            {/* Sort buttons */}
            <div className="flex gap-1">
              {([['category', '章'], ['difficulty', 'Lv'], ['name', '名前']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border transition-all ${
                    sortMode === mode
                      ? 'bg-red-500/20 border-red-400/50 text-red-300'
                      : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-red-600/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900/80 border border-red-500/20 text-red-200 text-[10px] sm:text-xs rounded px-1.5 py-0.5 outline-none"
            >
              <option value="all">全章</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Difficulty filter */}
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(Number(e.target.value))}
              className="bg-slate-900/80 border border-red-500/20 text-red-200 text-[10px] sm:text-xs rounded px-1.5 py-0.5 outline-none"
            >
              <option value={0}>全Lv</option>
              {difficulties.map(d => (
                <option key={d} value={d}>Lv.{d}</option>
              ))}
            </select>
          </div>

          <div className="flex-grow grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 sm:gap-3 p-1 overflow-y-auto custom-scrollbar min-h-0">
            {filteredAndSortedCards.map((cardDef) => {
              const countInDeck = deckCardCounts[cardDef.id] || 0;
              const isDimmed = countInDeck >= MAX_DUPLICATES;
              return (
                <div key={cardDef.id} className="relative group" onClick={() => !isDimmed && addCardToDeck(cardDef)}>
                  <div className={`${isDimmed ? 'opacity-20 saturate-0 scale-95' : 'cursor-pointer transition-transform hover:scale-105 active:scale-95'}`}>
                    <div className="transform scale-[0.85] origin-top">
                      <Card card={cardDef} />
                    </div>
                  </div>
                  {!isDimmed && (
                    <div className="absolute top-0 right-1 bg-red-600 text-slate-950 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white/20 shadow-lg">
                      {MAX_DUPLICATES - countInDeck}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* デッキ */}
        <div className="w-1/2 flex flex-col hud-panel rounded-2xl p-3 sm:p-4 border-red-400/20 shadow-2xl relative bg-blue-900/5">
          <div className="corner-accent rt"></div>
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-red-200">デッキ ({deck.length}/{DECK_SIZE})</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setShowSavedDecks(true)}
                className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border bg-slate-900/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/20 transition-all"
              >
                読込
              </button>
              <button
                onClick={() => isDeckValid ? setShowSaveInput(true) : null}
                disabled={!isDeckValid}
                className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border bg-slate-900/40 border-red-500/30 text-red-300 hover:bg-red-900/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                保存
              </button>
              <button
                onClick={() => setDeck([])}
                disabled={deck.length === 0}
                className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border bg-slate-900/40 border-red-500/30 text-red-300 hover:bg-red-900/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                全解除
              </button>
            </div>
          </div>

          {/* Save input */}
          {showSaveInput && (
            <div className="flex gap-2 mb-2 flex-shrink-0 animate-math-fade-in">
              <input
                type="text"
                value={saveDeckName}
                onChange={(e) => setSaveDeckName(e.target.value)}
                placeholder="デッキ名を入力..."
                maxLength={20}
                className="flex-grow bg-slate-950/60 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs text-red-200 outline-none placeholder:text-red-800"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveDeck()}
              />
              <button
                onClick={handleSaveDeck}
                disabled={!saveDeckName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-slate-950 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                保存
              </button>
              <button
                onClick={() => { setShowSaveInput(false); setSaveDeckName(''); }}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex-grow grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 sm:gap-3 p-1 overflow-y-auto custom-scrollbar min-h-0">
            {deck.map((card, index) => (
              <div key={index} className="relative cursor-pointer transition-all hover:scale-105 active:scale-95 group" onClick={() => removeCardFromDeck(index)}>
                <div className="transform scale-[0.85] origin-top">
                  <Card card={card} />
                </div>
                <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                  <span className="text-red-400 text-xs font-bold">外す</span>
                </div>
              </div>
            ))}
            {Array.from({ length: DECK_SIZE - deck.length }).map((_, i) => (
              <div key={`empty-${i}`} className="w-full aspect-[48/72] rounded-xl border border-dashed border-red-900/30 flex items-center justify-center bg-slate-950/20">
                <span className="text-[10px] text-red-900 font-bold">空き</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar: format picker + battle buttons */}
      <div className="flex items-center gap-3 mt-3 sm:mt-4 flex-wrap justify-center flex-shrink-0">
        <button
          onClick={onBack}
          className="btn-tactical px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2"
        >
          <BackIcon className="w-4 h-4" /> 戻る
        </button>

        {/* Battle format selector */}
        <div className="relative">
          <button
            onClick={() => setShowFormatPicker(p => !p)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900/20 transition-all flex items-center gap-2"
          >
            <span className="text-[10px] text-purple-400">形式:</span>
            {BATTLE_FORMATS.find(f => f.key === battleFormat)?.label}
          </button>
          {showFormatPicker && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-purple-500/30 rounded-xl p-2 shadow-2xl backdrop-blur-xl z-50 w-56 animate-math-fade-in">
              {BATTLE_FORMATS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setBattleFormat(f.key); setShowFormatPicker(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all mb-1 last:mb-0 ${
                    battleFormat === f.key
                      ? 'bg-purple-500/20 text-purple-200 border border-purple-400/40'
                      : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <span className="block">{f.label}</span>
                  <span className="text-[10px] text-slate-500">{f.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onDeckSubmit(deck, 'cpu', battleFormat)}
          disabled={!isDeckValid}
          className={`px-8 py-3 rounded-xl text-base font-bold transition-all transform hover:scale-105 shadow-lg
            ${!isDeckValid ? 'opacity-20 cursor-not-allowed bg-slate-800 text-gray-500 border border-slate-700' : 'bg-blue-600 text-white border-red-400/50 hover:bg-blue-500'}`}
        >
          {isDeckValid ? 'CPU対戦' : `あと${DECK_SIZE - deck.length}枚`}
        </button>
        <button
          onClick={() => onDeckSubmit(deck, 'pvp', battleFormat)}
          disabled={!isDeckValid}
          className={`px-8 py-3 rounded-xl text-base font-bold transition-all transform hover:scale-105
            ${!isDeckValid ? 'opacity-20 cursor-not-allowed bg-slate-800 text-gray-500 border border-slate-700' : 'bg-amber-600 text-white border-amber-400/50 hover:bg-amber-500'}`}
        >
          {isDeckValid ? 'PvP対戦' : `あと${DECK_SIZE - deck.length}枚`}
        </button>
      </div>

      {/* Saved Decks Modal */}
      {showSavedDecks && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md" onClick={() => setShowSavedDecks(false)}>
          <div className="hud-panel rounded-2xl p-6 max-w-md w-full shadow-2xl border-amber-400/30 animate-math-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-400 text-lg font-bold mb-4">保存済みデッキ</h3>
            {savedDecks.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">保存済みデッキがありません</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {savedDecks.map((sd, i) => {
                  const validCount = sd.cardIds.filter(id => ownedCards.some(c => c.id === id)).length;
                  return (
                    <div key={i} className="flex items-center justify-between bg-slate-900/60 border border-amber-500/10 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-white">{sd.name}</p>
                        <p className="text-[10px] text-slate-500">{validCount}/{sd.cardIds.length}枚使用可 | {new Date(sd.createdAt).toLocaleDateString('ja-JP')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoadDeck(sd)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600/80 text-slate-950 hover:bg-amber-500 transition-all"
                        >
                          読込
                        </button>
                        <button
                          onClick={() => handleDeleteSavedDeck(i)}
                          className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-900/30 transition-all border border-red-500/20"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setShowSavedDecks(false)}
              className="mt-4 w-full btn-tactical py-2.5 rounded-lg font-bold text-sm text-red-400 border-red-400/40 hover:bg-red-400/20"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckBuilder;
