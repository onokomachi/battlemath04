// エビデンスA: Fisher-Yates shuffle — 唯一の均一分布シャッフル
// sort(() => Math.random()-0.5) は偏りがある (Raymond Chen 2007)
export const shuffleDeck = <T,>(deck: T[]): T[] => {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
