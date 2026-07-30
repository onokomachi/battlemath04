// ── CAT-WARS たいせん（PvP）画面 ─────────────────────────────────────────
//
// 部屋づくり → 相手待ち → 対戦、までを1つの画面で扱う。
//
// ロックステップで最も重要なのは「**両者がまったく同じ SimConfig を作る**」こと。
// そのために、進化段階・バフ・陣地を PlayerPayload として Firestore の部屋に
// 書き込み、対戦開始時に両者がその同じデータから設定を組み立てる。
// 自分の端末のストアを直接読んではいけない（相手には無い情報なのでズレる）。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { BattleScene } from '../game/BattleScene';
import { useArmyStore } from '../../store/useArmyStore';
import { useProgressStore, BUFF_LEVEL_INFO } from '../../store/useProgressStore';
import { useBaseStore } from '../../store/useBaseStore';
import { CHARACTERS } from '../../data/characters';
import { BUILDING_STATS } from '../../constants';
import { BuildingType, GameState } from '../../types';
import { PVP_MAPS, PVP_MAP_BY_ID, mirrorBase } from '../../data/battleMaps';
import { PVP_DIFFICULTY, CAMPAIGN } from '../../data/campaign';
import { buildSimConfig } from '../../sim/setup';
import { SimConfig, PlayerId } from '../../sim/types';
import type { SimInit } from '../../sim/simulate';
import { LockstepSession, recommendedInputDelayTicks } from '../../net/lockstep';
import { FirebaseTransport } from '../../net/firebaseTransport';
import {
  CatWarsRoom, PlayerPayload, createRoom, joinRoom, startMatch,
  watchRoom, watchOpenRooms, leaveRoom, finishRoom, heartbeat,
} from '../../net/matchmaking';
import { isFirebaseConfigured, isRealtimeDbConfigured, getRealtimeDb, auth } from '../../../firebase';

const fontMono = { fontFamily: 'Orbitron, monospace' };
// BattleScene の attackerState は表示にしか使われないので、PvPでは空の器を渡す
const EMPTY_GAME_STATE: GameState = {
  resources: { gold: 0, maxGold: 0 }, buildings: [], troops: [], lastTick: 0,
};

interface Props {
  onBack: () => void;
  playerName: string;
}

type Phase = 'lobby' | 'waiting' | 'battle';

