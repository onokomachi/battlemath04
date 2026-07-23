/**
 * utils/fractionSvg.ts — 分数の視覚表現(数直線・リットルます・テープ図)のSVG生成
 *
 * エビデンス: 数直線を分数指導の中心的表現とする(WWC 2010 推奨2, Moderate)。
 * 面積モデル(リットルます・テープ図)は具体→半具体→抽象(CRA)の導入に用いる。
 *
 * SVGは決定的な文字列として問題データに埋め込む(data.svg)。
 * 既存エンジンの text 型描画経路(練習/カードバトル/スピードデュエル共通)で表示される。
 * 配色はアプリのダークテーマ前提(明るいストローク+赤系ハイライト)。
 */

const AXIS = '#cbd5e1';      // 目盛り・軸
const LABEL = '#e2e8f0';     // 数値ラベル
const POINT = '#f87171';     // 注目点(赤)
const FILL = '#38bdf8';      // ぬり(水色 = 水のイメージ)
const FILL_DIM = 'rgba(56,189,248,0.25)';
const HILITE = '#fbbf24';    // 強調(こはく色)

/** 分数の積み上げ表記をSVGテキストとして描く(x,y は分数の中心) */
const fracLabel = (x: number, y: number, num: number, den: number, whole = 0, color = LABEL, size = 13): string => {
  const parts: string[] = [];
  let fx = x;
  if (whole > 0) {
    parts.push(`<text x="${x - size * 0.7}" y="${y + size * 0.35}" fill="${color}" font-size="${size * 1.15}" text-anchor="middle" font-weight="bold">${whole}</text>`);
    fx = x + size * 0.35;
  }
  const w = Math.max(String(num).length, String(den).length) * size * 0.62 + 4;
  parts.push(`<text x="${fx}" y="${y - size * 0.22}" fill="${color}" font-size="${size}" text-anchor="middle" font-weight="bold">${num}</text>`);
  parts.push(`<line x1="${fx - w / 2}" y1="${y}" x2="${fx + w / 2}" y2="${y}" stroke="${color}" stroke-width="1.4"/>`);
  parts.push(`<text x="${fx}" y="${y + size * 1.05}" fill="${color}" font-size="${size}" text-anchor="middle" font-weight="bold">${den}</text>`);
  return parts.join('');
};

export interface NumberLineOptions {
  /** 分母(1目盛り = 1/den) */
  den: number;
  /** 数直線の右端(整数) */
  max: number;
  /** 矢印(↓)で示す位置の分子(den 基準)。省略時は矢印なし */
  pointNum?: number;
  /** 矢印の位置にラベル(分数)を表示するか(答えを見せる用途) */
  labelPoint?: boolean;
  /** 「1」の位置を強調する(1より大きい分数の足場) */
  emphasizeOne?: boolean;
}

