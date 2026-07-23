/**
 * components/guided/DecimalColumnCalculator.tsx
 *
 * syo4-syousu の DecimalAddSubModule / DecimalMulDivModule を移植(デザインのみ
 * ダークテーマ化)。小数点を たてにそろえて、右の位から 1けたずつ 確認しながら
 * 計算する「筆算ビルダー」。マスターモードでは 自由に すべて入力してから 採点する。
 */
import React, { useMemo, useState } from 'react';
import type { GuidedDecimalColumnData } from '../../types';

type CellKind = 'blank' | 'digit' | 'helperZero';
interface Cell { place: number; kind: CellKind; digit?: string; }
interface AnswerCell { place: number; active: boolean; expected: string; }

const decimalsOf = (n: number): number => {
  const s = Math.abs(n).toString();
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};
const digitAt = (scaled: number, place: number, maxDec: number): string => {
  const idxFromRight = place + maxDec;
  if (idxFromRight < 0) return '0';
  return (Math.floor(Math.abs(scaled) / 10 ** idxFromRight) % 10).toString();
};
const msdExp = (scaled: number, maxDec: number): number => {
  if (scaled === 0) return -maxDec;
  return scaled.toString().length - 1 - maxDec;
};

/** たし算・ひき算の列モデル(小数点をそろえた筆算の各位) */
function buildAddSubColumns(a: number, b: number, op: '+' | '-') {
  const maxDec = Math.max(decimalsOf(a), decimalsOf(b));
  const scale = 10 ** maxDec;
  const A = Math.round(a * scale);
  const B = Math.round(b * scale);
  const R = op === '+' ? A + B : A - B;
  const maxScaled = Math.max(A, B, Math.abs(R));
  const totalDigits = Math.max(1, maxScaled.toString().length);
  const highExp = totalDigits - 1 - maxDec;
  const places: number[] = [];
  for (let e = highExp; e >= -maxDec; e--) places.push(e);
  const decA = decimalsOf(a);
  const decB = decimalsOf(b);
  const msdA = msdExp(A, maxDec);
  const msdB = msdExp(B, maxDec);
  const msdR = msdExp(R, maxDec);
  const operandCell = (scaled: number, decimals: number, msd: number, place: number): Cell => {
    const top = Math.max(msd, 0);
    if (place > top) return { place, kind: 'blank' };
    if (place < -decimals) return { place, kind: 'helperZero', digit: '0' };
    return { place, kind: 'digit', digit: digitAt(scaled, place, maxDec) };
  };
  const rowA = places.map((p) => operandCell(A, decA, msdA, p));
  const rowB = places.map((p) => operandCell(B, decB, msdB, p));
  const answerTop = Math.max(msdR, 0);
  const answer: AnswerCell[] = places.map((p) => ({ place: p, active: p <= answerTop, expected: p <= answerTop ? digitAt(R, p, maxDec) : '' }));
  return { places, rowA, rowB, answer, result: R / scale, maxDec };
}

/** かけ算・わり算: 小数点を右に寄せて整数として計算し、最後に小数点を打つ */
function buildMulDivColumns(a: number, b: number, op: '×' | '÷') {
  const decA = decimalsOf(a);
  const scale = 10 ** decA;
  const A = Math.round(a * scale);
  const resultRaw = op === '×' ? A * b : A / b;
  const resultScale = op === '×' ? scale : scale;
  const R = op === '×' ? A * b : Math.round(A / b);
  const finalValue = op === '×' ? (A * b) / scale : (A / b) / scale;
  const intStr = String(op === '×' ? Math.abs(R) : Math.abs(R));
  const places: number[] = [];
  for (let i = intStr.length - 1; i >= 0; i--) places.push(i);
  const answer: AnswerCell[] = places.map((p, idx) => ({ place: p, active: true, expected: intStr[idx] }));
  return { intStr, decimalPlaces: decA, answer, finalValue, resultScale };
}

interface Props {
  data: GuidedDecimalColumnData;
  onComplete: (isCorrect: boolean) => void;
}

