import { error } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const [quizzesResponse, progressionsResponse, stepsResponse, enrollmentsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&sort=position&expand=quiz`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=2000&fields=progression,status,released`, { headers }),
  ]);
  if (!quizzesResponse.ok || !progressionsResponse.ok || !stepsResponse.ok) error(500, "We could not load progressions.");
  const quizzes = await quizzesResponse.json();
  const progressions = await progressionsResponse.json();
  const steps = await stepsResponse.json();
  const enrollmentItems = enrollmentsResponse.ok ? (await enrollmentsResponse.json()).items : [];
  const classQuizzes = quizzes.items.filter((quiz: { class: string }) => quiz.class === params.id);

  // How many students are assigned to each progression.
  const studentCount: Record<string, number> = {};
  const waitingCount: Record<string, number> = {};
  const releasedCount: Record<string, number> = {};
  for (const enrollment of enrollmentItems as { progression: string; status: string; released: boolean }[]) {
    studentCount[enrollment.progression] = (studentCount[enrollment.progression] ?? 0) + 1;
    if (enrollment.status !== "active") continue;
    const counts = enrollment.released ? releasedCount : waitingCount;
    counts[enrollment.progression] = (counts[enrollment.progression] ?? 0) + 1;
  }

  const classProgressions = progressions.items
    .filter((progression: { class: string }) => progression.class === params.id)
    .map((progression: { id: string }) => ({
      ...progression,
      studentCount: studentCount[progression.id] ?? 0,
      waitingCount: waitingCount[progression.id] ?? 0,
      releasedCount: releasedCount[progression.id] ?? 0,
    }));
  const progressionIds = new Set(classProgressions.map((progression: { id: string }) => progression.id));
  return {
    quizzes: classQuizzes,
    progressions: classProgressions,
    steps: steps.items.filter((step: { progression: string }) => progressionIds.has(step.progression)),
  };
}
