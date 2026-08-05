import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

type Quiz = { id: string; class: string; data: { title: string; icon?: string } };
type Step = { quiz: string; progression: string; position: number };
type Progression = { id: string; class: string; name: string; operation?: string; icon?: string; shade?: string };

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

  // Tag every quiz with the progressions it belongs to, and remember where it
  // first shows up so the flat list can be ordered by that membership: quizzes
  // sit under the progression that uses them, in step order, and quizzes in no
  // progression fall to the end.
  const quizIds = new Set(quizzes.map((quiz) => quiz.id));
  const membership = new Map<string, { id: string; name: string; operation: string; icon: string; shade: string }[]>();
  const rank = new Map<string, [number, number]>();
  progressions.forEach((progression, progressionIndex) => {
    const ordered = steps
      .filter((step) => step.progression === progression.id && quizIds.has(step.quiz))
      .sort((a, b) => a.position - b.position);
    ordered.forEach((step, stepIndex) => {
      const entry = { id: progression.id, name: progression.name, operation: progression.operation ?? "", icon: progression.icon ?? "", shade: progression.shade ?? "" };
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
