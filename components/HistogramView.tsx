
import React from 'react';

export interface HistogramBar {
  /** 階級の下限 */
  from: number;
  /** 階級の上限 */
  to: number;
  /** 度数 */
  freq: number;
}

interface HistogramViewProps {
  bars: HistogramBar[];
  /** 横軸ラベル */
  xLabel?: string;
  /** 縦軸ラベル */
  yLabel?: string;
}

/**
 * ヒストグラムSVGコンポーネント
 */
const HistogramView: React.FC<HistogramViewProps> = ({
  bars,
  xLabel = '',
  yLabel = '度数（人）',
}) => {
  if (bars.length === 0) return null;

  const maxFreq = Math.max(...bars.map(b => b.freq));
  const xMin = bars[0].from;
  const xMax = bars[bars.length - 1].to;
  const xRange = xMax - xMin || 1;

  // SVGレイアウト
  const svgWidth = 400;
  const svgHeight = 200;
  const plotLeft = 50;
  const plotRight = svgWidth - 20;
  const plotTop = 20;
  const plotBottom = svgHeight - 40;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const toX = (val: number) => plotLeft + ((val - xMin) / xRange) * plotWidth;
  const toY = (freq: number) => plotBottom - (freq / (maxFreq || 1)) * plotHeight;

  // Y軸目盛り
  const yStep = maxFreq <= 5 ? 1 : maxFreq <= 10 ? 2 : maxFreq <= 20 ? 5 : 10;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxFreq; v += yStep) {
    yTicks.push(v);
  }
  if (!yTicks.includes(maxFreq) && maxFreq > 0) yTicks.push(maxFreq);

  // X軸目盛り（各階級の境界値）
  const xTicks = [xMin, ...bars.map(b => b.to)];

  return (
    <div className="w-full flex justify-center my-2">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-md"
        style={{ maxHeight: '220px' }}
      >
        {/* 背景 */}
        <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} rx="2"
          fill="rgba(15,23,42,0.6)" stroke="rgba(239,68,68,0.15)" strokeWidth="1" />

        {/* Y軸グリッドと目盛り */}
        {yTicks.map(v => {
          const y = toY(v);
          return (
            <g key={`y-${v}`}>
              <line x1={plotLeft} y1={y} x2={plotRight} y2={y}
                stroke="rgba(239,68,68,0.08)" strokeWidth="1" />
              <text x={plotLeft - 6} y={y + 3} textAnchor="end"
                fill="rgba(239,68,68,0.7)" fontSize="10" fontFamily="monospace">
                {v}
              </text>
            </g>
          );
        })}

        {/* X軸目盛り */}
        {xTicks.map(v => {
          const x = toX(v);
          return (
            <text key={`x-${v}`} x={x} y={plotBottom + 14} textAnchor="middle"
              fill="rgba(239,68,68,0.7)" fontSize="9" fontFamily="monospace">
              {v}
            </text>
          );
        })}

        {/* 棒 */}
        {bars.map((bar, i) => {
          const x1 = toX(bar.from);
          const x2 = toX(bar.to);
          const y = toY(bar.freq);
          const barWidth = x2 - x1;
          const barHeight = plotBottom - y;

          return (
            <g key={i}>
              <rect
                x={x1}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="rgba(239,68,68,0.3)"
                stroke="#f87171"
                strokeWidth="1.5"
              />
              {/* 度数ラベル */}
              {bar.freq > 0 && (
                <text x={x1 + barWidth / 2} y={y - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {bar.freq}
                </text>
              )}
            </g>
          );
        })}

        {/* 軸ラベル */}
        {xLabel && (
          <text x={plotLeft + plotWidth / 2} y={svgHeight - 4} textAnchor="middle"
            fill="rgba(239,68,68,0.5)" fontSize="10" fontFamily="sans-serif">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x="12" y={plotTop + plotHeight / 2} textAnchor="middle"
            fill="rgba(239,68,68,0.5)" fontSize="10" fontFamily="sans-serif"
            transform={`rotate(-90, 12, ${plotTop + plotHeight / 2})`}>
            {yLabel}
          </text>
        )}

        {/* 軸線 */}
        <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom}
          stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
        <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom}
          stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

export default HistogramView;
