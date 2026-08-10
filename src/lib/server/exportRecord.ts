import { isShade, type ShadeId } from "$lib/shades";
import { readProblems, type Problem } from "$lib/quizProblems";

// The shape of the pdfcx record this app writes and reads. Keeping both
// directions in one file is what stops an export and an import drifting apart.
export type QuizRecord = {
  title: string;
  timeLimitMinutes: number;
  showScore: boolean;
  passMessage: string;
  icon: string | null;
  shade: ShadeId | null;
  problems: Problem[];
};
export type ProgressionRecord = {
  name: string;
  description: string;
  passPercentage: number;
  // True when students meet the questions one at a time rather than as a sheet.
  // It belongs to the path, so every step of it is sat the same way.
  oneAtATime: boolean;
  icon: string | null;
  shade: ShadeId | null;
  // A progression is only ever a series of quizzes, so they travel inline and
  // in order. An ordering on its own would refer to quizzes the far end has
  // never seen, so there is nothing useful to import.
  quizzes: QuizRecord[];
};

export type Envelope =
  | { pdfcx_version: 1; app: "fact-friends"; kind: "quiz"; exportedAt: string; quiz: QuizRecord }
  | { pdfcx_version: 1; app: "fact-friends"; kind: "progression"; exportedAt: string; progression: ProgressionRecord };

const MAX_QUESTIONS = 500;
const MAX_QUIZZES = 100;

function text(value: unknown, fallback = "", limit = 200): string {
  const out = typeof value === "string" ? value.trim() : "";
  return (out || fallback).slice(0, limit);
}
function shadeOf(value: unknown): ShadeId | null {
  return isShade(value) ? value : null;
}
function iconOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 60) : null;
}

// Everything below is fed by a file someone handed us, so each field is clamped
// to something sane rather than trusted.
export function readQuizRecord(value: unknown): QuizRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const problems = readProblems(raw.problems).slice(0, MAX_QUESTIONS);
  if (!problems.length) return null;
  return {
    title: text(raw.title, "Untitled quiz", 120),
    timeLimitMinutes: Math.min(60, Math.max(1, Math.round(Number(raw.timeLimitMinutes)) || 2)),
    showScore: raw.showScore !== false,
    passMessage: text(raw.passMessage, "Great work! You finished this quiz.", 120),
    icon: iconOf(raw.icon),
    shade: shadeOf(raw.shade),
    problems,
  };
}

export function readProgressionRecord(value: unknown): ProgressionRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const quizzes = (Array.isArray(raw.quizzes) ? raw.quizzes : [])
    .slice(0, MAX_QUIZZES)
    .map(readQuizRecord)
    .filter((quiz): quiz is QuizRecord => Boolean(quiz));
  if (!quizzes.length) return null;
  return {
    name: text(raw.name, "Untitled path", 120),
    description: text(raw.description, "", 200),
    passPercentage: Math.min(100, Math.max(1, Math.round(Number(raw.passPercentage)) || 80)),
    // Files written before this setting moved up here show the whole sheet.
    oneAtATime: raw.oneAtATime === true,
    icon: iconOf(raw.icon),
    shade: shadeOf(raw.shade),
    quizzes,
  };
}

// Read whatever came out of a PDF, or null when it is not something we can use.
export function readEnvelope(record: unknown): { kind: "quiz"; quiz: QuizRecord } | { kind: "progression"; progression: ProgressionRecord } | null {
  if (!record || typeof record !== "object") return null;
  const raw = record as Record<string, unknown>;

  if (raw.kind === "quiz") {
    const quiz = readQuizRecord(raw.quiz);
    return quiz ? { kind: "quiz", quiz } : null;
  }
  if (raw.kind === "progression") {
    const progression = readProgressionRecord(raw.progression);
    return progression ? { kind: "progression", progression } : null;
  }
  // No kind declared: accept anything shaped like one of ours anyway, so a
  // record hand-written by someone else still imports.
  const progression = readProgressionRecord(raw.progression ?? raw);
  if (progression) return { kind: "progression", progression };
  const quiz = readQuizRecord(raw.quiz ?? raw);
  return quiz ? { kind: "quiz", quiz } : null;
}

export function quizEnvelope(quiz: QuizRecord): Envelope {
  return { pdfcx_version: 1, app: "fact-friends", kind: "quiz", exportedAt: new Date().toISOString(), quiz };
}
export function progressionEnvelope(progression: ProgressionRecord): Envelope {
  return { pdfcx_version: 1, app: "fact-friends", kind: "progression", exportedAt: new Date().toISOString(), progression };
}
