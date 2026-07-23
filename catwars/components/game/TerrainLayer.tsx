import React from 'react';
import { TerrainTile } from '../../types';

interface Props {
  terrain: TerrainTile[];
  cellSize?: number;
}

const TERRAIN_ICONS: Record<string, string> = {
  WATER: '🌊',
  BRIDGE: '',
  ROCK: '🪨',
  SWAMP: '',
  GRASS: '',
};

export const TerrainLayer: React.FC<Props> = ({ terrain, cellSize = 40 }) => {
  return (
    <>
      {terrain.map(tile => {
        const isWater = tile.type === 'WATER';
        const isBridge = tile.type === 'BRIDGE';
        const isRock = tile.type === 'ROCK';
        const isSwamp = tile.type === 'SWAMP';

        return (
          <div
            key={`${tile.x}-${tile.y}`}
            className={isWater ? 'terrain-water' : isBridge ? 'terrain-bridge' : ''}
            style={{
              position: 'absolute',
              left: tile.x * cellSize,
              top: tile.y * cellSize,
              width: cellSize,
              height: cellSize,
              pointerEvents: 'none',
              zIndex: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: cellSize * 0.5,
              background: isWater ? undefined
                : isBridge ? '#92400e'
                : isRock ? '#374151'
                : isSwamp ? 'rgba(20,83,45,0.8)'
                : 'transparent',
              border: isBridge ? '1px solid rgba(120,53,15,0.6)' : 'none',
              boxShadow: isRock ? 'inset 0 0 8px rgba(0,0,0,0.5)' : undefined,
            }}
          >
            {isRock && <span style={{ fontSize: cellSize * 0.4, lineHeight: 1 }}>🪨</span>}
            {isSwamp && <span style={{ fontSize: cellSize * 0.4, opacity: 0.6, lineHeight: 1 }}>🌿</span>}
            {isBridge && (
              <div style={{
                width: '100%',
                height: '100%',
                background: 'repeating-linear-gradient(90deg, #92400e 0px, #92400e 4px, #78350f 4px, #78350f 8px)',
                opacity: 0.9,
              }} />
            )}
          </div>
        );
      })}
    </>
  );
};
