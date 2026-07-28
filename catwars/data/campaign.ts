// ── CAT-WARS ストーリーキャンペーン（全8章）────────────────────────────────
//
// 目的:
//   ・PC戦に「難易度」と「盛り上がり（物語）」を与える（②）
//   ・一般の小4が やる気を失わずに続けられる 段階的な難易度設計にする（⑤）
//
// ── 難易度設計のエビデンスと、そこから導いた具体値 ──────────────────────
//
// [エビデンスレベル1: 複数のRCT・メタ分析に支えられた理論]
//   ・フロー理論 (Csikszentmihalyi 1990) / ゲームへの適用 (Chen 2007, CACM)。
//     挑戦が能力をわずかに上回る帯に留まるとき没入が最大化し、上回りすぎると不安、
//     下回ると退屈になる。→ 章ごとに「わずかに上回る」量だけ強くする方針の根拠。
//   ・自己決定理論 (Ryan & Deci 2000; ゲームへの適用は Ryan, Rigby & Przybylski 2006)。
//     有能感(competence)の充足が継続意欲を最も強く予測する。有能感は「勝てるが
//     楽勝ではない」経験から生じる。→ 章クリア率の目標値を設定する根拠。
//   ・望ましい困難 (Bjork & Bjork 2011)。易しすぎる練習は学習も定着も生まない。
//
// [エビデンスレベル2: 大規模実証研究（教育ゲーム分野）]
//   ・Lomas, Patel, Forlizzi & Koedinger (2013), CHI "Optimizing Challenge in an
//     Educational Game Using Large-Scale Design Experiments"（n≈3万の被験者実験）。
//     教育ゲームでは開発者の直感より "易しめ" が継続率を最大化した。難しすぎる設定は
//     プレイ時間を大きく落とす。→ 序盤2章を明確に易しく置く根拠（勝率85%前後を目標）。
//   ・Sampayo-Vargas et al. (2013, Computers & Education) ほか、適応的難易度は固定難易度に
//     比べ学習成果・動機づけで優位。ただし効果量は中程度。→ 適応は「補助」に留める根拠。
//
// [エビデンスレベル3: 実務上の定石（査読論文ではないが業界で広く検証された知見）]
//   ・Hunicke (2005) "The Case for Dynamic Difficulty Adjustment in Games"。
//     DDA は下方向（救済）に使うと満足度を落とさないが、上方向（成功者への罰）に
//     使うとプレイヤーは「ズルされた」と感じる。→ 本作の自動調整を**下方向のみ**に限定。
//   ・Baldwin, Johnson & Wyeth (2014) ほか、隠れた調整は気づかれると不信を生む。
//     → 補助が働いたときは「サポートモード」として**明示表示**する。
//
// ── 目標値（この数値表が満たすべき仕様）──────────────────────────────
//   ・章1〜2 の初回クリア率: 約85%（Lomas et al. の「易しめが最適」に合わせる）
//   ・章3〜6 の初回クリア率: 約70%（フロー帯の中心）
//   ・章7〜8 の初回クリア率: 約55%（達成感のピークを最終章に置く）
//   ・基本ネコ（近接・進化前 HP60）が敵大砲の集中砲火で倒れるまで **どの章でも4秒以上**。
//     根拠: 8〜10歳の選択反応時間は成人より有意に遅い (Kail 1991 の発達的処理速度研究;
//     Der & Deary 2006)。観察→判断→タップの1サイクルに現実的な余裕を残すには
//     2秒台では足りない。※実測値は `docs/CATWARS_DESIGN.md` の表を参照。

export type EnemyUnitKind = 'grunt' | 'shooter' | 'runner' | 'brute' | 'flyer' | 'boss';

