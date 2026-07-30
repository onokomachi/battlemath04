# CAT-WARS PvP：ロックステップ同期のベストプラクティス

CAT-WARS にリアルタイム対戦を入れる場合の設計指針。
一般論だけでなく、**このリポジトリの現状コードを実測した結果**にもとづいて
「何を直せば動くのか」を具体的に示す。

---

## 0. 結論（先に読む用）

- CAT-WARS は構造的にロックステップ向き。同期すべきは**キャラの座標ではなくコマンド**。
- ただし現状の `BattleScene.tsx` は **決定論的ではない**。実測で18箇所の `Date.now()`、
  1箇所の `Math.random()`、フレームレート依存の移動処理があり、このままでは
  2台の端末で必ず結果がズレる。
- 対応の本体は「ネットワークを書くこと」ではなく **シミュレーションを決定論にすること**。
  ここが8割で、通信部分は2割。
- 決定論化は**単体プレイのままでも価値がある**（リプレイ・自動テスト・
  フレームレート非依存の挙動）。PvPを作らない判断をしても無駄にならない。

---

## 1. ロックステップとは何か

状態（各キャラのHPや座標）を送らず、**入力（コマンド）だけ**を送り、
全クライアントが同じロジックで同じ順序で再計算する方式。

```
❌ 状態同期:  「にゃばりあんA が (12.34, 5.67) にいて HP 42」を毎フレーム送る
✅ ロックステップ: 「tick 120 で にゃばりあん を (3,7) に出撃」だけを送る
```

RTS（Age of Empires 以来）で使われてきた古典的な手法。CAT-WARS が向いている理由：

| 条件 | CAT-WARS の状況 |
|---|---|
| 入力が離散的なコマンド | ✅ 出撃・移動命令・呪文・建設だけ |
| 1秒あたりの入力が少ない | ✅ 多くて数回／秒 |
| 単位数が多い | ✅ 状態同期だと帯域が破綻するので、むしろロックステップ有利 |
| 数百msの遅延が許容される | ✅ 出撃系は 200〜300ms 遅れても体感に出ない |
| 乱数を使う | ⚠️ `SeededRNG` があるので土台はある（後述の条件つき） |

---

## 2. 三原則

### 原則1：同じ入力 → 同じ出力（決定論）

これが崩れると、他のすべてが無意味になる。最優先。

### 原則2：固定タイムステップ

シミュレーションは**フレームレートと切り離した固定間隔**（例: 20Hz = 50ms/tick）で進める。
描画は 60fps のまま、tick 間を補間して滑らかに見せる。

### 原則3：入力は未来に予約する

いま押した操作を**いま**実行してはいけない。`現在tick + 遅延` の tick で実行する。
そうしないと、相手のコマンドが届く前に自分だけ進んでしまう。

---

## 3. 決定論を壊すもの（このリポジトリの実測）

`catwars/components/game/BattleScene.tsx` および `catwars/utils/` を調査した結果。

### 3-1. 実測した違反箇所

| 種類 | 箇所数 | 判定 | 対応 |
|---|---|---|---|
| `Date.now()` | 18 | ❌ 致命的 | tick カウンタに置換 |
| `Math.random()` | 1 | ❌ 致命的 | `SeededRNG` に置換 |
| `Math.pow()` | 18 | ❌ 危険 | 距離計算は乗算に置換 |
| `Math.hypot()` | 5 | ❌ 危険 | 乗算＋`Math.sqrt` に置換 |
| `Math.atan2()` | 3 | ❌ 危険 | 経路ベクトルの正規化に置換 |
| `Math.cos()` / `Math.sin()` | 各3 | ❌ 危険 | 同上 |
| `Math.sqrt()` | 11 | ✅ 安全 | そのままでよい |
| `requestAnimationFrame` 駆動 | 全体 | ❌ 致命的 | 固定タイムステップへ |

### 3-2. 「危険」の根拠 — JavaScript の数学関数は2種類ある

ECMAScript 仕様では：

- **`+` `-` `*` `/` `Math.sqrt()`** は IEEE 754 で**正しく丸めることが要求**されている。
  → どのエンジン・どのCPUでも**ビット単位で同じ結果**。安全。
