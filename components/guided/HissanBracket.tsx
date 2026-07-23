/**
 * components/guided/HissanBracket.tsx
 * wari-hissann3 の HissanBracket.tsx を移植(デザインのみダークテーマ化)。
 * 筆算の「わく」の静的表示(エラーハンター・見積もり・たしかめ算などで使う)。
 */
import React from 'react';

interface Props {
  dividend: string;
  divisor: string;
  quotient?: string;
  quotientOffset?: number;
  quotientWrong?: boolean;
  className?: string;
}

const HissanBracket: React.FC<Props> = ({ dividend, divisor, quotient, quotientOffset, quotientWrong = false, className = '' }) => {
  const cols = dividend.length;
  const cell = 36;
  const divisorW = Math.max(44, divisor.length * 22 + 10);
  const qStart = quotient != null ? quotientOffset ?? cols - quotient.length : 0;
  const gridStyle: React.CSSProperties = { gridTemplateColumns: `${divisorW}px repeat(${cols}, ${cell}px)` };

  return (
    <div className={`inline-block font-mono text-2xl leading-none select-none ${className}`}>
      {quotient != null && (
        <div className="grid items-center text-center" style={gridStyle}>
          <div />
          {Array.from({ length: cols }, (_, i) => {
            const ch = i >= qStart && i - qStart < quotient.length ? quotient[i - qStart] : '';
            return (
              <div key={i} className={`h-9 flex items-center justify-center font-bold ${quotientWrong ? 'text-rose-400' : 'text-white'}`}>
                {ch}
              </div>
            );
          })}
        </div>
      )}
      <div className="grid items-center text-center relative h-10" style={gridStyle}>
        <div className="flex justify-end pr-2 text-white font-bold border-r-4 border-white h-full items-center">{divisor}</div>
        <div className="absolute right-0 top-0 border-t-4 border-white" style={{ left: divisorW - 2 }} />
        {dividend.split('').map((d, i) => (
          <div key={i} className="h-10 flex items-center justify-center font-bold text-white">{d}</div>
        ))}
      </div>
    </div>
  );
};

export default HissanBracket;