/** 敵ウェーブ兵の基礎ステータス（章の倍率をかける前の素の値） */
export const ENEMY_UNIT_STATS: Record<EnemyUnitKind, {
  subType: string;      // 描画に使うスプライト系統
  label: string;
  hp: number;
  damage: number;
  attackRange: number;
  attackSpeed: number;  // ms/攻撃
  moveSpeed: number;
}> = {
  grunt:   { subType: 'barbarian',     label: 'ノラ兵',     hp: 70,  damage: 10, attackRange: 1.2, attackSpeed: 1200, moveSpeed: 2.0 },
  shooter: { subType: 'archer',        label: 'スナイパー', hp: 50,  damage: 8,  attackRange: 3.0, attackSpeed: 1300, moveSpeed: 2.3 },
  runner:  { subType: 'speed',         label: 'かけぬけ兵', hp: 45,  damage: 9,  attackRange: 1.2, attackSpeed: 900,  moveSpeed: 3.4 },
  brute:   { subType: 'giant',         label: '重装ロボ',   hp: 220, damage: 18, attackRange: 1.3, attackSpeed: 1500, moveSpeed: 1.4 },
  flyer:   { subType: 'flying',        label: '飛行ドローン', hp: 90, damage: 14, attackRange: 1.4, attackSpeed: 1100, moveSpeed: 3.0 },
  boss:    { subType: 'boss_overlord', label: '皇帝の親衛隊', hp: 700, damage: 45, attackRange: 1.8, attackSpeed: 2400, moveSpeed: 0.9 },
};

export interface ChapterDifficulty {
  /** 敵ウェーブ兵のHP倍率 */
  enemyHpMult: number;
  /** 敵ウェーブ兵の攻撃力倍率 */
  enemyDamageMult: number;
  /** 敵の防衛施設（大砲・テスラ）の威力倍率。⑥の体感難易度を直接決める値 */
  defenseDamageMult: number;
  /** 敵の防衛施設のHP倍率 */
  defenseHpMult: number;
  /** 最初のウェーブまでの猶予(ms)。序盤ほど長く取り、まず攻める体験を保証する */
  firstWaveDelayMs: number;
  /** ウェーブ間隔(ms) */
  waveIntervalMs: number;
  /** 1ウェーブの体数（最初） */
  waveSize: number;
  /** 1ウェーブの体数（上限。ウェーブが進むと増える） */
  waveSizeMax: number;
  /** この章に出てくる敵の種類 */
  unitPool: EnemyUnitKind[];
  /** このウェーブ番号でボスが1体だけ出現する（未設定ならボスなし） */
  bossAtWave?: number;
  /** 戦闘開始時に持っている⚡ */
  startEnergy: number;
  /** ⚡の自然回復（毎秒） */
  energyPerSec: number;
}

export interface CampaignChapter {
  id: string;
  no: number;
  /** 戦いのタイトル */
  title: string;
  /** 敵の名前 */
  enemyName: string;
  /** 敵の肩書き */
  enemyTitle: string;
  /** 敵の背景（2文程度・小4が読める語彙） */
  background: string;
  /** 戦闘内容に関する非常に簡単な文 */
  briefing: string;
  /** 戦術のヒント1行 */
  hint: string;
  victoryLine: string;
  defeatLine: string;
  mapId: string;
  difficulty: ChapterDifficulty;
  /** 勝利時の💠クレジット */
  rewardCredits: number;
}