- **`Math.sin` `Math.cos` `Math.atan2` `Math.pow` `Math.hypot` `Math.exp` `Math.log`** は
  仕様上 *implementation-approximated*（実装依存の近似でよい）。
  → V8 / JavaScriptCore（iPad Safari）/ 同じV8でもバージョン差で
  **最下位ビットが変わりうる**。

CAT-WARS の想定環境は「学校のiPad（Safari/JavaScriptCore）」と
「PCのChrome（V8）」が混在しうるので、これは理論上の話ではなく実害になる。

**最下位ビット1つの差が、なぜ致命的になるか**：

```
tick 100: A機 距離 = 3.2000000000000002 → 攻撃範囲 3.2 の判定が false
          B機 距離 = 3.1999999999999997 → 同じ判定が true
tick 101: B機だけ攻撃が発生 → HPが違う → ターゲット選択が変わる → 完全に別のゲームになる
```

浮動小数点の誤差は「だいたい合っていればいい」ではなく、
**比較の境界をまたいだ瞬間に離散的な分岐の差になり、そこから指数的に発散する**。

### 3-3. 具体的な書き換え例

```ts
// ❌ 現状（catwars/components/game/BattleScene.tsx:1003 付近）
const dist = Math.sqrt(Math.pow(t.x - entity.x, 2) + Math.pow(t.y - entity.y, 2));

// ✅ Math.pow を排除（速度も上がる）
const dx = t.x - entity.x, dy = t.y - entity.y;
const dist = Math.sqrt(dx * dx + dy * dy);
```

```ts
// ❌ 現状（BattleScene.tsx:1225 付近）三角関数で方向を出している
const angle = Math.atan2(dy, dx);
entity.x += Math.cos(angle) * speed;
entity.y += Math.sin(angle) * speed;

// ✅ 三角関数を経由せず、ベクトルを正規化するだけで同じことができる
const len = Math.sqrt(dx * dx + dy * dy);
if (len > 0) {
  entity.x += (dx / len) * speed;
  entity.y += (dy / len) * speed;
}
```

> 補足：`atan2 → cos/sin` は数学的には「正規化」と同一で、**遠回りなうえに
> 非決定的**。決定論と関係なく、いま直しても損はない。

### 3-4. さらに厳密にやるなら：固定小数点

上記でも「JSの `double` 演算は IEEE 754 準拠なので同じ」という前提に依存する。
これは実務上ほぼ成り立つが、絶対の保証が欲しければ**整数（固定小数点）**にする。

```ts
// 1マス = 1024 単位として整数で持つ
type Fixed = number;               // 実体は整数
const ONE: Fixed = 1024;
const toFixed = (n: number): Fixed => Math.round(n * ONE);
const mul = (a: Fixed, b: Fixed): Fixed => Math.floor((a * b) / ONE);
```

**推奨**：CAT-WARS の規模（小学生向け・厳密な競技性は不要）なら
**まず double のまま原則2・3を守り、チェックサムでズレを検出する**方針で十分。
固定小数点化は、実際にデシンクが観測されてから着手すればよい（早すぎる最適化）。

---

## 4. 固定タイムステップへの移行

### 4-1. いまの問題

```ts
// BattleScene.tsx:1277
const moveStep = currentMoveSpeed * 0.013;   // ← 「1フレームあたり」の移動量
```

これは `requestAnimationFrame` ごとに適用されるので、
**120Hz の iPad Pro では 60Hz の端末のちょうど2倍の速さで動く**。
PvP以前に、単体プレイでも端末による有利不利が出ている実バグ。

### 4-2. 移行後の形

```ts
const TICK_MS = 50;                    // 20Hz
const TICKS_PER_SEC = 1000 / TICK_MS;

let accumulator = 0;
let lastReal = performance.now();

function frame() {                     // 描画は 60fps のまま
  const nowReal = performance.now();
  accumulator += Math.min(250, nowReal - lastReal);   // タブ復帰時の暴走を防ぐ上限
  lastReal = nowReal;

  while (accumulator >= TICK_MS) {
    if (!canAdvance(currentTick)) break;   // ← 相手のコマンド待ち（§5）
    simulateOneTick(currentTick);          // ここだけが「ゲーム状態」を変える
    currentTick++;
    accumulator -= TICK_MS;
  }

  render(currentTick, accumulator / TICK_MS);  // 補間して滑らかに描く
  requestAnimationFrame(frame);
}
```

