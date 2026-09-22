import { error } from "@sveltejs/kit";
import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

export async function load({ cookies, params }) {
  const headers = { Authorization: teacherAuthorization(cookies) };
  const studentFilter = encodeURIComponent(`student="${params.studentId}"`);
  const [studentResponse, enrollmentsResponse, stepsResponse, attemptsResponse, progressionsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records/${params.studentId}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=500&expand=progression,currentStep,currentStep.quiz&filter=${studentFilter}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=2000`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records?perPage=500&sort=-completedAt&expand=quiz,progressionStep,progressionStep.progression&filter=${studentFilter}`, { headers }),
    // Only real learning paths can be assigned from here: a quiz given out on
    // its own is a hidden single-quiz path, and offering those back would turn
    // this picker into a second, confusing copy of the quiz library.
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=200&sort=name&filter=${encodeURIComponent(`class="${params.id}" && standalone != true`)}`, { headers }),
  ]);

  if (studentResponse.status === 404) error(404, "Student not found.");
  if (!studentResponse.ok) error(500, "We could not load this student.");
  const student = await studentResponse.json();
  if (student.class !== params.id) error(404, "Student not found.");
  if (!enrollmentsResponse.ok || !stepsResponse.ok || !attemptsResponse.ok) error(500, "We could not load this student's progress.");

  const enrollmentItems = (await enrollmentsResponse.json()).items;
  const stepItems = (await stepsResponse.json()).items;
  const attemptItems = (await attemptsResponse.json()).items;
  const progressionItems = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const stepCount: Record<string, number> = {};
  for (const step of stepItems as { progression: string }[]) stepCount[step.progression] = (stepCount[step.progression] ?? 0) + 1;

  return {
    student: {
      id: student.id,
      name: student.name,
      loginName: student.loginName,
      extraTimeMinutes: Number(student.accommodations?.extraTimeMinutes) || 0,
    },
    // Every path in this class, so the page can offer the ones this student is
    // not on yet.
    progressions: (progressionItems as { id: string; name: string; operation?: string; shade?: string }[]).map((progression) => ({
      id: progression.id,
      name: progression.name,
      operation: progression.operation ?? "",
      shade: progression.shade ?? "",
      stepCount: stepCount[progression.id] ?? 0,
    })),
    enrollments: enrollmentItems.map((enrollment: {
      id: string;
      progression: string;
      status: string;
      released: boolean;
      expand?: {
        progression?: { name: string; icon?: string; shade?: string; operation?: string; standalone?: boolean };
        currentStep?: { id: string; position: number; quiz?: string; expand?: { quiz?: { data?: { title?: string } } } };
      };
    }) => ({
      id: enrollment.id,
      progressionId: enrollment.progression,
      currentStep: enrollment.expand?.currentStep?.id ?? "",
      progressionName: enrollment.expand?.progression?.name ?? "Progression",
      icon: enrollment.expand?.progression?.icon ?? null,
      shade: enrollment.expand?.progression?.shade ?? null,
      operation: enrollment.expand?.progression?.operation ?? "",
      position: enrollment.expand?.currentStep?.position ?? 1,
      totalSteps: stepCount[enrollment.progression] ?? 0,
      // A quiz she gave this student on its own belongs here beside their
      // learning paths, but it is not one: no step count, and the card opens
      // the quiz rather than the hidden path holding it.
      standalone: enrollment.expand?.progression?.standalone === true,
      quizId: enrollment.expand?.currentStep?.quiz ?? "",
      currentQuiz: enrollment.expand?.currentStep?.expand?.quiz?.data?.title ?? "Current quiz",
      status: enrollment.status,
      released: enrollment.released,
    })),
    attempts: attemptItems.map((attempt: {
      id: string;
      correct: number;
      total: number;
      passed: boolean;
      leveledUp: boolean;
      completedAt: string;
      expand?: { quiz?: { data?: { title?: string } }; progressionStep?: { position?: number; expand?: { progression?: { standalone?: boolean } } } };
    }) => ({
      id: attempt.id,
      title: attempt.expand?.quiz?.data?.title ?? "Quiz",
      // A quiz sat on its own was not step anything, so the row leaves the step
      // off and reads as the plain attempt it was.
      position: attempt.expand?.progressionStep?.expand?.progression?.standalone === true
        ? null
        : attempt.expand?.progressionStep?.position ?? null,
      correct: attempt.correct,
      total: attempt.total,
      passed: attempt.passed,
      leveledUp: attempt.leveledUp,
      completedAt: attempt.completedAt,
    })),
  };
}