export const CAMPAIGN: CampaignChapter[] = [
  {
    id: 'ch1', no: 1,
    title: '月のはずれの前哨基地',
    enemyName: 'ガラクタ隊長',
    enemyTitle: 'ノラボット隊 隊長',
    background: '宇宙にすてられたガラクタが集まって生まれたロボネコ。ひろった部品を勝手に組み立てて、月のはずれに小さな基地をつくってしまった。',
    briefing: 'まもりの設備はまだ無い。ネコを出して、まっすぐコアをこわそう。',
    hint: '⚡がへったら「📚といて⚡」で問題をとくと、すぐに補給できるよ。',
    victoryLine: 'ガラクタ隊長はバラバラになって逃げていった。宇宙への第一歩だ！',
    defeatLine: 'つぎはもっとたくさんネコを出してみよう。',
    mapId: 'map-outpost',
    difficulty: {
      enemyHpMult: 0.7, enemyDamageMult: 0.6,
      defenseDamageMult: 0.6, defenseHpMult: 0.7,
      firstWaveDelayMs: 45000, waveIntervalMs: 36000,
      waveSize: 1, waveSizeMax: 1, unitPool: ['grunt'],
      startEnergy: 260, energyPerSec: 1.6,
    },
    rewardCredits: 300,
  },
  {
    id: 'ch2', no: 2,
    title: 'クレーター峡谷のふたご',
    enemyName: 'ミギー＆ヒダリー',
    enemyTitle: 'ふたごの見張り番',
    background: 'いつもケンカばかりしている双子の見張りネコ。ふたりで峡谷の上の道と下の道を1本ずつ守っている。',
    briefing: '道が2本ある。大砲が待ちかまえている道と、あいている道を見きわめよう。',
    hint: '大砲は岩のむこうがわは撃てない。岩のかげを通ればあんぜんだよ。',
    victoryLine: 'ふたごは「おまえのせいだ！」とケンカしながら退散した。',
    defeatLine: '2本の道を、べつべつに攻めてみるのはどうかな？',
    mapId: 'map-canyon',
    difficulty: {
      enemyHpMult: 0.8, enemyDamageMult: 0.7,
      defenseDamageMult: 0.7, defenseHpMult: 0.8,
      firstWaveDelayMs: 40000, waveIntervalMs: 32000,
      waveSize: 1, waveSizeMax: 2, unitPool: ['grunt', 'shooter'],
      startEnergy: 240, energyPerSec: 1.5,
    },
    rewardCredits: 380,
  },
  {
    id: 'ch3', no: 3,
    title: '隕石王のなわばり',
    enemyName: 'ロックニャン',
    enemyTitle: '隕石王',
    background: '隕石をあやつって自分のなわばりをつくる、いばりんぼうのネコ。中央に大きな隕石のかべを積み上げて通せんぼしている。',
    briefing: '中央の隕石はこわせない。上か下から回りこんで、敵のコアをねらおう。',
    hint: 'タンク系（ニャイアント）を先に出すと、大砲がタンクをねらってくれる。',
    victoryLine: '隕石王のなわばりは、こなごなにくずれ落ちた。',
    defeatLine: 'タンク系を先に出して、大砲のねらいを引きつけてみよう。',
    mapId: 'map-grassland',
    difficulty: {
      enemyHpMult: 0.9, enemyDamageMult: 0.85,
      defenseDamageMult: 0.8, defenseHpMult: 0.9,
      firstWaveDelayMs: 35000, waveIntervalMs: 28000,
      waveSize: 2, waveSizeMax: 2, unitPool: ['grunt', 'shooter'],
      startEnergy: 220, energyPerSec: 1.4,
    },
    rewardCredits: 460,
  },
  {
    id: 'ch4', no: 4,
    title: '鉄壁のヨロイニャン',
    enemyName: 'ヨロイニャン',
    enemyTitle: '要塞の守備隊長',
    background: '「まもりこそ最強」が口ぐせの、かたい鎧を着たネコ。自分の基地を分厚い装甲壁でぐるりと囲んでしまった。',
    briefing: 'コアは壁の中。壁をこわして進むか、飛行系で壁をこえよう。',
    hint: '爆発系（ボムニャー）は建物に大ダメージ。壁をこわす係にぴったり。',
    victoryLine: '「まもりだけでは勝てない」。ヨロイニャンは静かにうなずいた。',
    defeatLine: '壁をこわす係と、コアをねらう係を分けてみよう。',
    mapId: 'map-fortress',
    difficulty: {
      enemyHpMult: 1.0, enemyDamageMult: 0.95,
      defenseDamageMult: 0.9, defenseHpMult: 1.0,
      firstWaveDelayMs: 32000, waveIntervalMs: 25000,
      waveSize: 2, waveSizeMax: 3, unitPool: ['grunt', 'shooter', 'runner'],
      startEnergy: 200, energyPerSec: 1.3,
    },
    rewardCredits: 550,
  },
  {
    id: 'ch5', no: 5,
    title: '軌道ブリッジの番人',
    enemyName: 'ブリッジャ',
    enemyTitle: '橋の番人',
    background: '軌道ブリッジの通行料をとって暮らしているネコ。橋は2本しかないと知っていて、その両方に大砲をすえつけた。',
    briefing: '橋の上ではネコが1列にならぶ。まとめて出しすぎると、まとめてやられるよ。',
    hint: '2本の橋に部隊を分けると、大砲のダメージも半分ずつになる。',
    victoryLine: '通行料はもう不要。橋はみんなのものになった。',
    defeatLine: '1本の橋に集めすぎたかも。左右に分けて渡ってみよう。',
    mapId: 'map-river',
    difficulty: {
      enemyHpMult: 1.05, enemyDamageMult: 1.0,
      defenseDamageMult: 1.0, defenseHpMult: 1.05,
      firstWaveDelayMs: 30000, waveIntervalMs: 22000,
      waveSize: 2, waveSizeMax: 3, unitPool: ['grunt', 'shooter', 'runner'],
      startEnergy: 190, energyPerSec: 1.25,
    },
    rewardCredits: 650,
  },
  {
    id: 'ch6', no: 6,
    title: '重力沼のグラビニャ',
    enemyName: 'グラビニャ',
    enemyTitle: '重力使い',
    background: '重力をあやつって、あたり一面を歩きにくい沼に変えてしまったネコ。沼の中では、どんなに足のはやいネコもゆっくりになる。',
    briefing: '中央の沼はとおれるけど、おそくなる。左右の道を通るほうがはやいかも。',
    hint: '沼の上は大砲に長くねらわれる。HPの高いタンク系なら渡りきれる。',
    victoryLine: '重力がもとにもどり、ネコたちの足どりが軽くなった。',
    defeatLine: '沼を避けて、左右のはしを通ってみよう。',
    mapId: 'map-swamp',
    difficulty: {
      enemyHpMult: 1.1, enemyDamageMult: 1.05,
      defenseDamageMult: 1.1, defenseHpMult: 1.1,
      firstWaveDelayMs: 28000, waveIntervalMs: 20000,
      waveSize: 3, waveSizeMax: 3, unitPool: ['grunt', 'shooter', 'brute'],
      startEnergy: 180, energyPerSec: 1.2,
    },
    rewardCredits: 780,
  },
  {
    id: 'ch7', no: 7,
    title: '星くだきアステロ',
    enemyName: 'アステロ',
    enemyTitle: '小惑星帯の破壊者',
    background: '小惑星をくだいて宇宙をちらかす、あばれんぼうのネコ。岩と沼のふくざつな地形を、自分の庭のように使いこなす。',
    briefing: '岩・沼・大砲、ぜんぶある。どのルートが一番はやいか考えよう。',
    hint: '飛行系は壁も岩も気にしない。ただし大砲からはかくれられない。',
    victoryLine: 'ちらかった小惑星帯に、しずかな星の光がもどった。',
    defeatLine: 'ルートを変えるか、部隊の組み合わせを変えてみよう。',
    mapId: 'map-cliffs',
    difficulty: {
      enemyHpMult: 1.2, enemyDamageMult: 1.15,
      defenseDamageMult: 1.2, defenseHpMult: 1.15,
      firstWaveDelayMs: 26000, waveIntervalMs: 18000,
      waveSize: 3, waveSizeMax: 4, unitPool: ['grunt', 'shooter', 'runner', 'flyer'],
      startEnergy: 170, energyPerSec: 1.15,
    },
    rewardCredits: 920,
  },
  {
    id: 'ch8', no: 8,
    title: '銀河皇帝ニャースベイダー',
    enemyName: 'ニャースベイダー',
    enemyTitle: '銀河皇帝',
    background: '黒いマントをまとった銀河の支配者。三重の防衛線をもつ最終要塞シタデルの奥で、じっとこちらを見つめている。',
    briefing: '大砲もテスラもいちばん多い。あわてずに、少しずつ防衛をけずっていこう。',
    hint: 'とちゅうで「皇帝の親衛隊」が出てくる。ヒール・レイジは、そこまで残しておこう。',
    victoryLine: '銀河にへいわがもどった。きみとネコ軍団の伝説がはじまる。',
    defeatLine: 'ここまで来たらもう一息。⚡をためてから一気に攻めこもう。',
    mapId: 'map-citadel',
    difficulty: {
      enemyHpMult: 1.3, enemyDamageMult: 1.2,
      defenseDamageMult: 1.3, defenseHpMult: 1.25,
      firstWaveDelayMs: 24000, waveIntervalMs: 16000,
      waveSize: 3, waveSizeMax: 4, unitPool: ['grunt', 'shooter', 'brute', 'flyer'],
      bossAtWave: 4,
      startEnergy: 180, energyPerSec: 1.2,
    },
    rewardCredits: 1200,
  },
];

