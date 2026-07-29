/**
 * utils/mathSvg.ts — 小4算数 全単元用の視覚表現SVG生成
 * (折れ線グラフ・二次元表・角度図・テープ図・面積図・数直線(大きい数)・組み合わせグラフ)
 *
 * fractionSvg.ts と同じ方針: 決定的な文字列として問題データに埋め込み、
 * text型の共通描画経路(練習/バトル/スピード/本番テスト)で表示する。
 * 配色はダークテーマ前提。
 */

const AXIS = '#cbd5e1';
const LABEL = '#e2e8f0';
const POINT = '#f87171';
const LINE = '#38bdf8';
const BAR = 'rgba(244,114,182,0.55)';
const GRID = 'rgba(148,163,184,0.22)';
const HILITE = '#fbbf24';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ============================================================
// 折れ線グラフ
// ============================================================

export interface LineGraphOptions {
  title: string;
  xLabels: string[];       // 横軸ラベル(時刻など)
  values: number[];        // 各点の値
  yMin: number;
  yMax: number;
  yStep: number;
  yUnit?: string;          // (度) など
  xUnit?: string;          // (時) など
  /** 波線(省略記号)を0とyMinの間に描く */
  brokenAxis?: boolean;
  /** 強調する点のインデックス */
  highlightIndex?: number;
  /**
   * 補助目盛りの間隔(数値ラベルなし・細線)。yStep より細かい値を渡すと、
   * yStep間に補助線を引く。「よみとり」問題で、yStepの目盛り線上に無い値
   * (例: yStep=5でも17度・23度を問う)を、目もりを数えて正確に読めるようにする。
   * 省略時は yStep と同じ(=補助線なし。従来どおり)。
   */
  yMinorStep?: number;
}

