/**
 * ItemShop.tsx — アイテムショップ（称号管理・シールド・テーマ・消耗品）
 *
 * エビデンスB: Castronova (2005) 仮想経済バランス
 * エビデンスA: 自己決定理論（Deci & Ryan 1985）— 有能感・自律性の充足
 */
import React, { useState } from 'react';
import { SHOP_ITEMS, TITLE_DEFS } from '../constants';
import type { ShopItemDef, TitleDef } from '../types';

type TabKey = 'equip' | 'streak_shield' | 'theme' | 'consumable';

interface ItemShopProps {
  mathPoints: number;
  ownedItems: Set<string>;
  earnedTitleIds: Set<string>;
  equippedTitle: string | null;
  equippedTheme: string | null;
  hintTokens: number;
  onPurchase: (item: ShopItemDef) => void;
  onEquipTitle: (titleId: string | null) => void;
  onEquipTheme: (themeId: string | null) => void;
  onClose: () => void;
}

const RARITY_STYLE: Record<string, string> = {
  common: 'border-gray-600/40',
  rare: 'border-blue-600/40',
  epic: 'border-purple-600/40',
  legendary: 'border-amber-500/50',
};

const RARITY_LABEL: Record<string, { text: string; cls: string }> = {
  common: { text: 'COMMON', cls: 'text-gray-400 bg-gray-800/40' },
  rare: { text: 'RARE', cls: 'text-blue-300 bg-blue-900/30' },
  epic: { text: 'EPIC', cls: 'text-purple-300 bg-purple-900/30' },
  legendary: { text: 'LEGENDARY', cls: 'text-amber-300 bg-amber-900/30' },
};

