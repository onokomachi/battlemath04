// ── にゃんこ大戦争風 キャラクター図鑑 ───────────────────────────────────────────
// 11系統 × 3進化段階 = 33フォーム（8通常系統＋3ボス系統）。
// スプライトは /assets/sprites/chars/<spriteFamily>-<stage>.png（無料AI生成＋背景透過処理ずみ。
// 後でSupabase/Firebase StorageのURLに差し替え可能。getCharacterSprite() の baseUrl を変えるだけ）。

export type TargetPref = 'ANY' | 'DEFENSE' | 'RESOURCE';

export interface EvolutionForm {
  stage: 1 | 2 | 3;
  name: string;
  minLevel: number;   // この姿になる最低レベル
  flavor: string;
}

export interface CharacterFamily {
  id: string;            // 兵士ID（戦闘エンジンのsubType）＝アーミーストアのキー
  spriteFamily: string;  // /assets/sprites/chars/<spriteFamily>-<stage>.png
  displayName: string;   // 系統名
  role: string;          // 役割の短い説明
  isStarter?: boolean;   // 最初から使えるスターターキャラ
  forms: [EvolutionForm, EvolutionForm, EvolutionForm];
  // 戦闘の基礎ステータス（Lv1）。進化段階で乗算強化される。
  base: {
    hp: number;
    damage: number;
    moveSpeed: number;
    target: TargetPref;
    attackRange: number;
    attackSpeed: number; // ms/攻撃
  };
  cost: { gold: number; count: number }; // 補充1回ぶん（ゴールドのみ）
  accent: string;
}

// 進化段階を返す（Lv1-9 = 1, Lv10-29 = 2, Lv30+ = 3）
export function stageForLevel(level: number): 1 | 2 | 3 {
  if (level >= 30) return 3;
  if (level >= 10) return 2;
  return 1;
}

// 段階ごとの戦闘倍率（進化＝強化）。Flow理論：学習量が戦力に直結する手応え。
export const STAGE_MULT: Record<1 | 2 | 3, { hp: number; dmg: number }> = {
  1: { hp: 1.0,  dmg: 1.0 },
  2: { hp: 1.45, dmg: 1.4 },
  3: { hp: 2.0,  dmg: 1.9 },
};

export const MAX_LEVEL = 50;

// 累積XPテーブルではなく「次のレベルに必要なXP」= level * 40
export function xpToNext(level: number): number {
  return level * 40;
}

const SPRITE_BASE = '/assets/sprites/chars';

export function getCharacterSprite(spriteFamily: string, stage: 1 | 2 | 3): string {
  return `${SPRITE_BASE}/${spriteFamily}-${stage}.png`;
}

// 戦闘エンジンの既存subType（barbarian/archer/giant/skeleton）→ 系統スプライトの対応
const SUBTYPE_TO_SPRITE: Record<string, string> = {
  barbarian: 'melee',
  archer: 'ranged',
  giant: 'tank',
  magic: 'magic',
  speed: 'speed',
  flying: 'flying',
  healer: 'healer',
  bomber: 'bomber',
  boss_titan: 'boss-titan',
  boss_artillery: 'boss-artillery',
  boss_overlord: 'boss-overlord',
};

export function spriteFamilyForSubType(subType: string): string | null {
  return SUBTYPE_TO_SPRITE[subType] ?? null;
}

