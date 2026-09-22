import { error, redirect } from "@sveltejs/kit";

import { pocketBaseUrl, teacherAuthorization } from "$lib/server/pocketbase";

type Operation = "multiplication" | "division" | "addition" | "subtraction";

export async function load({ locals, cookies, params }) {
  if (!locals.teacher) redirect(303, "/teacher");

  const headers = { Authorization: teacherAuthorization(cookies) };
  const classFilter = encodeURIComponent(`class="${params.id}"`);
  // A quiz given to students on its own is stored as a hidden single-quiz
  // learning path, so every list of learning paths has to leave those out or
  // the teacher gets one per quiz she has handed out.
  const pathFilter = encodeURIComponent(`class="${params.id}" && standalone != true`);
  const nestedFilter = (path: string) => encodeURIComponent(`${path}.class="${params.id}"`);

  const [classResponse, studentsResponse, progressionsResponse, enrollmentsResponse, stepsResponse] = await Promise.all([
    globalThis.fetch(`${pocketBaseUrl}/api/collections/classes/records/${params.id}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/students/records?perPage=500&sort=name&filter=${classFilter}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progressions/records?perPage=200&sort=name&filter=${pathFilter}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=1000&expand=progression,currentStep&filter=${nestedFilter("student")}`, { headers }),
    globalThis.fetch(`${pocketBaseUrl}/api/collections/progression_steps/records?perPage=2000&filter=${nestedFilter("progression")}`, { headers }),
  ]);
  if (classResponse.status === 404) error(404, "Class not found.");
  if (!classResponse.ok) error(500, "We could not load this class.");
  if (!studentsResponse.ok) error(500, "We could not load this class roster.");

  const classRoom = await classResponse.json();
  const students = (await studentsResponse.json()).items;
  const progressionItems = progressionsResponse.ok ? (await progressionsResponse.json()).items : [];
  const enrollmentItems = enrollmentsResponse.ok ? (await enrollmentsResponse.json()).items : [];
  const stepItems = stepsResponse.ok ? (await stepsResponse.json()).items : [];

  const stepCount: Record<string, number> = {};
  for (const step of stepItems as { progression: string }[]) stepCount[step.progression] = (stepCount[step.progression] ?? 0) + 1;

  const progressions = (progressionItems as { id: string; name: string; operation: Operation; shade?: string }[]).map((progression) => ({
    id: progression.id,
    name: progression.name,
    operation: progression.operation,
    shade: progression.shade || "",
    stepCount: stepCount[progression.id] ?? 0,
  }));

  type EnrollmentRecord = {
    id: string;
    student: string;
    progression: string;
    status: string;
    released?: boolean;
    expand?: { progression?: { name: string; operation: Operation; shade?: string; icon?: string; standalone?: boolean }; currentStep?: { position: number; quiz?: string } };
  };
  const enrollments = (enrollmentItems as EnrollmentRecord[]).map((enrollment) => ({
    id: enrollment.id,
    student: enrollment.student,
    progression: enrollment.progression,
    name: enrollment.expand?.progression?.name ?? "Path",
    operation: enrollment.expand?.progression?.operation,
    shade: enrollment.expand?.progression?.shade || "",
    icon: enrollment.expand?.progression?.icon || "",
    position: enrollment.expand?.currentStep?.position ?? 1,
    totalSteps: stepCount[enrollment.progression] ?? 0,
    // A quiz she gave out on its own still belongs on the roster beside this
    // student's paths — it is work they owe her. It just is not a path, so the
    // chip points at the quiz and says nothing about steps.
    standalone: enrollment.expand?.progression?.standalone === true,
    quizId: enrollment.expand?.currentStep?.quiz ?? "",
    status: enrollment.status,
    released: Boolean((enrollment as EnrollmentRecord & { released?: boolean }).released),
  }));

  return { classRoom, students, progressions, enrollments };
}
