import { error, json } from "@sveltejs/kit";

const pocketBaseUrl = "http://127.0.0.1:8090";

function auth(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get("teacher_session");
  if (!token) error(401, "Please sign in again.");
  return `Bearer ${token}`;
}

export async function POST({ request, cookies }) {
  const authorization = auth(cookies);
  const body = await request.json();
  const students: string[] = Array.isArray(body.students) ? body.students.filter((id: unknown) => typeof id === "string" && id) : [];
  if (!body.progression || !students.length)
    return json({ message: "Pick a progression and at least one student." }, { status: 400 });

  const headers = { "Content-Type": "application/json", Authorization: authorization };

  // Start each new student on the progression's first step.
  const stepsResponse = await fetch(
    `${pocketBaseUrl}/api/collections/progression_steps/records?perPage=1&sort=position&filter=progression%3D%22${body.progression}%22`,
    { headers: { Authorization: authorization } },
  );
  const steps = await stepsResponse.json().catch(() => ({ items: [] }));
  const firstStep = steps.items?.[0]?.id as string | undefined;

  // Skip students already assigned so re-assigning is a no-op that never resets progress.
  const existingResponse = await fetch(
    `${pocketBaseUrl}/api/collections/progression_enrollments/records?perPage=1000&fields=student&filter=progression%3D%22${body.progression}%22`,
    { headers: { Authorization: authorization } },
  );
  const existing = await existingResponse.json().catch(() => ({ items: [] }));
  const assignedStudents = new Set<string>((existing.items ?? []).map((item: { student: string }) => item.student));
  const toAssign = students.filter((student) => !assignedStudents.has(student));

  let assigned = 0;
  for (const student of toAssign) {
    const response = await fetch(`${pocketBaseUrl}/api/collections/progression_enrollments/records`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        progression: body.progression,
        student,
        status: "active",
        released: false,
        ...(firstStep ? { currentStep: firstStep } : {}),
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return json({ message: result.message || "We could not assign every student.", assigned, skipped: students.length - toAssign.length }, { status: response.status });
    }
    assigned++;
  }

  return json({ assigned, skipped: students.length - toAssign.length });
}