移動量は「秒あたり」で定義し直す：

```ts
// moveSpeed をマス/秒として、1tickぶんに換算する
const moveStep = entity.moveSpeed / TICKS_PER_SEC;
```

### 4-3. `Date.now()` の置換

`entity.lastAttack` などの時刻はすべて **tick 番号**にする。

```ts
// ❌ if (now - entity.lastAttack > entity.attackSpeed)
// ✅
const attackCooldownTicks = Math.round(entity.attackSpeed / TICK_MS);
if (currentTick - entity.lastAttackTick >= attackCooldownTicks) { ... }
```

エンティティIDも `Date.now()` ベースをやめる：

```ts
// ❌ id: `wave-${Date.now()}-${i}`
// ✅ 決定論的な連番（両クライアントで同じIDになる）
id: `e-${entityCounter++}`
```

> **重要**：UIの `setTimeout(() => setTriggerMessage(null), 2200)` のような
> **見た目だけの処理は `Date.now()` のままでよい**。決定論が必要なのは
> 「ゲーム状態を変える計算」だけ。ここを分離できるかが設計の勘所。

---

## 5. 入力遅延（Input Delay）

### 5-1. 仕組み

プレイヤーが tick 100 で操作したら、実行は **tick 100 + DELAY**。
DELAY のあいだに相手へコマンドが届く。

```ts
const INPUT_DELAY_TICKS = 6;   // 50ms × 6 = 300ms

function onPlayerDeploy(unitId: string, x: number, y: number) {
  const execTick = currentTick + INPUT_DELAY_TICKS;
  const cmd = { tick: execTick, player: myId, type: 'DEPLOY', unitId, x, y };
  localQueue.push(cmd);          // 自分もこのtickまで実行しない
  sendToNetwork(cmd);            // 相手に送る
}
```

### 5-2. 「コマンドが無い」ことも送る必要がある

ロックステップの落とし穴。**相手が何もしなかった tick でも「何もしない」を明示**しないと、
「まだ届いていない」のか「操作しなかった」のか区別できず、永久に待つ。

```ts
// 毎tick、必ず何かを送る（空でもよい）
sendToNetwork({ tick: execTick, player: myId, commands: pending });  // pending は [] でもよい

function canAdvance(tick: number): boolean {
  // 両プレイヤーぶんのコマンド（空を含む）が揃ってはじめて進める
  return receivedCommands.has(`${tick}:p1`) && receivedCommands.has(`${tick}:p2`);
}
```

送信量を減らすなら「4tickまとめて1回送る」（バッチ）が定石。
20Hz × 2人でも、まとめれば毎秒5メッセージ程度に収まる。

### 5-3. DELAY の決め方

```
INPUT_DELAY_TICKS × TICK_MS  >  往復遅延(RTT) の実測値
```

Firebase Realtime Database の実測はおおむね 50〜150ms（地域とネットワーク次第）。
往復で 100〜300ms を見込み、**300ms（6tick）を初期値**にする。

RTT を計測して 4〜10 tick の範囲で動的に調整するとなおよい。ただし
**変更は両者が合意した tick から**適用すること（片側だけ変えると即デシンク）。

### 5-4. ロールバックは要らない

格闘ゲームで使われる rollback netcode（予測して外れたら巻き戻す）は、
実装コストが input delay の数倍。CAT-WARS の操作（部隊を出す・移動を指示する）は
300ms の遅延が体感に出ないので、**input delay で十分**。

---

## 6. デシンク検出

決定論は「守ったつもり」でよく破れる。**必ず検出機構を入れる。**

