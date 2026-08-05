export type Operation = "multiplication" | "division" | "addition" | "subtraction";
// One question in a quiz. Every problem carries its own operator, so a quiz is
// just a bucket of questions and can freely mix operations. The id keeps two
// identical questions apart while dragging and selecting.
export type Problem = { id: string; op: Operation; top: number; bottom: number };

export const operations: Operation[] = ["multiplication", "division", "addition", "subtraction"];

// `min`/`max` bound the fact family (the number you operate BY); `factorMin`/
// `factorMax` are the range a new fact set covers by default.
export const operationDetails: Record<Operation, { label: string; symbol: string; verb: string; min: number; max: number; factorMin: number; factorMax: number }> = {
  multiplication: { label: "Multiplication", symbol: "×", verb: "Multiply by", min: 0, max: 12, factorMin: 1, factorMax: 12 },
  division: { label: "Division", symbol: "÷", verb: "Divide by", min: 1, max: 12, factorMin: 1, factorMax: 12 },
  addition: { label: "Addition", symbol: "+", verb: "Add", min: 0, max: 20, factorMin: 1, factorMax: 12 },
  subtraction: { label: "Subtraction", symbol: "−", verb: "Subtract", min: 0, max: 9, factorMin: 1, factorMax: 12 },
};

export function symbolFor(op: Operation): string {
  return operationDetails[op]?.symbol ?? "";
}

// The answer a student should write. Fact sets are built so the top number is
// the larger one, so every operation reads top-then-bottom.
export function answerFor(problem: { op: Operation; top: number; bottom: number }): number {
  if (problem.op === "multiplication") return problem.top * problem.bottom;
  if (problem.op === "division") return problem.top / problem.bottom;
  if (problem.op === "addition") return problem.top + problem.bottom;
  return problem.top - problem.bottom;
}

// Questions a teacher types by hand have to stay in whole, non-negative
// territory: division must come out even, subtraction must not go below zero.
export function problemIsValid(op: Operation, top: number, bottom: number): boolean {
  if (!Number.isInteger(top) || !Number.isInteger(bottom)) return false;
  if (top < 0 || bottom < 0) return false;
  if (op === "division") return bottom > 0 && top % bottom === 0;
  if (op === "subtraction") return top - bottom >= 0;
  return true;
}

// Why a hand-typed question can't be added yet, or "" when it is fine.
export function problemProblem(op: Operation, top: number, bottom: number): string {
  if (!Number.isInteger(top) || !Number.isInteger(bottom) || top < 0 || bottom < 0) return "Use whole numbers.";
  if (op === "division" && bottom === 0) return "You cannot divide by zero.";
  if (op === "division") return top % bottom === 0 ? "" : "Pick numbers that divide evenly.";
  if (op === "subtraction") return top - bottom >= 0 ? "" : "Put the larger number first so the answer is not below zero.";
  return "";
}

// Ids only have to be unique within one quiz, so a counter plus a little
// randomness is plenty — and unlike crypto.randomUUID it works everywhere.
let counter = 0;
function newId(): string {
  counter += 1;
  return `q${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeProblem(op: Operation, top: number, bottom: number): Problem {
  return { id: newId(), op, top, bottom };
}

// Expand one fact family into questions, one per number in the range. Division
// and subtraction put the larger number on top so answers stay whole and
// non-negative: "divide by 3" over 1–12 is 3÷3, 6÷3, 9÷3 …
export function buildFactSet(op: Operation, family: number, from: number, to: number): Problem[] {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const out: Problem[] = [];
  for (let other = low; other <= high; other += 1) {
    if (op === "multiplication") out.push(makeProblem(op, family, other));
    else if (op === "division") out.push(makeProblem(op, family * other, family));
    else if (op === "addition") out.push(makeProblem(op, family, other));
    else out.push(makeProblem(op, family + other, family));
  }
  return out;
}

// Bring a stored problem back into shape, dropping anything unusable. Stored
// quizzes are free-form JSON, so this is the one place that trusts them.
export function readProblems(value: unknown): Problem[] {
  if (!Array.isArray(value)) return [];
  const out: Problem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, op, top, bottom } = item as Partial<Problem>;
    if (!op || !operations.includes(op)) continue;
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) continue;
    out.push({ id: typeof id === "string" && id ? id : newId(), op, top: Number(top), bottom: Number(bottom) });
  }
  return out;
}
