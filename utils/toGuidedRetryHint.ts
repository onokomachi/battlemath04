/**
 * utils/toGuidedRetryHint.ts
 *
 * 既存の type:'text' Problem(質問文・SVG・選択肢・ヒント・正答はそのまま)を、
 * syo4-gaisu / syo4-bainomikata の RoundModule・TimesModule 等と同じ
 * 「正解するまでヒント付きでリトライ」インタラクションに載せかえる。
 * 問題の中身(数値・文章)は変えず、答え方のしくみだけを差し替える。
 */
import type { Problem } from '../types';

export function toGuidedRetryHint(p: Problem): Problem {
  const d = p.data as { question?: string; svg?: string; options?: string[]; multiple?: boolean; hint?: string | string[] };
  const hasRemainder = !d.options && /あまり/.test(p.answer);
  return {
    type: 'guided',
    data: {
      guidedKind: 'retry-hint',
      question: d.question,
      prompt: d.question ?? '',
      answer: p.answer,
      svg: d.svg,
      hint: d.hint ?? 'もういちど考えてみよう。',
      choices: d.options,
      choiceAnswerIndex: d.options ? d.options.indexOf(p.answer) : undefined,
      multiple: d.multiple,
      allowDecimal: /[.]/.test(p.answer),
      extraKeys: hasRemainder ? ['あまり'] : undefined,
    },
    answer: p.answer,
  };
}
