import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

type Quiz = { id: string; class: string; data: unknown };
type Step = { quiz: string; progression: string; position: number };
type Progression = { id: string; class: string; name: string; operation?: string };

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const [quizzesResponse, stepsResponse, attemptsResponse, progressionsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500`, { headers }),
  ]);
  if (!quizzesResponse.ok) error(500, "We could not load this class's quizzes.");
  const quizzes: Quiz[] = (await quizzesResponse.json()).items.filter((quiz: Quiz) => quiz.class === params.id);
  const steps: Step[] = stepsResponse.ok ? (await stepsResponse.json()).items : [];
  const attempts = attemptsResponse.ok ? (await attemptsResponse.json()).items : [];
  const progressions: Progression[] = progressionsResponse.ok
    ? (await progressionsResponse.json()).items.filter((p: Progression) => p.class === params.id)
    : [];

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
  progressions.sort((a, b) => rankOf(a.operation) - rankOf(b.operation) || a.name.localeCompare(b.name));

  // Group quizzes under their progression, ordered by step position. A quiz can
  // appear in more than one progression; any quiz in none falls to the catch-all.
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const grouped = new Set<string>();
  const progressionGroups = progressions
    .map((progression) => {
      const orderedQuizzes = steps
        .filter((step) => step.progression === progression.id)
        .sort((a, b) => a.position - b.position)
        .map((step) => quizById.get(step.quiz))
        .filter((quiz): quiz is Quiz => Boolean(quiz));
      for (const quiz of orderedQuizzes) grouped.add(quiz.id);
      return { id: progression.id, name: progression.name, operation: progression.operation ?? "", quizzes: orderedQuizzes };
    })
    .filter((group) => group.quizzes.length);

  const ungrouped = quizzes.filter((quiz) => !grouped.has(quiz.id));

  return { usage, ungrouped, progressionGroups };
}
