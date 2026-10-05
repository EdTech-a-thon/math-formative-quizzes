import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

type Quiz = { id: string; teacher: string; data: { title: string; icon?: string } };
type Step = { quiz: string; progression: string; position: number };
type Progression = { id: string; class: string; name: string; operation?: string; icon?: string; shade?: string; standalone?: boolean };
type Class = { id: string; name: string };
type Enrollment = { progression: string; student: string; status: string };

export async function load({ cookies, params }) {
  const headers = { Authorization: teacherAuthorization(cookies) };
  const [quizzesResponse, stepsResponse, attemptsResponse, progressionsResponse, classesResponse, studentsResponse, enrollmentsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records?perPage=500&sort=name&fields=id,name&filter=${encodeURIComponent(`class="${params.id}"`)}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=2000&fields=progression,student,status`, { headers }),
  ]);
  if (!quizzesResponse.ok) error(500, "We could not load this class's quizzes.");
  // Quizzes belong to the teacher, so PocketBase's access rules already narrow
  // this to hers and there is nothing left to filter by class.
  const quizzes: Quiz[] = (await quizzesResponse.json()).items;
  const steps: Step[] = stepsResponse.ok ? (await stepsResponse.json()).items : [];
  const attempts = attemptsResponse.ok ? (await attemptsResponse.json()).items : [];
  // Every learning path of hers, not only this class's: one quiz can be used by
  // the paths of several classes, and the tags have to say which. A quiz given
  // out on its own is stored as a hidden single-quiz path, so those are split
  // off here: the tags and filter pills below are only ever about real paths,
  // and the hidden ones are read separately for who still has each quiz.
  const everyProgression: Progression[] = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const progressions = everyProgression.filter((progression) => progression.standalone !== true);
  const givenOnItsOwn = everyProgression.filter(
    (progression) => progression.standalone === true && progression.class === params.id,
  );
  const classNames = new Map<string, string>(
    (classesResponse.ok ? (await classesResponse.json()).items : []).map((held: Class) => [held.id, held.name]),
  );

  // The class's own students, both to hand to the picker and to put names to
  // the one-off assignments below.
  const students: { id: string; name: string }[] = studentsResponse.ok ? (await studentsResponse.json()).items : [];
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const enrollments: Enrollment[] = enrollmentsResponse.ok ? (await enrollmentsResponse.json()).items : [];

  // Who still owes her each quiz she gave out on its own, and who has finished
  // it. A hidden path has exactly one step, so its enrollments are that quiz's.
  // Students are listed by id; the page puts the names back in the order the
  // roster is already sorted in.
  const onItsOwn: Record<string, { outstanding: string[]; finished: string[] }> = {};
  for (const progression of givenOnItsOwn) {
    const step = steps.find((held) => held.progression === progression.id);
    if (!step) continue;
    const who = (onItsOwn[step.quiz] ??= { outstanding: [], finished: [] });
    for (const enrollment of enrollments) {
      if (enrollment.progression !== progression.id) continue;
      if (!studentNames.has(enrollment.student)) continue;
      (enrollment.status === "completed" ? who.finished : who.outstanding).push(enrollment.student);
    }
  }

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

  return { usage, quizzes: ordered, students, onItsOwn };
}
