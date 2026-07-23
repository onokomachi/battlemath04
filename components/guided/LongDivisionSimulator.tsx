/**
 * components/guided/LongDivisionSimulator.tsx
 *
 * wari-hissann3 の DivisionSimulator.tsx を機能そのまま移植したコンポーネント。
 * (デザインのみ Battle-Math:04 のダーク/レッド系テーマへ変更。ロジックは同一)
 *
 * 位取りの自己選択 → たてる → かける → ひく → おろす、を1けたずつ採点し、
 * 2けたの除数では仮商のやり直しダイアログを出す。マスターモードでは
 * 手順の誘導を出さず、筆算のマス目を自由な順番でタップして入力し、
 * 最後に「答え合わせ」で一括採点する(商を立て忘れる、といったつまずきを
 * 自分で気づけるようにするため)。
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { GuidedDivisionHissanData } from '../../types';

type StepType = 'PLACE' | 'DIVIDE' | 'MULTIPLY' | 'SUBTRACT' | 'BRING_DOWN';

interface RealStep {
  type: 'CALC' | 'ZERO';
  index: number;
  digitIndex: number;
  quotient: number;
  multiply: number;
  remainder: number;
  dividendPart: number;
}

interface GridRow {
  type: 'quotient' | 'frame' | 'multiply' | 'remainder';
  values?: (number | null)[];
  divisor?: string;
  dividend?: string;
  value?: string | number;
  offset?: number;
}

interface Props {
  data: GuidedDivisionHissanData;
  onComplete: (isCorrect: boolean) => void;
}

const LongDivisionSimulator: React.FC<Props> = ({ data, onComplete }) => {
  const { dividend, divisor, zeroShortcut = false, masterMode = false } = data;
  const dividendStr = dividend.toString();
  const divisorStr = divisor.toString();
  const isTwoDigitDivisor = divisor >= 10;
  const divisorColPx = Math.max(56, divisorStr.length * 30 + 10);
  const roundedDivisor = divisor >= 100
    ? Math.max(100, Math.round(divisor / 100) * 100)
    : Math.max(10, Math.round(divisor / 10) * 10);

  const realSteps = useMemo<RealStep[]>(() => {
    const steps: RealStep[] = [];
    let currentValStr = '';
    for (let i = 0; i < dividendStr.length; i++) {
      currentValStr += dividendStr[i];
      const currentVal = parseInt(currentValStr, 10);
      if (currentVal >= divisor || (i === dividendStr.length - 1 && steps.length === 0)) {
        const q = Math.floor(currentVal / divisor);
        const m = q * divisor;
        const r = currentVal - divisor * q;
        steps.push({ type: 'CALC', index: i, digitIndex: i, quotient: q, multiply: m, remainder: r, dividendPart: currentVal });
        currentValStr = r.toString();
      } else if (steps.length > 0) {
        steps.push({ type: 'ZERO', index: i, digitIndex: i, quotient: 0, multiply: 0, remainder: currentVal, dividendPart: currentVal });
        currentValStr = currentVal.toString();
      }
    }
    return steps;
  }, [dividend, divisor]);

  // マスターモードの自由入力用に、各行の値だけでなく列位置(offset)も
  // あらかじめ計算しておく(位置は問題の構造で決まる既知の情報であり、
  // 採点対象は「そこに書く数字」のみ。これは非マスターモードの逐次表示と同じ考え方)
  const expectedRowMeta = useMemo(() => {
    const rows: { type: 'multiply' | 'remainder'; value: string; offset: number; stepIndex: number }[] = [];
    for (let s = 0; s < realSteps.length; s++) {
      const step = realSteps[s];
      if (zeroShortcut && step.type === 'ZERO') continue;
      rows.push({ type: 'multiply', value: step.multiply.toString(), offset: step.index, stepIndex: step.index });
      let display = step.remainder === 0 ? '' : step.remainder.toString();
      let offset = step.index;
      let t = s + 1;
      while (t < realSteps.length) {
        display = (display === '0' ? '' : display) + dividendStr[realSteps[t].digitIndex];
        offset = realSteps[t].digitIndex;
        if (!(zeroShortcut && realSteps[t].type === 'ZERO')) break;
        t++;
      }
      rows.push({ type: 'remainder', value: display === '' ? '0' : display, offset, stepIndex: step.index });
    }
    return rows;
  }, [realSteps, zeroShortcut, dividendStr]);

  const expectedRows = useMemo(() => expectedRowMeta.map((r) => r.value), [expectedRowMeta]);

  const buildInitialGrid = (): GridRow[] => {
    const base: GridRow[] = [
      { type: 'quotient', values: Array(dividendStr.length).fill(null) },
      { type: 'frame', divisor: divisorStr, dividend: dividendStr },
    ];
    if (!masterMode) return base;
    // マスターモード: 手順を待たず、すべての行を空欄であらかじめ並べておく
    return [
      ...base,
      ...expectedRowMeta.map((r) => ({ type: r.type, value: '', offset: r.offset } as GridRow)),
    ];
  };

  const [stepIndex, setStepIndex] = useState(0);
  const [subStep, setSubStep] = useState<StepType>('PLACE');
  const [userInput, setUserInput] = useState('');
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [placeMistakes, setPlaceMistakes] = useState(0);
  const [trialQuotient, setTrialQuotient] = useState<number | null>(null);
  const [rollbackPrompt, setRollbackPrompt] = useState<{ message: string; buttonLabel: string; action: () => void } | null>(null);
  const [isAllEntered, setIsAllEntered] = useState(false);
  const [isGraded, setIsGraded] = useState(false);
  const [hasMistakes, setHasMistakes] = useState<boolean | null>(null);
  // エビデンスA: プリテスト効果 (Kornell, Hays & Bjork, 2009) — ヒントを見る前に
  // まず自力で1回考えさせると、その後の定着が向上する。ステップが変わるたびに
  // リセットし、まちがえた時だけ自動表示する(見たい時は手動でも開ける)。
  const [hintRevealed, setHintRevealed] = useState(false);
  // マスターモード: どのマスを選んで入力中か(自由な順番でタップして選べる)
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const isProcessing = React.useRef(false);

  useEffect(() => {
    setGridData(buildInitialGrid());
    setMistakeCount(0);
    setIsAllEntered(false);
    setIsGraded(false);
    setHasMistakes(null);
    setStepIndex(0);
    setSubStep('PLACE');
    setUserInput('');
    setIsFinished(false);
    setPlaceMistakes(0);
    setTrialQuotient(null);
    setRollbackPrompt(null);
    setFeedback(null);
    setHintRevealed(false);
    setSelectedCell(masterMode ? 'q-0' : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dividend, divisor, masterMode]);

  // ステップが進むたびに「まず自力で考える」状態に戻す(プリテスト効果)
  useEffect(() => {
    setHintRevealed(false);
  }, [stepIndex, subStep]);

  const activeStep = realSteps[stepIndex];
  const nextStep = realSteps[stepIndex + 1];

  const getRowCorrectValue = (rowIdx: number): string => expectedRows[rowIdx - 2] ?? '';

  const writeQuotient = (val: number) => {
    setGridData((prev) => {
      const next = [...prev];
      if (next[0] && activeStep) {
        const newValues = [...(next[0].values || [])];
        newValues[activeStep.index] = val;
        next[0] = { ...next[0], values: newValues };
      }
      return next;
    });
  };

  const handlePlaceTap = (colIdx: number) => {
    if (subStep !== 'PLACE' || isFinished) return;
    const correctIdx = realSteps[0]?.index ?? 0;
    const prefix = dividendStr.slice(0, correctIdx + 1);

    if (colIdx === correctIdx) {
      setSubStep('DIVIDE');
      setFeedback(`そのとおり！\n${prefix} の中に ${divisor} が入るから、この位から商を立てるよ。`);
      return;
    }

    setMistakeCount((prev) => prev + 1);
    setHintRevealed(true);
    setPlaceMistakes((prev) => prev + 1);

    if (colIdx < correctIdx) {
      const tapped = dividendStr.slice(0, colIdx + 1);
      setFeedback(`${tapped} は ${divisor} より小さいから、ここには商を立てられないよ。\nもう1けた ふやして くらべてみよう。`);
    } else {
      setFeedback(`もっと大きい位から 立てられるよ。\n左から じゅんばんに「${divisor} が入るかな？」と くらべてみよう。`);
    }
  };

  const rollbackTrial = (suggestedNext: number, rowsToRemove: number) => {
    setRollbackPrompt(null);
    setGridData((prev) => {
      const next = prev.slice(0, prev.length - rowsToRemove);
      if (next[0] && activeStep) {
        const newValues = [...(next[0].values || [])];
        newValues[activeStep.index] = null;
        next[0] = { ...next[0], values: newValues };
      }
      return next;
    });
    setTrialQuotient(null);
    setUserInput('');
    setSubStep('DIVIDE');
    setFeedback(`こんどは「${suggestedNext}」を ためしてみよう！`);
  };

  const isQuotientDigitCorrect = (colIdx: number) => {
    const userDigit = gridData[0]?.values?.[colIdx];
    const matchingStep = realSteps.find((s) => s.index === colIdx);
    if (!matchingStep) return userDigit === null || userDigit === undefined;
    return userDigit === matchingStep.quotient;
  };

  const finish = () => {
    setIsFinished(true);
    setSubStep('DIVIDE');
    onComplete(mistakeCount === 0);
  };

  const doGrading = () => {
    let errorsFound = false;
    for (let i = 0; i < dividendStr.length; i++) {
      if (!isQuotientDigitCorrect(i)) errorsFound = true;
    }
    for (let rowIdx = 2; rowIdx < gridData.length; rowIdx++) {
      const row = gridData[rowIdx];
      const valStr = (row.value ?? '').toString();
      if (valStr !== getRowCorrectValue(rowIdx)) errorsFound = true;
    }
    setIsGraded(true);
    setHasMistakes(errorsFound);
    if (!errorsFound) {
      setIsFinished(true);
      onComplete(mistakeCount === 0);
    } else {
      onComplete(false);
    }
  };

  const handleKeypad = (val: string) => {
    if (isFinished || isAllEntered) return;
    if (subStep === 'BRING_DOWN' || subStep === 'PLACE') return;
    if (rollbackPrompt) return;
    setUserInput((prev) => prev + val);
  };

  const handleBackspace = () => {
    if (isAllEntered || isFinished) return;
    setUserInput((prev) => prev.slice(0, -1));
  };

  const triggerError = (msg?: string) => {
    setMistakeCount((prev) => prev + 1);
    setHintRevealed(true);
    if (msg) setFeedback(msg);
    const el = document.getElementById('lds-input-area');
    el?.classList.add('lds-shake');
    setTimeout(() => el?.classList.remove('lds-shake'), 500);
    setUserInput('');
  };

  const checkAnswer = () => {
    if (!activeStep || isProcessing.current || subStep === 'PLACE' || rollbackPrompt) return;

    if (subStep === 'DIVIDE') {
      const inputVal = parseInt(userInput, 10);
      if (activeStep.type === 'ZERO') {
        if (inputVal === 0) {
          writeQuotient(0);
          setUserInput('');
          if (zeroShortcut) {
            if (stepIndex < realSteps.length - 1) setSubStep('BRING_DOWN');
            else finish();
          } else {
            setSubStep('MULTIPLY');
          }
        } else {
          triggerError(`${activeStep.dividendPart} は ${divisor} より小さくて、1つも分けられないね。\n分けられないときは、商に「0」を立てるよ。`);
        }
        return;
      }

      if (isTwoDigitDivisor) {
        const trueQ = activeStep.quotient;
        if (inputVal >= 1 && inputVal <= 9 && Math.abs(inputVal - trueQ) <= 2) {
          setTrialQuotient(inputVal);
          writeQuotient(inputVal);
          setUserInput('');
          setSubStep('MULTIPLY');
        } else {
          triggerError(`見当をつけてみよう！\n${divisor} を ${roundedDivisor} とみると、\n${activeStep.dividendPart} ÷ ${roundedDivisor} で だいたい いくつかな？`);
        }
        return;
      }

      if (inputVal === activeStep.quotient) {
        writeQuotient(activeStep.quotient);
        setUserInput('');
        setSubStep('MULTIPLY');
      } else {
        let msg = 'おしい！ もう一度考えてみよう。';
        if (inputVal < activeStep.quotient) msg = 'もっと大きく わけられそうだよ！\n（あまりが わる数より大きくなっちゃうよ）';
        else if (inputVal > activeStep.quotient) msg = 'ちょっと 大きすぎたかも？\n（下のひき算が できなくなっちゃうよ）';
        triggerError(msg);
      }
    } else if (subStep === 'MULTIPLY') {
      const q = trialQuotient ?? activeStep.quotient;
      const expectedProduct = divisor * q;
      if (parseInt(userInput, 10) === expectedProduct) {
        setGridData((prev) => [...prev, { type: 'multiply', value: userInput, offset: activeStep.index }]);
        setUserInput('');
        if (expectedProduct > activeStep.dividendPart) {
          setRollbackPrompt({
            message: `${activeStep.dividendPart} から ${expectedProduct} は ひけない！\n仮の商「${q}」は 大きすぎたみたい。`,
            buttonLabel: `${q} を消して ${q - 1} でやりなおす`,
            action: () => rollbackTrial(q - 1, 1),
          });
        } else {
          setSubStep('SUBTRACT');
        }
      } else {
        triggerError('かけ算を もういちど かくにんしてみよう！');
      }
    } else if (subStep === 'SUBTRACT') {
      const q = trialQuotient ?? activeStep.quotient;
      const expectedProduct = divisor * q;
      const expectedRemainder = activeStep.dividendPart - expectedProduct;
      if (parseInt(userInput, 10) === expectedRemainder) {
        setGridData((prev) => [...prev, { type: 'remainder', value: userInput, offset: activeStep.index }]);
        setUserInput('');
        if (expectedRemainder >= divisor) {
          setRollbackPrompt({
            message: `あまりの ${expectedRemainder} が、わる数の ${divisor} と同じか大きいよ。\nまだ ${divisor} を ひけるね。仮の商「${q}」は 小さすぎたみたい。`,
            buttonLabel: `${q} を消して ${q + 1} でやりなおす`,
            action: () => rollbackTrial(q + 1, 2),
          });
          return;
        }
        setTrialQuotient(null);
        if (stepIndex < realSteps.length - 1) setSubStep('BRING_DOWN');
        else finish();
      } else {
        triggerError('ひき算を もういちど かくにんしてみよう！');
      }
    } else if (subStep === 'BRING_DOWN') {
      if (!nextStep) return;
      isProcessing.current = true;
      setGridData((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        const lastRow = next[lastIdx];
        if (lastRow && lastRow.type === 'remainder') {
          const remainderString = activeStep.remainder.toString();
          const nextDigit = dividendStr[nextStep.digitIndex];
          next[lastIdx] = { ...lastRow, value: (remainderString === '0' ? '' : remainderString) + nextDigit, offset: nextStep.digitIndex };
        }
        return next;
      });
      setTimeout(() => {
        setStepIndex((prev) => prev + 1);
        setSubStep('DIVIDE');
        setUserInput('');
        isProcessing.current = false;
      }, 300);
    }
  };

  const resetAll = () => {
    setGridData(buildInitialGrid());
    setStepIndex(0);
    setSubStep('PLACE');
    setUserInput('');
    setIsAllEntered(false);
    setIsGraded(false);
    setHasMistakes(null);
    setPlaceMistakes(0);
    setTrialQuotient(null);
    setRollbackPrompt(null);
    setSelectedCell(masterMode ? 'q-0' : null);
  };

  // --- マスターモード専用: マスを自由に選んで入力する ---
  const masterRowIndexOf = (key: string): number => {
    if (key.startsWith('m-') || key.startsWith('r-')) {
      const stepIdx = parseInt(key.slice(2), 10);
      const metaIdx = expectedRowMeta.findIndex((r) => r.stepIndex === stepIdx && r.type === (key.startsWith('m-') ? 'multiply' : 'remainder'));
      return metaIdx >= 0 ? metaIdx + 2 : -1;
    }
    return -1;
  };

  const handleMasterDigit = (d: string) => {
    if (!selectedCell || isFinished) return;
    if (selectedCell.startsWith('q-')) {
      const col = parseInt(selectedCell.slice(2), 10);
      setGridData((prev) => {
        const next = [...prev];
        if (next[0]) {
          const newValues = [...(next[0].values || [])];
          newValues[col] = parseInt(d, 10);
          next[0] = { ...next[0], values: newValues };
        }
        return next;
      });
      return;
    }
    const rowIdx = masterRowIndexOf(selectedCell);
    if (rowIdx < 0) return;
    setGridData((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      if (row) {
        const cur = (row.value ?? '').toString();
        next[rowIdx] = { ...row, value: cur + d };
      }
      return next;
    });
  };

  const handleMasterBackspace = () => {
    if (!selectedCell || isFinished) return;
    if (selectedCell.startsWith('q-')) {
      const col = parseInt(selectedCell.slice(2), 10);
      setGridData((prev) => {
        const next = [...prev];
        if (next[0]) {
          const newValues = [...(next[0].values || [])];
          newValues[col] = null;
          next[0] = { ...next[0], values: newValues };
        }
        return next;
      });
      return;
    }
    const rowIdx = masterRowIndexOf(selectedCell);
    if (rowIdx < 0) return;
    setGridData((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      if (row) {
        const cur = (row.value ?? '').toString();
        next[rowIdx] = { ...row, value: cur.slice(0, -1) };
      }
      return next;
    });
  };

  if (masterMode) {
    return (
      <div className="w-full flex flex-col gap-3">
        <style>{`
          @keyframes lds-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
          .lds-shake { animation: lds-shake 0.2s ease-in-out infinite; }
        `}</style>

        <div className="bg-gradient-to-br from-indigo-950/40 to-amber-950/40 p-4 rounded-2xl border border-red-500/20">
          <h3 className="text-amber-300 font-black text-sm mb-1">👑 マスターモード</h3>
          <p className="text-red-200/80 font-bold text-xs leading-relaxed">
            ヒントはなしだよ！マスをタップして、じぶんで じゅんばんを決めながら すべてうめてね。うめおわったら「答え合わせ」だよ。
          </p>
        </div>

        <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
          <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
            <div id="lds-quotient-row" className="grid items-center text-center" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
              <div />
              {dividendStr.split('').map((_, i) => {
                const key = `q-${i}`;
                const val = gridData[0]?.values?.[i];
                const isSelected = selectedCell === key;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isFinished}
                    onClick={() => setSelectedCell(key)}
                    className={`w-9 h-11 flex items-center justify-center relative rounded-lg border-2 border-dashed transition-all ${
                      isSelected ? 'border-red-400 bg-red-500/10 ring-2 ring-red-400 ring-inset' : 'border-amber-400/40 bg-amber-500/5 hover:bg-amber-500/10'
                    }`}
                  >
                    {isGraded ? (
                      <span className={isQuotientDigitCorrect(i) ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold bg-rose-950/60 px-1 rounded'}>{val ?? ''}</span>
                    ) : (
                      <span className="text-white">{val ?? ''}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid items-center text-center relative h-11" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
              <div className="col-start-1 flex justify-end pr-2 text-white font-bold border-r-4 border-white h-full items-center">{divisor}</div>
              <div className="absolute right-0 top-0 border-t-4 border-white" style={{ left: divisorColPx - 2 }} />
              {dividendStr.split('').map((d, i) => (
                <div key={i} className="w-9 h-11 flex items-center justify-center relative font-bold text-white">{d}</div>
              ))}
            </div>

            <div className="relative">
              {gridData.slice(2).map((row, idx) => {
                const rowIdx = idx + 2;
                const meta = expectedRowMeta[idx];
                const key = meta ? `${meta.type === 'multiply' ? 'm' : 'r'}-${meta.stepIndex}` : '';
                const isSelected = selectedCell === key;
                return (
                  <div key={idx} className="grid items-center text-center relative h-11" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
                    {row.type === 'multiply' && <div className="absolute right-0 bottom-0 border-b border-red-500/30" style={{ left: divisorColPx }} />}
                    <div className="col-start-1 text-red-500/70 font-bold text-lg flex justify-end pr-2">
                      {row.type === 'multiply' ? '×' : '-'}
                    </div>
                    <button
                      type="button"
                      disabled={isFinished}
                      onClick={() => setSelectedCell(key)}
                      className={`col-span-full row-start-1 absolute inset-0 rounded-xl border-2 border-dashed transition-all ${
                        isSelected ? 'border-red-400 bg-red-500/5 ring-2 ring-red-400/40 ring-inset' : 'border-transparent hover:bg-slate-900/40'
                      }`}
                      style={{ gridColumn: `2 / span ${dividendStr.length}` }}
                      title="タップして このマスを えらぶ"
                    />
                    {Array(dividendStr.length).fill(0).map((_, dividendIdx) => {
                      const valStr = (row.value ?? '').toString();
                      const offset = row.offset ?? 0;
                      const digitsNeeded = valStr.length || 1;
                      const startIdx = offset - digitsNeeded + 1;
                      const char = dividendIdx >= startIdx && dividendIdx <= offset ? valStr[dividendIdx - startIdx] : '';
                      if (isGraded) {
                        const correctVal = getRowCorrectValue(rowIdx);
                        const expectedDigitsNeeded = correctVal.length;
                        const expectedStartIdx = offset - expectedDigitsNeeded + 1;
                        const expectedChar = dividendIdx >= expectedStartIdx && dividendIdx <= offset ? correctVal[dividendIdx - expectedStartIdx] : '';
                        const isCharCorrect = char === expectedChar;
                        return (
                          <div key={dividendIdx} className="w-9 h-11 flex justify-center items-center relative pointer-events-none">
                            {char && <span className={isCharCorrect ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold bg-rose-950/60 px-1 rounded'}>{char}</span>}
                          </div>
                        );
                      }
                      return (
                        <div key={dividendIdx} className="w-9 h-11 flex justify-center items-center relative pointer-events-none">
                          <span className="text-white">{char}</span>
                          {isSelected && dividendIdx === offset && !char && <span className="text-red-800 animate-pulse">？</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isGraded && !hasMistakes && (
          <div className="flex flex-col items-center p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center">
            <span className="text-4xl mb-2">🏆</span>
            <h3 className="text-lg font-black text-emerald-300 mb-1">パーフェクト！</h3>
            <p className="text-emerald-400/80 text-sm font-bold">全問せいかいです！</p>
          </div>
        )}

        {isGraded && hasMistakes && (
          <div className="flex flex-col items-center p-5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-center gap-3">
            <span className="text-4xl">💡</span>
            <h3 className="text-lg font-black text-rose-300">おしい！</h3>
            <p className="text-rose-300/80 text-xs font-bold leading-relaxed">赤いマスのまちがっている数字を、もういちど見なおしてみてね。</p>
            <button onClick={() => setIsGraded(false)} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black transition-all active:scale-95">
              まちがいをなおす
            </button>
            <button onClick={resetAll} className="w-full py-2 bg-slate-900 border border-red-500/20 text-red-200 rounded-xl font-bold transition-all">
              はじめからやりなおす
            </button>
          </div>
        )}

        {!isGraded && !isFinished && (
          <div id="lds-input-area" className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => handleMasterDigit(n.toString())}
                  className="h-12 bg-slate-900/60 hover:bg-red-900/40 active:bg-red-600 active:text-white border border-red-900/50 rounded-xl text-xl font-black text-white transition-all"
                >
                  {n}
                </button>
              ))}
              <button onClick={handleMasterBackspace} className="h-12 bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all">
                ⌫
              </button>
            </div>
            <button
              onClick={doGrading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-[0.98]"
            >
              答え合わせをする
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <style>{`
        @keyframes lds-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .lds-shake { animation: lds-shake 0.2s ease-in-out infinite; }
      `}</style>

      <div className="text-center text-xs font-bold text-red-400/80 uppercase tracking-widest">
        {['たてる', 'かける', 'ひく', 'おろす'].map((s, i) => {
          const stepWords: StepType[] = ['DIVIDE', 'MULTIPLY', 'SUBTRACT', 'BRING_DOWN'];
          const isActive = subStep === stepWords[i] || (subStep === 'PLACE' && i === 0);
          return (
            <span
              key={s}
              className={`inline-block mx-1 px-2 py-1 rounded-lg ${isActive ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-red-800'}`}
            >
              {s}
            </span>
          );
        })}
      </div>

      {feedback && (
        <div
          onClick={() => setFeedback(null)}
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 cursor-pointer"
        >
          <div className="bg-slate-950 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border-2 border-amber-400/60">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="text-lg font-black text-amber-200 mb-4 whitespace-pre-wrap leading-relaxed">{feedback}</h3>
            <button onClick={() => setFeedback(null)} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition-all active:scale-95">
              わかった！
            </button>
          </div>
        </div>
      )}

      {rollbackPrompt && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-950 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border-2 border-rose-500/60">
            <div className="text-4xl mb-3">🤔</div>
            <h3 className="text-base font-black text-rose-200 mb-2 whitespace-pre-wrap leading-relaxed">{rollbackPrompt.message}</h3>
            <p className="text-red-300/70 text-xs font-bold mb-5">まちがいに気づけたのがすごい！けしゴムで消して、立て直そう。</p>
            <button onClick={rollbackPrompt.action} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition-all active:scale-95">
              {rollbackPrompt.buttonLabel}
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
        <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
          <div id="lds-quotient-row" className="grid items-center text-center" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
            <div />
            {dividendStr.split('').map((_, i) => {
              if (subStep === 'PLACE' && !isFinished) {
                return (
                  <button
                    key={i}
                    onClick={() => handlePlaceTap(i)}
                    className="w-9 h-11 flex items-center justify-center border-2 border-dashed border-amber-400 bg-amber-500/10 rounded-lg text-amber-400 text-lg font-black hover:bg-amber-500/20 active:scale-95 transition-all"
                  >
                    ？
                  </button>
                );
              }
              const userVal = gridData[0]?.values?.[i];
              const isActiveCol = subStep === 'DIVIDE' && activeStep?.index === i;
              return (
                <div key={i} className={`w-9 h-11 flex items-center justify-center relative ${isActiveCol ? 'bg-red-500/10 ring-2 ring-red-400 ring-inset rounded-lg' : ''}`}>
                  {userVal != null ? (
                    <span className={trialQuotient !== null && activeStep?.index === i && !isFinished ? 'text-amber-400 border-b-2 border-dotted border-amber-400' : ''}>{userVal}</span>
                  ) : (
                    isActiveCol && <span className="text-red-400 animate-pulse">{userInput || '？'}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid items-center text-center relative h-11" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
            <div className="col-start-1 flex justify-end pr-2 text-white font-bold border-r-4 border-white h-full items-center">{divisor}</div>
            <div className="absolute right-0 top-0 border-t-4 border-white" style={{ left: divisorColPx - 2 }} />
            {dividendStr.split('').map((d, i) => {
              const isBeingUsed = !isFinished && subStep === 'DIVIDE' && i <= (activeStep?.index ?? -1) && i >= (stepIndex === 0 ? 0 : realSteps[stepIndex - 1].index + 1);
              return (
                <div key={i} className={`w-9 h-11 flex items-center justify-center relative font-bold text-white ${isBeingUsed ? 'bg-amber-500/10 text-amber-300' : ''}`}>
                  {subStep === 'BRING_DOWN' && nextStep?.digitIndex === i ? (
                    <button
                      type="button"
                      onClick={() => !isProcessing.current && checkAnswer()}
                      className="bg-red-600 text-white w-8 h-8 flex items-center justify-center rounded-md shadow-lg animate-bounce active:scale-90 transition-transform cursor-pointer"
                      title="タップして おろす"
                    >
                      {d}
                    </button>
                  ) : (
                    <span className={subStep === 'BRING_DOWN' && nextStep?.digitIndex === i ? 'opacity-20' : ''}>{d}</span>
                  )}
                  {isBeingUsed && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-amber-400 rounded-full" />}
                </div>
              );
            })}
          </div>

          <div className="relative">
            {gridData.slice(2).map((row, idx) => {
              const rowIdx = idx + 2;
              const isLastRow = idx === gridData.length - 3;
              return (
                <div key={idx} className="grid items-center text-center relative h-11" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
                  {row.type === 'multiply' && <div className="absolute right-0 bottom-0 border-b border-red-500/30" style={{ left: divisorColPx }} />}
                  <div className="col-start-1 text-red-500/70 font-bold text-lg flex justify-end pr-2">
                    {row.type === 'multiply' ? '×' : idx > 0 && gridData.slice(2)[idx - 1].type === 'multiply' ? '-' : ''}
                  </div>
                  {Array(dividendStr.length).fill(0).map((_, dividendIdx) => {
                    const valStr = (row.value ?? '').toString();
                    const offset = row.offset ?? 0;
                    const digitsNeeded = valStr.length;
                    const startIdx = offset - digitsNeeded + 1;
                    const char = dividendIdx >= startIdx && dividendIdx <= offset ? valStr[dividendIdx - startIdx] : '';
                    const isActiveDigitInDivision = !isFinished && subStep === 'DIVIDE' && isLastRow && row.type === 'remainder' && dividendIdx >= startIdx && dividendIdx <= offset;
                    const isBringDownEmptySpot = subStep === 'BRING_DOWN' && row.type === 'remainder' && isLastRow && nextStep?.digitIndex === dividendIdx;
                    if (!char) {
                      return (
                        <div key={dividendIdx} className="w-9 h-11 flex justify-center items-center relative">
                          {isBringDownEmptySpot && (
                            <button
                              type="button"
                              onClick={() => !isProcessing.current && checkAnswer()}
                              className="absolute inset-1 border border-dashed border-red-400 rounded-md bg-red-500/10 flex items-center justify-center text-red-400 active:scale-90 transition-transform cursor-pointer"
                              title="タップして おろす"
                            >
                              ↓
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={dividendIdx} className="w-9 h-11 flex justify-center items-center relative">
                        <span className={isActiveDigitInDivision ? 'text-red-400 font-extrabold' : 'text-white'}>{char}</span>
                        {isActiveDigitInDivision && <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-red-400 rounded-full" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {!isFinished && (subStep === 'MULTIPLY' || subStep === 'SUBTRACT') && (
              <div className="grid items-center text-center relative h-11 bg-red-500/10 ring-2 ring-red-400/40 rounded-xl mx-1" style={{ gridTemplateColumns: `${divisorColPx}px repeat(${dividendStr.length}, 40px)` }}>
                <div className="col-start-1 text-red-400 font-bold text-lg flex justify-end pr-2">{subStep === 'MULTIPLY' ? '×' : '-'}</div>
                {Array(dividendStr.length).fill(0).map((_, dividendIdx) => {
                  const valStr = userInput;
                  const offset = activeStep?.index ?? 0;
                  const digitsNeeded = valStr.length || 1;
                  const startIdx = offset - digitsNeeded + 1;
                  const isTarget = dividendIdx >= startIdx && dividendIdx <= offset;
                  const char = isTarget ? valStr[dividendIdx - startIdx] : '';
                  return (
                    <div key={dividendIdx} className={`w-9 h-11 flex justify-center items-center ${isTarget ? 'bg-slate-900 ring-2 ring-red-400 ring-inset rounded-lg' : ''}`}>
                      <span className="text-red-300 font-black">{char}</span>
                      {isTarget && !char && dividendIdx === startIdx && <span className="text-red-800 animate-pulse">？</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isFinished && (
            <div className="mt-3 bg-red-600 text-white p-3 rounded-xl text-center inline-block">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-85">けいさん おわり！</div>
              <div className="text-xl font-black">あまり：{activeStep?.remainder ?? 0}</div>
            </div>
          )}
        </div>
      </div>

      {!isFinished && (
        <>
          {hintRevealed ? (
            <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
              <h3 className="text-red-300 font-black text-sm mb-1">💡 ヒント</h3>
              <p className="text-red-100/80 font-medium text-xs leading-relaxed whitespace-pre-line">
                {subStep === 'PLACE' && '商は どの位から 立てられるかな？\n上のてんせんのマスをタップしよう！'}
                {subStep === 'DIVIDE' && (activeStep?.type === 'ZERO'
                  ? `${activeStep?.dividendPart} の中に ${divisor} は あるかな？\nないときは どうするんだったかな？`
                  : isTwoDigitDivisor
                    ? `${activeStep?.dividendPart} の中に ${divisor} はいくつあるかな？\n${divisor} を ${roundedDivisor} とみて見当をつけよう。`
                    : `${activeStep?.dividendPart} の中に ${divisor} はいくつあるかな？`)}
                {subStep === 'MULTIPLY' && `${divisor} × ${trialQuotient ?? activeStep?.quotient} を けいさんしよう。`}
                {subStep === 'SUBTRACT' && `${activeStep?.dividendPart} − ${divisor * (trialQuotient ?? activeStep?.quotient ?? 0)} は？`}
                {subStep === 'BRING_DOWN' && 'つぎの かずを おろそう。'}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setHintRevealed(true)}
              className="w-full py-2.5 bg-slate-900/60 border border-red-500/20 text-red-300/80 rounded-xl text-xs font-black transition-all hover:bg-red-950/30"
            >
              💡 まずは じぶんで考えてみよう（ヒントを見る）
            </button>
          )}

          <div id="lds-input-area" className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => handleKeypad(n.toString())}
                  className="h-12 bg-slate-900/60 hover:bg-red-900/40 active:bg-red-600 active:text-white border border-red-900/50 rounded-xl text-xl font-black text-white transition-all"
                >
                  {n}
                </button>
              ))}
              <button onClick={handleBackspace} className="h-12 bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all">
                ⌫
              </button>
            </div>
            <button
              onClick={checkAnswer}
              disabled={userInput === '' && subStep !== 'BRING_DOWN'}
              className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${
                userInput !== '' || subStep === 'BRING_DOWN' ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-900 text-red-900'
              }`}
            >
              {subStep === 'BRING_DOWN' ? 'つぎへ' : 'チェック'}
            </button>
          </div>
        </>
      )}

      {isFinished && (
        <div className="flex flex-col items-center p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center">
          <span className="text-4xl mb-2">🎉</span>
          <h3 className="text-lg font-black text-emerald-300">せいかい！よくできました！</h3>
        </div>
      )}
    </div>
  );
};

export default LongDivisionSimulator;