```ts
// 20tick（1秒）ごとに、状態のハッシュを送り合う
function stateChecksum(entities: BattleEntity[]): number {
  let h = 2166136261 >>> 0;                       // FNV-1a
  // ⚠️ 配列順が両者で同じ保証が要る。IDでソートしてから畳む
  for (const e of [...entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    for (const v of [Math.round(e.x * 1000), Math.round(e.y * 1000), Math.round(e.hp)]) {
      h = Math.imul(h ^ (v & 0xff), 16777619) >>> 0;
      h = Math.imul(h ^ ((v >> 8) & 0xff), 16777619) >>> 0;
      h = Math.imul(h ^ ((v >> 16) & 0xff), 16777619) >>> 0;
    }
  }
  return h >>> 0;
}
```

- 一致しない → その場で試合を打ち切り、**両者に同じ結果**（引き分け等）を出す。
  片方だけ「勝ち」にしてはいけない。
- 開発中は、直前 N tick のコマンド列をログに残しておくと原因追跡ができる。
- `Math.round(e.x * 1000)` のように**丸めてから**ハッシュするのがコツ。
  生の double をそのまま入れると、無害な誤差でも検出が暴発する。

---

## 7. Firebase へのマッピング

### 7-1. どのプロダクトを使うか

| 用途 | 選択 | 理由 |
|---|---|---|
| マッチメイキング・部屋管理 | **Firestore** | 既存の `usePvpConnection.ts` をそのまま流用できる |
| tick ごとのコマンド配送 | **Realtime Database** | 低遅延・帯域課金でこの用途に合う |
| 戦績の確定・保存 | **Firestore + Cloud Functions** | 権威づけと集計 |

Firestore は「ドキュメント単位のCRUD」向けで、毎秒数回の細かい書き込みには
課金・遅延の両面で不利。**コマンド配送だけ Realtime Database に分ける**のが要点。

### 7-2. データ構造

```
/matches/{matchId}
  meta:    { seed: 928374, mapId: "map-canyon", p1: uid, p2: uid, startedAt }
  ticks/
    {tickBucket}/                     ← 4tickごとのバケット
      {uid}: { cmds: [...], sum: 3847261 }
```

```ts
// 送信（バケット単位でまとめる）
await set(ref(rtdb, `matches/${matchId}/ticks/${bucket}/${myUid}`), {
  cmds: pendingCommands,
  sum: checksumAtBucketStart,
});

// 受信
onChildAdded(ref(rtdb, `matches/${matchId}/ticks`), snap => {
  const bucket = Number(snap.key);
  const data = snap.val();
  for (const [uid, payload] of Object.entries(data)) {
    enqueueCommands(bucket, uid, payload.cmds);
    verifyChecksum(bucket, uid, payload.sum);
  }
});
```

### 7-3. `seed` は必ずサーバー側で決める

```ts
// ❌ クライアントが決めると、有利な乱数を引くまで作り直せてしまう
// ✅ 部屋作成時に Cloud Functions（または serverTimestamp 由来）で確定させ、
//    両者はそれを読むだけにする
rngRef.current = new SeededRNG(match.meta.seed);
```

現状の `rngRef.current = new SeededRNG(Date.now())`（BattleScene.tsx:317）は
そもそも両端末で違う値になるので、PvP では必ず置換が必要。

### 7-4. `SeededRNG` の注意点

`catwars/utils/random.ts` の LCG（`seed * 9301 + 49297 % 233280`）は
**決定論的ではあるが、周期が短く品質は低い**。
より重要なのは以下：

- **乱数を引く順序が両者で完全に一致していなければならない。**
  「描画のためにちょっと乱数を使う」ようなコードが1箇所あるだけで壊れる。
- → **シミュレーション用RNGと演出用RNGを別インスタンスに分ける**こと。
  現状 `rngRef` は出撃ジッター（sim）とヒットエフェクトID（演出）の両方で
  使われており（BattleScene.tsx:1180 付近の `fx-${now}-${rngRef.current.next()}`）、
  この分離は必須。

---

## 8. 切断・遅延クライアントの扱い

ロックステップの最大の弱点：**いちばん遅い1台に全員が引きずられる**。