export const CHARACTERS: CharacterFamily[] = [
  {
    id: 'barbarian', spriteFamily: 'melee', displayName: '近接系', role: '無差別の地上アタッカー',
    isStarter: true,
    accent: '#f4814e',
    forms: [
      { stage: 1, name: 'ニャバリアン',   minLevel: 1,  flavor: '剣をふりまわす元気なネコ戦士。まずはコイツから！' },
      { stage: 2, name: 'ニャーサーカー', minLevel: 10, flavor: 'ツノのカブトでパワーアップ。こん棒で一撃！' },
      { stage: 3, name: 'デモニャ・ロード', minLevel: 30, flavor: '王冠と大剣をまとった近接系の王者。' },
    ],
    base: { hp: 60, damage: 15, moveSpeed: 2.5, target: 'ANY', attackRange: 1.2, attackSpeed: 1000 },
    cost: { gold: 30, count: 3 },
  },
  {
    id: 'archer', spriteFamily: 'ranged', displayName: '遠距離系', role: '壁ごしに矢を放つ狙撃手',
    isStarter: true,
    accent: '#46c98a',
    forms: [
      { stage: 1, name: 'ニャーチャー', minLevel: 1,  flavor: '弓矢で遠くからチクチク攻撃するネコ。' },
      { stage: 2, name: 'クロスニャー', minLevel: 10, flavor: 'クロスボウで連射。フードがクールだニャ。' },
      { stage: 3, name: 'ニャイパー',   minLevel: 30, flavor: '超射程のロングボウ使い。王冠つき。' },
    ],
    base: { hp: 40, damage: 12, moveSpeed: 3.0, target: 'ANY', attackRange: 3.5, attackSpeed: 900 },
    cost: { gold: 30, count: 3 },
  },
  {
    id: 'giant', spriteFamily: 'tank', displayName: 'タンク系', role: '防衛設備をひきつける盾役',
    isStarter: true,
    accent: '#b98a5e',
    forms: [
      { stage: 1, name: 'ニャイアント', minLevel: 1,  flavor: '大きなHPで敵の攻撃を受けとめる。' },
      { stage: 2, name: 'ニャーレム',   minLevel: 10, flavor: '岩のこぶしでなぐる頑丈なゴーレムネコ。' },
      { stage: 3, name: 'タイタニャン', minLevel: 30, flavor: '巨大ハンマーをもつ伝説の巨人ネコ。' },
    ],
    base: { hp: 300, damage: 25, moveSpeed: 1.5, target: 'DEFENSE', attackRange: 1.2, attackSpeed: 1200 },
    cost: { gold: 120, count: 1 },
  },
  {
    id: 'magic', spriteFamily: 'magic', displayName: '魔法系', role: '高火力の遠距離魔法使い',
    accent: '#7b6cf0',
    forms: [
      { stage: 1, name: 'ミニャジョ',     minLevel: 1,  flavor: '杖で魔法をうつ見習いネコ魔導士。' },
      { stage: 2, name: 'ニャザード',     minLevel: 10, flavor: 'オーブから強力な魔力を放つウィザード。' },
      { stage: 3, name: 'ニャークメイジ', minLevel: 30, flavor: '魔導書をあやつる大魔導士ネコ。' },
    ],
    base: { hp: 55, damage: 30, moveSpeed: 2.0, target: 'ANY', attackRange: 3.0, attackSpeed: 1300 },
    cost: { gold: 140, count: 2 },
  },
  {
    id: 'speed', spriteFamily: 'speed', displayName: '高速系', role: '資源を一気に奪う俊足の暗殺者',
    accent: '#9bd83a',
    forms: [
      { stage: 1, name: 'ニャブリン',     minLevel: 1,  flavor: 'すばやく動く小さなネコ。資源が大好き。' },
      { stage: 2, name: 'アサシニャン',   minLevel: 10, flavor: '二刀流のアサシン。一瞬で間合いを詰める。' },
      { stage: 3, name: 'ニャンジャ',     minLevel: 30, flavor: '手裏剣を投げる忍者ネコ。神出鬼没。' },
    ],
    base: { hp: 45, damage: 14, moveSpeed: 4.2, target: 'RESOURCE', attackRange: 1.2, attackSpeed: 700 },
    cost: { gold: 60, count: 4 },
  },
  {
    id: 'flying', spriteFamily: 'flying', displayName: '飛行系', role: '壁を無視して突っ込む空の戦士',
    accent: '#e3534a',
    forms: [
      { stage: 1, name: 'コニャウモリ',   minLevel: 1,  flavor: 'パタパタ飛ぶ小さなコウモリネコ。' },
      { stage: 2, name: 'ワイニャバーン', minLevel: 10, flavor: 'ツノとツバサをもつ飛竜ネコ。' },
      { stage: 3, name: 'ドラニャン',     minLevel: 30, flavor: '大剣をもつ伝説のドラゴンネコ。' },
    ],
    base: { hp: 80, damage: 22, moveSpeed: 3.4, target: 'ANY', attackRange: 1.4, attackSpeed: 1000 },
    cost: { gold: 160, count: 1 },
  },
  {
    id: 'healer', spriteFamily: 'healer', displayName: '回復系', role: '味方を支える癒やしのサポーター',
    accent: '#ff8fb3',
    forms: [
      { stage: 1, name: 'ニャース',     minLevel: 1,  flavor: 'ナースキャップのやさしいネコ。' },
      { stage: 2, name: 'プリーニャ',   minLevel: 10, flavor: '聖なる杖をもつプリーストネコ。' },
      { stage: 3, name: 'セイニャント', minLevel: 30, flavor: '光輪をまとった聖女ネコ。' },
    ],
    base: { hp: 70, damage: 8, moveSpeed: 2.2, target: 'ANY', attackRange: 1.4, attackSpeed: 1100 },
    cost: { gold: 120, count: 2 },
  },
  {
    id: 'bomber', spriteFamily: 'bomber', displayName: '爆発系', role: '建物に大ダメージの爆弾魔',
    accent: '#ffb020',
    forms: [
      { stage: 1, name: 'ボムニャー',     minLevel: 1,  flavor: 'ゴーグルをかけた爆弾ずきのネコ。' },
      { stage: 2, name: 'キャノニャー',   minLevel: 10, flavor: '大砲をかついだ砲撃ネコ。' },
      { stage: 3, name: 'デモリニャン',   minLevel: 30, flavor: 'ダイナマイトで何でも吹き飛ばす破壊王。' },
    ],
    base: { hp: 50, damage: 40, moveSpeed: 2.3, target: 'DEFENSE', attackRange: 1.2, attackSpeed: 1400 },
    cost: { gold: 100, count: 2 },
  },
  {
    id: 'boss_titan', spriteFamily: 'boss-titan', displayName: 'コズミック・ハイドラ', role: '宇宙怪獣（多頭触手・範囲攻撃）',
    accent: '#7c3aed',
    forms: [
      { stage: 1, name: 'ハイドラニャン',     minLevel: 1,  flavor: '3つの頭と触手で広範囲を同時に攻撃する宇宙怪獣ネコ。' },
      { stage: 2, name: 'ギガ・ハイドラニャン', minLevel: 10, flavor: 'バイオルミネセンスを放つ触手が戦場を制圧する。' },
      { stage: 3, name: 'コズミック・ハイドラ', minLevel: 30, flavor: '全宇宙に広がる触手。複数の敵を同時に喰い尽くす伝説の宇宙怪獣。' },
    ],
    base: { hp: 1500, damage: 70, moveSpeed: 0.8, target: 'DEFENSE', attackRange: 1.4, attackSpeed: 2000 },
    cost: { gold: 600, count: 1 },
  },
  {
    id: 'boss_artillery', spriteFamily: 'boss-artillery', displayName: 'メカ・カイザー', role: '機械皇帝（超遠距離砲撃・建物優先）',
    accent: '#f59e0b',
    forms: [
      { stage: 1, name: 'メカニャー',    minLevel: 1,  flavor: '金属外骨格と肩の二連装キャノンで遠くの施設を狙い撃つ。' },
      { stage: 2, name: 'カイザーニャ',  minLevel: 10, flavor: '全身機械化されたサイボーグネコ。単眼センサーが敵を正確に捉える。' },
      { stage: 3, name: 'メカ・カイザー', minLevel: 30, flavor: '銀河皇帝の名を持つ機械神。超長距離の必殺砲は建物を一撃で消し飛ばす。' },
    ],
    base: { hp: 800, damage: 110, moveSpeed: 1.0, target: 'ANY', attackRange: 3.5, attackSpeed: 2400 },
    cost: { gold: 550, count: 1 },
  },
  {
    id: 'boss_overlord', spriteFamily: 'boss-overlord', displayName: 'ニャースベイダー', role: 'ダークロード（超遅・即死級攻撃）',
    accent: '#dc2626',
    forms: [
      { stage: 1, name: 'ダースニャン',     minLevel: 1,  flavor: '黒いマントをなびかせ闇のエネルギーブレードを操る宇宙ネコ。' },
      { stage: 2, name: 'ダースニャンII',   minLevel: 10, flavor: '胸の赤いコアが激しく光る。その一撃は戦場を半壊させる。' },
      { stage: 3, name: 'ニャースベイダー', minLevel: 30, flavor: '銀河皇帝。黒マントの逆三角シルエットが戦場に影を落とす最恐のボス。' },
    ],
    base: { hp: 1100, damage: 150, moveSpeed: 0.9, target: 'ANY', attackRange: 1.8, attackSpeed: 2600 },
    cost: { gold: 750, count: 1 },
  },
];

export const CHARACTER_BY_ID: Record<string, CharacterFamily> =
  Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

export function currentFormName(familyId: string, level: number): string {
  const fam = CHARACTER_BY_ID[familyId];
  if (!fam) return familyId;
  return fam.forms[stageForLevel(level) - 1].name;
}