const ItemShop: React.FC<ItemShopProps> = ({
  mathPoints, ownedItems, earnedTitleIds, equippedTitle, equippedTheme,
  hintTokens, onPurchase, onEquipTitle, onEquipTheme, onClose,
}) => {
  const [tab, setTab] = useState<TabKey>('equip');
  const [message, setMessage] = useState<string | null>(null);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleBuy = (item: ShopItemDef) => {
    if (item.type !== 'hint_token' && ownedItems.has(item.id)) return;
    if (mathPoints < item.cost) { showMsg('MPが足りません'); return; }
    onPurchase(item);
    showMsg(`${item.name} を購入しました！`);
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'equip', label: '装備管理', icon: '🏷️' },
    { key: 'streak_shield', label: 'シールド', icon: '🛡️' },
    { key: 'theme', label: 'テーマ', icon: '🎨' },
    { key: 'consumable', label: '消耗品', icon: '⚡' },
  ];

  // 装備管理タブ用：所持称号一覧
  const ownedTitles: TitleDef[] = TITLE_DEFS.filter(t => earnedTitleIds.has(t.id));

  // テーマ・シールドタブ用
  const shieldItems = SHOP_ITEMS.filter(i => i.type === 'streak_shield');
  const themeItems = SHOP_ITEMS.filter(i => i.type === 'theme');
  const consumableItems = SHOP_ITEMS.filter(i => ['mp_booster', 'hint_token', 'exp_booster'].includes(i.type));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-math-fade-in">
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] bg-slate-950/95 border border-amber-500/30 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.1)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900/20 via-orange-900/10 to-amber-900/20 p-5 border-b border-amber-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white tracking-wider flex items-center gap-2">
                <span className="text-amber-400">🏪</span> アイテムショップ
              </h2>
              <p className="text-[10px] text-amber-400/70 mt-1 font-bold">
                称号はバトルや実績で自動獲得 / アイテムはMPで購入
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/60 rounded-lg px-3 py-1.5 border border-amber-900/30">
                <span className="text-amber-400 font-black font-mono text-sm">{mathPoints.toLocaleString()} MP</span>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl transition-colors">✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mt-3">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                  tab === t.key
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900/40 text-gray-500 border border-slate-700/30 hover:text-gray-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="px-4 py-2 bg-amber-900/30 text-amber-300 text-sm text-center font-bold animate-math-fade-in flex-shrink-0">
            {message}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {/* 装備管理タブ */}
          {tab === 'equip' && (
            <>
              <p className="text-[10px] text-amber-400/60 px-1 mb-3">
                獲得済みの称号を装備できます。称号はバトル・実績・継続ログインで自動獲得されます。
              </p>
              {ownedTitles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">まだ称号がありません</p>
                  <p className="text-gray-600 text-xs mt-1">バトルや実績をこなして称号を獲得しよう！</p>
                </div>
              ) : (
                ownedTitles.map(title => {
                  const isEquipped = equippedTitle === title.id;
                  const rarityBorder = RARITY_STYLE[title.rarity || 'common'];
                  const rarityLabel = RARITY_LABEL[title.rarity || 'common'];
                  return (
                    <div key={title.id} className={`rounded-lg p-3 border ${rarityBorder} bg-slate-900/30`}>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl flex-shrink-0 w-10 text-center">{title.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-bold">{title.name}</span>
                            {isEquipped && (
                              <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">装備中</span>
                            )}
                            {title.isMonthly && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">月次限定</span>
                            )}
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${rarityLabel.cls}`}>{rarityLabel.text}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{title.description}</p>
                        </div>
                        <button
                          onClick={() => onEquipTitle(isEquipped ? null : title.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                            isEquipped
                              ? 'border-gray-600 text-gray-400 hover:text-white'
                              : 'border-red-600/40 text-red-400 hover:bg-red-900/20'
                          }`}
                        >
                          {isEquipped ? '外す' : '装備'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              {/* 未取得称号のヒント */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-[9px] text-gray-600 text-center">
                  未取得称号: {TITLE_DEFS.length - ownedTitles.length} 種 — バトルや練習でさらに獲得しよう！
                </p>
              </div>
            </>
          )}

          {/* シールドタブ */}
          {tab === 'streak_shield' && shieldItems.map(item => {
            const owned = ownedItems.has(item.id);
            const canAfford = mathPoints >= item.cost;
            return (
              <div key={item.id} className={`rounded-lg p-3 border ${owned ? 'border-green-700/30 bg-green-900/10' : 'border-slate-700/30 bg-slate-900/30'}`}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0 w-10 text-center">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm font-bold">{item.name}</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  {owned ? (
                    <span className="text-green-400 text-[10px] font-bold flex-shrink-0">所持中</span>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={!canAfford}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${canAfford ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' : 'border-gray-700 text-gray-600 cursor-not-allowed'}`}
                    >
                      {item.cost.toLocaleString()} MP
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* テーマタブ */}
          {tab === 'theme' && themeItems.map(item => {
            const owned = ownedItems.has(item.id);
            const isApplied = equippedTheme === item.id;
            const canAfford = mathPoints >= item.cost;
            return (
              <div key={item.id} className={`rounded-lg p-3 border ${isApplied ? 'border-red-600/40 bg-red-900/10' : owned ? 'border-green-700/30 bg-green-900/10' : 'border-slate-700/30 bg-slate-900/30'}`}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0 w-10 text-center">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-bold">{item.name}</span>
                      {isApplied && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">適用中</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {owned ? (
                      <button
                        onClick={() => onEquipTheme(isApplied ? null : item.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${isApplied ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-red-600/40 text-red-400 hover:bg-red-900/20'}`}
                      >
                        {isApplied ? '解除' : '適用'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={!canAfford}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${canAfford ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' : 'border-gray-700 text-gray-600 cursor-not-allowed'}`}
                      >
                        {item.cost.toLocaleString()} MP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 消耗品タブ */}
          {tab === 'consumable' && consumableItems.map(item => {
            const canAfford = mathPoints >= item.cost;
            const count = item.id === 'hint_token' ? hintTokens : undefined;
            return (
              <div key={item.id} className="rounded-lg p-3 border border-slate-700/30 bg-slate-900/30 hover:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0 w-10 text-center">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-bold">{item.name}</span>
                      {count !== undefined && count > 0 && (
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">×{count}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <button
                    onClick={() => handleBuy(item)}
                    disabled={!canAfford}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${canAfford ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' : 'border-gray-700 text-gray-600 cursor-not-allowed'}`}
                  >
                    {item.cost.toLocaleString()} MP
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-amber-900/20 bg-slate-900/40 flex-shrink-0">
          <p className="text-[9px] text-gray-600 text-center">
            称号はプレイヤー名の横に表示されます / テーマはバトル画面に反映されます
          </p>
        </div>
      </div>
    </div>
  );
};

export default ItemShop;