```ts
const STALL_WARN_MS  = 1500;   // 「相手を待っています…」を出す
const STALL_DROP_MS  = 10000;  // 切断とみなす

if (waitingSince && now - waitingSince > STALL_DROP_MS) {
  // 既存の leaveRoom() と同じ考え方で、残っている側を勝者にする
  await declareWinnerByTimeout(matchId, myUid);
}
```

- 待ち状態は**必ずUIに出す**（無言のフリーズが最悪の体験）。
  小学生向けなら「あいてを まっています…」のような明示が要る。
- 既存の `usePvpConnection.ts` にあるハートビート（30秒間隔）と
  ゾンビルーム掃除のロジックは、そのまま流用できる。
  ただし**10秒程度に短縮**しないとロックステップの停止に対して遅すぎる。

---

## 9. テスト戦略

決定論はテストしないと必ず壊れる。以下は CI に入れられる。

### 9-1. リプレイ一致テスト（最重要・PvPなしでも書ける）

```ts
// 同じ seed + 同じコマンド列 → 同じチェックサム、を2回実行して比較
const cmds = generateRandomCommandScript(seed);
const a = runHeadlessSimulation({ seed, mapId, cmds, ticks: 2000 });
const b = runHeadlessSimulation({ seed, mapId, cmds, ticks: 2000 });
expect(a.checksums).toEqual(b.checksums);
```

これを通すには、シミュレーションを React から切り離して
**純粋関数 `simulateOneTick(state, commands) => state`** にする必要がある。
この切り出しが、PvP対応で最も大きなリファクタリングになる。

### 9-2. 可変フレームレート耐性テスト

```ts
// 実時間の刻み方を変えても、tick結果が同一であることを確認
const steady  = run({ frameDeltas: Array(600).fill(16.7) });
const jittery = run({ frameDeltas: randomDeltas(600, 5, 120) });
expect(steady.checksums).toEqual(jittery.checksums);
```

### 9-3. 2インスタンス同時実行テスト

Playwright で2つのページを開き、同じ部屋に入れて 60 秒対戦させ、
双方のチェックサムログが全 tick で一致することを確認する。
（このリポジトリには既にヘッドレスChromiumでの検証実績があるので流用できる）

---

## 10. 段階的な移行計画

いきなり全部やらない。各段階が**単独で価値を持つ**ように並べている。

| 段階 | 内容 | 単体プレイへの利益 | 規模 |
|---|---|---|---|
| **1** | 非決定的な数学関数を排除（`pow`/`hypot`/`atan2`/`cos`/`sin`） | 計算が速くなる | 小 |
| **2** | 固定タイムステップ化、`Date.now()` → tick | **端末による速度差のバグが直る** | 中 |
| **3** | シミュレーションを React から純粋関数に切り出す | リプレイ機能・自動テストが可能に | **大** |
| **4** | リプレイ一致テストを CI に入れる | 回帰を防げる | 小 |
| **5** | コマンドキュー＋input delay（ローカル2人で検証） | — | 中 |
| **6** | Firebase RTDB でコマンド配送、チェックサム検証 | — | 中 |
| **7** | 切断・スタール処理、結果の権威づけ | — | 小 |

**段階1〜4だけでも実施する価値がある。** 特に段階2は、いま存在している
「高リフレッシュレート端末でゲームが速く進む」バグの修正そのもの。

---

## 11. 代替案：非同期PvP（実装コスト 1/5 程度）

同期対戦にこだわらないなら、こちらが圧倒的に安い。

- 相手プレイヤーが `BaseBuilder` で組んだ**陣地の構成だけ**を Firestore に保存する。
- 挑戦者はそれを読み込み、**自分の端末だけで**単体プレイと同じ戦闘を行う。
- 結果（勝敗・残りHP）を記録し、ランキングや「しかえし」に使う。

| | ロックステップ同期 | 非同期PvP |
|---|---|---|
| 決定論の要求 | **必須** | 不要 |
| ネットワーク遅延の影響 | 大きい | **なし** |
| 既存コードの再利用 | 大改修が必要 | **ほぼそのまま** |
| Firestore 書き込み量 | 中 | **極小**（1試合数回） |
| リアルタイムの緊張感 | ある | ない |

