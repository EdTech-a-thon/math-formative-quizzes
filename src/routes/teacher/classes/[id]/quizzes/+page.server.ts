import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

type Quiz = { id: string; teacher: string; data: { title: string; icon?: string } };
type Step = { quiz: string; progression: string; position: number };
type Progression = { id: string; class: string; name: string; operation?: string; icon?: string; shade?: string };
type Class = { id: string; name: string };

export async function load({ cookies, params }) {
  const headers = { Authorization: teacherAuthorization(cookies) };
  const [quizzesResponse, stepsResponse, attemptsResponse, progressionsResponse, classesResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=500`, { headers }),
  ]);
  if (!quizzesResponse.ok) error(500, "We could not load this class's quizzes.");
  // Quizzes belong to the teacher, so PocketBase's access rules already narrow
  // this to hers and there is nothing left to filter by class.
  const quizzes: Quiz[] = (await quizzesResponse.json()).items;
  const steps: Step[] = stepsResponse.ok ? (await stepsResponse.json()).items : [];
  const attempts = attemptsResponse.ok ? (await attemptsResponse.json()).items : [];
  // Every learning path of hers, not only this class's: one quiz can be used by
  // the paths of several classes, and the tags have to say which.
  const progressions: Progression[] = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const classNames = new Map<string, string>(
    (classesResponse.ok ? (await classesResponse.json()).items : []).map((held: Class) => [held.id, held.name]),
  );

  // Count how many progressions and recorded attempts reference each quiz, so the
  // editor can warn before a delete cascades progression steps away.
  const usage: Record<string, { progressions: number; attempts: number }> = {};
  for (const step of steps) {
    (usage[step.quiz] ??= { progressions: 0, attempts: 0 }).progressions += 1;
  }
  for (const attempt of attempts as { quiz: string }[]) {
    (usage[attempt.quiz] ??= { progressions: 0, attempts: 0 }).attempts += 1;
  }

  // Show the operation ladders in the same order they're seeded in.
  const operationOrder = ["multiplication", "division", "addition", "subtraction"];
  const rankOf = (op?: string) => {
    const index = operationOrder.indexOf(op ?? "");
    return index === -1 ? operationOrder.length : index;
  };
  // The class she is standing in comes first, then her other classes by name,
  // so the list reads as "this class, then everywhere else this quiz is used".
  const classRankOf = (progression: Progression) => (progression.class === params.id ? "" : classNames.get(progression.class) ?? "~");
  progressions.sort(
    (a, b) =>
      classRankOf(a).localeCompare(classRankOf(b)) ||
      rankOf(a.operation) - rankOf(b.operation) ||
      a.name.localeCompare(b.name),
  );

  // Tag every quiz with the learning paths it belongs to and the class each of
  // those paths belongs to, and remember where it first shows up so the flat
  // list can be ordered by that membership: quizzes sit under the path that
  // uses them, in step order, quizzes used only by another class's path follow,
  // and quizzes in no path at all fall to the end.
  type Tag = { id: string; name: string; operation: string; icon: string; shade: string; className: string; thisClass: boolean };
  const quizIds = new Set(quizzes.map((quiz) => quiz.id));
  const membership = new Map<string, Tag[]>();
  const rank = new Map<string, [number, number]>();
  progressions.forEach((progression, progressionIndex) => {
    const ordered = steps
      .filter((step) => step.progression === progression.id && quizIds.has(step.quiz))
      .sort((a, b) => a.position - b.position);
    ordered.forEach((step, stepIndex) => {
      const entry: Tag = {
        id: progression.id,
        name: progression.name,
        operation: progression.operation ?? "",
        icon: progression.icon ?? "",
        shade: progression.shade ?? "",
        className: classNames.get(progression.class) ?? "Another class",
        thisClass: progression.class === params.id,
      };
      const tags = membership.get(step.quiz);
      if (tags) { if (!tags.some((tag) => tag.id === entry.id)) tags.push(entry); }
      else { membership.set(step.quiz, [entry]); rank.set(step.quiz, [progressionIndex, stepIndex]); }
    });
  });

  const ordered = quizzes
    .map((quiz) => ({ ...quiz, progressions: membership.get(quiz.id) ?? [] }))
    .sort((a, b) => {
      const [aProgression, aStep] = rank.get(a.id) ?? [progressions.length, 0];
      const [bProgression, bStep] = rank.get(b.id) ?? [progressions.length, 0];
      if (aProgression !== bProgression) return aProgression - bProgression;
      if (aStep !== bStep) return aStep - bStep;
      return a.data.title.localeCompare(b.data.title, undefined, { sensitivity: "base" });
    });

  return { usage, quizzes: ordered };
}