/** 数直線SVG。0〜max を den 等分の目盛りで示し、pointNum/den の位置に赤い矢印を置く。 */
export const numberLineSvg = (opts: NumberLineOptions): string => {
  const { den, max, pointNum, labelPoint, emphasizeOne } = opts;
  const W = 460;
  const H = pointNum != null ? 120 : 96;
  const padX = 30;
  const y = pointNum != null ? 72 : 56;
  const innerW = W - padX * 2;
  const unit = innerW / (max * den);

  const el: string[] = [];
  el.push(`<line x1="${padX - 8}" y1="${y}" x2="${W - padX + 8}" y2="${y}" stroke="${AXIS}" stroke-width="2"/>`);
  for (let i = 0; i <= max * den; i++) {
    const x = padX + i * unit;
    const isInt = i % den === 0;
    const h = isInt ? 14 : 8;
    const isOne = emphasizeOne && i === den;
    el.push(`<line x1="${x}" y1="${y - h}" x2="${x}" y2="${y + (isInt ? 4 : 2)}" stroke="${isOne ? HILITE : AXIS}" stroke-width="${isInt ? 2.4 : 1.4}"/>`);
    if (isInt) {
      el.push(`<text x="${x}" y="${y + 24}" fill="${isOne ? HILITE : LABEL}" font-size="15" text-anchor="middle" font-weight="bold">${i / den}</text>`);
    }
  }
  if (pointNum != null) {
    const x = padX + pointNum * unit;
    el.push(`<path d="M ${x} ${y - 18} l -7 -14 h 14 z" fill="${POINT}"/>`);
    el.push(`<line x1="${x}" y1="${y - 18}" x2="${x}" y2="${y - 6}" stroke="${POINT}" stroke-width="2.4"/>`);
    if (labelPoint) {
      el.push(fracLabel(x, y - 48, pointNum % den === 0 ? pointNum / den : pointNum, den, 0, POINT, 12));
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

/**
 * 積み重ね数直線SVG(等しい分数の発見用)。
 * dens の各分母について 0〜1 の数直線を縦に並べ、markNums[i]/dens[i] の位置に点を打つ。
 * 例: 1/2 = 2/4 = 3/6 = 4/8 が縦にそろうことに気づかせる。
 */
export const stackedNumberLinesSvg = (dens: number[], markNums?: (number | null)[]): string => {
  const W = 460;
  const rowH = 52;
  const padX = 56;
  const H = rowH * dens.length + 16;
  const innerW = W - padX - 24;
  const el: string[] = [];
  dens.forEach((den, r) => {
    const y = 34 + r * rowH;
    el.push(fracLabel(24, y, 1, den, 0, LABEL, 11));
    el.push(`<line x1="${padX}" y1="${y}" x2="${padX + innerW}" y2="${y}" stroke="${AXIS}" stroke-width="1.8"/>`);
    for (let i = 0; i <= den; i++) {
      const x = padX + (i / den) * innerW;
      el.push(`<line x1="${x}" y1="${y - 9}" x2="${x}" y2="${y + 5}" stroke="${AXIS}" stroke-width="${i === 0 || i === den ? 2.2 : 1.2}"/>`);
    }
    el.push(`<text x="${padX}" y="${y - 14}" fill="${LABEL}" font-size="11" text-anchor="middle">0</text>`);
    el.push(`<text x="${padX + innerW}" y="${y - 14}" fill="${LABEL}" font-size="11" text-anchor="middle">1</text>`);
    const mark = markNums?.[r];
    if (mark != null) {
      const x = padX + (mark / den) * innerW;
      el.push(`<circle cx="${x}" cy="${y}" r="6" fill="${POINT}"/>`);
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

/**
 * リットルますSVG。1Lますを den 等分し、wholes 個の満杯ます + num/den のますを描く。
 * 例: literSvg(1, 3, 4) = 「1と3/4 L」
 */
export const literSvg = (wholes: number, num: number, den: number): string => {
  const cupW = 84;
  const cupH = 108;
  const gap = 22;
  const count = wholes + (num > 0 ? 1 : 0);
  const W = count * (cupW + gap) + gap;
  const H = cupH + 40;
  const el: string[] = [];
  for (let c = 0; c < count; c++) {
    const x = gap + c * (cupW + gap);
    const yTop = 18;
    const isPartial = c === count - 1 && num > 0;
    const fillLevel = isPartial ? num / den : 1;
    const fillH = cupH * fillLevel;
    // 水
    el.push(`<rect x="${x + 2}" y="${yTop + cupH - fillH}" width="${cupW - 4}" height="${fillH}" fill="${isPartial ? FILL : FILL_DIM}" stroke="none"/>`);
    // ます本体
    el.push(`<rect x="${x}" y="${yTop}" width="${cupW}" height="${cupH}" fill="none" stroke="${AXIS}" stroke-width="2.4"/>`);
    // 目盛り
    for (let i = 1; i < den; i++) {
      const gy = yTop + cupH - (cupH * i) / den;
      el.push(`<line x1="${x}" y1="${gy}" x2="${x + 16}" y2="${gy}" stroke="${AXIS}" stroke-width="1.4"/>`);
      el.push(`<line x1="${x + cupW - 16}" y1="${gy}" x2="${x + cupW}" y2="${gy}" stroke="${AXIS}" stroke-width="1.4"/>`);
    }
    el.push(`<text x="${x + cupW / 2}" y="${yTop + cupH + 18}" fill="${LABEL}" font-size="13" text-anchor="middle">1L</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(count * 110, 340)}">${el.join('')}</svg>`;
};

/** テープ図SVG。1本のテープを den 等分し、先頭から num マスをぬる。wholes 本の満杯テープを前置できる。 */
export const tapeSvg = (num: number, den: number, wholes = 0): string => {
  const W = 440;
  const H = 84;
  const padX = 20;
  const tapeH = 40;
  const y = 14;
  const el: string[] = [];
  const totalCells = (wholes + 1) * den;
  const innerW = W - padX * 2;
  const cellW = innerW / totalCells;
  for (let i = 0; i < totalCells; i++) {
    const x = padX + i * cellW;
    const filled = i < wholes * den + num;
    el.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${tapeH}" fill="${filled ? FILL : 'none'}" stroke="${AXIS}" stroke-width="1.6"/>`);
  }
  // 1 の区切りを太線で
  for (let wIdx = 0; wIdx <= wholes + 1; wIdx++) {
    const x = padX + wIdx * den * cellW;
    el.push(`<line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + tapeH + 4}" stroke="${LABEL}" stroke-width="2.6"/>`);
    el.push(`<text x="${x}" y="${y + tapeH + 22}" fill="${LABEL}" font-size="13" text-anchor="middle">${wIdx}</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};
