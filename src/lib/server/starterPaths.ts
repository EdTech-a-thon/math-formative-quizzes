import addition from "../../../addition-0-to-12-progression.json";
import subtraction from "../../../subtraction-0-to-12-progression.json";
import multiplication from "../../../multiplication-0-to-12-progression.json";
import division from "../../../division-1-to-12-progression.json";
import { readProgressionRecord } from "$lib/server/exportRecord";
import { pocketBaseRequest } from "$lib/server/pocketbase";
import { saveQuiz } from "$lib/server/saveProgression";

const files = { addition, subtraction, multiplication, division };
export type StarterPath = keyof typeof files;

export function isStarterPath(value: unknown): value is StarterPath {
  return typeof value === "string" && Object.hasOwn(files, value);
}

export function starterProgression(key: StarterPath) {
  const progression = readProgressionRecord(files[key]);
  if (!progression) throw new Error(`The ${key} starter path could not be read.`);
  return progression;
}

export const starterPathKeys = Object.keys(files) as StarterPath[];

// Every teacher's library holds one copy of each ready-made quiz, marked with
// the path and position it came from ("multiplication:3"). Starting a class on
// a ready-made path reuses those copies — including any edits she has made —
// so she never ends up with a fresh set of the same quizzes per class. Any that
// are missing (she deleted one, or her account predates this) are added back.
export async function starterQuizIds(authorization: string, teacherId: string, key: StarterPath): Promise<string[]> {
  const inLibrary = await pocketBaseRequest<{ items: { id: string; starter: string }[] }>(
    `/api/collections/quizzes/records?perPage=500&fields=id,starter&filter=${encodeURIComponent(`starter ~ "${key}:"`)}`,
    { headers: { Authorization: authorization }, errorMessage: "We could not read your quiz library." },
  );
  const byStarter = new Map(inLibrary.items.map((quiz) => [quiz.starter, quiz.id]));
  const quizIds: string[] = [];
  for (const [index, quiz] of starterProgression(key).quizzes.entries()) {
    const starter = `${key}:${index + 1}`;
    quizIds.push(byStarter.get(starter) ?? (await saveQuiz(authorization, teacherId, quiz, starter)));
  }
  return quizIds;
}

// A teacher's quiz library starts with every ready-made quiz, so she can browse
// and edit them before building anything of her own. Run at each sign-in, it
// only acts on a library holding none of them — a new account, or one from
// before this existed — so a quiz she deleted on purpose stays deleted.
export async function fillEmptyStarterLibrary(authorization: string, teacherId: string) {
  const existing = await pocketBaseRequest<{ totalItems: number }>(
    `/api/collections/quizzes/records?perPage=1&fields=id&filter=${encodeURIComponent('starter != ""')}`,
    { headers: { Authorization: authorization }, errorMessage: "We could not read your quiz library." },
  );
  if (existing.totalItems > 0) return;
  for (const key of starterPathKeys) await starterQuizIds(authorization, teacherId, key);
}
