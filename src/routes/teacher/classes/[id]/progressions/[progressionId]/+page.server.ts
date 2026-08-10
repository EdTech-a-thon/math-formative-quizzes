import { error } from "@sveltejs/kit";
import type { Problem } from "$lib/quizProblems";

const pocketBaseUrl = "http://127.0.0.1:8090";

type Step = { id: string; quiz: string; position: number };

export async function load({ cookies, params }) {
  const headers = { Authorization: `Bearer ${cookies.get("teacher_session")}` };
  const [progressionResponse, quizzesResponse, stepsResponse, enrollmentsResponse, studentsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records/${params.progressionId}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/quizzes/records?perPage=500`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=500&sort=position&filter=${encodeURIComponent(`progression="${params.progressionId}"`)}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=2000&expand=student,currentStep&filter=${encodeURIComponent(`progression="${params.progressionId}"`)}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records?perPage=500&sort=name&filter=${encodeURIComponent(`class="${params.id}"`)}`, { headers }),
  ]);
  if (progressionResponse.status === 404) error(404, "Progression not found.");
  if (!progressionResponse.ok) error(500, "We could not load this progression.");
  const progression = await progressionResponse.json();
  if (progression.class !== params.id) error(404, "Progression not found.");
  if (!quizzesResponse.ok) error(500, "We could not load this class's quizzes.");
  if (!stepsResponse.ok) error(500, "We could not load this progression's steps.");
  if (!enrollmentsResponse.ok) error(500, "We could not load student progress.");

  const quizzes = (await quizzesResponse.json()).items.filter((quiz: { class: string }) => quiz.class === params.id);
  const steps: Step[] = (await stepsResponse.json()).items.sort((a: Step, b: Step) => a.position - b.position);
  const quizById = new Map(quizzes.map((quiz: { id: string }) => [quiz.id, quiz]));
  const enrollmentItems = enrollmentsResponse.ok ? (await enrollmentsResponse.json()).items : [];
  // The whole class roster, so the page can offer the students who are not on
  // this path yet.
  const classStudents = studentsResponse.ok ? (await studentsResponse.json()).items : [];

  return {
    quizzes,
    students: (classStudents as { id: string; name: string; loginName: string }[]).map((student) => ({
      id: student.id,
      name: student.name,
      loginName: student.loginName,
    })),
    progression: {
      id: progression.id,
      name: progression.name,
      description: progression.description ?? "",
      passPercentage: progression.passPercentage,
      oneAtATime: progression.oneAtATime === true,
      icon: progression.icon ?? null,
      shade: progression.shade || null,
      quizIds: steps.map((step) => step.quiz),
    },
    steps: steps.map((step) => {
      const quiz = quizById.get(step.quiz) as { data?: { title?: string; problems?: Problem[] } } | undefined;
      return { id: step.id, quizId: step.quiz, position: step.position, title: quiz?.data?.title ?? "Quiz", questionCount: (quiz?.data?.problems ?? []).length };
    }),
    enrollments: enrollmentItems.map((enrollment: { id: string; currentStep: string; status: string; released: boolean; expand?: { student?: { id: string; name: string }; currentStep?: { position: number } } }) => ({
      id: enrollment.id,
      studentId: enrollment.expand?.student?.id ?? "",
      studentName: enrollment.expand?.student?.name ?? "Student",
      currentStep: enrollment.currentStep,
      position: enrollment.expand?.currentStep?.position ?? 1,
      status: enrollment.status,
      released: enrollment.released,
    })).sort((a: { studentName: string }, b: { studentName: string }) => a.studentName.localeCompare(b.studentName)),
  };
}
