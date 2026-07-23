import React from 'react';
import { parseFractionMarkup, parsePartialAnswer, type Frac } from '../utils/fraction';

/**
 * 分数の積み上げ表記(教科書表記)レンダラ。
 * 児童にスラッシュ表記を見せないための共通コンポーネント。
 *
 * - <FractionText text="{3/4}Lと{1と2/4}L" /> … 問題文・選択肢用({}マークアップ)
 * - <FractionText text="2と3/4" auto />        … 解答文字列用(全体を分数として解釈)
 */

export const FracView: React.FC<{ frac: Frac; className?: string }> = ({ frac, className }) => {
  if (frac.num === 0) {
    return <span className={className}>{frac.whole}</span>;
  }
  return (
    <span className={`inline-flex items-center align-middle mx-0.5 ${className || ''}`}>
      {frac.whole > 0 && <span className="mr-0.5">{frac.whole}</span>}
      <span className="inline-flex flex-col items-center leading-none align-middle">
        <span className="px-1 text-[0.82em] leading-tight">{frac.num}</span>
        <span className="w-full border-t-2 border-current" />
        <span className="px-1 text-[0.82em] leading-tight">{frac.den}</span>
      </span>
    </span>
  );
};

interface FractionTextProps {
  text: string;
  /**
   * true のとき、text 中の分数らしき並び("2と3/4"・"3/4")を自動で
   * 積み上げ表記に変換する(解答文字列・選択肢・カンマ区切りリスト用)。
   * text が既に {} マークアップを含む場合は何もしない。
   */
  auto?: boolean;
  className?: string;
}

const FractionText: React.FC<FractionTextProps> = ({ text, auto, className }) => {
  const raw = text || '';
  const source = auto && !raw.includes('{')
    ? raw.replace(/(\d+と\d+\/\d+|\d+\/\d+)/g, '{$1}')
    : raw;
  const segments = parseFractionMarkup(source);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'frac' ? (
          <FracView key={i} frac={seg.frac} />
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
};

/**
 * 入力途中の解答("2と3/" など)を積み上げ表記でライブ表示する。
 * 空欄は点線ボックスで示し、次に何を入れるかが視覚的に分かるようにする
 * (転記負荷の除去: docs/DESIGN.md §6)。
 */
export const PartialFractionDisplay: React.FC<{ raw: string; placeholder?: string }> = ({ raw, placeholder }) => {
  if (!raw) {
    return <span className="text-red-800 text-sm">{placeholder || 'キーパッドで入力...'}</span>;
  }
  // 分数として解釈できない入力(選択肢の文字列など)はそのまま表示
  const { whole, num, den, hasFracPart } = parsePartialAnswer(raw);
  const isNumeric = /^[0-9と/\s]*$/.test(raw.replace(/[０-９／]/g, '0'));
  if (!isNumeric) return <span>{raw}</span>;

  if (!hasFracPart) return <span>{whole}</span>;

  const box = (v: string) => (
    v ? <span className="px-1 text-[0.82em] leading-tight">{v}</span>
      : <span className="px-1 text-[0.82em] leading-tight text-red-500/60 border border-dashed border-red-500/40 rounded min-w-[1.2em] text-center">&nbsp;</span>
  );

  return (
    <span className="inline-flex items-center align-middle">
      {whole && <span className="mr-0.5">{whole}</span>}
      <span className="inline-flex flex-col items-center leading-none align-middle">
        {box(num)}
        <span className="w-full border-t-2 border-current" />
        {box(den)}
      </span>
    </span>
  );
};

export default FractionText;