const DecimalColumnCalculator: React.FC<Props> = ({ data, onComplete }) => {
  const { operator, a, b, masterMode = false } = data;
  const isAddSub = operator === '+' || operator === '-';

  const addSubModel = useMemo(() => (isAddSub ? buildAddSubColumns(a, b, operator as '+' | '-') : null), [a, b, operator, isAddSub]);
  const mulDivModel = useMemo(() => (!isAddSub ? buildMulDivColumns(a, b, operator as '×' | '÷') : null), [a, b, operator, isAddSub]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dotPlaced, setDotPlaced] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [isGraded, setIsGraded] = useState(false);

  const activePlace = useMemo(() => {
    if (addSubModel) {
      for (let i = addSubModel.places.length - 1; i >= 0; i--) {
        const p = addSubModel.places[i];
        const cell = addSubModel.answer.find((c) => c.place === p);
        if (cell?.active && answers[p] === undefined) return p;
      }
    } else if (mulDivModel) {
      for (let i = mulDivModel.answer.length - 1; i >= 0; i--) {
        const p = mulDivModel.answer[i].place;
        if (answers[p] === undefined) return p;
      }
    }
    return null;
  }, [addSubModel, mulDivModel, answers]);

  const activeCell = addSubModel
    ? addSubModel.answer.find((c) => c.place === activePlace)
    : mulDivModel?.answer.find((c) => c.place === activePlace);

  const opWord = operator === '+' ? 'たす' : operator === '-' ? 'ひく' : operator === '×' ? 'かける' : 'わる';

  const allDigitsDone = addSubModel
    ? addSubModel.answer.filter((c) => c.active).every((c) => answers[c.place] !== undefined)
    : mulDivModel
      ? mulDivModel.answer.every((c) => answers[c.place] !== undefined)
      : false;

  const needsDotPlacement = !!mulDivModel && mulDivModel.decimalPlaces > 0;

  const finish = (perfect: boolean) => {
    setFinished(true);
    onComplete(perfect);
  };

  const handleDigit = (d: string) => {
    if (finished || masterMode) return;
    if (activePlace === null || !activeCell) return;
    if (d === activeCell.expected) {
      const next = { ...answers, [activePlace]: d };
      setAnswers(next);
      setHint(null);
      const done = addSubModel
        ? addSubModel.answer.filter((c) => c.active).every((c) => next[c.place] !== undefined)
        : mulDivModel!.answer.every((c) => next[c.place] !== undefined);
      if (done && !needsDotPlacement) finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      if (addSubModel) {
        const aCell = addSubModel.rowA.find((c) => c.place === activePlace);
        const bCell = addSubModel.rowB.find((c) => c.place === activePlace);
        setHint(`${aCell?.digit ?? '0'} を ${opWord} ${bCell?.digit ?? '0'} は いくつかな？くり上がり・くり下がりに気をつけてね。`);
      } else {
        setHint('もういちど、右の位から順番に計算してみよう。');
      }
    }
  };

  const handleDotPlace = (idx: number) => {
    if (!mulDivModel) return;
    if (idx === mulDivModel.decimalPlaces) {
      setDotPlaced(idx);
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      setHint(`かけられる数(または わられる数)の小数点の位置に合わせて、右から ${mulDivModel.decimalPlaces}けた のところに 小数点を うとう。`);
    }
  };

  const handleMasterDigit = (place: number, d: string) => {
    if (finished) return;
    setAnswers((prev) => ({ ...prev, [place]: d }));
  };

  const doGrading = () => {
    let errorsFound = false;
    const cells = addSubModel ? addSubModel.answer.filter((c) => c.active) : mulDivModel!.answer;
    for (const c of cells) {
      if (answers[c.place] !== c.expected) errorsFound = true;
    }
    if (needsDotPlacement && dotPlaced !== mulDivModel!.decimalPlaces) errorsFound = true;
    setIsGraded(true);
    setFinished(true);
    onComplete(!errorsFound);
  };

  const reset = () => {
    setAnswers({});
    setDotPlaced(null);
    setFinished(false);
    setMistakes(0);
    setHint(null);
    setIsGraded(false);
  };

  const CELL = 40;
  const OP_W = 32;

  if (addSubModel) {
    const { places, rowA, rowB, answer } = addSubModel;
    return (
      <div className="w-full flex flex-col gap-3">
        <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 overflow-x-auto">
          <div className="inline-block font-mono text-xl select-none" style={{ minWidth: OP_W + places.length * CELL }}>
            <Row cells={rowA} places={places} cellW={CELL} opW={OP_W} op="" />
            <Row cells={rowB} places={places} cellW={CELL} opW={OP_W} op={operator} />
            <div className="border-t-2 border-white my-1" style={{ marginLeft: OP_W }} />
            <div className="grid" style={{ gridTemplateColumns: `${OP_W}px repeat(${places.length}, ${CELL}px)` }}>
              <div />
              {places.map((p) => {
                const cell = answer.find((c) => c.place === p);
                const val = masterMode ? answers[p] : cell?.active ? answers[p] : undefined;
                const isActive = !masterMode && activePlace === p;
                return (
                  <div key={p} className={`h-10 flex items-center justify-center relative font-black text-lg ${isActive ? 'bg-red-500/10 ring-2 ring-red-400 rounded-lg' : ''}`}>
                    {p === -1 && places.includes(0) && <span className="absolute -left-2 text-red-400">.</span>}
                    {masterMode && cell?.active !== false ? (
                      <button onClick={() => { const d = prompt('数字を入力(0-9)'); if (d && /^[0-9]$/.test(d)) handleMasterDigit(p, d); }} className="text-white">
                        {val ?? (cell?.active ? '？' : '')}
                      </button>
                    ) : (
                      <span className={isGraded ? (val === cell?.expected ? 'text-emerald-400' : 'text-rose-400 bg-rose-950/60 px-1 rounded') : 'text-white'}>
                        {val ?? (isActive ? <span className="text-red-400 animate-pulse">？</span> : '')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {hint && !finished && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <h3 className="text-amber-300 font-black text-sm mb-1">💡 ヒント</h3>
            <p className="text-amber-100/80 text-xs font-bold leading-relaxed">{hint}</p>
          </div>
        )}

        {!finished && !masterMode && (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <button key={n} onClick={() => handleDigit(String(n))} className="h-12 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-xl font-black text-white transition-all">{n}</button>
            ))}
          </div>
        )}

        {!finished && masterMode && !isGraded && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs text-red-300/70 font-bold">マスかん(位)を タップして数字を入力し、すべて うめたら 答え合わせしよう。</p>
            <button onClick={doGrading} className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-[0.98]">
              答え合わせをする
            </button>
          </div>
        )}

        {finished && (
          <div className={`flex flex-col items-center p-5 rounded-2xl text-center gap-2 border ${mistakes === 0 && !isGraded ? 'bg-emerald-950/40 border-emerald-500/30' : isGraded && mistakes === 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-red-950/30 border-red-500/20'}`}>
            <span className="text-4xl">🎉</span>
            <h3 className="text-lg font-black text-emerald-300">できました！</h3>
          </div>
        )}
      </div>
    );
  }

  // 小数×整数・小数÷整数
  const model = mulDivModel!;
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 text-center">
        <p className="text-white font-black text-lg mb-3">{a} {operator} {b} = ?</p>
        <p className="text-red-300/70 text-xs font-bold mb-3">まず 小数点が ないものとして 整数の{operator === '×' ? 'かけ算' : 'わり算'}を しよう。</p>
        <div className="inline-block font-mono text-2xl">
          {model.answer.map((c, idx) => {
            const val = answers[c.place];
            const isActive = !masterMode && activePlace === c.place;
            return (
              <span key={c.place} className={`inline-flex w-9 h-11 items-center justify-center mx-0.5 rounded-lg ${isActive ? 'bg-red-500/10 ring-2 ring-red-400' : ''}`}>
                {masterMode
                  ? val ?? '？'
                  : isGraded
                    ? <span className={val === c.expected ? 'text-emerald-400' : 'text-rose-400'}>{val ?? '?'}</span>
                    : (val ?? (isActive ? <span className="text-red-400 animate-pulse">？</span> : ''))}
              </span>
            );
          })}
        </div>
        {needsDotPlacement && allDigitsDone && (
          <div className="mt-4">
            <p className="text-amber-300 text-xs font-black mb-2">小数点は どこにうつかな？(右から{model.decimalPlaces}けた)</p>
            <div className="flex justify-center gap-1">
              {Array.from({ length: model.intStr.length + 1 }, (_, i) => model.intStr.length - i).map((idx) => (
                <button key={idx} onClick={() => handleDotPlace(idx)} className={`px-2 py-2 rounded-lg text-sm font-black ${dotPlaced === idx ? 'bg-red-600 text-white' : 'bg-slate-900/60 border border-red-900/50 text-red-300 hover:bg-red-900/30'}`}>
                  ｜{idx}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hint && !finished && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <h3 className="text-amber-300 font-black text-sm mb-1">💡 ヒント</h3>
          <p className="text-amber-100/80 text-xs font-bold leading-relaxed">{hint}</p>
        </div>
      )}

      {!finished && !allDigitsDone && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <button key={n} onClick={() => handleDigit(String(n))} className="h-12 bg-slate-900/60 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-xl font-black text-white transition-all">{n}</button>
          ))}
        </div>
      )}

      {finished && (
        <div className="flex flex-col items-center p-5 rounded-2xl text-center gap-2 border bg-emerald-950/40 border-emerald-500/30">
          <span className="text-4xl">🎉</span>
          <h3 className="text-lg font-black text-emerald-300">できました！答え: {model.finalValue}</h3>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ cells: Cell[]; places: number[]; cellW: number; opW: number; op: string }> = ({ cells, places, cellW, opW, op }) => (
  <div className="grid items-center" style={{ gridTemplateColumns: `${opW}px repeat(${places.length}, ${cellW}px)` }}>
    <div className="text-red-400 font-black text-center">{op}</div>
    {places.map((p, i) => {
      const c = cells[i];
      return (
        <div key={p} className="h-10 flex items-center justify-center relative font-black text-white">
          {p === -1 && places.includes(0) && <span className="absolute -left-2 text-white">.</span>}
          {c.kind === 'blank' ? '' : c.kind === 'helperZero' ? <span className="text-red-800">{c.digit}</span> : c.digit}
        </div>
      );
    })}
  </div>
);

export default DecimalColumnCalculator;