/** ローカルの端末IDを安定させる（ゲストプレイでもuidが要るため） */
function localUid(): string {
  const KEY = 'cw_local_uid';
  let v = localStorage.getItem(KEY);
  if (!v) { v = 'local-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(KEY, v); }
  return v;
}

export const CatWarsPvpScreen: React.FC<Props> = ({ onBack, playerName }) => {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [rooms, setRooms] = useState<CatWarsRoom[]>([]);
  const [room, setRoom] = useState<CatWarsRoom | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [mapId, setMapId] = useState(PVP_MAPS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { getStage } = useArmyStore();
  const { getTodayBuffs } = useProgressStore();
  const base = useBaseStore();

  const uid = useMemo(() => auth?.currentUser?.uid ?? localUid(), []);

  // ── 自分の設定を PlayerPayload にまとめる ──
  const myPayload = useMemo((): PlayerPayload => {
    const stages: Record<string, 1 | 2 | 3> = {};
    for (const c of CHARACTERS) stages[c.id] = getStage(c.id);

    const buffs: Record<string, number> = {};
    for (const b of getTodayBuffs()) {
      const info = (BUFF_LEVEL_INFO as Record<string, { values: number[] }>)[b.type];
      const lv = ((b as { level?: number }).level ?? 2) as 1 | 2 | 3;
      if (info) buffs[b.type] = info.values[lv - 1];
    }

    // 陣地は第1章のレイアウトを流用する（PvP専用の陣地づくりは今後の課題）。
    // コアが無い場合は自陣ゾーンの奥に1つ足して、勝敗条件が成立するようにする。
    const layout = base.getLayout(CAMPAIGN[0].id) ?? [];
    const hasCore = layout.some(b => b.type === BuildingType.TOWN_HALL);
    const myBase = hasCore ? layout : [...layout, { type: BuildingType.TOWN_HALL, x: 0, y: 7 }];

    return {
      uid, name: playerName || 'プレイヤー',
      stages, buffs,
      base: myBase.map(b => ({ type: b.type, x: b.x, y: b.y })),
      spells: { HEAL: 2, RAGE: 2 },
    };
  }, [uid, playerName]);

  // ── 待機中の部屋一覧 ──
  useEffect(() => {
    if (phase !== 'lobby') return;
    return watchOpenRooms(setRooms);
  }, [phase]);

  // ── 入っている部屋の監視 ──
  useEffect(() => {
    if (!roomId) return;
    const un = watchRoom(roomId, r => {
      setRoom(r);
      if (r === null) { setPhase('lobby'); setRoomId(null); return; }
      if (r.status === 'playing' && r.seed !== null && r.guest) setPhase('battle');
      if (r.status === 'finished') { setPhase('lobby'); setRoomId(null); }
    });
    const hb = window.setInterval(() => {
      heartbeat(roomId, isHost ? 'P1' : 'P2').catch(() => {});
    }, 15000);
    return () => { un(); window.clearInterval(hb); };
  }, [roomId, isHost]);

  // ホストは相手が入ったら対戦を開始する
  useEffect(() => {
    if (!isHost || !roomId || !room) return;
    if (room.status === 'waiting' && room.guest && room.seed === null) {
      startMatch(roomId).catch(e => setError(String(e)));
    }
  }, [isHost, roomId, room?.guest, room?.status]);

  const handleCreate = async () => {
    setBusy(true); setError(null);
    try {
      const id = await createRoom(myPayload, mapId);
      setRoomId(id); setIsHost(true); setPhase('waiting');
    } catch (e) { setError('部屋をつくれませんでした: ' + String(e)); }
    finally { setBusy(false); }
  };

  const handleJoin = async (r: CatWarsRoom) => {
    setBusy(true); setError(null);
    try {
      const ok = await joinRoom(r.roomId, myPayload);
      if (!ok) { setError('この部屋には入れませんでした（すでに満員かも）'); return; }
      setRoomId(r.roomId); setIsHost(false); setPhase('waiting');
    } catch (e) { setError('参加できませんでした: ' + String(e)); }
    finally { setBusy(false); }
  };

  const handleLeave = async () => {
    if (roomId) await leaveRoom(roomId, isHost).catch(() => {});
    setRoomId(null); setRoom(null); setPhase('lobby');
  };

  // ── 対戦フェーズ ──
  if (phase === 'battle' && room && room.seed !== null && room.host && room.guest) {
    return (
      <PvpBattle
        room={room}
        localPlayer={isHost ? 'P1' : 'P2'}
        onEnd={async (win) => {
          if (isHost) await finishRoom(room.roomId, win ? 'host' : 'guest').catch(() => {});
          setRoomId(null); setRoom(null); setPhase('lobby');
        }}
      />
    );
  }

  // ── 未設定のときの案内 ──
  if (!isFirebaseConfigured || !isRealtimeDbConfigured) {
    return (
      <div className="min-h-[100dvh] bg-[#05070f] text-white p-4">
        <button onClick={onBack} className="text-white/60 text-sm mb-6">← もどる</button>
        <div className="max-w-md mx-auto rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5">
          <div className="text-amber-300 font-black mb-2" style={fontMono}>たいせんは まだ つかえません</div>
          <p className="text-white/70 text-sm leading-relaxed">
            オンライン対戦には Firebase の設定が必要です。
            {!isFirebaseConfigured && <><br />・<code>VITE_FIREBASE_*</code> が未設定です</>}
            {!isRealtimeDbConfigured && <><br />・<code>VITE_FIREBASE_DATABASE_URL</code> が未設定です</>}
          </p>
          <p className="text-white/40 text-xs mt-3">
            設定しなくても、ひとりでの ぼうけん（キャンペーン）は ふつうに あそべます。
          </p>
        </div>
      </div>
    );
  }

  // ── 相手待ち ──
  if (phase === 'waiting') {
    return (
      <div className="min-h-[100dvh] bg-[#05070f] text-white p-4 flex flex-col items-center justify-center">
        <div className="text-5xl mb-4 animate-pulse">📡</div>
        <div className="font-black text-lg mb-1" style={fontMono}>
          {isHost ? 'あいてを まっています…' : 'たいせんの じゅんびちゅう…'}
        </div>
        <div className="text-white/50 text-sm mb-6">
          {isHost ? `あいことば: ${roomId}` : `ホスト: ${room?.hostName ?? '...'}`}
        </div>
        {room?.guest && <div className="text-[#4ade80] text-sm mb-4">✅ {room.guest.name} が さんかしました！</div>}
        <Button variant="secondary" size="sm" onClick={handleLeave}>やめる</Button>
      </div>
    );
  }

  // ── ロビー ──
  return (
    <div className="min-h-[100dvh] bg-[#05070f] text-white p-4">
      <button onClick={onBack} className="text-white/60 text-sm mb-4">← もどる</button>
      <h1 className="text-2xl font-black mb-1 text-[#ef4444]" style={fontMono}>たいせん</h1>
      <p className="text-white/50 text-xs mb-5">ともだちと ネコ軍団で しょうぶしよう！</p>

      {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-red-300 text-xs">{error}</div>}

      <div className="rounded-2xl border border-white/10 bg-[rgba(6,10,24,0.55)] p-4 mb-5">
        <div className="text-white/70 text-xs font-bold mb-2" style={fontMono}>あたらしい へやを つくる</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PVP_MAPS.map(m => (
            <button key={m.id} onClick={() => setMapId(m.id)}
              className={`px-3 py-2 rounded-xl border text-xs text-left ${
                mapId === m.id ? 'border-[#ef4444] bg-[#ef4444]/15 text-white' : 'border-white/10 text-white/60'}`}>
              <div className="font-bold">{m.name}</div>
              <div className="text-[10px] opacity-70">{m.description}</div>
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={busy}>へやを つくる</Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[rgba(6,10,24,0.55)] p-4">
        <div className="text-white/70 text-xs font-bold mb-2" style={fontMono}>あいての へやに はいる</div>
        {rooms.length === 0 && <div className="text-white/40 text-xs py-4 text-center">いま あいている へやは ありません</div>}
        {rooms.filter(r => r.hostId !== uid).map(r => (
          <button key={r.roomId} onClick={() => handleJoin(r)} disabled={busy}
            className="w-full flex items-center justify-between rounded-xl border border-white/10 p-3 mb-2 hover:border-[#22d3ee]">
            <div className="text-left">
              <div className="font-bold text-sm">{r.hostName}</div>
              <div className="text-white/40 text-[10px]">{PVP_MAP_BY_ID[r.mapId]?.name ?? r.mapId}</div>
            </div>
            <span className="text-[#22d3ee] text-xs font-bold">はいる ›</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── 対戦本体 ────────────────────────────────────────────────────────────

const PvpBattle: React.FC<{
  room: CatWarsRoom;
  localPlayer: PlayerId;
  onEnd: (win: boolean) => void;
}> = ({ room, localPlayer, onEnd }) => {
  const [session, setSession] = useState<LockstepSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sessionRef = useRef<LockstepSession | null>(null);

  // ★ 両者がまったく同じ SimConfig / SimInit を作る ★
  // 入力は「部屋のドキュメント」だけ。ローカルのストアは一切見ない。
  const { config, init } = useMemo((): { config: SimConfig; init: SimInit } => {
    const host = room.host!;
    const guest = room.guest!;
    const map = PVP_MAP_BY_ID[room.mapId] ?? PVP_MAPS[0];

    const cfg = buildSimConfig({
      mode: 'PVP',
      seed: room.seed!,
      chapter: { enemyName: guest.name },
      difficulty: PVP_DIFFICULTY,
      battleMap: map,
      p1: { stages: host.stages, buffs: { values: host.buffs } },
      p2: { stages: guest.stages, buffs: { values: guest.buffs } },
    });

    // ゲスト（P2）の陣地は左右反転して右半分へ置く
    const widthOf = (t: BuildingType) => BUILDING_STATS[t].width;
    return {
      config: cfg,
      init: {
        playerBuildings: host.base,
        defenderBuildings: mirrorBase(guest.base, widthOf),
        spellCharges: { P1: host.spells, P2: guest.spells },
      },
    };
  }, [room.roomId, room.seed]);

  useEffect(() => {
    let closed = false;
    (async () => {
      const rtdb = await getRealtimeDb();
      if (!rtdb) { setErr('Realtime Database に接続できませんでした'); return; }
      if (closed) return;
      const transport = new FirebaseTransport({
        matchId: room.matchId ?? room.roomId,
        localPlayer,
        database: rtdb,
      });
      // Firebase RTDB の往復はおおむね 100〜300ms。推奨式で入力遅延を決める。
      const s = new LockstepSession(transport, ['P1', 'P2'], {
        inputDelayTicks: recommendedInputDelayTicks(300),
      });
      sessionRef.current = s;
      setSession(s);
    })();
    return () => {
      closed = true;
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [room.roomId, localPlayer]);

  if (err) {
    return (
      <div className="min-h-[100dvh] bg-[#05070f] text-white flex flex-col items-center justify-center p-6">
        <div className="text-red-400 font-bold mb-4">{err}</div>
        <Button size="sm" onClick={() => onEnd(false)}>もどる</Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-[#05070f] text-white flex flex-col items-center justify-center">
        <div className="text-4xl mb-3 animate-pulse">🔗</div>
        <div className="font-black" style={fontMono}>せつぞく しています…</div>
      </div>
    );
  }

  const opponent = localPlayer === 'P1' ? room.guest! : room.host!;

  return (
    <BattleScene
      attackerState={EMPTY_GAME_STATE}
      defenderBuildings={init.defenderBuildings}
      playerDeployments={init.playerBuildings}
      battleMap={config.battleMap ?? undefined}
      chapter={{
        ...CAMPAIGN[0],
        title: 'たいせん',
        enemyName: opponent.name,
        enemyTitle: 'たいせんあいて',
        background: `${opponent.name} との しんけんしょうぶ！`,
        briefing: 'あいての コアを こわしたら かち！',
        hint: 'あいても おなじように ネコを 出してくるよ。まもりも わすれずに。',
        rewardCredits: 0,
      }}
      difficulty={PVP_DIFFICULTY}
      pvp={{ session, localPlayer, config, init, opponentName: opponent.name }}
      onEndBattle={(win) => onEnd(win)}
    />
  );
};
