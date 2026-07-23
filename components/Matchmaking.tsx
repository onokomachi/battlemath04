import React, { useState } from 'react';
import type { Room, BattleType } from '../types';
import type { User } from 'firebase/auth';

interface MatchmakingProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
  onCancel: () => void;
  currentRoomId: string | null;
  user: User | null;
  connectionError?: string | null;
  battleType?: BattleType;
}

const Matchmaking: React.FC<MatchmakingProps> = ({ rooms, onJoinRoom, onCancel, currentRoomId, user, connectionError, battleType }) => {
  const [customRoomId, setCustomRoomId] = useState('');

  const waitingRooms = rooms.filter(r => r.status === 'waiting');
  const playingRooms = rooms.filter(r => r.status === 'playing');

  const handleCustomRoom = () => {
    const id = customRoomId.trim().toUpperCase();
    if (id.length >= 2) {
      onJoinRoom(id);
      setCustomRoomId('');
    }
  };

  const handleCreateRoom = () => {
    // Generate a simple 4-char room code
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    onJoinRoom(code);
  };

  const statusColor = (status: string) => {
    if (status === 'playing') return 'text-red-400 border-red-800 bg-red-900/20';
    if (status === 'waiting') return 'text-green-400 border-green-800 bg-green-900/20';
    return 'text-gray-400 border-gray-700 bg-gray-900/20';
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-6 text-white overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-hologram tracking-wide">対戦マッチング</h2>
            <p className={`text-xs font-bold mt-1 ${battleType === 'speed_duel' ? 'text-orange-400' : 'text-red-400'}`}>
              {battleType === 'speed_duel' ? '⚡ スピードデュエル' : 'オンライン対戦'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
        </div>

        {/* Firestore connection error */}
        {connectionError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/50 bg-red-950/30 text-center">
            <p className="text-red-400 text-sm font-bold mb-1">接続エラー</p>
            <p className="text-red-300/80 text-xs">{connectionError}</p>
          </div>
        )}

        {/* Waiting status */}
        {currentRoomId && (
          <div className="hud-panel rounded-xl p-4 mb-6 border border-red-800/50">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
              <div>
                <p className="text-xs text-red-400 font-bold">対戦相手を待っています...</p>
                <p className="text-sm text-white font-bold">ルーム: <span className="text-red-300 font-mono">{currentRoomId}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Create / Custom Room */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleCreateRoom}
            className="btn-tactical py-4 rounded-xl font-bold tracking-[0.2em] text-sm"
          >
            + 部屋を作る
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              value={customRoomId}
              onChange={e => setCustomRoomId(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleCustomRoom()}
              placeholder="ルームIDを入力"
              maxLength={8}
              className="flex-1 bg-gray-900/80 border border-red-800/50 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-red-500 outline-none tracking-widest"
            />
            <button
              onClick={handleCustomRoom}
              disabled={customRoomId.trim().length < 2}
              className="btn-tactical px-4 rounded-xl font-bold text-sm disabled:opacity-40"
            >
              入室
            </button>
          </div>
        </div>

        {/* Room List */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-bold text-red-400 tracking-widest uppercase">待機中のルーム</h3>
            <span className="text-xs text-green-400 font-mono">({waitingRooms.length})</span>
          </div>

          {waitingRooms.length === 0 ? (
            <div className="hud-panel rounded-xl p-8 text-center text-gray-500 text-sm">
              <p>待機中のルームはありません</p>
              <p className="text-xs mt-1 text-gray-600">「部屋を作る」でルームを作成してみよう</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingRooms.map(room => (
                <div
                  key={room.roomId}
                  className="hud-panel rounded-xl p-4 flex items-center justify-between hover:border-red-700/50 transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm text-red-300 font-bold">{room.roomId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ホスト: {room.hostName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${statusColor(room.status)}`}>
                      {room.status === 'waiting' ? '待機中' : '対戦中'}
                    </span>
                    <button
                      onClick={() => onJoinRoom(room.roomId)}
                      disabled={!!currentRoomId}
                      className="btn-tactical px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                    >
                      参加
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active battles preview */}
        {playingRooms.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-bold text-red-400 tracking-widest uppercase">対戦中</h3>
              <span className="text-xs text-red-400 font-mono">({playingRooms.length})</span>
            </div>
            <div className="space-y-2">
              {playingRooms.map(room => (
                <div key={room.roomId} className="hud-panel rounded-xl p-3 flex items-center justify-between opacity-60">
                  <div>
                    <p className="font-mono text-xs text-gray-400">{room.roomId}</p>
                    <p className="text-xs text-gray-500">{room.hostName} vs {room.guestName || '???'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border font-mono ${statusColor(room.status)}`}>
                    対戦中
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-8 p-4 rounded-xl border border-amber-800/50 bg-amber-900/10 text-center">
            <p className="text-xs text-amber-400">PvP対戦にはGoogleログインが必要です</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Matchmaking;
