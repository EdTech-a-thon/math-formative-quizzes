import { error } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

type Step = { quiz: string; progression: string };
type Progression = { id: string; class: string; name: string };
type Class = { id: string; name: string };

export async function load({ cookies, params }) {
  const headers = { Authorization: teacherAuthorization(cookies) };
  const [response, stepsResponse, progressionsResponse, classesResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records/${params.quizId}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&filter=${encodeURIComponent(`quiz="${params.quizId}"`)}`, { headers }),
    // How far an edit to this quiz reaches is counted in learning paths, so the
    // hidden single-quiz paths behind "assign on its own" are left out.
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500&filter=${encodeURIComponent("standalone != true")}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records?perPage=500`, { headers }),
  ]);
  if (response.status === 404) error(404, "Quiz not found.");
  if (!response.ok) error(500, "We could not load this quiz.");
  // A quiz is the teacher's, not the class's, so PocketBase's access rules are
  // the whole ownership check: another teacher's quiz comes back as a 404.
  const quiz = await response.json();

  // How far an edit here reaches: the classes whose learning paths use this
  // quiz. The editor shows this beside the title, before anything is changed.
  const steps: Step[] = stepsResponse.ok ? (await stepsResponse.json()).items : [];
  const progressions: Progression[] = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const classNames = new Map<string, string>(
    (classesResponse.ok ? (await classesResponse.json()).items : []).map((held: Class) => [held.id, held.name]),
  );
  const usedBy = new Set(steps.map((step) => step.progression));
  const reachedClasses = progressions.filter((progression) => usedBy.has(progression.id)).map((progression) => progression.class);
  const classes = [...new Set(reachedClasses)]
    .map((classId) => classNames.get(classId) ?? "Another class")
    .sort((a, b) => a.localeCompare(b));
  // Whether this class's own path is one of the ones using this quiz. "Make a
  // separate copy for this class" only makes sense when there is a step here
  // to repoint at the copy.
  const usedByCurrentClass = progressions.some((progression) => progression.class === params.id && usedBy.has(progression.id));

  return { quiz, reach: { classes, paths: usedBy.size, usedByCurrentClass } };
}
