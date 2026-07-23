import type { Problem } from '../types';
import {
  fractionBasicsProblems,
  fractionKindsProblems,
  fractionConversionProblems,
  fractionSizeProblems,
  fractionAdditionProblems,
  fractionSubtractionProblems,
  fractionApplicationProblems,
} from './fractionProblems';
import { bigNumberProblems } from './bigNumberProblems';
import { graphTableProblems } from './graphTableProblems';
import { division1Problems, division2Problems } from './divisionProblems';
import { angleProblems } from './angleProblems';
import { decimalProblems, decimalMulDivProblems } from './decimalProblems';
import { roundingProblems } from './roundingProblems';
import { calcRulesProblems, areaProblems, changeProblems, solidProblems } from './mixedUnitsProblems';
import { ratioProblems } from './ratioProblems';

/** サブトピック名 → 問題配列(小4全14単元を統合)。練習モード・スピードデュエル・本番テストの出題元。 */
export const ALL_PROBLEM_SETS: Record<string, Problem[]> = {
  ...bigNumberProblems,
  ...graphTableProblems,
  ...division1Problems,
  ...angleProblems,
  ...decimalProblems,
  ...division2Problems,
  ...roundingProblems,
  ...calcRulesProblems,
  ...areaProblems,
  ...decimalMulDivProblems,
  ...fractionBasicsProblems,
  ...fractionKindsProblems,
  ...fractionConversionProblems,
  ...fractionSizeProblems,
  ...fractionAdditionProblems,
  ...fractionSubtractionProblems,
  ...fractionApplicationProblems,
  ...changeProblems,
  ...solidProblems,
  ...ratioProblems,
};
