import { error } from "@sveltejs/kit";
const pocketBaseUrl = "http://127.0.0.1:8090";

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const studentFilter = encodeURIComponent(`student="${params.studentId}"`);
  const [studentResponse, enrollmentsResponse, stepsResponse, attemptsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records/${params.studentId}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=500&expand=progression,currentStep,currentStep.quiz&filter=${studentFilter}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=2000`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quiz_attempts/records?perPage=500&sort=-completedAt&expand=quiz,progressionStep&filter=${studentFilter}`, { headers }),
  ]);

  if (studentResponse.status === 404) error(404, "Student not found.");
  if (!studentResponse.ok) error(500, "We could not load this student.");
  const student = await studentResponse.json();
  if (student.class !== params.id) error(404, "Student not found.");
  if (!enrollmentsResponse.ok || !stepsResponse.ok || !attemptsResponse.ok) error(500, "We could not load this student's progress.");

  const enrollmentItems = (await enrollmentsResponse.json()).items;
  const stepItems = (await stepsResponse.json()).items;
  const attemptItems = (await attemptsResponse.json()).items;
  const stepCount: Record<string, number> = {};
  for (const step of stepItems as { progression: string }[]) stepCount[step.progression] = (stepCount[step.progression] ?? 0) + 1;

  return {
    student: { id: student.id, name: student.name, loginName: student.loginName },
    enrollments: enrollmentItems.map((enrollment: {
      id: string;
      progression: string;
      status: string;
      released: boolean;
      expand?: {
        progression?: { name: string; icon?: string; shade?: string; operation?: string };
        currentStep?: { id: string; position: number; expand?: { quiz?: { data?: { title?: string } } } };
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
      expand?: { quiz?: { data?: { title?: string } }; progressionStep?: { position?: number } };
    }) => ({
      id: attempt.id,
      title: attempt.expand?.quiz?.data?.title ?? "Quiz",
      position: attempt.expand?.progressionStep?.position ?? null,
      correct: attempt.correct,
      total: attempt.total,
      passed: attempt.passed,
      leveledUp: attempt.leveledUp,
      completedAt: attempt.completedAt,
    })),
  };
}