export const lineGraphSvg = (o: LineGraphOptions): string => {
  const W = 460;
  const H = 300;
  const padL = 52;
  const padR = 18;
  const padT = 34;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = o.values.length;
  const el: string[] = [];

  const yPos = (v: number) => padT + innerH - ((v - o.yMin) / (o.yMax - o.yMin)) * innerH;
  const xPos = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  el.push(`<text x="${W / 2}" y="18" fill="${LABEL}" font-size="14" text-anchor="middle" font-weight="bold">${esc(o.title)}</text>`);

  // 補助目盛り(数値ラベルなし・細くうすい線)。主目盛りの間を実際に数えて
  // 正確な値を読み取れるようにする(主目盛りの上に無い値を問う設問への対応)。
  const minorStep = o.yMinorStep && o.yMinorStep > 0 && o.yMinorStep < o.yStep ? o.yMinorStep : 0;
  if (minorStep > 0) {
    for (let v = o.yMin; v <= o.yMax + 1e-9; v += minorStep) {
      // 主目盛りと重なる位置は主目盛り側で描画するのでスキップ
      const onMajor = Math.abs((v - o.yMin) / o.yStep - Math.round((v - o.yMin) / o.yStep)) < 1e-6;
      if (onMajor) continue;
      const y = yPos(v);
      el.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2,2"/>`);
    }
  }
  // 目盛り・グリッド(主)
  for (let v = o.yMin; v <= o.yMax + 1e-9; v += o.yStep) {
    const y = yPos(v);
    el.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
    el.push(`<text x="${padL - 6}" y="${y + 4}" fill="${LABEL}" font-size="11" text-anchor="end">${v}</text>`);
  }
  for (let i = 0; i < n; i++) {
    const x = xPos(i);
    el.push(`<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + innerH}" stroke="${GRID}" stroke-width="1"/>`);
    el.push(`<text x="${x}" y="${padT + innerH + 16}" fill="${LABEL}" font-size="11" text-anchor="middle">${esc(o.xLabels[i] ?? '')}</text>`);
  }
  // 軸
  el.push(`<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${AXIS}" stroke-width="2"/>`);
  el.push(`<line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${AXIS}" stroke-width="2"/>`);
  if (o.yUnit) el.push(`<text x="${padL - 6}" y="${padT - 10}" fill="${LABEL}" font-size="11" text-anchor="end">${esc(o.yUnit)}</text>`);
  if (o.xUnit) el.push(`<text x="${W - padR + 2}" y="${padT + innerH + 16}" fill="${LABEL}" font-size="11">${esc(o.xUnit)}</text>`);
  // 波線(省略)
  if (o.brokenAxis) {
    const y = padT + innerH + 6;
    el.push(`<path d="M ${padL - 10} ${y} q 5 -5 10 0 q 5 5 10 0" fill="none" stroke="${AXIS}" stroke-width="1.6"/>`);
  }
  // 折れ線
  const pts = o.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  el.push(`<polyline points="${pts}" fill="none" stroke="${LINE}" stroke-width="2.6"/>`);
  o.values.forEach((v, i) => {
    const hl = i === o.highlightIndex;
    el.push(`<circle cx="${xPos(i)}" cy="${yPos(v)}" r="${hl ? 6 : 4}" fill="${hl ? HILITE : LINE}"/>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

/** ぼうグラフ+折れ線の組み合わせグラフ(数量と気温など) */
export interface ComboGraphOptions {
  title: string;
  xLabels: string[];
  barValues: number[];
  lineValues: number[];
  barMax: number;
  barStep: number;
  lineMin: number;
  lineMax: number;
  lineStep: number;
  barUnit: string;
  lineUnit: string;
}

export const comboGraphSvg = (o: ComboGraphOptions): string => {
  const W = 480;
  const H = 310;
  const padL = 50;
  const padR = 50;
  const padT = 34;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = o.xLabels.length;
  const el: string[] = [];
  const slot = innerW / n;

  el.push(`<text x="${W / 2}" y="18" fill="${LABEL}" font-size="13" text-anchor="middle" font-weight="bold">${esc(o.title)}</text>`);

  // 左軸(ぼう)
  for (let v = 0; v <= o.barMax + 1e-9; v += o.barStep) {
    const y = padT + innerH - (v / o.barMax) * innerH;
    el.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
    el.push(`<text x="${padL - 5}" y="${y + 4}" fill="${LABEL}" font-size="10" text-anchor="end">${v}</text>`);
  }
  // 右軸(折れ線)
  for (let v = o.lineMin; v <= o.lineMax + 1e-9; v += o.lineStep) {
    const y = padT + innerH - ((v - o.lineMin) / (o.lineMax - o.lineMin)) * innerH;
    el.push(`<text x="${W - padR + 5}" y="${y + 4}" fill="${LABEL}" font-size="10">${v}</text>`);
  }
  el.push(`<text x="${padL - 5}" y="${padT - 8}" fill="${LABEL}" font-size="10" text-anchor="end">(${esc(o.barUnit)})</text>`);
  el.push(`<text x="${W - padR + 5}" y="${padT - 8}" fill="${LABEL}" font-size="10">(${esc(o.lineUnit)})</text>`);

  // ぼう
  o.barValues.forEach((v, i) => {
    const bh = (v / o.barMax) * innerH;
    const x = padL + i * slot + slot * 0.22;
    el.push(`<rect x="${x}" y="${padT + innerH - bh}" width="${slot * 0.56}" height="${bh}" fill="${BAR}" stroke="rgba(244,114,182,0.9)" stroke-width="1"/>`);
  });
  // 折れ線
  const lx = (i: number) => padL + i * slot + slot / 2;
  const ly = (v: number) => padT + innerH - ((v - o.lineMin) / (o.lineMax - o.lineMin)) * innerH;
  el.push(`<polyline points="${o.lineValues.map((v, i) => `${lx(i)},${ly(v)}`).join(' ')}" fill="none" stroke="${LABEL}" stroke-width="2.2"/>`);
  o.lineValues.forEach((v, i) => el.push(`<circle cx="${lx(i)}" cy="${ly(v)}" r="3.6" fill="${LABEL}"/>`));
  // x軸ラベル
  o.xLabels.forEach((lb, i) => el.push(`<text x="${lx(i)}" y="${padT + innerH + 15}" fill="${LABEL}" font-size="10" text-anchor="middle">${esc(lb)}</text>`));
  el.push(`<line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${AXIS}" stroke-width="2"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

// ============================================================
// 二次元表
// ============================================================

export interface TwoWayTableOptions {
  title: string;
  /** 左上の斜線セルの右/下ラベル(例: 場所, けがの種類) */
  colHeader: string;
  rowHeader: string;
  cols: string[];       // 列名(合計含めない)
  rows: string[];       // 行名(合計含めない)
  cells: (number | string)[][]; // rows×cols。'?'などの文字も可
  colTotals?: (number | string)[];
  rowTotals?: (number | string)[];
  grandTotal?: number | string;
  unit?: string;
}

export const twoWayTableSvg = (o: TwoWayTableOptions): string => {
  const cols = [...o.cols, '合計'];
  const rows = [...o.rows, '合計'];
  const headW = 96;
  const cellW = Math.max(58, Math.min(84, Math.floor(330 / cols.length)));
  const cellH = 34;
  const W = headW + cols.length * cellW + 8;
  const H = 30 + (rows.length + 1) * cellH + 8;
  const el: string[] = [];
  el.push(`<text x="${W / 2}" y="16" fill="${LABEL}" font-size="13" text-anchor="middle" font-weight="bold">${esc(o.title)}${o.unit ? `　(${esc(o.unit)})` : ''}</text>`);
  const top = 26;
  const cellVal = (r: number, c: number): string => {
    if (r < o.rows.length && c < o.cols.length) return String(o.cells[r]?.[c] ?? '');
    if (r < o.rows.length && c === o.cols.length) return String(o.rowTotals?.[r] ?? '');
    if (r === o.rows.length && c < o.cols.length) return String(o.colTotals?.[c] ?? '');
    return String(o.grandTotal ?? '');
  };
  // ヘッダ行
  el.push(`<rect x="4" y="${top}" width="${headW}" height="${cellH}" fill="rgba(148,163,184,0.15)" stroke="${AXIS}"/>`);
  el.push(`<line x1="4" y1="${top}" x2="${4 + headW}" y2="${top + cellH}" stroke="${AXIS}" stroke-width="1"/>`);
  el.push(`<text x="${4 + headW - 6}" y="${top + 13}" fill="${LABEL}" font-size="9.5" text-anchor="end">${esc(o.colHeader)}</text>`);
  el.push(`<text x="10" y="${top + cellH - 5}" fill="${LABEL}" font-size="9.5">${esc(o.rowHeader)}</text>`);
  cols.forEach((c, i) => {
    const x = 4 + headW + i * cellW;
    el.push(`<rect x="${x}" y="${top}" width="${cellW}" height="${cellH}" fill="rgba(148,163,184,0.15)" stroke="${AXIS}"/>`);
    el.push(`<text x="${x + cellW / 2}" y="${top + cellH / 2 + 4}" fill="${LABEL}" font-size="11" text-anchor="middle" font-weight="bold">${esc(c)}</text>`);
  });
  // 本体
  rows.forEach((r, ri) => {
    const y = top + (ri + 1) * cellH;
    el.push(`<rect x="4" y="${y}" width="${headW}" height="${cellH}" fill="rgba(148,163,184,0.12)" stroke="${AXIS}"/>`);
    el.push(`<text x="${4 + headW / 2}" y="${y + cellH / 2 + 4}" fill="${LABEL}" font-size="11" text-anchor="middle" font-weight="bold">${esc(r)}</text>`);
    cols.forEach((_, ci) => {
      const x = 4 + headW + ci * cellW;
      const v = cellVal(ri, ci);
      const isQ = v.includes('?') || v.includes('あ') && v.length === 1;
      el.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${isQ ? 'rgba(251,191,36,0.15)' : 'none'}" stroke="${AXIS}"/>`);
      el.push(`<text x="${x + cellW / 2}" y="${y + cellH / 2 + 5}" fill="${isQ ? HILITE : LABEL}" font-size="14" text-anchor="middle" font-weight="bold">${esc(v)}</text>`);
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

/** ○×の記録表(妹・弟調べのような生データ) */
export const recordTableSvg = (title: string, names: string[], rowLabels: [string, string], marks: [boolean[], boolean[]]): string => {
  const headW = 54;
  const cellW = 34;
  const cellH = 30;
  const W = headW + names.length * cellW + 8;
  const H = 26 + 3 * cellH + 10;
  const el: string[] = [];
  el.push(`<text x="${W / 2}" y="15" fill="${LABEL}" font-size="12" text-anchor="middle" font-weight="bold">${esc(title)}</text>`);
  const top = 22;
  const rows = [['名前', ...names], [rowLabels[0], ...marks[0].map(m => (m ? '○' : '×'))], [rowLabels[1], ...marks[1].map(m => (m ? '○' : '×'))]];
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const x = ci === 0 ? 4 : 4 + headW + (ci - 1) * cellW;
      const w = ci === 0 ? headW : cellW;
      const y = top + ri * cellH;
      el.push(`<rect x="${x}" y="${y}" width="${w}" height="${cellH}" fill="${ri === 0 || ci === 0 ? 'rgba(148,163,184,0.15)' : 'none'}" stroke="${AXIS}"/>`);
      el.push(`<text x="${x + w / 2}" y="${y + cellH / 2 + 4}" fill="${LABEL}" font-size="11" text-anchor="middle"${ri === 0 || ci === 0 ? ' font-weight="bold"' : ''}>${esc(String(v))}</text>`);
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

// ============================================================
// 角度
// ============================================================

/**
 * 半直線2本のなす角を描く。deg: 反時計回りの角度、markはこの角に弧を描く。
 * base: 基準線の向き(度、0=右)。
 */
export const angleSvg = (deg: number, opts?: { base?: number; label?: string; showLabel?: boolean }): string => {
  const W = 300;
  const H = 220;
  const cx = 130;
  const cy = deg > 180 ? 110 : 150;
  const r = 105;
  const base = opts?.base ?? 0;
  const el: string[] = [];
  const rad = (d: number) => (-d * Math.PI) / 180;
  const pt = (d: number, rr = r) => `${cx + rr * Math.cos(rad(d))} ${cy + rr * Math.sin(rad(d))}`;
  // 2本の半直線
  el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(base).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2.4"/>`);
  el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(base + deg).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2.4"/>`);
  // 弧
  const arcR = 34;
  const large = deg > 180 ? 1 : 0;
  el.push(`<path d="M ${pt(base, arcR)} A ${arcR} ${arcR} 0 ${large} 0 ${pt(base + deg, arcR)}" fill="none" stroke="${POINT}" stroke-width="2.2"/>`);
  // ラベル
  const mid = base + deg / 2;
  const lp = pt(mid, arcR + 22).split(' ');
  el.push(`<text x="${lp[0]}" y="${lp[1]}" fill="${POINT}" font-size="16" text-anchor="middle" font-weight="bold">${esc(opts?.showLabel === false ? (opts?.label ?? '?') : (opts?.label ?? `${deg}°`))}</text>`);
  el.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${AXIS}"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 320)}">${el.join('')}</svg>`;
};

/** 交わる2直線。given の角を示し、? の角(隣り合う/向かい合う)を問う */
export const crossingLinesSvg = (givenDeg: number, askAdjacent: boolean): string => {
  const W = 320;
  const H = 200;
  const cx = 160;
  const cy = 100;
  const r = 130;
  const tilt = 18; // 片方の直線の傾き
  const el: string[] = [];
  const rad = (d: number) => (-d * Math.PI) / 180;
  const px = (d: number, rr = r) => cx + rr * Math.cos(rad(d));
  const py = (d: number, rr = r) => cy + rr * Math.sin(rad(d));
  // 直線1(水平気味) 直線2(givenDeg の角をなす)
  const d1 = tilt;
  const d2 = tilt + givenDeg;
  el.push(`<line x1="${px(d1)}" y1="${py(d1)}" x2="${px(d1 + 180)}" y2="${py(d1 + 180)}" stroke="${AXIS}" stroke-width="2.2"/>`);
  el.push(`<line x1="${px(d2)}" y1="${py(d2)}" x2="${px(d2 + 180)}" y2="${py(d2 + 180)}" stroke="${AXIS}" stroke-width="2.2"/>`);
  // given角の弧(d1→d2)
  const arc = (from: number, to: number, rr: number, color: string) => {
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `<path d="M ${px(from, rr)} ${py(from, rr)} A ${rr} ${rr} 0 ${large} 0 ${px(to, rr)} ${py(to, rr)}" fill="none" stroke="${color}" stroke-width="2"/>`;
  };
  el.push(arc(d1, d2, 28, LINE));
  const gm = (d1 + d2) / 2;
  el.push(`<text x="${px(gm, 48)}" y="${py(gm, 48)}" fill="${LINE}" font-size="14" text-anchor="middle" font-weight="bold">${givenDeg}°</text>`);
  // 問う角: 隣(d2→d1+180) または 向かい(d1+180→d2+180)
  if (askAdjacent) {
    el.push(arc(d2, d1 + 180, 24, POINT));
    const m = (d2 + d1 + 180) / 2;
    el.push(`<text x="${px(m, 44)}" y="${py(m, 44)}" fill="${POINT}" font-size="15" text-anchor="middle" font-weight="bold">あ</text>`);
  } else {
    el.push(arc(d1 + 180, d2 + 180, 24, POINT));
    const m = (d1 + 180 + d2 + 180) / 2;
    el.push(`<text x="${px(m, 44)}" y="${py(m, 44)}" fill="${POINT}" font-size="15" text-anchor="middle" font-weight="bold">あ</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

/**
 * 三角じょうぎ2まいを 組み合わせた／かさねた角を示す図。
 * mode 'add': 0°→a° と a°→(a+b)° を隣どうしに並べ、合計の「あ」の角を外側に示す。
 * mode 'sub': 0°→b°(大きいほう)の上に 0°→a°(小さいほう)を重ね、のこりの a°→b° を「あ」として示す。
 */
export const sankakuJougiSvg = (a: number, b: number, mode: 'add' | 'sub'): string => {
  const W = 300;
  const H = 220;
  const cx = 150;
  const cy = 190;
  const r = 120;
  const rad = (d: number) => (-d * Math.PI) / 180;
  const pt = (d: number, rr = r) => `${cx + rr * Math.cos(rad(d))} ${cy + rr * Math.sin(rad(d))}`;
  const wedge = (from: number, to: number, rr: number, fill: string): string => {
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `<path d="M ${cx} ${cy} L ${pt(from, rr)} A ${rr} ${rr} 0 ${large} 0 ${pt(to, rr)} Z" fill="${fill}" stroke="${AXIS}" stroke-width="1.5"/>`;
  };
  const arcLabel = (from: number, to: number, rr: number, text: string, color: string): string => {
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const mid = (from + to) / 2;
    const lp = pt(mid, rr + 20).split(' ');
    return `<path d="M ${pt(from, rr)} A ${rr} ${rr} 0 ${large} 0 ${pt(to, rr)}" fill="none" stroke="${color}" stroke-width="2.2"/>`
      + `<text x="${lp[0]}" y="${lp[1]}" fill="${color}" font-size="16" text-anchor="middle" font-weight="bold">${esc(text)}</text>`;
  };
  const el: string[] = [];
  // 台となる水平の半直線(0°)
  el.push(`<line x1="${cx}" y1="${cy}" x2="${cx + r + 10}" y2="${cy}" stroke="${AXIS}" stroke-width="2"/>`);

  if (mode === 'add') {
    // 隣どうしに並べる: 0→a(三角定規1) と a→a+b(三角定規2)
    el.push(wedge(0, a, r, 'rgba(56,189,248,0.28)'));
    el.push(wedge(a, a + b, r, 'rgba(244,114,182,0.28)'));
    el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(a).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2"/>`);
    el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(a + b).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2"/>`);
    el.push(arcLabel(0, a, 30, `${a}°`, LINE));
    el.push(arcLabel(a, a + b, 30, `${b}°`, '#f472b6'));
    el.push(arcLabel(0, a + b, 62, 'あ', POINT));
  } else {
    // 重ねる: 大きいほう(b)の上に 小さいほう(a)を重ねる。のこり(a→b)が「あ」
    el.push(wedge(0, b, r, 'rgba(56,189,248,0.22)'));
    el.push(wedge(0, a, r * 0.82, 'rgba(244,114,182,0.4)'));
    el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(a).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2" stroke-dasharray="4 3"/>`);
    el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(b).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2"/>`);
    el.push(arcLabel(0, a, 26, `${a}°`, '#f472b6'));
    el.push(arcLabel(0, b, 46, `${b}°`, LINE));
    el.push(arcLabel(a, b, 68, 'あ', POINT));
  }
  el.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${AXIS}"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 300)}">${el.join('')}</svg>`;
};

/** 一直線(180°)を knownDeg と のこり に分ける図。knownDeg側は数値、のこりは「あ」とラベルする */
export const straightLineAngleSvg = (knownDeg: number): string => {
  const W = 300;
  const H = 170;
  const cx = 150;
  const cy = 140;
  const r = 120;
  const rad = (d: number) => (-d * Math.PI) / 180;
  const pt = (d: number, rr = r) => `${cx + rr * Math.cos(rad(d))} ${cy + rr * Math.sin(rad(d))}`;
  const wedge = (from: number, to: number, rr: number, fill: string): string => {
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `<path d="M ${cx} ${cy} L ${pt(from, rr)} A ${rr} ${rr} 0 ${large} 0 ${pt(to, rr)} Z" fill="${fill}" stroke="${AXIS}" stroke-width="1.5"/>`;
  };
  const arcLabel = (from: number, to: number, rr: number, text: string, color: string): string => {
    const mid = (from + to) / 2;
    const lp = pt(mid, rr + 20).split(' ');
    return `<text x="${lp[0]}" y="${lp[1]}" fill="${color}" font-size="16" text-anchor="middle" font-weight="bold">${esc(text)}</text>`;
  };
  const el: string[] = [];
  el.push(`<line x1="${cx - r - 10}" y1="${cy}" x2="${cx + r + 10}" y2="${cy}" stroke="${AXIS}" stroke-width="2.4"/>`);
  el.push(wedge(0, knownDeg, r * 0.55, 'rgba(56,189,248,0.28)'));
  el.push(wedge(knownDeg, 180, r * 0.55, 'rgba(244,114,182,0.28)'));
  el.push(`<line x1="${cx}" y1="${cy}" x2="${pt(knownDeg).replace(' ', '" y2="')}" stroke="${AXIS}" stroke-width="2"/>`);
  el.push(arcLabel(0, knownDeg, r * 0.55 + 18, `${knownDeg}°`, LINE));
  el.push(arcLabel(knownDeg, 180, r * 0.55 + 18, 'あ', POINT));
  el.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${AXIS}"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 300)}">${el.join('')}</svg>`;
};

/**
 * 立方体の展開図(横に4面ならんだ帯 + 上下にタブ2面)。
 * tabCol(0〜3)は タブが どの列に つくかを示す。
 * 向かい合う面は 帯の中では常に (0列,2列) と (1列,3列)、タブどうしは常に向かい合う
 * (組み立てると帯が側面をぐるっと1周し、タブが天面・底面になるため)。
 */
export const cubeNetSvg = (tabCol: 0 | 1 | 2 | 3, labels: [string, string, string, string, string, string]): string => {
  const cell = 46;
  const gap = 3;
  const W = (cell + gap) * 4 + gap;
  const H = (cell + gap) * 3 + gap;
  const colors = ['rgba(56,189,248,0.22)', 'rgba(244,114,182,0.22)', 'rgba(251,191,36,0.22)', 'rgba(74,222,128,0.22)', 'rgba(167,139,250,0.22)', 'rgba(248,113,113,0.22)'];
  const sq = (row: number, col: number, label: string, colorIdx: number): string => {
    const x = gap + col * (cell + gap);
    const y = gap + row * (cell + gap);
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${colors[colorIdx]}" stroke="${AXIS}" stroke-width="2"/>`
      + `<text x="${x + cell / 2}" y="${y + cell / 2 + 6}" fill="${LABEL}" font-size="20" text-anchor="middle" font-weight="bold">${esc(label)}</text>`;
  };
  const el: string[] = [];
  for (let c = 0; c < 4; c++) el.push(sq(1, c, labels[c], c));
  el.push(sq(0, tabCol, labels[4], 4));
  el.push(sq(2, tabCol, labels[5], 5));
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 260)}">${el.join('')}</svg>`;
};

/**
 * 直方体の見取図(ワイヤーフレーム)。頂点に A〜H のラベルをつける。
 * 手前の面: A(左下前)B(右下前)C(右上前)D(左上前)、おくの面: E F G H(同じ並び)。
 */
export const cuboidWireframeSvg = (opts?: { highlightEdge?: [string, string] }): string => {
  const W = 260;
  const H = 200;
  // 手前の面の四隅
  const front = { A: [60, 160], B: [190, 160], C: [190, 60], D: [60, 60] };
  // 奥の面(右上にずらして立体感を出す)
  const back = { E: [100, 120], F: [230, 120], G: [230, 20], H: [100, 20] };
  const pts: Record<string, [number, number]> = { ...front, ...back } as any;
  const edges: [string, string][] = [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], // 手前の面
    ['E', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'E'], // 奥の面
    ['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H'], // つなぐ辺
  ];
  const isHi = (a: string, b: string) =>
    !!opts?.highlightEdge && ((opts.highlightEdge[0] === a && opts.highlightEdge[1] === b) || (opts.highlightEdge[0] === b && opts.highlightEdge[1] === a));
  const el: string[] = [];
  for (const [a, b] of edges) {
    const hi = isHi(a, b);
    el.push(`<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="${hi ? POINT : AXIS}" stroke-width="${hi ? 3.5 : 2}"/>`);
  }
  for (const [name, [x, y]] of Object.entries(pts)) {
    el.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="${LABEL}"/>`);
    el.push(`<text x="${x + (name <= 'D' ? 0 : 8)}" y="${y + (name <= 'D' ? 18 : -6)}" fill="${LABEL}" font-size="14" text-anchor="middle" font-weight="bold">${esc(name)}</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 280)}">${el.join('')}</svg>`;
};

// ============================================================
// テープ図(倍の見方)
// ============================================================

export const ratioTapeSvg = (baseLabel: string, compareLabel: string, times: number, opts?: { baseValue?: string; compareValue?: string }): string => {
  const W = 440;
  const H = 130;
  const padX = 96;
  const unitW = (W - padX - 20) / Math.max(times, 3);
  const el: string[] = [];
  // もとにする量(1本)
  el.push(`<text x="${padX - 8}" y="34" fill="${LABEL}" font-size="12" text-anchor="end" font-weight="bold">${esc(baseLabel)}</text>`);
  el.push(`<rect x="${padX}" y="18" width="${unitW}" height="26" fill="rgba(56,189,248,0.4)" stroke="${AXIS}" stroke-width="1.6"/>`);
  if (opts?.baseValue) el.push(`<text x="${padX + unitW / 2}" y="36" fill="${LABEL}" font-size="12" text-anchor="middle">${esc(opts.baseValue)}</text>`);
  // くらべられる量(times 本)
  el.push(`<text x="${padX - 8}" y="86" fill="${LABEL}" font-size="12" text-anchor="end" font-weight="bold">${esc(compareLabel)}</text>`);
  for (let i = 0; i < times; i++) {
    el.push(`<rect x="${padX + i * unitW}" y="70" width="${unitW}" height="26" fill="rgba(244,114,182,0.4)" stroke="${AXIS}" stroke-width="1.6"/>`);
  }
  if (opts?.compareValue) el.push(`<text x="${padX + (times * unitW) / 2}" y="88" fill="${LABEL}" font-size="12" text-anchor="middle">${esc(opts.compareValue)}</text>`);
  el.push(`<text x="${padX + (times * unitW) / 2}" y="116" fill="${HILITE}" font-size="12" text-anchor="middle">「1」とみた ${esc(baseLabel)} の ${times}つ分</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

// ============================================================
// 面積(長方形・正方形・複合図形)
// ============================================================

export const rectAreaSvg = (wLabel: string, hLabel: string, opts?: { square?: boolean }): string => {
  const W = 320;
  const H = 200;
  const rw = opts?.square ? 130 : 200;
  const rh = 130;
  const x = (W - rw) / 2;
  const y = 24;
  const el: string[] = [];
  el.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="rgba(56,189,248,0.18)" stroke="${AXIS}" stroke-width="2.2"/>`);
  el.push(`<text x="${x + rw / 2}" y="${y + rh + 22}" fill="${LABEL}" font-size="14" text-anchor="middle" font-weight="bold">${esc(wLabel)}</text>`);
  el.push(`<text x="${x - 10}" y="${y + rh / 2 + 5}" fill="${LABEL}" font-size="14" text-anchor="end" font-weight="bold">${esc(hLabel)}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${Math.min(W, 300)}">${el.join('')}</svg>`;
};

/** L字型の複合図形(全体 bigW×bigH から右上 cutW×cutH を切り取った形) */
export const lShapeAreaSvg = (bigW: number, bigH: number, cutW: number, cutH: number, unit: string): string => {
  const W = 340;
  const H = 230;
  const scale = Math.min(220 / bigW, 150 / bigH);
  const x0 = 60;
  const y0 = 30;
  const bw = bigW * scale;
  const bh = bigH * scale;
  const cw = cutW * scale;
  const ch = cutH * scale;
  // L字: 左下原点。右上を切り取る
  const path = `M ${x0} ${y0 + bh} L ${x0} ${y0} L ${x0 + bw - cw} ${y0} L ${x0 + bw - cw} ${y0 + ch} L ${x0 + bw} ${y0 + ch} L ${x0 + bw} ${y0 + bh} Z`;
  const el: string[] = [];
  el.push(`<path d="${path}" fill="rgba(56,189,248,0.18)" stroke="${AXIS}" stroke-width="2.2"/>`);
  el.push(`<text x="${x0 - 8}" y="${y0 + bh / 2}" fill="${LABEL}" font-size="13" text-anchor="end" font-weight="bold">${bigH}${esc(unit)}</text>`);
  el.push(`<text x="${x0 + bw / 2}" y="${y0 + bh + 20}" fill="${LABEL}" font-size="13" text-anchor="middle" font-weight="bold">${bigW}${esc(unit)}</text>`);
  el.push(`<text x="${x0 + bw - cw / 2}" y="${y0 - 8}" fill="${HILITE}" font-size="12" text-anchor="middle" font-weight="bold">${cutW}${esc(unit)}</text>`);
  el.push(`<text x="${x0 + bw - cw - 8}" y="${y0 + ch / 2 + 4}" fill="${HILITE}" font-size="12" text-anchor="end" font-weight="bold">${cutH}${esc(unit)}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

// ============================================================
// 大きい数の数直線(億・兆)
// ============================================================

/** 目盛りラベルを任意文字列で指定できる数直線。pointIndex 番目の目盛りに↓ */
export const labeledNumberLineSvg = (tickCount: number, labels: Record<number, string>, pointIndex: number): string => {
  const W = 460;
  const H = 110;
  const padX = 34;
  const innerW = W - padX * 2;
  const y = 66;
  const el: string[] = [];
  el.push(`<line x1="${padX - 8}" y1="${y}" x2="${W - padX + 8}" y2="${y}" stroke="${AXIS}" stroke-width="2"/>`);
  for (let i = 0; i < tickCount; i++) {
    const x = padX + (i / (tickCount - 1)) * innerW;
    const major = labels[i] != null;
    el.push(`<line x1="${x}" y1="${y - (major ? 13 : 8)}" x2="${x}" y2="${y + 3}" stroke="${AXIS}" stroke-width="${major ? 2.2 : 1.2}"/>`);
    if (major) el.push(`<text x="${x}" y="${y + 22}" fill="${LABEL}" font-size="12" text-anchor="middle" font-weight="bold">${esc(labels[i])}</text>`);
  }
  const px = padX + (pointIndex / (tickCount - 1)) * innerW;
  el.push(`<path d="M ${px} ${y - 20} l -7 -14 h 14 z" fill="${POINT}"/>`);
  el.push(`<line x1="${px}" y1="${y - 20}" x2="${px}" y2="${y - 6}" stroke="${POINT}" stroke-width="2.4"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};

// ============================================================
// 変わり方調べ(対応表)
// ============================================================

export const pairTableSvg = (title: string, xLabel: string, yLabel: string, xs: (number | string)[], ys: (number | string)[]): string => {
  const headW = 92;
  const cellW = 52;
  const cellH = 32;
  const W = headW + xs.length * cellW + 8;
  const H = 24 + 2 * cellH + 10;
  const el: string[] = [];
  el.push(`<text x="${W / 2}" y="14" fill="${LABEL}" font-size="12" text-anchor="middle" font-weight="bold">${esc(title)}</text>`);
  const top = 20;
  const rows = [[xLabel, ...xs.map(String)], [yLabel, ...ys.map(String)]];
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const x = ci === 0 ? 4 : 4 + headW + (ci - 1) * cellW;
      const w = ci === 0 ? headW : cellW;
      const yy = top + ri * cellH;
      const isQ = v === '?' || v === '□';
      el.push(`<rect x="${x}" y="${yy}" width="${w}" height="${cellH}" fill="${ci === 0 ? 'rgba(148,163,184,0.15)' : isQ ? 'rgba(251,191,36,0.15)' : 'none'}" stroke="${AXIS}"/>`);
      el.push(`<text x="${x + w / 2}" y="${yy + cellH / 2 + 4}" fill="${isQ ? HILITE : LABEL}" font-size="12" text-anchor="middle" font-weight="bold">${esc(v)}</text>`);
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${el.join('')}</svg>`;
};
