/**
 * components/guided/MultiplicationColumnSimulator.tsx
 *
 * 2桁×2桁・3桁×3桁など、暗算では非現実的なかけ算の筆算専用エンジン。
 * かける数の各位ごとに部分積を1つずつ入力・採点し(位がずれる筆算のかたち
 * をそのままマスに反映)、最後にすべての部分積をたした答えを入力する。
 * マスターモードでは 手順を示さず、マスを自由に選んで入力→最後に一括採点する。
 *
 * エビデンスA: Sweller & Cooper (1985) のワークトイグザンプル効果、
 * および Brown & VanLehn (1980) の「手続き的バグ」理論
 * (位をそろえ間違える・くり上げを忘れる、といった典型的な誤りは
 * 各部分積を個別に確認できるほうが早期に気づける)。
 */
import React, { useMemo, useState } from 'react';
import type { GuidedMultiplicationData } from '../../types';

interface Props {
  data: GuidedMultiplicationData;
  onComplete: (isCorrect: boolean) => void;
}

const MultiplicationColumnSimulator: React.FC<Props> = ({ data, onComplete }) => {
  const { a, b, masterMode = false } = data;
  const bStr = b.toString();
  const digitsOfB = bStr.split('').reverse().map(Number); // [ones, tens, hundreds, ...]
  const partials = useMemo(() => digitsOfB.map((d) => a * d), [a, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const finalAnswer = a * b;
  const needsSum = digitsOfB.length > 1;
  const totalWidth = Math.max(a.toString().length + bStr.length, finalAnswer.toString().length, ...partials.map((p) => p.toString().length));
  const rightOffset = totalWidth - 1;

  const CELL = 40;

  // --- 共通の採点判定 ---
  const isPartialCorrect = (idx: number, val: string) => val !== '' && parseInt(val, 10) === partials[idx];
  const isSumCorrect = (val: string) => val !== '' && parseInt(val, 10) === finalAnswer;

  // ============ マスターモード: 自由選択入力 ============
  const [masterAnswers, setMasterAnswers] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(needsSum ? 'p-0' : null);
  const [isGraded, setIsGraded] = useState(false);
  const [hasMistakes, setHasMistakes] = useState(false);
  const [finished, setFinished] = useState(false);

  const handleMasterDigit = (d: string) => {
    if (!selectedKey || finished) return;
    setMasterAnswers((prev) => ({ ...prev, [selectedKey]: (prev[selectedKey] ?? '') + d }));
  };
  const handleMasterBackspace = () => {
    if (!selectedKey || finished) return;
    setMasterAnswers((prev) => ({ ...prev, [selectedKey]: (prev[selectedKey] ?? '').slice(0, -1) }));
  };
  const doMasterGrading = () => {
    let errors = false;
    partials.forEach((p, idx) => {
      if (!isPartialCorrect(idx, masterAnswers[`p-${idx}`] ?? '')) errors = true;
    });
    if (needsSum && !isSumCorrect(masterAnswers.sum ?? '')) errors = true;
    setIsGraded(true);
    setHasMistakes(errors);
    setFinished(!errors);
    onComplete(!errors);
  };
  const resetMaster = () => {
    setMasterAnswers({});
    setIsGraded(false);
    setHasMistakes(false);
    setFinished(false);
    setSelectedKey(needsSum ? 'p-0' : null);
  };

  // ============ 通常モード: 部分積を1つずつ確認 → 最後に合計 ============
  const [stepIdx, setStepIdx] = useState(0); // 0..partials.length-1 は部分積、その後 'SUM'
  const [enteredPartials, setEnteredPartials] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [normalFinished, setNormalFinished] = useState(false);
  const [enteredSum, setEnteredSum] = useState('');

  const isSumStep = stepIdx >= partials.length;
  const currentDigit = digitsOfB[stepIdx];

  const handleKeypad = (d: string) => {
    if (normalFinished) return;
    setUserInput((prev) => prev + d);
  };
  const handleBackspace = () => {
    if (normalFinished) return;
    setUserInput((prev) => prev.slice(0, -1));
  };

  const shake = () => {
    const el = document.getElementById('mcs-input-area');
    el?.classList.add('mcs-shake');
    setTimeout(() => el?.classList.remove('mcs-shake'), 500);
  };

  const checkStep = () => {
    if (normalFinished || userInput === '') return;
    if (!isSumStep) {
      const digit = currentDigit;
      if (parseInt(userInput, 10) === a * digit) {
        setEnteredPartials((prev) => [...prev, userInput]);
        setUserInput('');
        setHintRevealed(false);
        if (stepIdx + 1 >= partials.length && !needsSum) {
          setNormalFinished(true);
          onComplete(mistakeCount === 0);
        } else {
          setStepIdx((prev) => prev + 1);
        }
      } else {
        setMistakeCount((prev) => prev + 1);
        setHintRevealed(true);
        setFeedback(`${a} × ${digit} を もういちど 計算してみよう。`);
        shake();
        setUserInput('');
      }
    } else {
      if (parseInt(userInput, 10) === finalAnswer) {
        setEnteredSum(userInput);
        setUserInput('');
        setNormalFinished(true);
        onComplete(mistakeCount === 0);
      } else {
        setMistakeCount((prev) => prev + 1);
        setHintRevealed(true);
        setFeedback('それぞれの部分積を たてに たしてみよう。くり上がりに 気をつけてね。');
        shake();
        setUserInput('');
      }
    }
  };

  const placeDigitLabel = ['一', '十', '百', '千', '万'];

  if (masterMode) {
    return (
      <div className="w-full flex flex-col gap-3">
        <style>{`
          @keyframes mcs-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
          .mcs-shake { animation: mcs-shake 0.2s ease-in-out infinite; }
        `}</style>

        <div className="bg-gradient-to-br from-indigo-950/40 to-amber-950/40 p-4 rounded-2xl border border-red-500/20">
          <h3 className="text-amber-300 font-black text-sm mb-1">👑 マスターモード</h3>
          <p className="text-red-200/80 font-bold text-xs leading-relaxed">
            ヒントはなしだよ！部分積のマスをタップして、じぶんで じゅんばんを決めながら すべてうめてね。うめおわったら「答え合わせ」だよ。
          </p>
        </div>

        <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
          <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
            <Row label="" valStr={a.toString()} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
            <div className="relative">
              <Row label="×" valStr={bStr} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} borderBottom />
            </div>
            {partials.map((_, idx) => {
              const key = `p-${idx}`;
              const isSelected = selectedKey === key;
              const val = masterAnswers[key] ?? '';
              return (
                <SelectableRow
                  key={key}
                  label={idx === 0 ? '' : ''}
                  valStr={val}
                  shift={idx}
                  totalWidth={totalWidth}
                  rightOffset={rightOffset}
                  cellW={CELL}
                  isSelected={isSelected}
                  onSelect={() => !finished && setSelectedKey(key)}
                  isGraded={isGraded}
                  correctVal={partials[idx].toString()}
                  disabled={finished}
                />
              );
            })}
            {needsSum && (
              <SelectableRow
                label=""
                valStr={masterAnswers.sum ?? ''}
                shift={0}
                totalWidth={totalWidth}
                rightOffset={rightOffset}
                cellW={CELL}
                isSelected={selectedKey === 'sum'}
                onSelect={() => !finished && setSelectedKey('sum')}
                isGraded={isGraded}
                correctVal={finalAnswer.toString()}
                disabled={finished}
                borderTop
              />
            )}
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
            <button onClick={resetMaster} className="w-full py-2 bg-slate-900 border border-red-500/20 text-red-200 rounded-xl font-bold transition-all">
              はじめからやりなおす
            </button>
          </div>
        )}

        {!isGraded && !finished && (
          <div id="mcs-input-area" className="flex flex-col gap-2">
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
              onClick={doMasterGrading}
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
        @keyframes mcs-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .mcs-shake { animation: mcs-shake 0.2s ease-in-out infinite; }
      `}</style>

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

      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
        <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
          <Row label="" valStr={a.toString()} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          <Row label="×" valStr={bStr} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} borderBottom />

          {enteredPartials.map((val, idx) => (
            <Row key={idx} label="" valStr={val} shift={idx} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          ))}

          {!isSumStep && !normalFinished && (
            <Row label="" valStr={userInput || '？'} shift={stepIdx} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} highlight />
          )}

          {needsSum && (enteredPartials.length === partials.length) && (
            <div className="border-t-2 border-white my-1" style={{ marginLeft: 0 }} />
          )}

          {normalFinished && needsSum && (
            <Row label="" valStr={enteredSum} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          )}
          {isSumStep && !normalFinished && (
            <Row label="" valStr={userInput || '？'} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} highlight />
          )}
        </div>
      </div>

      {normalFinished && (
        <div className="flex flex-col items-center p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center">
          <span className="text-4xl mb-2">🎉</span>
          <h3 className="text-lg font-black text-emerald-300">せいかい！よくできました！</h3>
        </div>
      )}

      {!normalFinished && (
        <>
          {hintRevealed ? (
            <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
              <h3 className="text-red-300 font-black text-sm mb-1">💡 ヒント</h3>
              <p className="text-red-100/80 font-medium text-xs leading-relaxed whitespace-pre-line">
                {!isSumStep
                  ? `${a} × ${currentDigit}(${placeDigitLabel[stepIdx] ?? ''}の位)を 計算しよう。`
                  : `部分積を すべて たてに たそう。${partials.join(' + ')} = ${finalAnswer}`}
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

          <p className="text-center text-xs text-red-300/70 font-bold">
            {!isSumStep ? `${a} × ${currentDigit}(${bStr.length - 1 - stepIdx === 0 ? '一' : placeDigitLabel[stepIdx]}の位)は？` : 'すべての部分積を たした 答えは？'}
          </p>

          <div id="mcs-input-area" className="flex flex-col gap-2">
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
              onClick={checkStep}
              disabled={userInput === ''}
              className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${
                userInput !== '' ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-900 text-red-900'
              }`}
            >
              チェック
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** 1行ぶんの数字を右づめ・位ずらしで描画する共通行コンポーネント */
const Row: React.FC<{
  label: string; valStr: string; shift: number; totalWidth: number; rightOffset: number; cellW: number;
  borderBottom?: boolean; highlight?: boolean;
}> = ({ label, valStr, shift, totalWidth, rightOffset, cellW, borderBottom, highlight }) => {
  const offset = rightOffset - shift;
  const startIdx = offset - valStr.length + 1;
  return (
    <div className={`grid items-center text-center relative h-11 ${borderBottom ? 'border-b-2 border-white' : ''}`} style={{ gridTemplateColumns: `28px repeat(${totalWidth}, ${cellW}px)` }}>
      <div className="text-red-400 font-black text-lg flex justify-end pr-1">{label}</div>
      {Array(totalWidth).fill(0).map((_, i) => {
        const inRange = i >= startIdx && i <= offset;
        const char = inRange ? valStr[i - startIdx] : '';
        return (
          <div key={i} className={`w-9 h-11 sm:w-10 flex items-center justify-center ${highlight && inRange ? 'bg-red-500/10 ring-2 ring-red-400 ring-inset rounded-lg' : ''}`}>
            <span className={highlight ? 'text-red-400 animate-pulse' : 'text-white'}>{char}</span>
          </div>
        );
      })}
    </div>
  );
};

/** マスターモード用: 行全体をタップで選択できる版 */
const SelectableRow: React.FC<{
  label: string; valStr: string; shift: number; totalWidth: number; rightOffset: number; cellW: number;
  isSelected: boolean; onSelect: () => void; isGraded: boolean; correctVal: string; disabled?: boolean;
  borderTop?: boolean;
}> = ({ label, valStr, shift, totalWidth, rightOffset, cellW, isSelected, onSelect, isGraded, correctVal, disabled, borderTop }) => {
  const offset = rightOffset - shift;
  const startIdx = offset - valStr.length + 1;
  const correctOffset = offset;
  const correctStartIdx = correctOffset - correctVal.length + 1;
  const isCorrect = isGraded && valStr !== '' && parseInt(valStr, 10) === parseInt(correctVal, 10);
  return (
    <div className={`grid items-center text-center relative h-11 ${borderTop ? 'border-t-2 border-white mt-1' : ''}`} style={{ gridTemplateColumns: `28px repeat(${totalWidth}, ${cellW}px)` }}>
      <div className="text-red-400 font-black text-lg flex justify-end pr-1">{label}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={`col-span-full row-start-1 absolute inset-0 rounded-xl border-2 border-dashed transition-all ${
          isSelected ? 'border-red-400 bg-red-500/5 ring-2 ring-red-400/40 ring-inset' : 'border-transparent hover:bg-slate-900/40'
        }`}
        style={{ gridColumn: `2 / span ${totalWidth}` }}
        title="タップして このマスを えらぶ"
      />
      {Array(totalWidth).fill(0).map((_, i) => {
        const inRange = i >= startIdx && i <= offset;
        const char = inRange ? valStr[i - startIdx] : '';
        if (isGraded && char) {
          return (
            <div key={i} className="w-9 h-11 sm:w-10 flex items-center justify-center relative pointer-events-none">
              <span className={isCorrect ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold bg-rose-950/60 px-1 rounded'}>{char}</span>
            </div>
          );
        }
        return (
          <div key={i} className="w-9 h-11 sm:w-10 flex items-center justify-center relative pointer-events-none">
            <span className="text-white">{char}</span>
            {isSelected && !char && i === offset && <span className="text-red-800 animate-pulse">？</span>}
          </div>
        );
      })}
    </div>
  );
};

export default MultiplicationColumnSimulator;