Clash of Clans が採用している方式で、**「友だちの陣地を攻略する」という
遊びの核は十分に成立する**。まずこちらを実装し、
子どもの反応を見てから同期対戦に進むのが現実的な順序。

---

## 12. 参考

- Bernier, Y. (2001) *Latency Compensating Methods in Client/Server In-game Protocol
  Design and Optimization* — クライアント予測／遅延補償の基礎文献
- Terrano, M. & Bettner, P. (2001) *1500 Archers on a 28.8: Network Programming in
  Age of Empires and Beyond* — RTS ロックステップの原典。本書の設計はここに準拠
- Fiedler, G. *Fix Your Timestep!* — 固定タイムステップと描画補間の定番解説
- ECMAScript 仕様 `Math` 節 — `sqrt` は正しく丸められ、`sin`/`cos`/`pow` 等は
  実装依存の近似であることの根拠

---

# 実装状況（本リポジトリ）

上記の設計指針にもとづき、**段階1〜7をすべて実装ずみ**。

## 追加されたファイル

| ファイル | 役割 |
|---|---|
| `catwars/sim/rng.ts` | mulberry32。整数演算のみなので全エンジンでビット単位一致 |
| `catwars/sim/math.ts` | `pow`/`hypot`/`atan2`/`cos`/`sin` を排した距離・正規化 |
| `catwars/sim/pathfind.ts` | 全順序 (f,h,y,x) の二分ヒープA*。g値更新も修正し最短を返す |
| `catwars/sim/types.ts` | `SimState` / `SimCommand` / `SimEvent` / `SimConfig` |
| `catwars/sim/simulate.ts` | `simulateTick()`。戦闘ロジック本体（React非依存の純粋関数） |
| `catwars/sim/setup.ts` | 進化段階・バフを試合開始時に解決して `SimConfig` へ焼き込む |
| `catwars/sim/checksum.ts` | ID順ソート＋量子化 FNV-1a、デシンク時のダンプ |
| `catwars/sim/runner.ts` | 20Hz固定タイムステップのアキュムレータ駆動 |
| `catwars/net/transport.ts` | トランスポート抽象＋テスト用インメモリ実装 |
| `catwars/net/lockstep.ts` | 入力遅延・tickバリア・デシンク検出・スタール検知 |
| `catwars/net/firebaseTransport.ts` | RTDBによるバケット配送、サーバー確定seed |
| `scripts/simTest.ts` | 決定論テスト一式（`npm run test:sim`） |

## 設計上の要点

- **同期するのはコマンドのみ**。座標・HPは一切送らない。
- **PvE と PvP は同じコードを通る**。違いは「P2の行動をAIが決めるか、
  ネットワーク越しのコマンドが決めるか」だけ（`SimConfig.mode`）。
  結果として、ソロプレイもリプレイ・自動テストの対象になる。
- **入力遅延 > バケット長 + 片道遅延** が成立条件。
  `recommendedInputDelayTicks()` がこの不等式から値を出す。
- 進化段階やデイリーバフは端末ごとに違うので、**試合開始時に解決して
  `SimConfig` に焼き込む**。シミュレーション中にストアを参照しない。
- 演出（弾道・ヒットエフェクト・メッセージ・音）は `SimEvent` として
  分離。演出を変えてもシミュレーションの一致性は壊れない。

## 直った既存バグ

固定タイムステップ化にともない、**単体プレイに存在していた実バグ**も解消した。

- 旧実装は `requestAnimationFrame` ごとに1回進め、移動量を
  `moveSpeed * 0.013`（＝1フレームあたり）で加算していた。
  このため **120Hz の端末では 60Hz の端末のちょうど2倍の速さ**で
  ゲームが進んでいた。現在は実時間で `1tick = 50ms` に固定されており、
  フレームレートが変わっても進行は変わらない（テスト[2]で検証）。
- A* が「オープンリスト内しか探さず、より短い経路を見つけても
  優先度キューを更新しない」実装だったため、最短でない経路を返すことが
  あった。`gScore` マップで管理する正しい実装に修正した。

## テスト（`npm run test:sim`）

