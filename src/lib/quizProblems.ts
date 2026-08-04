export type Operation = "multiplication" | "division" | "addition" | "subtraction";
// A fact family plus the range of second operands to include, e.g. "multiply by
// 5" from 1 to 12 means 5×1 … 5×12. Older quizzes stored { group, questions };
// that shape is still accepted and normalised below.
export type FactGroup = { group: number; from: number; to: number };
export type StoredFactGroup = { group: number; from?: number; to?: number; questions?: number };
export type Problem = { top: number; bottom: number; sym: string; group: number };
export type BuildOptions = { cap?: number; seed?: number | null };

// A tiny seeded PRNG so a shuffled preview/printout is stable across re-renders
// (a fresh Math.random() shuffle would reorder on every keystroke).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bring any stored fact group into the { group, from, to } shape. A legacy
// { group, questions } becomes the range 1..questions so old quizzes still open.
export function normalizeGroup(item: StoredFactGroup): FactGroup {
  if (item.from != null && item.to != null) {
    return { group: item.group, from: Math.min(item.from, item.to), to: Math.max(item.from, item.to) };
  }
  const count = Math.max(1, item.questions ?? 1);
  return { group: item.group, from: 1, to: count };
}

// How many questions a single fact-group range produces.
export function groupCount(item: StoredFactGroup): number {
  const { from, to } = normalizeGroup(item);
  return Math.max(0, to - from + 1);
}

// Deterministically expand the chosen fact groups into the exact questions a
// student would see, one per number in each group's range. Each problem carries
// its source `group` so the editor can highlight a family's questions. `cap`
// limits how many are built (the preview caps for performance; the printout
// passes no cap so every question is on the page).
export function buildProblems(operation: Operation, groups: StoredFactGroup[], options: BuildOptions = {}): Problem[] {
  const { cap = Infinity, seed = null } = options;
  const out: Problem[] = [];
  for (const raw of groups) {
    const { group, from, to } = normalizeGroup(raw);
    for (let other = from; other <= to; other += 1) {
      if (operation === "multiplication") out.push({ top: group, bottom: other, sym: "×", group });
      else if (operation === "division") out.push({ top: group * other, bottom: group, sym: "÷", group });
      else if (operation === "addition") out.push({ top: group, bottom: other, sym: "+", group });
      else out.push({ top: group + other, bottom: group, sym: "−", group });
    }
  }
  // A seed reorders the whole worksheet; the same seed always yields the same
  // order, so the on-screen preview and the printout match for one shuffle.
  if (seed != null) {
    const random = mulberry32(seed >>> 0);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return cap === Infinity ? out : out.slice(0, cap);
}
