import React from 'react';
import { VisualHint } from '../types';

interface GraphHintOverlayProps {
  hints: VisualHint[];
  xDomain: [number, number];
  yDomain: [number, number];
  width: number;
  height: number;
}

const colorMap: { [key: string]: string } = {
  blue: 'rgba(59, 130, 246, 0.2)',
  green: 'rgba(16, 185, 129, 0.2)',
  red: 'rgba(239, 68, 68, 0.2)',
};

const strokeColorMap: { [key: string]: string } = {
    blue: 'rgba(59, 130, 246, 0.4)',
    green: 'rgba(16, 185, 129, 0.4)',
    red: 'rgba(239, 68, 68, 0.4)',
}

const GraphHintOverlay: React.FC<GraphHintOverlayProps> = ({ hints, xDomain, yDomain, width, height }) => {
  const mapX = (mathX: number) => ((mathX - xDomain[0]) / (xDomain[1] - xDomain[0])) * width;
  const mapY = (mathY: number) => ((yDomain[1] - mathY) / (yDomain[1] - yDomain[0])) * height;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      className="absolute top-0 left-0 pointer-events-none"
    >
      {hints.map((hint, index) => {
        if (hint.type === 'highlight-rect') {
          const x = mapX(hint.x_range[0]);
          const y = mapY(hint.y_range[1]);
          const rectWidth = mapX(hint.x_range[1]) - x;
          const rectHeight = mapY(hint.y_range[0]) - y;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={Math.max(0, rectWidth)}
              height={Math.max(0, rectHeight)}
              fill={colorMap[hint.color] || 'rgba(255, 255, 255, 0.3)'}
              stroke={strokeColorMap[hint.color]}
              strokeWidth="1"
            />
          );
        }
        return null;
      })}
    </svg>
  );
};

export default GraphHintOverlay;