| # | 内容 | 結果 |
|---|---|---|
| 1 | 同一seed＋同一コマンド列で全2400tickのチェックサムが一致 | ✅ |
| 1 | seedを変えると結果が変わる（テスト自体の妥当性） | ✅ |
| 2 | 60fps と 120fps で同じtickに到達し状態も一致 | ✅ |
| 2 | 5〜120msの不規則なフレーム刻みでも一致 | ✅ |
| 3 | 2インスタンスのロックステップが全600tickで一致 | ✅ |
| 3 | RTT 300ms相当（推奨入力遅延8tick）でも同期 | ✅ |
| 4 | 注入したズレ（HP -0.5）をチェックサムが検出 | ✅ |
| 5 | `catwars/sim/` に実装依存の数学関数が無いことを静的検査 | ✅ |

## 対戦導線（実装ずみ）

| ファイル | 役割 |
|---|---|
| `catwars/net/matchmaking.ts` | Firestore `catwars_rooms` による部屋の作成・参加・状態遷移 |
| `catwars/components/pvp/CatWarsPvpScreen.tsx` | ロビー → 相手待ち → 対戦 の画面 |
| `catwars/data/battleMaps.ts` | PvP用の左右対称マップ2種＋陣地の鏡写し `mirrorBase()` |

### 両者が同じ `SimConfig` に到達する仕組み

ロックステップで最も事故りやすいのがここ。進化段階・バフ・陣地は端末ごとに
違うので、**Firestoreの部屋ドキュメントに `PlayerPayload` として書き込み、
対戦開始時に両者がその同じデータだけから設定を組み立てる**。
自分の端末のストアは一切読まない。

```
ホスト: createRoom(自分のPayload)      → status='waiting'
ゲスト: joinRoom(自分のPayload)        → guest欄が埋まる
ホスト: startMatch()                   → serverTimestampを素にseedを確定, status='playing'
両者  : 部屋ドキュメント（seed + host + guest）だけから SimConfig を構築
両者  : FirebaseTransport + LockstepSession を張って対戦開始
```

seed をクライアントが決められると「有利な乱数を引くまで部屋を作り直す」
ことができるため、**サーバー時刻を素にして撹拌した値**を使う。

### 陣地の対称化

キャンペーンのマップは「左＝自陣／右＝敵陣」の非対称設計なので対人戦には
使えない。地形が x=13.5 を軸に完全な鏡写しになる専用マップを用意し、
ゲスト（P2）の陣地は `mirrorBase()` で右半分へ反転して配置する。
幅 w の建物は `x → GRID_W - x - w` で写る。

### 通信状態の表示

ロックステップは相手待ちで画面が止まる。**無言のフリーズはいちばん悪い
体験**なので、`LockstepStatus` に応じて全画面オーバーレイを出す。

| 状態 | 表示 |
|---|---|
| `WAITING`（1.5秒以上の待ち） | 「あいてを まっています…」＋経過秒数 |
| `DROPPED`（10秒以上の無応答） | 「あいてと せつだんされました」＋もどるボタン |
| `DESYNC` | 「しあいを ちゅうだんしました」＋引き分けで終了 |

デシンク時に**片方だけを勝ちにしてはいけない**（両者の画面で結果が
食い違っているため）。引き分けで打ち切る。

## 残っていること

- **`.env.local` の設定**（利用者側の作業）。
  `VITE_FIREBASE_DATABASE_URL` を設定し、Firebase コンソールで
  Realtime Database を有効化する。未設定の場合、たいせん画面は
  「たいせんは まだ つかえません」と理由を表示し、
  **ソロプレイには一切影響しない**。
- **PvP専用の陣地づくり**。現在はキャンペーン第1章のレイアウトを流用している
  （コアが無い場合は自動で1つ補う）。対戦用に別レイアウトを組めるようにすると
  戦略の幅が広がる。
- **実機での対戦テスト**。決定論・同期・セットアップはすべて自動テストで
  検証ずみだが、実際のFirebase越しの往復遅延での挙動は未確認。
  入力遅延は `recommendedInputDelayTicks(300)` = 8tick(400ms) を初期値にしている。
