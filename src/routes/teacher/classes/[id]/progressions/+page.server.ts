import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const [quizzesResponse, progressionsResponse, stepsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&sort=position&expand=quiz`, { headers }),
  ]);
  if (!quizzesResponse.ok || !progressionsResponse.ok || !stepsResponse.ok) error(500, "We could not load progressions.");
  const quizzes = await quizzesResponse.json();
  const progressions = await progressionsResponse.json();
  const steps = await stepsResponse.json();
  const classQuizzes = quizzes.items.filter((quiz: { class: string }) => quiz.class === params.id);
  const classProgressions = progressions.items.filter((progression: { class: string }) => progression.class === params.id);
  const progressionIds = new Set(classProgressions.map((progression: { id: string }) => progression.id));
  return {
    quizzes: classQuizzes,
    progressions: classProgressions,
    steps: steps.items.filter((step: { progression: string }) => progressionIds.has(step.progression)),
  };
}
