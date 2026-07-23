
import React from 'react';

export interface BoxPlotData {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  label?: string;
}

interface BoxPlotViewProps {
  datasets: BoxPlotData[];
  /** 問題で隠す値のラベル（例: 'median'） */
  hideValue?: string;
}

/**
 * 箱ひげ図SVGコンポーネント
 * datasetsに複数渡すと2つの箱ひげ図を比較表示できる
 */
const BoxPlotView: React.FC<BoxPlotViewProps> = ({ datasets, hideValue }) => {
  if (datasets.length === 0) return null;

  // 全データの値域を決定
  const allValues = datasets.flatMap(d => [d.min, d.q1, d.median, d.q3, d.max]);
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  const range = globalMax - globalMin || 1;

  // SVGレイアウト
  const svgWidth = 400;
  const svgHeight = datasets.length === 1 ? 120 : 180;
  const plotLeft = 40;
  const plotRight = svgWidth - 20;
  const plotWidth = plotRight - plotLeft;

  // 値 → x座標
  const toX = (val: number) => plotLeft + ((val - globalMin) / range) * plotWidth;

  // 目盛り生成
  const tickStep = (() => {
    const r = globalMax - globalMin;
    if (r <= 10) return 1;
    if (r <= 20) return 2;
    if (r <= 50) return 5;
    if (r <= 100) return 10;
    return 20;
  })();
  const ticks: number[] = [];
  const tickStart = Math.ceil(globalMin / tickStep) * tickStep;
  for (let v = tickStart; v <= globalMax; v += tickStep) {
    ticks.push(v);
  }
  // 必ずglobalMinとglobalMaxを含む
  if (!ticks.includes(globalMin)) ticks.unshift(globalMin);
  if (!ticks.includes(globalMax)) ticks.push(globalMax);

  const boxHeight = 30;
  const colors = ['#f87171', '#f59e0b']; // red, amber

  return (
    <div className="w-full flex justify-center my-2">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-md"
        style={{ maxHeight: datasets.length === 1 ? '140px' : '200px' }}
      >
        {/* 背景 */}
        <rect x={plotLeft} y="10" width={plotWidth} height={svgHeight - 35} rx="4"
          fill="rgba(15,23,42,0.6)" stroke="rgba(239,68,68,0.15)" strokeWidth="1" />

        {/* 目盛り */}
        {ticks.map(v => {
          const x = toX(v);
          return (
            <g key={v}>
              <line x1={x} y1={svgHeight - 22} x2={x} y2="10"
                stroke="rgba(239,68,68,0.1)" strokeWidth="1" strokeDasharray="3,3" />
              <text x={x} y={svgHeight - 8} textAnchor="middle"
                fill="rgba(239,68,68,0.7)" fontSize="10" fontFamily="monospace">
                {v}
              </text>
            </g>
          );
        })}

        {/* 箱ひげ図 */}
        {datasets.map((d, i) => {
          const cy = datasets.length === 1
            ? (svgHeight - 25) / 2 + 10
            : 35 + i * 65;
          const top = cy - boxHeight / 2;
          const color = colors[i % colors.length];

          return (
            <g key={i}>
              {/* ラベル */}
              {d.label && (
                <text x={plotLeft - 5} y={cy + 4} textAnchor="end"
                  fill={color} fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                  {d.label}
                </text>
              )}

              {/* ひげ: min → Q1 */}
              <line x1={toX(d.min)} y1={cy} x2={toX(d.q1)} y2={cy}
                stroke={color} strokeWidth="2" />
              {/* ひげ端: min */}
              <line x1={toX(d.min)} y1={top + 5} x2={toX(d.min)} y2={cy + boxHeight / 2 - 5}
                stroke={color} strokeWidth="2" />

              {/* ひげ: Q3 → max */}
              <line x1={toX(d.q3)} y1={cy} x2={toX(d.max)} y2={cy}
                stroke={color} strokeWidth="2" />
              {/* ひげ端: max */}
              <line x1={toX(d.max)} y1={top + 5} x2={toX(d.max)} y2={cy + boxHeight / 2 - 5}
                stroke={color} strokeWidth="2" />

              {/* 箱 */}
              <rect x={toX(d.q1)} y={top} width={toX(d.q3) - toX(d.q1)} height={boxHeight}
                fill={`${color}20`} stroke={color} strokeWidth="2" rx="2" />

              {/* 中央値の線 */}
              <line x1={toX(d.median)} y1={top} x2={toX(d.median)} y2={top + boxHeight}
                stroke={color} strokeWidth="3" />

              {/* 値ラベル（隠す指定がない値のみ） */}
              {hideValue !== 'min' && (
                <text x={toX(d.min)} y={top - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">{d.min}</text>
              )}
              {hideValue !== 'q1' && (
                <text x={toX(d.q1)} y={top - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">{d.q1}</text>
              )}
              {hideValue !== 'median' && (
                <text x={toX(d.median)} y={top - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">{d.median}</text>
              )}
              {hideValue !== 'q3' && (
                <text x={toX(d.q3)} y={top - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">{d.q3}</text>
              )}
              {hideValue !== 'max' && (
                <text x={toX(d.max)} y={top - 4} textAnchor="middle"
                  fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">{d.max}</text>
              )}

              {/* 隠す値に ? を表示 */}
              {hideValue === 'min' && (
                <text x={toX(d.min)} y={top - 4} textAnchor="middle"
                  fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">?</text>
              )}
              {hideValue === 'q1' && (
                <text x={toX(d.q1)} y={top - 4} textAnchor="middle"
                  fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">?</text>
              )}
              {hideValue === 'median' && (
                <text x={toX(d.median)} y={top - 4} textAnchor="middle"
                  fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">?</text>
              )}
              {hideValue === 'q3' && (
                <text x={toX(d.q3)} y={top - 4} textAnchor="middle"
                  fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">?</text>
              )}
              {hideValue === 'max' && (
                <text x={toX(d.max)} y={top - 4} textAnchor="middle"
                  fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">?</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default BoxPlotView;