export const CHAPTER_BY_ID: Record<string, CampaignChapter> =
  Object.fromEntries(CAMPAIGN.map(c => [c.id, c]));

// ── 章内の自動微調整（サポートモード）────────────────────────────────────
// Hunicke (2005) / Baldwin et al. (2014) に従い、**下方向のみ**・**明示表示つき**。
// 成功しているプレイヤーを難しくすること（上方向のDDA）は一切行わない。
export interface AssistLevel {
  level: 0 | 1 | 2;
  label: string;
  /** 敵の防衛施設と兵の与ダメージにかける倍率 */
  damageMult: number;
  /** ウェーブ間隔にかける倍率（大きいほど敵が来にくい） */
  waveIntervalMult: number;
  /** 開始⚡に加算 */
  bonusEnergy: number;
  description: string;
}

export const ASSIST_LEVELS: Record<0 | 1 | 2, AssistLevel> = {
  0: { level: 0, label: '', damageMult: 1, waveIntervalMult: 1, bonusEnergy: 0, description: '' },
  1: {
    level: 1, label: 'サポートモード',
    damageMult: 0.85, waveIntervalMult: 1.2, bonusEnergy: 60,
    description: '敵の攻撃が すこし弱くなり、⚡を多めに持ってスタートするよ。',
  },
  2: {
    level: 2, label: 'サポートモード＋',
    damageMult: 0.7, waveIntervalMult: 1.4, bonusEnergy: 140,
    description: '敵の攻撃がかなり弱くなり、援軍も来にくくなるよ。あきらめずにいこう！',
  },
};

/** 連敗数 → サポート段階。2連敗でLv1、4連敗でLv2。勝てば0に戻る。 */
export function assistLevelForLosses(consecutiveLosses: number): 0 | 1 | 2 {
  if (consecutiveLosses >= 4) return 2;
  if (consecutiveLosses >= 2) return 1;
  return 0;
}

/** サポート段階を反映した実効難易度を返す */
export function effectiveDifficulty(ch: CampaignChapter, assist: 0 | 1 | 2): ChapterDifficulty {
  const a = ASSIST_LEVELS[assist];
  const d = ch.difficulty;
  return {
    ...d,
    enemyDamageMult: d.enemyDamageMult * a.damageMult,
    defenseDamageMult: d.defenseDamageMult * a.damageMult,
    firstWaveDelayMs: Math.round(d.firstWaveDelayMs * a.waveIntervalMult),
    waveIntervalMs: Math.round(d.waveIntervalMs * a.waveIntervalMult),
    startEnergy: d.startEnergy + a.bonusEnergy,
  };
}
